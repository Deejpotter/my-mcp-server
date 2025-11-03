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

		it("should reject forbidden paths like /etc/passwd", () => {
			const result = validatePath("/etc/passwd");
			expect(result.valid).toBe(false);
			expect(result.checks.join(" ")).toContain("outside allowed directory");
		});

		it("should reject paths outside current directory", () => {
			const result = validatePath("/etc/hosts");
			expect(result.valid).toBe(false);
			expect(result.checks.join(" ")).toContain("outside allowed directory");
		});

		it("should reject paths with forbidden directories", () => {
			const testPath = join(process.cwd(), ".git", "config");
			const result = validatePath(testPath);
			expect(result.valid).toBe(false);
			expect(result.checks.join(" ")).toContain("Forbidden directory");
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
	});

	describe("getSecurityConfig", () => {
		it("should return security configuration", () => {
			const config = getSecurityConfig();
			expect(config).toHaveProperty("allowed_commands");
			expect(config).toHaveProperty("forbidden_paths");
			expect(config).toHaveProperty("hardening_enabled");
			expect(Array.isArray(config.allowed_commands)).toBe(true);
		});
	});
});
