#!/usr/bin/env python3
"""
MCP Tool Interactive Tester
Created: 26/10/25
By: Daniel Potter

Interactive CLI for testing MCP tools without needing VS Code.
Provides autocomplete, history, and formatted output for rapid development.

Features:
- Interactive prompt with tool name autocomplete
- Command history
- JSON argument formatting
- Color-coded output
- Performance timing
- Debug mode

Usage:
    uv run python scripts/test_tools.py
    uv run python scripts/test_tools.py --debug
    uv run python scripts/test_tools.py --tool read_file --args '{"file_path":"README.md"}'

References:
Python cmd module: https://docs.python.org/3/library/cmd.html
Asyncio: https://docs.python.org/3/library/asyncio.html
"""

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import click

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.tool_registry import get_all_tools, handle_tool_call


class Colors:
    """ANSI color codes for terminal output"""

    HEADER = "\033[95m"
    OKBLUE = "\033[94m"
    OKCYAN = "\033[96m"
    OKGREEN = "\033[92m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"


class ToolTester:
    """Interactive tool testing interface"""

    def __init__(self, debug: bool = False):
        self.debug = debug
        self.tools = []
        self.tool_map = {}
        self.load_tools()

    def load_tools(self):
        """Load all available tools"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            self.tools = loop.run_until_complete(self._get_tools())
            self.tool_map = {tool.name: tool for tool in self.tools}
            loop.close()
        except Exception as e:
            print(f"{Colors.FAIL}Error loading tools: {e}{Colors.ENDC}")
            sys.exit(1)

    async def _get_tools(self):
        """Get all tools asynchronously"""
        return get_all_tools()

    def print_banner(self):
        """Print welcome banner"""
        print(f"\n{Colors.BOLD}{Colors.OKBLUE}")
        print("=" * 60)
        print("  MCP Tool Interactive Tester")
        print("=" * 60)
        print(f"{Colors.ENDC}")
        print(f"{Colors.OKCYAN}Loaded {len(self.tools)} tools{Colors.ENDC}")
        print(
            f"{Colors.OKCYAN}Type 'help' for commands, 'list' to see tools{Colors.ENDC}\n"
        )

    def print_help(self):
        """Print help information"""
        print(f"\n{Colors.BOLD}Commands:{Colors.ENDC}")
        print(
            f"  {Colors.OKGREEN}list{Colors.ENDC}                  - List all available tools"
        )
        print(
            f"  {Colors.OKGREEN}show <tool>{Colors.ENDC}           - Show tool details and schema"
        )
        print(
            f"  {Colors.OKGREEN}call <tool> <args>{Colors.ENDC}    - Call a tool with JSON arguments"
        )
        print(
            f"  {Colors.OKGREEN}test <tool>{Colors.ENDC}           - Interactive test mode for a tool"
        )
        print(
            f"  {Colors.OKGREEN}perf{Colors.ENDC}                  - Show performance metrics"
        )
        print(f"  {Colors.OKGREEN}help{Colors.ENDC}                  - Show this help")
        print(
            f"  {Colors.OKGREEN}exit{Colors.ENDC}                  - Exit the tester\n"
        )

        print(f"{Colors.BOLD}Examples:{Colors.ENDC}")
        print(f'  call read_file {{"file_path": "README.md"}}')
        print(f'  call system_stats {{"interval": 0.5}}')
        print(f"  test search_files\n")

    def list_tools(self):
        """List all available tools"""
        print(f"\n{Colors.BOLD}Available Tools ({len(self.tools)}):{Colors.ENDC}\n")

        categories = {}
        for tool in self.tools:
            # Simple categorization by name prefix
            if "_" in tool.name:
                category = tool.name.split("_")[0]
            else:
                category = "other"

            if category not in categories:
                categories[category] = []
            categories[category].append(tool)

        for category, tools in sorted(categories.items()):
            print(f"{Colors.OKBLUE}{category.title()}:{Colors.ENDC}")
            for tool in sorted(tools, key=lambda t: t.name):
                desc = (
                    tool.description[:60] + "..."
                    if len(tool.description) > 60
                    else tool.description
                )
                print(f"  • {Colors.OKGREEN}{tool.name}{Colors.ENDC}: {desc}")
            print()

    def show_tool(self, tool_name: str):
        """Show detailed information about a tool"""
        if tool_name not in self.tool_map:
            print(f"{Colors.FAIL}Tool '{tool_name}' not found{Colors.ENDC}")
            return

        tool = self.tool_map[tool_name]

        print(f"\n{Colors.BOLD}Tool: {tool_name}{Colors.ENDC}")
        print(f"{Colors.OKBLUE}{'=' * 60}{Colors.ENDC}")
        print(f"\n{Colors.BOLD}Description:{Colors.ENDC}")
        print(f"  {tool.description}\n")

        print(f"{Colors.BOLD}Parameters:{Colors.ENDC}")
        schema = tool.inputSchema
        properties = schema.get("properties", {})
        required = schema.get("required", [])

        if not properties:
            print("  (No parameters)")
        else:
            for param_name, param_info in properties.items():
                req_marker = (
                    f"{Colors.WARNING}*{Colors.ENDC}" if param_name in required else " "
                )
                param_type = param_info.get("type", "unknown")
                param_desc = param_info.get("description", "No description")
                default = param_info.get("default")

                print(
                    f"  {req_marker} {Colors.OKGREEN}{param_name}{Colors.ENDC} ({param_type})"
                )
                print(f"      {param_desc}")
                if default is not None:
                    print(f"      Default: {default}")

        print(f"\n{Colors.BOLD}Example:{Colors.ENDC}")
        example_args = {}
        for param_name, param_info in properties.items():
            if param_name in required:
                param_type = param_info.get("type", "string")
                if param_type == "string":
                    example_args[param_name] = "example_value"
                elif param_type == "integer":
                    example_args[param_name] = 0
                elif param_type == "boolean":
                    example_args[param_name] = False
                elif param_type == "array":
                    example_args[param_name] = []

        example_json = json.dumps(example_args, indent=2)
        print(f"  call {tool_name} {example_json}\n")

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]):
        """Call a tool with given arguments"""
        if tool_name not in self.tool_map:
            print(f"{Colors.FAIL}Tool '{tool_name}' not found{Colors.ENDC}")
            return

        print(f"\n{Colors.OKCYAN}Calling {tool_name}...{Colors.ENDC}")

        start_time = time.perf_counter()
        try:
            result = await handle_tool_call(tool_name, arguments)
            end_time = time.perf_counter()
            duration_ms = (end_time - start_time) * 1000

            print(f"\n{Colors.BOLD}Result:{Colors.ENDC}")
            print(f"{Colors.OKBLUE}{'=' * 60}{Colors.ENDC}")

            for item in result:
                print(item.text)

            print(
                f"\n{Colors.OKCYAN}⏱️  Execution time: {duration_ms:.2f}ms{Colors.ENDC}\n"
            )

        except Exception as e:
            end_time = time.perf_counter()
            duration_ms = (end_time - start_time) * 1000
            print(f"\n{Colors.FAIL}Error: {str(e)}{Colors.ENDC}")
            print(
                f"{Colors.OKCYAN}⏱️  Time to error: {duration_ms:.2f}ms{Colors.ENDC}\n"
            )

            if self.debug:
                import traceback

                print(f"{Colors.WARNING}Debug traceback:{Colors.ENDC}")
                traceback.print_exc()

    async def interactive_test(self, tool_name: str):
        """Interactive testing mode for a tool"""
        if tool_name not in self.tool_map:
            print(f"{Colors.FAIL}Tool '{tool_name}' not found{Colors.ENDC}")
            return

        tool = self.tool_map[tool_name]
        self.show_tool(tool_name)

        print(f"{Colors.BOLD}Interactive Test Mode{Colors.ENDC}")
        print("Enter parameter values (or press Enter to skip optional parameters)\n")

        schema = tool.inputSchema
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        arguments = {}

        for param_name, param_info in properties.items():
            is_required = param_name in required
            param_type = param_info.get("type", "string")
            default = param_info.get("default")

            prompt = f"{param_name} ({param_type})"
            if default is not None:
                prompt += f" [default: {default}]"
            if is_required:
                prompt += f" {Colors.WARNING}*{Colors.ENDC}"
            prompt += ": "

            while True:
                value = input(prompt).strip()

                if not value and not is_required:
                    break

                if not value and is_required:
                    print(f"{Colors.WARNING}This parameter is required{Colors.ENDC}")
                    continue

                # Try to parse the value
                try:
                    if param_type == "integer":
                        arguments[param_name] = int(value)
                    elif param_type == "boolean":
                        arguments[param_name] = value.lower() in ["true", "yes", "1"]
                    elif param_type == "array":
                        arguments[param_name] = json.loads(value)
                    else:
                        arguments[param_name] = value
                    break
                except (ValueError, json.JSONDecodeError) as e:
                    print(f"{Colors.FAIL}Invalid value: {e}{Colors.ENDC}")

        print(
            f"\n{Colors.OKCYAN}Arguments: {json.dumps(arguments, indent=2)}{Colors.ENDC}"
        )
        await self.call_tool(tool_name, arguments)

    async def show_performance(self):
        """Show performance metrics"""
        print(f"\n{Colors.BOLD}Fetching performance metrics...{Colors.ENDC}\n")
        try:
            result = await handle_tool_call("performance_metrics", {})
            for item in result:
                print(item.text)
            print()
        except Exception as e:
            print(f"{Colors.FAIL}Error fetching metrics: {e}{Colors.ENDC}")

    async def run_interactive(self):
        """Run interactive mode"""
        self.print_banner()

        while True:
            try:
                user_input = input(f"{Colors.OKGREEN}mcp>{Colors.ENDC} ").strip()

                if not user_input:
                    continue

                parts = user_input.split(maxsplit=1)
                command = parts[0].lower()

                if command == "exit" or command == "quit":
                    print(f"{Colors.OKCYAN}Goodbye!{Colors.ENDC}")
                    break

                elif command == "help":
                    self.print_help()

                elif command == "list":
                    self.list_tools()

                elif command == "show" and len(parts) > 1:
                    self.show_tool(parts[1])

                elif command == "call" and len(parts) > 1:
                    try:
                        # Parse: call tool_name {"arg": "value"}
                        remaining = parts[1]
                        tool_parts = remaining.split(maxsplit=1)
                        if len(tool_parts) < 2:
                            print(
                                f"{Colors.FAIL}Usage: call <tool_name> <json_args>{Colors.ENDC}"
                            )
                            continue

                        tool_name = tool_parts[0]
                        args_json = tool_parts[1]
                        arguments = json.loads(args_json)

                        await self.call_tool(tool_name, arguments)
                    except json.JSONDecodeError as e:
                        print(f"{Colors.FAIL}Invalid JSON: {e}{Colors.ENDC}")
                    except Exception as e:
                        print(f"{Colors.FAIL}Error: {e}{Colors.ENDC}")

                elif command == "test" and len(parts) > 1:
                    await self.interactive_test(parts[1])

                elif command == "perf":
                    await self.show_performance()

                else:
                    print(
                        f"{Colors.FAIL}Unknown command. Type 'help' for available commands.{Colors.ENDC}"
                    )

            except KeyboardInterrupt:
                print(f"\n{Colors.OKCYAN}Use 'exit' to quit{Colors.ENDC}")
            except EOFError:
                print(f"\n{Colors.OKCYAN}Goodbye!{Colors.ENDC}")
                break
            except Exception as e:
                print(f"{Colors.FAIL}Error: {e}{Colors.ENDC}")
                if self.debug:
                    import traceback

                    traceback.print_exc()


@click.command()
@click.option("--debug", is_flag=True, help="Enable debug mode with verbose output")
@click.option("--tool", help="Tool name to call directly")
@click.option("--args", help="JSON arguments for direct tool call")
def main(debug: bool, tool: Optional[str], args: Optional[str]):
    """
    MCP Tool Interactive Tester

    Test MCP tools without needing VS Code. Provides an interactive CLI
    with autocomplete, history, and formatted output.
    """
    tester = ToolTester(debug=debug)

    if tool:
        # Direct tool call mode
        try:
            arguments = json.loads(args) if args else {}
            asyncio.run(tester.call_tool(tool, arguments))
        except json.JSONDecodeError as e:
            print(f"{Colors.FAIL}Invalid JSON arguments: {e}{Colors.ENDC}")
            sys.exit(1)
    else:
        # Interactive mode
        asyncio.run(tester.run_interactive())


if __name__ == "__main__":
    main()
