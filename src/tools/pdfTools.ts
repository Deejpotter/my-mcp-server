/**
 * Local PDF receipt/invoice parsing tools.
 *
 * Parses machine-readable grocery PDFs locally using pdf-parse-new and a set of
 * receipt heuristics. This avoids quota-sensitive external model calls for the
 * common Woolworths-style invoice flow while keeping the MCP surface simple.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pdf from "pdf-parse-new";
import fs from "fs";
import path from "path";
import { genericLimiter } from "../utils/cache.js";

interface ReceiptItem {
	name: string;
	quantity: number;
	unit_price: number;
	total_price: number;
	category?: string;
}

interface ReceiptData {
	store_name: string;
	store_location?: string;
	date: string;
	order_number?: string;
	items: ReceiptItem[];
	subtotal: number;
	tax?: number;
	total: number;
	payment_method?: string;
}

const DATE_PATTERNS = [
	/(?:^|\n)Date:\s*(\d{2} [A-Za-z]{3,9} \d{4})/m,
	/(?:^|\n)(\d{4}-\d{2}-\d{2})(?:\n|$)/m,
];

const ORDER_PATTERNS = [
	/Invoice\/Order Number:\s*(\d{6,})/i,
	/Order(?: Number| ID)?:\s*(\d{6,})/i,
];

const MONEY_LINE_RE = /^\$(\d+\.\d{2})$/;
const ITEM_LINE_RE =
	/^(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?(?:\s+kg)?)\s+\$(\d+\.\d{2})\s+\$(\d+\.\d{2})$/;

const CATEGORY_NAMES = new Set([
	"Bakery",
	"Biscuits & Snacks",
	"Canned & Packet Food",
	"Condiments",
	"Dairy",
	"Drinks",
	"Frozen Food",
	"Fruit & Vegetables",
	"Health & Wellness",
	"Household",
	"Pantry",
	"Serviced Deli",
	"Toiletries",
	"Beauty",
	"Desserts",
]);

const IGNORED_EXACT = new Set([
	"Sub Total:Sub Total:",
	"Paper bags: Paper bags:",
	"Collection feeCollection fee",
	"Service feesService fees",
	"Invoice Total:Invoice Total:",
	"Paid Amount:Paid Amount:",
	"Invoice total includes GST of:Invoice total includes GST of:",
	"SuppliedSupplied",
	"LineLine DescriptionDescription OrderedOrdered SuppliedSupplied PricePrice AmountAmount",
	"SubstitutionsSubstitutions",
]);

const IGNORED_PREFIXES = [
	"Registered O",
	"* Indicates GST",
	"~ Indicate meat items",
	"For all liquor orders",
	"Need help with your order?",
	"Tax Invoice Page",
	"ABN ",
	"Customer:",
	"Date:",
	"Pickup:",
	"Collection Instructions",
	"CAN LEAVE UNATTENDED",
	"Everyday Rewards",
	"Looking for your most up to date",
	"view your current balance.",
	"app and track your balance",
	"4.0 cents per litre fuel",
	"Thank you for working with us",
	"Your personal shopper",
	"than the original item",
	"LineLine ",
	"Invoice/Order Number:",
];

function parseDateString(input: string | null | undefined): string {
	if (!input) return "";
	const trimmed = input.trim();
	for (const fmt of [
		{ regex: /^(\d{2}) ([A-Za-z]{3}) (\d{4})$/ },
		{ regex: /^(\d{2}) ([A-Za-z]{4,9}) (\d{4})$/ },
	]) {
		const match = trimmed.match(fmt.regex);
		if (!match) continue;
		const parsed = new Date(`${match[1]} ${match[2]} ${match[3]} UTC`);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed.toISOString().slice(0, 10);
		}
	}
	return trimmed;
}

function extractDate(text: string): string {
	for (const pattern of DATE_PATTERNS) {
		const match = text.match(pattern);
		if (match?.[1]) return parseDateString(match[1]);
	}
	return "";
}

function extractOrderNumber(text: string): string | undefined {
	for (const pattern of ORDER_PATTERNS) {
		const match = text.match(pattern);
		if (match?.[1]) return match[1];
	}
	return undefined;
}

function detectStoreName(text: string): string {
	if (/woolworths/i.test(text)) return "Woolworths";
	if (/coles/i.test(text)) return "Coles";
	if (/aldi/i.test(text)) return "ALDI";
	return "Unknown Store";
}

function normalizeCategory(line: string): string | null {
	if (CATEGORY_NAMES.has(line)) return line;
	if (line.length % 2 === 0) {
		const half = line.length / 2;
		const first = line.slice(0, half);
		const second = line.slice(half);
		if (first === second && CATEGORY_NAMES.has(first)) return first;
	}
	return null;
}

function isIgnoredLine(line: string): boolean {
	return IGNORED_EXACT.has(line) || IGNORED_PREFIXES.some((prefix) => line.startsWith(prefix));
}

function extractTotals(lines: string[], allMoneyValues: number[]): {
	subtotal: number;
	tax?: number | undefined;
	total: number;
	payment_method?: string | undefined;
} {
	const registeredOfficeIndex = lines.findIndex((line) => line.startsWith("Registered O"));
	if (registeredOfficeIndex >= 0) {
		const scanWindow = lines.slice(Math.max(0, registeredOfficeIndex - 12), registeredOfficeIndex);
		const totalsBlock = scanWindow
			.map((line) => line.match(MONEY_LINE_RE))
			.filter((match): match is RegExpMatchArray => Boolean(match))
			.map((match) => Number.parseFloat(match[1] ?? "0"));

		if (totalsBlock.length >= 7) {
			const result: {
				subtotal: number;
				tax?: number | undefined;
				total: number;
				payment_method?: string | undefined;
			} = {
				subtotal: totalsBlock.at(-7) ?? 0,
				total: totalsBlock.at(-3) ?? 0,
			};
			const tax = totalsBlock.at(-2);
			if (tax !== undefined) result.tax = tax;
			return result;
		}
	}

	const fallbackTotal = allMoneyValues.length ? Math.max(...allMoneyValues) : 0;
	return {
		subtotal: fallbackTotal,
		total: fallbackTotal,
	};
}

function extractItems(lines: string[]): ReceiptItem[] {
	const items: ReceiptItem[] = [];
	let currentCategory: string | undefined;
	const seen = new Set<string>();

	for (const rawLine of lines) {
		const category = normalizeCategory(rawLine);
		if (category) {
			currentCategory = category;
			continue;
		}
		if (isIgnoredLine(rawLine)) continue;

		const match = rawLine.match(ITEM_LINE_RE);
		if (!match) continue;

		const [, lineNo, description, orderedQty, suppliedQtyText, unitPrice, totalPrice] = match;
		const key = [lineNo, description, orderedQty, suppliedQtyText, unitPrice, totalPrice].join("|");
		if (seen.has(key)) continue;
		seen.add(key);

		const item: ReceiptItem = {
			name: description ?? "",
			quantity: Number.parseFloat(orderedQty ?? "0"),
			unit_price: Number.parseFloat(unitPrice ?? "0"),
			total_price: Number.parseFloat(totalPrice ?? "0"),
		};
		if (currentCategory !== undefined) item.category = currentCategory;
		items.push(item);
	}

	return items;
}

async function parseReceiptLocally(pdfPath: string): Promise<ReceiptData | null> {
	const dataBuffer = fs.readFileSync(pdfPath);
	const parsed = await pdf(dataBuffer);
	const text = parsed.text || "";
	if (!text.trim()) return null;

	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	const moneyValues = Array.from(text.matchAll(/\$(\d+\.\d{2})/g)).map((match) =>
		Number.parseFloat(match[1] ?? "0")
	);

	const totals = extractTotals(lines, moneyValues);
	const items = extractItems(lines);

	const receipt: ReceiptData = {
		store_name: detectStoreName(text),
		date: extractDate(text),
		items,
		subtotal: totals.subtotal,
		total: totals.total,
	};
	const orderNumber = extractOrderNumber(text);
	if (orderNumber !== undefined) receipt.order_number = orderNumber;
	if (totals.tax !== undefined) receipt.tax = totals.tax;
	if (totals.payment_method !== undefined) receipt.payment_method = totals.payment_method;
	return receipt;
}

export function registerPDFTools(server: McpServer): void {
	server.registerTool(
		"pdf_extract_text",
		{
			title: "Extract Text from PDF",
			description:
				"Extract all readable text from any PDF file. Works on machine-readable PDFs (manuals, reports, documents). Returns the full text content. For scanned/image-only PDFs, output may be empty.",
			inputSchema: {
				file_path: z.string().describe("Absolute path to the PDF file"),
				max_chars: z
					.number()
					.optional()
					.describe("Maximum characters to return (default: 50000). Use to avoid token overload on large docs."),
			},
		},
		async ({ file_path, max_chars }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [{ type: "text", text: `Rate limit exceeded. Please wait ${waitTime} seconds.` }],
						isError: true,
					};
				}
				if (!fs.existsSync(file_path)) {
					return {
						content: [{ type: "text", text: `File not found: ${file_path}` }],
						isError: true,
					};
				}
				const dataBuffer = fs.readFileSync(file_path);
				const parsed = await pdf(dataBuffer);
				const text = parsed.text || "";
				if (!text.trim()) {
					return {
						content: [{ type: "text", text: "No readable text found. The PDF may be image-only or scanned." }],
						isError: true,
					};
				}
				const limit = max_chars ?? 50000;
				const truncated = text.length > limit;
				const output = truncated ? text.slice(0, limit) : text;
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								file: path.basename(file_path),
								pages: parsed.numpages,
								char_count: text.length,
								truncated,
								text: output,
							}, null, 2),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error extracting PDF: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		}
	);


	server.registerTool(
		"pdf_list_receipts",
		{
			title: "List PDF Receipts",
			description:
				"Lists all PDF files in a specified directory. Use this to find receipt files before parsing them.",
			inputSchema: {
				directory: z
					.string()
					.describe(
						"Directory path to search for PDF files (e.g., 'C:\\Users\\Deej\\Downloads\\Woolworths orders')"
					),
				recursive: z
					.boolean()
					.optional()
					.describe("Search subdirectories recursively (default: false)"),
			},
		},
		async ({ directory, recursive }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [{ type: "text", text: `Rate limit exceeded. Please wait ${waitTime} seconds.` }],
						isError: true,
					};
				}

				if (!fs.existsSync(directory)) {
					return {
						content: [{ type: "text", text: `Directory not found: ${directory}` }],
						isError: true,
					};
				}

				const findPDFs = (dir: string, recurse: boolean): string[] => {
					const files: string[] = [];
					const entries = fs.readdirSync(dir, { withFileTypes: true });

					for (const entry of entries) {
						const fullPath = path.join(dir, entry.name);
						if (entry.isDirectory() && recurse) {
							files.push(...findPDFs(fullPath, recurse));
						} else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
							files.push(fullPath);
						}
					}

					return files;
				};

				const pdfFiles = findPDFs(directory, recursive || false);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									directory,
									total_files: pdfFiles.length,
									files: pdfFiles.map((file) => ({
										path: file,
										filename: path.basename(file),
										size: fs.statSync(file).size,
										modified: fs.statSync(file).mtime.toISOString(),
									})),
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error listing PDFs: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	server.registerTool(
		"pdf_extract_receipt",
		{
			title: "Extract Receipt Data",
			description:
				"Extract structured data from a grocery receipt or invoice PDF locally. Returns items, prices, totals, and store information in JSON format.",
			inputSchema: {
				file_path: z.string().describe("Absolute path to the PDF receipt file"),
				extract_categories: z
					.boolean()
					.optional()
					.describe("Attempt to preserve category headings from the receipt when available."),
			},
		},
		async ({ file_path }) => {
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [{ type: "text", text: `Rate limit exceeded. Please wait ${waitTime} seconds.` }],
						isError: true,
					};
				}

				if (!fs.existsSync(file_path)) {
					return {
						content: [{ type: "text", text: `File not found: ${file_path}` }],
						isError: true,
					};
				}

				const receiptData = await parseReceiptLocally(file_path);
				if (!receiptData) {
					return {
						content: [
							{
								type: "text",
								text: "Failed to extract receipt data locally. The PDF may be image-only, unreadable, or in an unsupported format.",
							},
						],
						isError: true,
					};
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									success: true,
									file: path.basename(file_path),
									parser: "local-text",
									receipt: receiptData,
									summary: {
										store: receiptData.store_name,
										date: receiptData.date,
										items_count: receiptData.items.length,
										total: receiptData.total,
									},
									next_steps:
										"Review extracted data, map items to your inventory or budgeting system, and save the JSON to a file for records.",
								},
								null,
								2
							),
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text",
							text: `Error extracting receipt: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
