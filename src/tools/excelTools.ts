import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import ExcelJS from "exceljs";
import { z } from "zod";
import { makeStructuredError } from "../utils/errors.js";
import { validatePath } from "../utils/security.js";

const EXCEL_EXTENSIONS = new Set([".xlsx", ".xlsm"]);

function isSupportedWorkbookPath(filePath: string): boolean {
	const extension = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
	return EXCEL_EXTENSIONS.has(extension);
}

function normalizeCellValue(value: unknown): unknown {
	if (value === undefined || value === null) {
		return null;
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value;
	}

	if (typeof value === "object") {
		const cellValue = value as {
			formula?: unknown;
			result?: unknown;
			richText?: Array<{ text?: string }>;
			text?: unknown;
			hyperlink?: unknown;
			error?: unknown;
		};

		if (cellValue.formula !== undefined) {
			return {
				formula: cellValue.formula,
				result: normalizeCellValue(cellValue.result),
			};
		}

		if (cellValue.richText) {
			return cellValue.richText.map((part) => part.text ?? "").join("");
		}

		if (cellValue.text !== undefined) {
			return cellValue.text;
		}

		if (cellValue.hyperlink !== undefined) {
			return {
				hyperlink: cellValue.hyperlink,
				text: cellValue.text ?? null,
			};
		}

		if (cellValue.error !== undefined) {
			return { error: cellValue.error };
		}
	}

	return String(value);
}

function columnLettersToNumber(letters: string): number {
	return letters
		.split("")
		.reduce((total, char) => total * 26 + (char.charCodeAt(0) - 64), 0);
}

function parseCellAddress(address: string): { row: number; col: number } {
	const match = /^([A-Z]+)(\d+)$/.exec(address.toUpperCase().trim());
	if (!match) {
		throw new Error(`Invalid cell address: ${address}`);
	}

	return {
		col: columnLettersToNumber(match[1]!),
		row: Number(match[2]),
	};
}

function parseRange(range: string): {
	startRow: number;
	startCol: number;
	endRow: number;
	endCol: number;
} {
	const normalized = range.trim().toUpperCase();
	const parts = normalized.split(":");
	if (parts.length === 1) {
		const cell = parseCellAddress(parts[0]!);
		return {
			startRow: cell.row,
			startCol: cell.col,
			endRow: cell.row,
			endCol: cell.col,
		};
	}

	if (parts.length === 2) {
		const start = parseCellAddress(parts[0]!);
		const end = parseCellAddress(parts[1]!);
		return {
			startRow: Math.min(start.row, end.row),
			startCol: Math.min(start.col, end.col),
			endRow: Math.max(start.row, end.row),
			endCol: Math.max(start.col, end.col),
		};
	}

	throw new Error(`Invalid range: ${range}`);
}

function getWorksheetByName(
	workbook: ExcelJS.Workbook,
	sheetName?: string
): ExcelJS.Worksheet {
	if (sheetName) {
		const worksheet = workbook.getWorksheet(sheetName);
		if (!worksheet) {
			throw new Error(`Sheet not found: ${sheetName}`);
		}
		return worksheet;
	}

	const firstSheet = workbook.worksheets[0];
	if (!firstSheet) {
		throw new Error("Workbook has no worksheets");
	}

	return firstSheet;
}

