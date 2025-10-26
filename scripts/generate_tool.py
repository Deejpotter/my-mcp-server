#!/usr/bin/env python3
"""
MCP Tool/Integration Template Generator
Created: 26/10/25
By: Daniel Potter

Generates boilerplate code for new MCP tools and API integrations.
Ensures consistency and includes all security best practices.

Features:
- Interactive prompts for tool creation
- Generates complete tool with schema and handler
- Includes security validation boilerplate
- Creates test file template
- Updates tool_registry.py automatically

Usage:
    uv run python scripts/generate_tool.py
    uv run python scripts/generate_tool.py --type integration --name slack

References:
MCP Tools: https://modelcontextprotocol.io/docs/concepts/tools
Jinja2 Templates: https://jinja.palletsprojects.com/
"""

import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import click

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


class Colors:
    """ANSI color codes"""

    OKGREEN = "\033[92m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"
    OKCYAN = "\033[96m"


# Templates
TOOL_TEMPLATE = '''"""
{category} tools for MCP server
Created: {date}
By: {author}

{description}

References:
{references}
"""

from typing import Any, Dict, List

from mcp.types import Tool, TextContent
import mcp.types as types

from ..utils.security import validate_file_path, get_security_config


def get_{module_name}_tools() -> List[Tool]:
    """Get all {category} tool definitions"""
    return [
        Tool(
            name="{tool_name}",
            description="{tool_description}",
            inputSchema={{
                "type": "object",
                "properties": {{
{schema_properties}
                }},
                "required": [{required_params}],
            }},
        ),
    ]


async def handle_{module_name}(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle {category} tool calls"""
    
    if name == "{tool_name}":
        try:
{handler_code}
            
            return [types.TextContent(
                type="text",
                text=f"✅ {{name}} completed successfully"
            )]
            
        except Exception as e:
            return [types.TextContent(
                type="text",
                text=f"❌ Error in {{name}}: {{str(e)}}"
            )]
    
    else:
        return [types.TextContent(
            type="text",
            text=f"❌ Unknown {category} tool: {{name}}"
        )]
'''

INTEGRATION_TEMPLATE = '''"""
{service_name} API Integration
Created: {date}
By: {author}

{description}

References:
{service_name} API: {api_url}
"""

import os
from typing import Any, Dict, List

import httpx
from mcp.types import Tool, TextContent
import mcp.types as types


def get_{service_lower}_tools() -> List[Tool]:
    """Get all {service_name} integration tool definitions"""
    return [
        Tool(
            name="{service_lower}_{action}",
            description="{tool_description}",
            inputSchema={{
                "type": "object",
                "properties": {{
{schema_properties}
                }},
                "required": [{required_params}],
            }},
        ),
    ]


async def handle_{service_lower}_tools(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    """Handle {service_name} integration tool calls"""
    
    if name == "{service_lower}_{action}":
        try:
            # Get API credentials from environment
            api_key = os.getenv("{env_var}_API_KEY")
            if not api_key:
                return [types.TextContent(
                    type="text",
                    text="❌ API key not found. Set {env_var}_API_KEY environment variable."
                )]
            
            api_url = os.getenv("{env_var}_API_URL", "{default_url}")
            
{handler_code}
            
            # Make API request
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{{api_url}}/endpoint",
                    headers={{"Authorization": f"Bearer {{api_key}}"}},
                    timeout=30.0
                )
                response.raise_for_status()
                data = response.json()
            
            return [types.TextContent(
                type="text",
                text=f"✅ {{name}} completed: {{data}}"
            )]
            
        except httpx.HTTPError as e:
            return [types.TextContent(
                type="text",
                text=f"❌ API Error: {{str(e)}}"
            )]
        except Exception as e:
            return [types.TextContent(
                type="text",
                text=f"❌ Error: {{str(e)}}"
            )]
    
    else:
        return [types.TextContent(
            type="text",
            text=f"❌ Unknown {service_name} tool: {{name}}"
        )]
'''

TEST_TEMPLATE = '''"""
Tests for {module_name}
Created: {date}
"""

import pytest
from src.tools.{module_name} import get_{module_name}_tools, handle_{module_name}


class Test{class_name}:
    """Test {category} tools"""
    
    def test_get_tools(self):
        """Test that tools are properly defined"""
        tools = get_{module_name}_tools()
        assert len(tools) > 0
        assert all(hasattr(tool, "name") for tool in tools)
        assert all(hasattr(tool, "description") for tool in tools)
    
    @pytest.mark.asyncio
    async def test_{tool_name}(self):
        """Test {tool_name} tool"""
        result = await handle_{module_name}("{tool_name}", {{}})
        assert len(result) > 0
        assert hasattr(result[0], "text")
'''


