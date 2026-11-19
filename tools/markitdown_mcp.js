// Starts the MarkItDown MCP server (stdio) from this repo's .venv, on macOS, Linux and Windows,
// so Claude Code or any MCP-capable agent can call convert_to_markdown(uri).
// Install it first with: npm run setup:py:extras
// stdout carries the MCP protocol, so this script must never print to stdout itself.
const { spawn } = require("child_process");
const { ROOT, requireVenvBin } = require("./venv");

const bin = requireVenvBin("markitdown-mcp", "npm run setup:py:extras");
const child = spawn(bin, process.argv.slice(2), { cwd: ROOT, stdio: "inherit" });
child.on("error", (err) => {
  console.error(err.message);
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