export function registerExcelTools(server: McpServer): void {
	server.registerTool(
		"excel_workbook_info",
		{
			title: "Inspect Excel Workbook",
			description:
				"Inspect workbook metadata, sheet names, and sheet dimensions for a local Excel file.",
			inputSchema: {
				file_path: z.string().describe("Path to the Excel workbook to inspect"),
			},
		},
		async ({ file_path }) => {
			try {
				const validation = validatePath(file_path, "read");
				if (!validation.valid || !validation.resolvedPath) {
					return {
						content: [
							{
								type: "text",
								text: `🔒 Security Error: ${validation.checks.join(", ")}`,
							},
						],
						isError: true,
					};
				}

				if (!isSupportedWorkbookPath(validation.resolvedPath)) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Unsupported workbook format. Use .xlsx or .xlsm files.",
							},
						],
						isError: true,
					};
				}

				const workbook = new ExcelJS.Workbook();
				await workbook.xlsx.readFile(validation.resolvedPath);

				const sheets = workbook.worksheets.map(
					(worksheet: ExcelJS.Worksheet) => ({
						name: worksheet.name,
						rowCount: worksheet.rowCount,
						columnCount: worksheet.columnCount,
						actualRowCount: worksheet.actualRowCount,
						actualColumnCount: worksheet.actualColumnCount,
						state: worksheet.state,
					})
				);

				return {
					content: [
						{
							type: "text",
							text: `✅ Workbook inspected: ${validation.resolvedPath}`,
						},
					],
					structuredContent: {
						filePath: validation.resolvedPath,
						sheetCount: workbook.worksheets.length,
						sheets,
					},
				};
			} catch (error: unknown) {
				const se = makeStructuredError(
					error,
					"excel_workbook_info_failed",
					false
				);
				return {
					content: [
						{
							type: "text",
							text: `❌ Excel workbook inspection failed: ${se.message}`,
						},
					],
					structuredContent: { error: se },
					isError: true,
				};
			}
		}
	);

	server.registerTool(
		"excel_read_range",
		{
			title: "Read Excel Range",
			description:
				"Read a worksheet range from a local Excel workbook and return the values as JSON rows.",
			inputSchema: {
				file_path: z.string().describe("Path to the Excel workbook to read"),
				sheet_name: z
					.string()
					.optional()
					.describe("Optional worksheet name (defaults to the first sheet)"),
				range: z
					.string()
					.optional()
					.describe("Optional cell range like A1:C20"),
			},
		},
		async ({ file_path, sheet_name, range }) => {
			try {
				const validation = validatePath(file_path, "read");
				if (!validation.valid || !validation.resolvedPath) {
					return {
						content: [
							{
								type: "text",
								text: `🔒 Security Error: ${validation.checks.join(", ")}`,
							},
						],
						isError: true,
					};
				}

				if (!isSupportedWorkbookPath(validation.resolvedPath)) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Unsupported workbook format. Use .xlsx or .xlsm files.",
							},
						],
						isError: true,
					};
				}

				const workbook = new ExcelJS.Workbook();
				await workbook.xlsx.readFile(validation.resolvedPath);
				const worksheet = getWorksheetByName(workbook, sheet_name);

				const bounds = range
					? parseRange(range)
					: {
							startRow: 1,
							startCol: 1,
							endRow: Math.max(worksheet.actualRowCount, 1),
							endCol: Math.max(worksheet.actualColumnCount, 1),
					  };

				const rows: unknown[][] = [];
				for (
					let rowNumber = bounds.startRow;
					rowNumber <= bounds.endRow;
					rowNumber += 1
				) {
					const row: unknown[] = [];
					for (
						let colNumber = bounds.startCol;
						colNumber <= bounds.endCol;
						colNumber += 1
					) {
						const cell = worksheet.getCell(rowNumber, colNumber);
						row.push(normalizeCellValue(cell.value));
					}
					rows.push(row);
				}

				return {
					content: [
						{
							type: "text",
							text: `✅ Read ${rows.length} row(s) from ${worksheet.name}${
								range ? ` (${range})` : ""
							}`,
						},
					],
					structuredContent: {
						filePath: validation.resolvedPath,
						sheetName: worksheet.name,
						range: range || null,
						rows,
					},
				};
			} catch (error: unknown) {
				const se = makeStructuredError(error, "excel_read_range_failed", false);
				return {
					content: [
						{ type: "text", text: `❌ Excel read failed: ${se.message}` },
					],
					structuredContent: { error: se },
					isError: true,
				};
			}
		}
	);

	server.registerTool(
		"excel_write_range",
		{
			title: "Write Excel Range",
			description:
				"Write a 2D value matrix into a local Excel workbook, creating the file or sheet if needed.",
			inputSchema: {
				file_path: z.string().describe("Path to the Excel workbook to write"),
				sheet_name: z
					.string()
					.optional()
					.describe("Worksheet name (defaults to Sheet1 or the first sheet)"),
				start_cell: z
					.string()
					.optional()
					.default("A1")
					.describe("Top-left cell to write to"),
				append: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						"Append after the last used row instead of using start_cell row"
					),
				values: z
					.array(
						z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
					)
					.describe("Rows of cell values to write"),
			},
		},
		async ({
			file_path,
			sheet_name,
			start_cell = "A1",
			append = false,
			values,
		}) => {
			try {
				const validation = validatePath(file_path, "write");
				if (!validation.valid || !validation.resolvedPath) {
					return {
						content: [
							{
								type: "text",
								text: `🔒 Security Error: ${validation.checks.join(", ")}`,
							},
						],
						isError: true,
					};
				}

				if (!isSupportedWorkbookPath(validation.resolvedPath)) {
					return {
						content: [
							{
								type: "text",
								text: "❌ Unsupported workbook format. Use .xlsx or .xlsm files.",
							},
						],
						isError: true,
					};
				}

				const workbook = new ExcelJS.Workbook();
				try {
					await workbook.xlsx.readFile(validation.resolvedPath);
				} catch {
					// New workbook is fine; it will be created below if needed.
				}

				let worksheet = sheet_name
					? workbook.getWorksheet(sheet_name)
					: workbook.worksheets[0];
				if (!worksheet) {
					worksheet = workbook.addWorksheet(sheet_name || "Sheet1");
				}

				const start = parseCellAddress(start_cell);
				const rowOffset = append ? worksheet.actualRowCount + 1 : start.row;
				const colOffset = start.col;

				for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
					const rowValues = values[rowIndex] ?? [];
					for (let colIndex = 0; colIndex < rowValues.length; colIndex += 1) {
						const cell = worksheet.getCell(
							rowOffset + rowIndex,
							colOffset + colIndex
						);
						const value = rowValues[colIndex];
						cell.value = value === null ? null : value;
					}
				}

				await workbook.xlsx.writeFile(validation.resolvedPath);

				return {
					content: [
						{
							type: "text",
							text: `✅ Wrote ${values.length} row(s) to ${worksheet.name} in ${validation.resolvedPath}`,
						},
					],
					structuredContent: {
						filePath: validation.resolvedPath,
						sheetName: worksheet.name,
						startCell: start_cell,
						append,
						rowsWritten: values.length,
						columnsWritten: Math.max(...values.map((row) => row.length), 0),
					},
				};
			} catch (error: unknown) {
				const se = makeStructuredError(
					error,
					"excel_write_range_failed",
					false
				);
				return {
					content: [
						{ type: "text", text: `❌ Excel write failed: ${se.message}` },
					],
					structuredContent: { error: se },
					isError: true,
				};
			}
		}
	);
}
