"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const path = require("path");
function activate(context) {
    console.log("My MCP Server Extension is now active!");
    // Register the MCP server definition provider
    const mcpProvider = {
        provideMcpServerDefinitions(_token) {
            // Get the workspace folder path to locate the server
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return [];
            }
            // Path to your MCP server
            const serverPath = path.join(workspaceFolder.uri.fsPath, "main.py");
            const pythonPath = path.join(workspaceFolder.uri.fsPath, ".venv", "Scripts", "python.exe");
            // Create the MCP server definition
            const mcpServer = new vscode.McpStdioServerDefinition("My Personal MCP Server", pythonPath, [serverPath], {}, // environment variables
            "0.1.0" // version
            );
            return [mcpServer];
        },
    };
    // Register the provider
    const disposable = vscode.lm.registerMcpServerDefinitionProvider("my-mcp-server", mcpProvider);
    context.subscriptions.push(disposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map