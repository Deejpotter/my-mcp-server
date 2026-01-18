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
import * as fsp from "fs/promises";
import * as fsSync from "fs";
import { fileURLToPath } from "url";

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
 * Includes both Unix and Windows equivalents for cross-platform support
 */
const ALLOWED_COMMANDS = [
	"git",
	"ls",
	"dir",
	"pwd",
	"cd",
	"echo",
	"cat",
	"type",
	"grep",
	"findstr",
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
	operation: string = "read"
): PathValidation {
	const checks: string[] = [];

	try {
		const resolvedPath = normalizeFsPath(filePath);

		// Load allowlist roots (repo, cwd, home, optional Windows Users, env/JSON)
		const allowedRoots = getAllowedRoots();

		// Quick forbidden checks first (apply regardless of allowlist)
		// Normalize forbidden paths to match the resolved path's format for consistent comparison
		for (const forbidden of FORBIDDEN_PATHS) {
			const normalizedForbidden = normalizeFsPath(forbidden);
			// Check if the forbidden path is contained in the resolved path
			if (resolvedPath.includes(normalizedForbidden)) {
				checks.push(`Forbidden path detected: ${forbidden}`);
				return { valid: false, checks };
			}
		}

		// Check for forbidden directories in path components
		const parts = resolvedPath.split(path.sep);
		for (const part of parts) {
			if (FORBIDDEN_DIRS.includes(part)) {
				checks.push(`Forbidden directory in path: ${part}`);
				return { valid: false, checks };
			}
		}

		// Enforce allowlist
		for (const root of allowedRoots) {
			if (isSubpath(resolvedPath, root.root)) {
				// Write operation blocked on read-only roots
				if (operation === "write" && root.mode === "ro") {
					checks.push(
						`Write blocked: read-only root ${root.root}`
					);
					return { valid: false, checks };
				}
				checks.push("Path validation passed");
				return { valid: true, checks, resolvedPath };
			}
		}

		checks.push(
			`Path outside allowed directories: ${resolvedPath}`
		);
		return { valid: false, checks };
	} catch (error) {
		checks.push(`Path resolution error: ${error}`);
		return { valid: false, checks };
	}
}

// --- Enhanced allowlist logic below ---

type AllowedRoot = { root: string; mode: "ro" | "rw" };

function isWindows(): boolean {
	return process.platform === "win32";
}

function normalizeFsPath(p: string): string {
	// Resolve to absolute and strip trailing separators (but keep volume root)
	let abs = path.resolve(p);
	abs = abs.replace(/[\\\/]+$/, "");
	if (isWindows()) {
		abs = abs.toLowerCase().split("/").join("\\");
	}
	return abs;
}

function moduleRootDir(): string {
	try {
		const thisFile = fileURLToPath(import.meta.url);
		// dist/utils/security.js → project root is two levels up from dist
		// Walk up until we find a package.json or .git
		let dir = normalizeFsPath(path.dirname(thisFile));
		const volumeRoot = isWindows() ? dir.split("\\")[0] + "\\" : "/";
		while (true) {
			const pkg = path.join(dir, "package.json");
			const git = path.join(dir, ".git");
			try {
				if (fsSync.existsSync(pkg) || fsSync.existsSync(git)) {
					return dir;
				}
			} catch {
				// ignore
			}
			if (dir === volumeRoot) break;
			dir = normalizeFsPath(path.dirname(dir));
		}
	} catch {
		// ignore
	}
	return normalizeFsPath(process.cwd());
}

function getHomeDir(): string | undefined {
	const home = process.env[isWindows() ? "USERPROFILE" : "HOME"];
	return home ? normalizeFsPath(home) : undefined;
}

// No longer exposing C:\Users as a default root; limiting to the current user's HOME reduces blast radius.

function expandHome(input: string): string {
	if (!input) return input;
	const home = process.env[isWindows() ? "USERPROFILE" : "HOME"];
	if (!home) return input;
	if (input.startsWith("~")) {
		return path.join(home, input.slice(1));
	}
	if (isWindows() && input.toUpperCase().includes("%USERPROFILE%")) {
		return input.replace(/%USERPROFILE%/gi, home);
	}
	return input;
}

function parseAllowedFromEnv(): AllowedRoot[] {
	const raw = process.env.MCP_ALLOWED_PATHS?.trim();
	if (!raw) return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
		.map((entry) => {
			const [maybeMode, maybePath] = entry.includes(":")
				? entry.split(":", 2)
				: [undefined, entry];
			const mode: "ro" | "rw" =
				maybeMode === "ro" || maybeMode === "rw" ? (maybeMode as any) : "rw";
			const base = normalizeFsPath(expandHome(maybePath ?? entry));
			return { root: base, mode };
		});
}

function tryReadJson<T = unknown>(file: string): T | undefined {
	try {
		if (fsSync.existsSync(file)) {
			const raw = fsSync.readFileSync(file, "utf8");
			return JSON.parse(raw) as T;
		}
	} catch {
		// degrade gracefully
	}
	return undefined;
}

function parseAllowedFromConfig(repoRoot: string): AllowedRoot[] {
	const jsonPath = path.join(repoRoot, ".mcp-allowed-paths.json");
	const cfg = tryReadJson<{
		paths?: Array<{ path: string; mode?: "ro" | "rw" }>;
	}>(jsonPath);
	if (!cfg?.paths?.length) return [];
	return cfg.paths
		.filter((p) => p?.path)
		.map((p) => {
			const base = normalizeFsPath(expandHome(p.path));
			return { root: base, mode: p.mode === "ro" ? "ro" : "rw" };
		});
}

function isSubpath(child: string, parent: string): boolean {
	const rel = path.relative(parent, child);
	if (!rel) return true; // same dir
	if (rel === ".." || rel.startsWith(".." + path.sep)) return false;
	return !path.isAbsolute(rel);
}

function getDefaultAllowedRoots(): AllowedRoot[] {
	const repo = moduleRootDir();
	const cwd = normalizeFsPath(process.cwd());
	const home = getHomeDir();

	const defaults: AllowedRoot[] = [{ root: repo, mode: "rw" }];
	if (cwd !== repo) defaults.push({ root: cwd, mode: "rw" });
	if (home) defaults.push({ root: home, mode: "rw" });
	return defaults;
}

function getAllowedRoots(): AllowedRoot[] {
	const defaults = getDefaultAllowedRoots();
	const envRoots = parseAllowedFromEnv();
	const repoForConfig = defaults[0]?.root ?? moduleRootDir();
	const cfgRoots = parseAllowedFromConfig(repoForConfig);
	const byRoot = new Map<string, AllowedRoot>();
	for (const r of [...defaults, ...cfgRoots, ...envRoots]) {
		const existing = byRoot.get(r.root);
		if (!existing) {
			byRoot.set(r.root, r);
		} else {
			const mode: "ro" | "rw" = existing.mode === "rw" || r.mode === "rw" ? "rw" : "ro";
			byRoot.set(r.root, { root: existing.root, mode });
		}
	}
	return [...byRoot.values()];
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
	const stats = await fsp.stat(validation.resolvedPath!);
	if (stats.size > maxSize) {
		throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
	}

	// Read file
	return await fsp.readFile(validation.resolvedPath!, "utf-8");
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
	await fsp.mkdir(dir, { recursive: true });

	// Write file
	await fsp.writeFile(validation.resolvedPath!, content, "utf-8");

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