class ToolGenerator:
    """Generator for MCP tools and integrations"""

    def __init__(self):
        self.project_root = project_root
        self.src_dir = self.project_root / "src"
        self.tools_dir = self.src_dir / "tools"
        self.integrations_dir = self.src_dir / "integrations"
        self.tests_dir = self.project_root / "tests"

    def generate_tool(
        self,
        tool_name: str,
        category: str,
        description: str,
        parameters: List[Dict[str, str]],
        author: str = "Daniel Potter",
    ):
        """Generate a new tool"""
        print(f"\n{Colors.OKCYAN}Generating tool: {tool_name}{Colors.ENDC}")

        # Determine module name and file path
        module_name = tool_name.split("_")[0] if "_" in tool_name else tool_name
        file_path = self.tools_dir / f"{module_name}.py"

        # Build schema properties
        schema_props = []
        required_params = []
        for param in parameters:
            param_name = param["name"]
            param_type = param["type"]
            param_desc = param["description"]
            is_required = param.get("required", False)

            schema_props.append(
                f'                    "{param_name}": {{'
                f'"type": "{param_type}", '
                f'"description": "{param_desc}"}},'
            )

            if is_required:
                required_params.append(f'"{param_name}"')

        # Build handler code
        handler_lines = []
        for param in parameters:
            param_name = param["name"]
            default = param.get(
                "default", '""' if param["type"] == "string" else "None"
            )
            handler_lines.append(
                f'            {param_name} = arguments.get("{param_name}", {default})'
            )

        # Generate the file
        content = TOOL_TEMPLATE.format(
            category=category,
            date=datetime.now().strftime("%d/%m/%y"),
            author=author,
            description=description,
            references="MCP Tools: https://modelcontextprotocol.io/docs/concepts/tools",
            module_name=module_name,
            tool_name=tool_name,
            tool_description=description,
            schema_properties="\n".join(schema_props),
            required_params=", ".join(required_params),
            handler_code=(
                "\n".join(handler_lines) if handler_lines else "            pass"
            ),
        )

        # Write the file
        file_path.write_text(content)
        print(f"{Colors.OKGREEN}✓ Created: {file_path}{Colors.ENDC}")

        # Generate test file
        self.generate_test(tool_name, module_name, category)

        # Update tool_registry
        self.update_tool_registry(tool_name, module_name, category)

        print(f"\n{Colors.BOLD}Next steps:{Colors.ENDC}")
        print(f"1. Implement the tool logic in: {file_path}")
        print(f"2. Add environment variables to .env.example (if needed)")
        print(f"3. Write tests in: tests/test_{module_name}.py")
        print(f"4. Test with: uv run python scripts/test_tools.py --tool {tool_name}\n")

    def generate_integration(
        self,
        service_name: str,
        action: str,
        description: str,
        api_url: str,
        parameters: List[Dict[str, str]],
        author: str = "Daniel Potter",
    ):
        """Generate a new API integration"""
        print(f"\n{Colors.OKCYAN}Generating integration: {service_name}{Colors.ENDC}")

        service_lower = service_name.lower().replace(" ", "_")
        env_var = service_name.upper().replace(" ", "_")
        file_path = self.integrations_dir / f"{service_lower}_api.py"

        # Build schema properties
        schema_props = []
        required_params = []
        for param in parameters:
            param_name = param["name"]
            param_type = param["type"]
            param_desc = param["description"]
            is_required = param.get("required", False)

            schema_props.append(
                f'                    "{param_name}": {{'
                f'"type": "{param_type}", '
                f'"description": "{param_desc}"}},'
            )

            if is_required:
                required_params.append(f'"{param_name}"')

        # Build handler code
        handler_lines = []
        for param in parameters:
            param_name = param["name"]
            default = param.get(
                "default", '""' if param["type"] == "string" else "None"
            )
            handler_lines.append(
                f'            {param_name} = arguments.get("{param_name}", {default})'
            )

        # Generate the file
        content = INTEGRATION_TEMPLATE.format(
            service_name=service_name,
            date=datetime.now().strftime("%d/%m/%y"),
            author=author,
            description=description,
            api_url=api_url,
            service_lower=service_lower,
            action=action,
            tool_description=description,
            schema_properties="\n".join(schema_props),
            required_params=", ".join(required_params),
            env_var=env_var,
            default_url=api_url,
            handler_code=(
                "\n".join(handler_lines) if handler_lines else "            pass"
            ),
        )

        # Write the file
        file_path.write_text(content)
        print(f"{Colors.OKGREEN}✓ Created: {file_path}{Colors.ENDC}")

        print(f"\n{Colors.BOLD}Next steps:{Colors.ENDC}")
        print(f"1. Add to .env.example:")
        print(f"   {env_var}_API_KEY=your_api_key")
        print(f"   {env_var}_API_URL={api_url}")
        print(f"2. Implement API logic in: {file_path}")
        print(f"3. Update external_apis.py to import and route the new tool")
        print(
            f"4. Test with: uv run python scripts/test_tools.py --tool {service_lower}_{action}\n"
        )

    def generate_test(self, tool_name: str, module_name: str, category: str):
        """Generate test file for a tool"""
        test_path = self.tests_dir / f"test_{module_name}.py"

        if test_path.exists():
            print(
                f"{Colors.WARNING}⚠ Test file already exists: {test_path}{Colors.ENDC}"
            )
            return

        class_name = "".join(word.capitalize() for word in module_name.split("_"))

        content = TEST_TEMPLATE.format(
            module_name=module_name,
            date=datetime.now().strftime("%d/%m/%y"),
            category=category,
            class_name=class_name,
            tool_name=tool_name,
        )

        test_path.write_text(content)
        print(f"{Colors.OKGREEN}✓ Created test: {test_path}{Colors.ENDC}")

    def update_tool_registry(self, tool_name: str, module_name: str, category: str):
        """Update tool_registry.py with new tool"""
        registry_path = self.src_dir / "tool_registry.py"
        content = registry_path.read_text()

        # Add import if not exists
        import_line = f"from .tools.{module_name} import get_{module_name}_tools, handle_{module_name}"
        if import_line not in content:
            # Find the imports section and add
            import_section = content.find("from .tools.")
            if import_section != -1:
                # Find end of imports
                next_section = content.find("\n\n", import_section)
                content = (
                    content[:next_section] + f"\n{import_line}" + content[next_section:]
                )
                print(
                    f"{Colors.OKGREEN}✓ Added import to tool_registry.py{Colors.ENDC}"
                )

        # Add to get_all_tools if not exists
        tools_extend = f"    tools.extend(get_{module_name}_tools())"
        if tools_extend not in content:
            # Find get_all_tools function
            func_start = content.find("def get_all_tools")
            if func_start != -1:
                # Find the end of the function (before return)
                return_pos = content.find("return tools", func_start)
                content = (
                    content[:return_pos]
                    + f"{tools_extend}\n    "
                    + content[return_pos:]
                )
                print(f"{Colors.OKGREEN}✓ Added to get_all_tools(){Colors.ENDC}")

        # Add to handle_tool_call routing
        elif_clause = f'    elif name in ["{tool_name}"]:\n        return await handle_{module_name}(name, arguments)'
        if elif_clause not in content:
            # Find handle_tool_call function
            func_start = content.find("async def handle_tool_call")
            if func_start != -1:
                # Find the else clause
                else_pos = content.find("else:", func_start)
                if else_pos != -1:
                    # Insert before else
                    indent = "        "
                    content = (
                        content[:else_pos]
                        + f"\n{elif_clause}\n\n    "
                        + content[else_pos:]
                    )
                    print(
                        f"{Colors.OKGREEN}✓ Added routing to handle_tool_call(){Colors.ENDC}"
                    )

        registry_path.write_text(content)
        print(f"{Colors.OKGREEN}✓ Updated: {registry_path}{Colors.ENDC}")


