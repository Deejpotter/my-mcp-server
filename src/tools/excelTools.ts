import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import ExcelJS from "exceljs";
import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { makeStructuredError } from "../utils/errors.js";
import { validatePath } from "../utils/security.js";

const execFileAsync = promisify(execFile);
const POWER_SHELL_BIN = process.platform === "win32" ? "powershell.exe" : "powershell";

function toEncodedPowerShell(script: string): string {
	return Buffer.from(script, "utf16le").toString("base64");
}

async function runExcelPowerShell(script: string, env: Record<string, string> = {}) {
	const { stdout } = await execFileAsync(
		POWER_SHELL_BIN,
		[
			"-NoProfile",
			"-NonInteractive",
			"-ExecutionPolicy",
			"Bypass",
			"-EncodedCommand",
			toEncodedPowerShell(script),
		],
		{
			env: { ...process.env, ...env },
			windowsHide: true,
			maxBuffer: 5 * 1024 * 1024,
		}
	);

	return stdout.toString();
}

function parsePowerShellJson(stdout: string) {
	const trimmed = stdout.trim();
	if (!trimmed) {
		throw new Error("PowerShell returned no data");
	}

	return JSON.parse(trimmed) as unknown;
}

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

function ensureWindowsExcelSupport() {
	if (process.platform !== "win32") {
		return "Windows Excel COM tools are only available on Windows.";
	}
	return null;
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

	server.registerTool(
		"excel_active_workbook_info",
		{
			title: "Inspect Active Excel Workbook",
			description:
				"Inspect the currently open Excel workbook through the live Excel COM instance.",
			inputSchema: {},
		},
		async () => {
			const windowsOnlyError = ensureWindowsExcelSupport();
			if (windowsOnlyError) {
				return {
					content: [{ type: "text", text: `❌ ${windowsOnlyError}` }],
					isError: true,
				};
			}

			try {
				const stdout = await runExcelPowerShell(`
$ErrorActionPreference = 'Stop'
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
} catch {
  throw 'No active Excel instance found.'
}
$workbook = $excel.ActiveWorkbook
if ($null -eq $workbook) { throw 'No active workbook found.' }
$sheets = @()
foreach ($worksheet in @($workbook.Worksheets)) {
  $used = $worksheet.UsedRange
  $sheets += [pscustomobject]@{
    name = $worksheet.Name
    usedRange = if ($used) { $used.Address($false, $false) } else { $null }
    usedRows = if ($used) { [int]$used.Rows.Count } else { 0 }
    usedColumns = if ($used) { [int]$used.Columns.Count } else { 0 }
  }
}
[pscustomobject]@{
  workbookName = $workbook.Name
  workbookPath = $workbook.Path
  sheetCount = [int]$workbook.Worksheets.Count
  activeSheet = $workbook.ActiveSheet.Name
  saved = [bool]$workbook.Saved
  sheets = $sheets
} | ConvertTo-Json -Depth 6 -Compress
				`, {});
				const parsed = parsePowerShellJson(stdout) as {
					workbookName: string;
					workbookPath: string;
					sheetCount: number;
					activeSheet: string;
					saved: boolean;
					sheets: Array<{
						name: string;
						usedRange?: string | null;
						usedRows?: number;
						usedColumns?: number;
					}>;
				};

				return {
					content: [
						{ type: "text", text: `✅ Active workbook: ${parsed.workbookName}` },
					],
					structuredContent: parsed,
				};
			} catch (error: unknown) {
				const se = makeStructuredError(error, "excel_active_workbook_info_failed", false);
				return {
					content: [{ type: "text", text: `❌ Active workbook inspection failed: ${se.message}` }],
					structuredContent: { error: se },
					isError: true,
				};
			}
		}
	);

	server.registerTool(
		"excel_active_read_range",
		{
			title: "Read Active Excel Range",
			description:
				"Read a range from the currently open Excel workbook through the live Excel COM instance.",
			inputSchema: {
				sheet_name: z.string().optional().describe("Optional worksheet name (defaults to the active sheet)"),
				range: z.string().optional().describe("Optional cell range like A1:C20 (defaults to UsedRange)"),
			},
		},
		async ({ sheet_name, range }) => {
			const windowsOnlyError = ensureWindowsExcelSupport();
			if (windowsOnlyError) {
				return {
					content: [{ type: "text", text: `❌ ${windowsOnlyError}` }],
					isError: true,
				};
			}

			try {
				const stdout = await runExcelPowerShell(`
$ErrorActionPreference = 'Stop'
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
} catch {
  throw 'No active Excel instance found.'
}
$workbook = $excel.ActiveWorkbook
if ($null -eq $workbook) { throw 'No active workbook found.' }
$sheetName = $env:MCP_SHEET_NAME
$rangeAddress = $env:MCP_RANGE
$worksheet = if ([string]::IsNullOrWhiteSpace($sheetName)) { $workbook.ActiveSheet } else { $workbook.Worksheets.Item($sheetName) }
if ($null -eq $worksheet) { throw "Sheet not found: $sheetName" }
$targetRange = if ([string]::IsNullOrWhiteSpace($rangeAddress)) { $worksheet.UsedRange } else { $worksheet.Range($rangeAddress) }
if ($null -eq $targetRange) { throw 'Unable to resolve target range.' }
$values = $targetRange.Value2
function Convert-ExcelValue($value) {
  if ($null -eq $value) { return $null }
  if ($value -is [DateTime]) { return $value.ToString('o') }
  return $value
}
$rows = @()
if ($values -is [System.Array]) {
  $rowCount = $values.GetLength(0)
  $colCount = $values.GetLength(1)
  for ($r = 1; $r -le $rowCount; $r++) {
    $row = @()
    for ($c = 1; $c -le $colCount; $c++) {
      $row += ,(Convert-ExcelValue $values[$r, $c])
    }
    $rows += ,$row
  }
} else {
  $rows = @(@(Convert-ExcelValue $values))
}
[pscustomobject]@{
  workbookName = $workbook.Name
  workbookPath = $workbook.Path
  sheetName = $worksheet.Name
  range = if ([string]::IsNullOrWhiteSpace($rangeAddress)) { $targetRange.Address($false, $false) } else { $rangeAddress }
  rows = $rows
} | ConvertTo-Json -Depth 6 -Compress
				`, { MCP_SHEET_NAME: sheet_name ?? "", MCP_RANGE: range ?? "" });
				const parsed = parsePowerShellJson(stdout) as { workbookName: string; workbookPath: string; sheetName: string; range: string; rows: unknown[][] };

				return {
					content: [{ type: "text", text: `✅ Read active range from ${parsed.sheetName}${range ? ` (${range})` : ""}` }],
					structuredContent: parsed,
				};
			} catch (error: unknown) {
				const se = makeStructuredError(error, "excel_active_read_range_failed", false);
				return {
					content: [{ type: "text", text: `❌ Active Excel read failed: ${se.message}` }],
					structuredContent: { error: se },
					isError: true,
				};
			}
		}
	);

	server.registerTool(
		"excel_active_write_range",
		{
			title: "Write Active Excel Range",
			description:
				"Write a 2D matrix into the currently open Excel workbook through the live Excel COM instance.",
			inputSchema: {
				sheet_name: z.string().optional().describe("Optional worksheet name (defaults to the active sheet)"),
				start_cell: z.string().optional().default("A1").describe("Top-left cell to write to"),
				append: z.boolean().optional().default(false).describe("Append after the last used row instead of using start_cell row"),
				values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe("Rows of cell values to write"),
			},
		},
		async ({ sheet_name, start_cell = "A1", append = false, values }) => {
			const windowsOnlyError = ensureWindowsExcelSupport();
			if (windowsOnlyError) {
				return {
					content: [{ type: "text", text: `❌ ${windowsOnlyError}` }],
					isError: true,
				};
			}

			try {
				const stdout = await runExcelPowerShell(`
$ErrorActionPreference = 'Stop'
try {
  $excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
} catch {
  throw 'No active Excel instance found.'
}
$workbook = $excel.ActiveWorkbook
if ($null -eq $workbook) { throw 'No active workbook found.' }
$sheetName = $env:MCP_SHEET_NAME
$startCell = $env:MCP_START_CELL
$append = $env:MCP_APPEND -eq 'true'
$valuesJson = $env:MCP_VALUES_JSON
$worksheet = if ([string]::IsNullOrWhiteSpace($sheetName)) { $workbook.ActiveSheet } else { $workbook.Worksheets.Item($sheetName) }
if ($null -eq $worksheet) { throw "Sheet not found: $sheetName" }
if (-not $worksheet) { throw 'Unable to resolve worksheet.' }
$values = ConvertFrom-Json $valuesJson
$startRange = $worksheet.Range($startCell)
$startRow = [int]$startRange.Row
$startColumn = [int]$startRange.Column
if ($append) {
  $used = $worksheet.UsedRange
  if ($used -and -not [string]::IsNullOrWhiteSpace([string]$used.Value2)) {
    $startRow = [int]$used.Row + [int]$used.Rows.Count
  } else {
    $startRow = 1
  }
}
for ($rowIndex = 0; $rowIndex -lt $values.Count; $rowIndex++) {
  $rowValues = $values[$rowIndex]
  for ($colIndex = 0; $colIndex -lt $rowValues.Count; $colIndex++) {
    $cell = $worksheet.Cells.Item($startRow + $rowIndex, $startColumn + $colIndex)
    $cell.Value2 = $rowValues[$colIndex]
  }
}
$saved = $false
if (-not [string]::IsNullOrWhiteSpace($workbook.Path)) {
  $workbook.Save()
  $saved = $true
}
[pscustomobject]@{
  workbookName = $workbook.Name
  workbookPath = $workbook.Path
  sheetName = $worksheet.Name
  startCell = $startCell
  append = $append
  rowsWritten = [int]$values.Count
  columnsWritten = if ($values.Count -gt 0) { [int]$values[0].Count } else { 0 }
  saved = $saved
} | ConvertTo-Json -Depth 6 -Compress
				`, { MCP_SHEET_NAME: sheet_name ?? "", MCP_START_CELL: start_cell, MCP_APPEND: append ? "true" : "false", MCP_VALUES_JSON: JSON.stringify(values) });
				const parsed = parsePowerShellJson(stdout) as { workbookName: string; workbookPath: string; sheetName: string; startCell: string; append: boolean; rowsWritten: number; columnsWritten: number; saved: boolean };

				return {
					content: [{ type: "text", text: `✅ Wrote ${parsed.rowsWritten} row(s) to active workbook${parsed.saved ? " and saved it" : ""}` }],
					structuredContent: parsed,
				};
			} catch (error: unknown) {
				const se = makeStructuredError(error, "excel_active_write_range_failed", false);
				return {
					content: [{ type: "text", text: `❌ Active Excel write failed: ${se.message}` }],
					structuredContent: { error: se },
					isError: true,
				};
			}
		}
	);
}
