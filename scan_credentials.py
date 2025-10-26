#!/usr/bin/env python3
"""
Simple credential scanner for repository security
Created: 26/10/25
By: Daniel Potter

Scans repository files for potential credential exposures.
Use before committing to catch accidentally included API keys.

Usage: python scan_credentials.py
"""

import os
import re
import sys
from pathlib import Path

# Credential patterns to detect
CREDENTIAL_PATTERNS = [
    # API Key patterns
    (
        r"ctx7sk-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
        "Context7 API Key",
    ),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub Personal Access Token"),
    (r"pk_[0-9]+_[A-Za-z0-9]{40}", "ClickUp API Token"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key"),
    (r"sk-[A-Za-z0-9]{48}", "OpenAI API Key"),
    # Generic patterns
    (
        r'["\']?[A-Za-z0-9_]*[Kk][Ee][Yy]["\']?\s*[:=]\s*["\'][A-Za-z0-9/+]{20,}["\']',
        "Generic API Key",
    ),
    (
        r'["\']?[A-Za-z0-9_]*[Tt][Oo][Kk][Ee][Nn]["\']?\s*[:=]\s*["\'][A-Za-z0-9/+]{20,}["\']',
        "Generic Token",
    ),
    (
        r'["\']?[A-Za-z0-9_]*[Ss][Ee][Cc][Rr][Ee][Tt]["\']?\s*[:=]\s*["\'][A-Za-z0-9/+]{20,}["\']',
        "Generic Secret",
    ),
]

# Files to exclude from scanning
EXCLUDE_PATTERNS = [
    r"\.git/",
    r"__pycache__/",
    r"\.pyc$",
    r"node_modules/",
    r"\.env\.example$",  # Example files are OK
    r"validate_core_security\.py$",  # Our test file
    r"scan_credentials\.py$",  # This file
]

# Safe placeholder patterns (these are OK)
SAFE_PATTERNS = [
    r"your_.*_here",
    r"your_.*_token",
    r"your_.*_key",
    r"placeholder",
    r"example_.*",
    r"fake_.*",
    r"test_.*_key",
    r"dummy_.*",
]


def is_excluded_file(file_path):
    """Check if file should be excluded from scanning"""
    file_str = str(file_path)
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, file_str):
            return True
    return False


def is_safe_placeholder(text):
    """Check if detected credential is actually a safe placeholder"""
    text_lower = text.lower()
    for pattern in SAFE_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    return False


def scan_file(file_path):
    """Scan a single file for credential patterns"""
    findings = []

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        for line_num, line in enumerate(content.split("\n"), 1):
            for pattern, description in CREDENTIAL_PATTERNS:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                for match in matches:
                    matched_text = match.group(0)

                    # Skip safe placeholders
                    if is_safe_placeholder(matched_text):
                        continue

                    findings.append(
                        {
                            "file": file_path,
                            "line": line_num,
                            "type": description,
                            "match": (
                                matched_text[:50] + "..."
                                if len(matched_text) > 50
                                else matched_text
                            ),
                            "context": (
                                line.strip()[:100] + "..."
                                if len(line.strip()) > 100
                                else line.strip()
                            ),
                        }
                    )

    except Exception as e:
        print(f"⚠️ Error scanning {file_path}: {e}")

    return findings


def scan_repository(root_path="."):
    """Scan entire repository for credentials"""
    print("🔍 Scanning repository for potential credential exposures...")
    print(f"📁 Root path: {os.path.abspath(root_path)}")
    print()

    all_findings = []
    files_scanned = 0

    for root, dirs, files in os.walk(root_path):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith(".")]

        for file in files:
            file_path = Path(root) / file

            # Skip excluded files
            if is_excluded_file(file_path):
                continue

            # Only scan text files
            if file_path.suffix.lower() in [
                ".py",
                ".md",
                ".txt",
                ".json",
                ".yaml",
                ".yml",
                ".env",
                ".cfg",
                ".ini",
                ".sh",
                ".bat",
            ]:
                findings = scan_file(file_path)
                all_findings.extend(findings)
                files_scanned += 1

    print(f"📊 Scanned {files_scanned} files")
    print()

    return all_findings


def main():
    """Main credential scanning function"""
    print("🔒 Repository Credential Scanner")
    print("=" * 40)

    # Scan repository
    findings = scan_repository()

    if not findings:
        print("✅ No credential exposures detected!")
        print("🔒 Repository appears secure")
        return 0

    print(f"❌ Found {len(findings)} potential credential exposures:")
    print()

    for finding in findings:
        print(f"🚨 {finding['type']}")
        print(f"   📁 File: {finding['file']}")
        print(f"   📍 Line: {finding['line']}")
        print(f"   🔍 Match: {finding['match']}")
        print(f"   📄 Context: {finding['context']}")
        print()

    print("🔧 Recommended Actions:")
    print("1. Replace actual credentials with placeholders (e.g., 'your_api_key_here')")
    print("2. Move real credentials to environment variables")
    print("3. Add sensitive files to .gitignore")
    print("4. Use .env.example for configuration templates")
    print()

    return 1


if __name__ == "__main__":
    sys.exit(main())