@click.group()
def cli():
    """MCP Tool/Integration Template Generator"""
    pass


@cli.command()
@click.option("--name", prompt="Tool name (e.g., analyze_code)", help="Tool name")
@click.option("--category", prompt="Category (e.g., analysis)", help="Tool category")
@click.option("--description", prompt="Description", help="Tool description")
def tool(name: str, category: str, description: str):
    """Generate a new tool"""
    generator = ToolGenerator()

    print(
        f"\n{Colors.BOLD}Define parameters (press Enter with empty name to finish):{Colors.ENDC}"
    )
    parameters = []

    while True:
        param_name = input(f"{Colors.OKCYAN}Parameter name: {Colors.ENDC}").strip()
        if not param_name:
            break

        param_type = (
            input(
                f"{Colors.OKCYAN}Type (string/integer/boolean/array): {Colors.ENDC}"
            ).strip()
            or "string"
        )
        param_desc = input(f"{Colors.OKCYAN}Description: {Colors.ENDC}").strip()
        is_required = (
            input(f"{Colors.OKCYAN}Required? (y/n): {Colors.ENDC}").strip().lower()
            == "y"
        )

        parameters.append(
            {
                "name": param_name,
                "type": param_type,
                "description": param_desc,
                "required": is_required,
            }
        )

    generator.generate_tool(name, category, description, parameters)


@cli.command()
@click.option("--name", prompt="Service name (e.g., Slack)", help="Service name")
@click.option("--action", prompt="Action (e.g., send_message)", help="Action name")
@click.option("--description", prompt="Description", help="Tool description")
@click.option("--api-url", prompt="API URL", help="Base API URL")
def integration(name: str, action: str, description: str, api_url: str):
    """Generate a new API integration"""
    generator = ToolGenerator()

    print(
        f"\n{Colors.BOLD}Define parameters (press Enter with empty name to finish):{Colors.ENDC}"
    )
    parameters = []

    while True:
        param_name = input(f"{Colors.OKCYAN}Parameter name: {Colors.ENDC}").strip()
        if not param_name:
            break

        param_type = (
            input(
                f"{Colors.OKCYAN}Type (string/integer/boolean/array): {Colors.ENDC}"
            ).strip()
            or "string"
        )
        param_desc = input(f"{Colors.OKCYAN}Description: {Colors.ENDC}").strip()
        is_required = (
            input(f"{Colors.OKCYAN}Required? (y/n): {Colors.ENDC}").strip().lower()
            == "y"
        )

        parameters.append(
            {
                "name": param_name,
                "type": param_type,
                "description": param_desc,
                "required": is_required,
            }
        )

    generator.generate_integration(name, action, description, api_url, parameters)


if __name__ == "__main__":
    cli()
