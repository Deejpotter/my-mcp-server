/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Performance tracking and metrics for MCP tool execution.
 * Tracks execution times, call counts, and success/failure rates.
 * Helps identify slow tools and monitor server performance.
 *
 * References:
 * Node.js Performance API: https://nodejs.org/api/perf_hooks.html
 */

/**
 * Metrics for a single tool
 */
interface ToolMetrics {
	totalCalls: number;
	successCount: number;
	failureCount: number;
	totalTime: number;
	minTime: number;
	maxTime: number;
	avgTime: number;
}

/**
 * Global metrics store
 */
const metrics: Map<string, ToolMetrics> = new Map();

/**
 * Track tool execution time and result
 *
 * @param toolName - Name of the tool being tracked
 * @param executionTime - Time taken in milliseconds
 * @param success - Whether the tool executed successfully
 */
export function trackToolExecution(
	toolName: string,
	executionTime: number,
	success: boolean
): void {
	let toolMetrics = metrics.get(toolName);

	if (!toolMetrics) {
		toolMetrics = {
			totalCalls: 0,
			successCount: 0,
			failureCount: 0,
			totalTime: 0,
			minTime: Infinity,
			maxTime: 0,
			avgTime: 0,
		};
		metrics.set(toolName, toolMetrics);
	}

	// Update metrics
	toolMetrics.totalCalls++;
	if (success) {
		toolMetrics.successCount++;
	} else {
		toolMetrics.failureCount++;
	}

	toolMetrics.totalTime += executionTime;
	toolMetrics.minTime = Math.min(toolMetrics.minTime, executionTime);
	toolMetrics.maxTime = Math.max(toolMetrics.maxTime, executionTime);
	toolMetrics.avgTime = toolMetrics.totalTime / toolMetrics.totalCalls;
}

/**
 * Get metrics for a specific tool
 *
 * @param toolName - Name of the tool
 * @returns Tool metrics or null if not found
 */
export function getToolMetrics(toolName: string): ToolMetrics | null {
	return metrics.get(toolName) || null;
}

/**
 * Get all tool metrics
 *
 * @returns Map of all tool metrics
 */
export function getAllMetrics(): Map<string, ToolMetrics> {
	return new Map(metrics);
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
	metrics.clear();
}

/**
 * Format metrics for display
 *
 * @param toolName - Optional tool name to filter (if not provided, shows all)
 * @returns Formatted metrics string
 */
export function formatMetrics(toolName?: string): string {
	if (toolName) {
		const toolMetrics = metrics.get(toolName);
		if (!toolMetrics) {
			return `No metrics found for tool: ${toolName}`;
		}

		return `Tool: ${toolName}
Total Calls: ${toolMetrics.totalCalls}
Success: ${toolMetrics.successCount} | Failure: ${toolMetrics.failureCount}
Execution Times:
  Min: ${toolMetrics.minTime.toFixed(2)}ms
  Max: ${toolMetrics.maxTime.toFixed(2)}ms
  Avg: ${toolMetrics.avgTime.toFixed(2)}ms
  Total: ${toolMetrics.totalTime.toFixed(2)}ms`;
	}

	// Format all metrics
	const lines: string[] = ["Performance Metrics Summary", "=".repeat(50)];

	for (const [name, toolMetrics] of metrics.entries()) {
		lines.push(`\nTool: ${name}`);
		lines.push(
			`  Calls: ${toolMetrics.totalCalls} (${toolMetrics.successCount} success, ${toolMetrics.failureCount} failures)`
		);
		lines.push(
			`  Time: ${toolMetrics.avgTime.toFixed(
				2
			)}ms avg (${toolMetrics.minTime.toFixed(2)}-${toolMetrics.maxTime.toFixed(
				2
			)}ms)`
		);
	}

	return lines.join("\n");
}

/**
 * Measure execution time of an async function
 *
 * @param fn - Async function to measure
 * @returns Tuple of [result, execution time in ms]
 */
export async function measureTime<T>(
	fn: () => Promise<T>
): Promise<[T, number]> {
	const start = performance.now();
	const result = await fn();
	const end = performance.now();
	return [result, end - start];
}
