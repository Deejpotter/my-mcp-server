# My MCP Server

A personal Model Context Protocol (MCP) server that provides example tools and resources for AI assistants and other MCP clients.

## Features

This MCP server provides:

### 🛠️ Tools

- **echo**: Echo back any message you send
- **calculate**: Perform basic arithmetic calculations safely
- **current_time**: Get the current date and time with optional formatting

### 📊 Resources

- **system://info**: Get system information including platform and Python version
- **datetime://current**: Get current date and time information

## Installation

### Prerequisites

- Python 3.12 or higher
- pip (Python package installer)

### Setup

1. **Clone or download this repository**

   ```bash
   git clone <your-repo-url>
   cd my-mcp-server
   ```

2. **Create and activate a virtual environment** (recommended)

   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install dependencies**

   ```bash
   pip install -e .
   ```

## Usage

### Running the Server

You can run the server in several ways:

#### Option 1: Using the installed script

```bash
my-mcp-server
```

#### Option 2: Running directly with Python

```bash
python main.py
```

#### Option 3: With custom log level

```bash
my-mcp-server --log-level DEBUG
```

### Connecting to the Server

The server uses stdio (standard input/output) for communication, which is the standard for MCP servers. You'll typically connect to it through:

1. **MCP-compatible AI assistants** (like Claude Desktop with MCP support)
2. **MCP client libraries** for testing and development
3. **Custom applications** that implement the MCP protocol

### Example Usage

Once connected, you can:

- **Use the echo tool**: Send a message and get it echoed back
- **Perform calculations**: Send mathematical expressions like "2 + 2" or "10 * 3.14"
- **Get current time**: Request current time with optional custom formatting
- **Access resources**: Read system information or current datetime

## Configuration for Claude Desktop

If you want to use this server with Claude Desktop, add this to your MCP configuration:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "python",
      "args": ["/path/to/your/my-mcp-server/main.py"],
      "env": {}
    }
  }
}
```

Replace `/path/to/your/my-mcp-server/main.py` with the actual path to your main.py file.

## Development

### Project Structure

```
my-mcp-server/
├── main.py           # Main server implementation
├── pyproject.toml    # Project configuration and dependencies
├── README.md         # This file
├── LICENSE          # License file
└── .venv/           # Virtual environment (after setup)
```

### Adding New Tools

To add a new tool:

1. Add the tool definition to the `handle_list_tools()` function
2. Add the tool implementation to the `handle_call_tool()` function
3. Test your new tool

### Adding New Resources

To add a new resource:

1. Add the resource definition to the `handle_list_resources()` function
2. Add the resource implementation to the `handle_read_resource()` function

## Troubleshooting

### Common Issues

1. **"Module not found" errors**: Make sure you've installed the dependencies with `pip install -e .`
2. **Permission errors**: Ensure your virtual environment is activated
3. **Connection issues**: Verify the server is running and check the logs

### Getting Help

- Check the [MCP documentation](https://modelcontextprotocol.io/)
- Review the server logs for error messages
- Ensure all dependencies are properly installed

## License

This project is licensed under the terms specified in the LICENSE file.

## Contributing

Feel free to fork this project and submit pull requests for improvements or additional tools/resources!
