"""
MCP Resources - Data sources that AI can read
"""

import json
import os
import platform
import sys
from typing import List

from mcp.types import Resource

from .utils.security import run_command


def get_all_resources() -> List[Resource]:
    """Get all available resources"""
    return [
        Resource(
            uri="system://info",
            name="System Information",
            description="Current system information and status",
            mimeType="application/json",
        ),
        Resource(
            uri="workspace://info",
            name="Workspace Information",
            description="Information about the current workspace",
            mimeType="application/json",
        ),
        Resource(
            uri="git://status",
            name="Git Status",
            description="Current git repository status",
            mimeType="text/plain",
        ),
    ]


async def handle_resource_read(uri: str) -> str:
    """Fetch content from a specific resource URI"""

    if uri == "system://info":
        return await _get_system_info()
    elif uri == "workspace://info":
        return await _get_workspace_info()
    elif uri == "git://status":
        return await _get_git_status()
    else:
        raise ValueError(f"Unknown resource URI: {uri}")


async def _get_system_info() -> str:
    """Get system information as JSON"""
    info = {
        "platform": platform.platform(),
        "system": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "python_version": sys.version,
        "python_executable": sys.executable,
        "working_directory": os.getcwd(),
        "environment_variables": {
            key: value
            for key, value in os.environ.items()
            if not key.upper().endswith(("_KEY", "_TOKEN", "_SECRET", "_PASSWORD"))
        },
    }
    return json.dumps(info, indent=2)


async def _get_workspace_info() -> str:
    """Get workspace information as JSON"""
    try:
        cwd = os.getcwd()
        files = []
        directories = []

        # Count files and directories
        for root, dirs, filenames in os.walk(cwd):
            # Skip hidden directories and common build directories
            dirs[:] = [
                d
                for d in dirs
                if not d.startswith(".")
                and d not in ["node_modules", "__pycache__", "venv", ".venv"]
            ]

            for filename in filenames:
                if not filename.startswith("."):
                    files.append(os.path.relpath(os.path.join(root, filename), cwd))

            for dirname in dirs:
                directories.append(os.path.relpath(os.path.join(root, dirname), cwd))

        # Get file type counts
        file_types = {}
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            file_types[ext] = file_types.get(ext, 0) + 1

        info = {
            "workspace_path": cwd,
            "total_files": len(files),
            "total_directories": len(directories),
            "file_types": file_types,
            "recent_files": files[:20],  # First 20 files
            "structure": directories[:20],  # First 20 directories
        }

        return json.dumps(info, indent=2)

    except Exception as e:
        return json.dumps(
            {"error": f"Failed to get workspace info: {str(e)}"}, indent=2
        )


async def _get_git_status() -> str:
    """Get git status as plain text"""
    try:
        result = run_command("git status --porcelain", timeout=10)

        if result["success"]:
            if result["stdout"]:
                return f"Git Status:\n{result['stdout']}"
            else:
                return "Git Status: Working directory clean"
        else:
            return f"Git Error: {result.get('error', 'Failed to get git status')}"

    except Exception as e:
        return f"Git Error: {str(e)}"
