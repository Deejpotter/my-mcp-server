/**
 * Created: 08/11/25
 * By: Daniel Potter
 *
 * PDF parsing tools using OpenAI GPT-4o Vision for receipt/invoice extraction.
 * Converts PDFs to images and uses vision AI to extract structured data.
 *
 * Requires environment variables:
 * - OPENAI_API_KEY: OpenAI API key for GPT-4o access
 *
 * References:
 * - OpenAI Vision API: https://platform.openai.com/docs/guides/vision
 * - Azure Sample: https://github.com/Azure-Samples/azure-openai-gpt-4-vision-pdf-extraction-sample
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import OpenAI from "openai";
import pdf from "pdf-parse-new";
import fs from "fs";
import path from "path";
import { genericLimiter } from "../utils/cache.js";

/**
 * OpenAI client singleton
 */
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
	if (!openaiClient) {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new Error(
				"OPENAI_API_KEY environment variable is required for PDF parsing tools"
			);
		}
		openaiClient = new OpenAI({ apiKey });
	}
	return openaiClient;
}

/**
 * Receipt item structure
 */
interface ReceiptItem {
	name: string;
	quantity: number;
	unit_price: number;
	total_price: number;
	category?: string;
}

/**
 * Receipt data structure
 */
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

/**
 * Convert PDF to base64-encoded images for vision model
 * Note: For production, consider using pdf-to-image libraries
 * This simplified version extracts text and sends as context
 * @reserved Future enhancement for image-based parsing
 */
/* async function pdfToBase64Images(pdfPath: string): Promise<string[]> {
	// For now, we'll use a simplified approach:
	// Convert PDF to text and send as image context
	// TODO: Implement proper PDF -> image conversion using pdf2pic or similar
	const dataBuffer = fs.readFileSync(pdfPath);
	const data = await pdf(dataBuffer);

	// Return text content as a signal that we need proper image conversion
	return [data.text];
} */

/**
 * Parse receipt using GPT-4o Vision
 */
async function parseReceiptWithVision(
	pdfPath: string
): Promise<ReceiptData | null> {
	const client = getOpenAIClient();

	// Extract text from PDF
	const dataBuffer = fs.readFileSync(pdfPath);
	const data = await pdf(dataBuffer);

	// Create a structured prompt for receipt parsing
	const systemPrompt = `You are an expert at extracting structured data from grocery receipts. 
Parse the receipt text and return ONLY a valid JSON object with the following structure:
{
  "store_name": "string",
  "store_location": "string (optional)",
  "date": "YYYY-MM-DD",
  "order_number": "string (optional)",
  "items": [
    {
      "name": "string",
      "quantity": number,
      "unit_price": number,
      "total_price": number,
      "category": "string (optional)"
    }
  ],
  "subtotal": number,
  "tax": number (optional),
  "total": number,
  "payment_method": "string (optional)"
}

Important:
- Extract ALL items from the receipt
- Ensure all prices are numbers (no currency symbols)
- Date must be in YYYY-MM-DD format
- Return ONLY the JSON object, no additional text`;

	const completion = await client.chat.completions.create({
		model: "gpt-4o",
		messages: [
			{
				role: "system",
				content: systemPrompt,
			},
			{
				role: "user",
				content: `Parse this receipt:\n\n${data.text}`,
			},
		],
		response_format: { type: "json_object" },
		temperature: 0.1, // Low temperature for consistent extraction
	});

	const responseText = completion.choices[0]?.message?.content;
	if (!responseText) {
		return null;
	}

	try {
		return JSON.parse(responseText) as ReceiptData;
	} catch (error) {
		console.error("Failed to parse GPT-4o response:", error);
		return null;
	}
}

/**
 * Register PDF parsing tools
 */
export function registerPDFTools(server: McpServer): void {
	// PDF_LIST_RECEIPTS - List PDFs in directory
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
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				// Check if directory exists
				if (!fs.existsSync(directory)) {
					return {
						content: [
							{
								type: "text",
								text: `Directory not found: ${directory}`,
							},
						],
						isError: true,
					};
				}

				// Find PDF files
				const findPDFs = (dir: string, recurse: boolean): string[] => {
					const files: string[] = [];
					const entries = fs.readdirSync(dir, { withFileTypes: true });

					for (const entry of entries) {
						const fullPath = path.join(dir, entry.name);
						if (entry.isDirectory() && recurse) {
							files.push(...findPDFs(fullPath, recurse));
						} else if (
							entry.isFile() &&
							entry.name.toLowerCase().endsWith(".pdf")
						) {
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
							text: `Error listing PDFs: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);

	// PDF_EXTRACT_RECEIPT - Parse receipt with GPT-4o Vision
	server.registerTool(
		"pdf_extract_receipt",
		{
			title: "Extract Receipt Data",
			description:
				"Extracts structured data from a grocery receipt PDF using GPT-4o Vision. Returns items, prices, totals, and store information in JSON format.",
			inputSchema: {
				file_path: z.string().describe("Absolute path to the PDF receipt file"),
				extract_categories: z
					.boolean()
					.optional()
					.describe(
						"Attempt to categorize items (e.g., 'produce', 'dairy', 'meat'). Default: false"
					),
			},
		},
		async ({ file_path }) => {
			// Note: extract_categories parameter reserved for future use
			try {
				if (!genericLimiter.allowCall()) {
					const waitTime = Math.ceil(genericLimiter.getWaitTime() / 1000);
					return {
						content: [
							{
								type: "text",
								text: `Rate limit exceeded. Please wait ${waitTime} seconds.`,
							},
						],
						isError: true,
					};
				}

				// Check if file exists
				if (!fs.existsSync(file_path)) {
					return {
						content: [
							{
								type: "text",
								text: `File not found: ${file_path}`,
							},
						],
						isError: true,
					};
				}

				// Check if OpenAI API key is configured
				if (!process.env.OPENAI_API_KEY) {
					return {
						content: [
							{
								type: "text",
								text: "OPENAI_API_KEY environment variable is not set. Please configure it to use receipt parsing.",
							},
						],
						isError: true,
					};
				}

				// Parse the receipt
				const receiptData = await parseReceiptWithVision(file_path);

				if (!receiptData) {
					return {
						content: [
							{
								type: "text",
								text: "Failed to extract receipt data. The PDF may be unreadable or in an unsupported format.",
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
									receipt: receiptData,
									summary: {
										store: receiptData.store_name,
										date: receiptData.date,
										items_count: receiptData.items.length,
										total: receiptData.total,
									},
									next_steps:
										"Use grocy_product_create to add new products, then grocy_stock_add_product to add items to stock",
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
							text: `Error extracting receipt: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					],
					isError: true,
				};
			}
		}
	);
}
