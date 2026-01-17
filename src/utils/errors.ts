/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Structured error helper used across tools and resources.
 * Produces a consistent error payload for MCP responses and logging.
 */
export function makeStructuredError(
  err: unknown,
  error_code = "internal_error",
  retryable = false
) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    error_code,
    message,
    retryable,
    timestamp: new Date().toISOString(),
  };
}

export type StructuredError = ReturnType<typeof makeStructuredError>;
