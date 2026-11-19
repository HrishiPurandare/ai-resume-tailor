"""Smoke test for the MarkItDown MCP server: starts it the way Claude Code does (.mcp.json),
lists its tools, and converts a local file through it.

Usage: python tests/mcp_smoke.py <file to convert> <text that must appear>
"""
import asyncio
import json
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parent.parent


async def main(target: Path, expected: str) -> int:
    server = json.loads((ROOT / ".mcp.json").read_text())["mcpServers"]["markitdown"]
    params = StdioServerParameters(command=server["command"], args=server["args"], cwd=str(ROOT))
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = [t.name for t in (await session.list_tools()).tools]
            if "convert_to_markdown" not in tools:
                print(f"FAIL: convert_to_markdown not offered (tools: {tools})")
                return 1
            result = await session.call_tool("convert_to_markdown", {"uri": target.resolve().as_uri()})
            text = "".join(getattr(c, "text", "") for c in result.content)
            if expected not in text:
                print(f"FAIL: expected {expected!r} in MCP output, got: {text[:200]!r}")
                return 1
    print(f"MCP PASS: tools={tools}, converted {target.name}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(Path(sys.argv[1]), sys.argv[2])))
