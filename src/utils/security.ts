/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * Security validation utilities for file paths, commands, and environment variables.
 * Prevents path traversal, command injection, and information disclosure.
 * Ported from Python security.py with same validation logic.
 *
 * References:
 * OWASP Path Traversal: https://owasp.org/www-community/attacks/Path_Traversal
 * Node.js Security Best Practices: https://nodejs.org/en/docs/guides/security/
 */

import * as path from "path";
import * as fs from "fs/promises";

/**
 * Paths that are forbidden for any file operations
 * These contain system files or sensitive data that should never be accessed
 */
const FORBIDDEN_PATHS = [
	"/etc/passwd",
	"/etc/shadow",
	"/etc/sudoers",
	"C:\\Windows\\System32",
	"C:\\Windows\\SysWOW64",
	".ssh",
	".aws",
	".env",
	"id_rsa",
	"id_ed25519",
];

/**
 * Directory names that should be blocked from operations
 * Typically contain sensitive data, credentials, or large binary files
 */
const FORBIDDEN_DIRS = [
	".git",
	"node_modules",
	"__pycache__",
	".venv",
	"venv",
	".env",
];

/**
 * Commands allowed for execution
 * This is a security allowlist - only these commands can be run
 */
const ALLOWED_COMMANDS = [
	"git",
	"ls",
	"dir",
	"pwd",
	"cd",
	"echo",
	"cat",
	"grep",
	"find",
	"python",
	"node",
	"npm",
	"pip",
	"uv",
];

/**
 * Dangerous command patterns that should never be executed
 * These can cause system damage or security breaches
 */
const DANGEROUS_PATTERNS = [
	/rm\s+-rf/,
	/del\s+\/[fqsa]/i,
	/format/i,
	/mkfs/,
	/dd\s+if=/,
	/:\(\)\{/, // Fork bomb pattern
	/>\s*\/dev\/sda/,
	/wget.*\|\s*sh/,
	/curl.*\|\s*bash/,
];

/**
 * Path validation result
 */
export interface PathValidation {
	valid: boolean;
	checks: string[];
	resolvedPath?: string;
}

/**
 * Validate a file path for security issues
 * Checks for path traversal, forbidden directories, and resolves to absolute path
 *
 * @param filePath - Path to validate
 * @param operation - Type of operation ('read', 'write', 'list')
 * @returns Validation result with security checks
 */
export function validatePath(
	filePath: string,
	_operation: string = "read"
): PathValidation {
	const checks: string[] = [];

	try {
		// Resolve to absolute path to prevent traversal
		const resolvedPath = path.resolve(filePath);
		const cwd = process.cwd();

		// Check if path is outside current working directory
		if (!resolvedPath.startsWith(cwd)) {
			checks.push(`Path outside allowed directory: ${resolvedPath}`);
			return { valid: false, checks };
		}

		// Check for forbidden paths
		for (const forbidden of FORBIDDEN_PATHS) {
			if (resolvedPath.includes(forbidden)) {
				checks.push(`Forbidden path detected: ${forbidden}`);
				return { valid: false, checks };
			}
		}

		// Check for forbidden directories in path
		const pathParts = resolvedPath.split(path.sep);
		for (const part of pathParts) {
			if (FORBIDDEN_DIRS.includes(part)) {
				checks.push(`Forbidden directory in path: ${part}`);
				return { valid: false, checks };
			}
		}

		checks.push("Path validation passed");
		return { valid: true, checks, resolvedPath };
	} catch (error) {
		checks.push(`Path resolution error: ${error}`);
		return { valid: false, checks };
	}
}

/**
 * Command validation result
 */
export interface CommandValidation {
	valid: boolean;
	reason?: string;
	command?: string;
}

/**
 * Validate a command for security issues
 * Checks against allowlist and dangerous patterns
 *
 * @param command - Command string to validate
 * @returns Validation result
 */
export function validateCommand(command: string): CommandValidation {
	// Check for dangerous patterns first
	for (const pattern of DANGEROUS_PATTERNS) {
		if (pattern.test(command)) {
			return {
				valid: false,
				reason: `Dangerous command pattern detected: ${pattern}`,
			};
		}
	}

	// Extract base command (first word)
	const baseCommand = command.trim().split(/\s+/)[0] || "";

	// Check if command is in allowlist
	const isAllowed = ALLOWED_COMMANDS.some(
		(allowed) => baseCommand === allowed || baseCommand.endsWith(allowed)
	);

	if (!isAllowed) {
		return {
			valid: false,
			reason: `Command not in allowlist: ${baseCommand}`,
		};
	}

	return { valid: true, command: baseCommand };
}

/**
 * Read a file safely with size limits and path validation
 *
 * @param filePath - Path to file
 * @param maxSize - Maximum file size in bytes (default 1MB)
 * @returns File contents as string
 * @throws Error if validation fails or file too large
 */
export async function safeReadFile(
	filePath: string,
	maxSize: number = 1024 * 1024
): Promise<string> {
	// Validate path first
	const validation = validatePath(filePath, "read");
	if (!validation.valid) {
		throw new Error(
			`Security validation failed: ${validation.checks.join("; ")}`
		);
	}

	// Check file size before reading
	const stats = await fs.stat(validation.resolvedPath!);
	if (stats.size > maxSize) {
		throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
	}

	// Read file
	return await fs.readFile(validation.resolvedPath!, "utf-8");
}

/**
 * Write to a file safely with path validation
 * Creates parent directories if needed
 *
 * @param filePath - Path to file
 * @param content - Content to write
 * @returns Success message
 * @throws Error if validation fails
 */
export async function safeWriteFile(
	filePath: string,
	content: string
): Promise<string> {
	// Validate path first
	const validation = validatePath(filePath, "write");
	if (!validation.valid) {
		throw new Error(
			`Security validation failed: ${validation.checks.join("; ")}`
		);
	}

	// Create parent directory if needed
	const dir = path.dirname(validation.resolvedPath!);
	await fs.mkdir(dir, { recursive: true });

	// Write file
	await fs.writeFile(validation.resolvedPath!, content, "utf-8");

	return `File written successfully: ${validation.resolvedPath}`;
}

/**
 * Filter sensitive environment variables
 * Removes API keys, tokens, passwords from environment object
 *
 * @returns Filtered environment object safe to expose
 */
export function filterSensitiveEnvironment(): Record<string, string> {
	const filtered: Record<string, string> = {};
	const sensitivePatterns = [
		/key/i,
		/token/i,
		/secret/i,
		/password/i,
		/credential/i,
		/auth/i,
	];

	for (const [key, value] of Object.entries(process.env)) {
		// Skip if key matches sensitive pattern
		const isSensitive = sensitivePatterns.some((pattern) => pattern.test(key));
		if (!isSensitive && value !== undefined) {
			filtered[key] = value;
		}
	}

	return filtered;
}

/**
 * Get security configuration status
 *
 * @returns Security config with hardening status
 */
export function getSecurityConfig() {
	return {
		hardening_enabled: true,
		command_allowlist_active: true,
		path_validation_active: true,
		security_version: "2.0-typescript",
		allowed_commands: ALLOWED_COMMANDS,
		forbidden_paths: FORBIDDEN_PATHS,
		forbidden_dirs: FORBIDDEN_DIRS,
	};
}
