"""MCP client glue — the one piece you write once.

connect_servers() launches each MCP server over stdio, runs the list_tools
handshake on each, assembles the combined tool spec the model sees (in
Anthropic tool format), and returns a dispatch(name, input) coroutine that
routes a tool call to whichever server owns that tool.

Adding a fifth server is one entry in SERVER_SPECS — the agent discovers its
tools automatically; no change to the agent loop.
"""
from __future__ import annotations

import sys
from contextlib import AsyncExitStack
from typing import Any, Awaitable, Callable

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Each server is launched as its own process. label is for logging/audit only.
SERVER_SPECS = [
    {"label": "ats", "module": "backend.mcp_servers.ats_server"},
    {"label": "web", "module": "backend.mcp_servers.web_search_server"},
    {"label": "linkedin", "module": "backend.mcp_servers.linkedin_indeed_server"},
    {"label": "internal", "module": "backend.mcp_servers.internal_server"},
]

DispatchFn = Callable[[str, dict[str, Any]], Awaitable[Any]]


class MCPHub:
    """Owns the live sessions and the tool -> session routing table."""

    def __init__(self) -> None:
        self._stack = AsyncExitStack()
        self._sessions: list[ClientSession] = []
        self._tool_to_session: dict[str, ClientSession] = {}
        self.tools: list[dict] = []  # Anthropic-format tool specs

    async def __aenter__(self) -> "MCPHub":
        for spec in SERVER_SPECS:
            params = StdioServerParameters(
                command=sys.executable, args=["-m", spec["module"]]
            )
            read, write = await self._stack.enter_async_context(stdio_client(params))
            session = await self._stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
            self._sessions.append(session)

            listed = await session.list_tools()
            for tool in listed.tools:
                self._tool_to_session[tool.name] = session
                self.tools.append({
                    "name": tool.name,
                    "description": tool.description or "",
                    "input_schema": tool.inputSchema,
                })
        return self

    async def __aexit__(self, *exc) -> None:
        await self._stack.aclose()

    async def dispatch(self, name: str, arguments: dict[str, Any]) -> Any:
        session = self._tool_to_session.get(name)
        if session is None:
            return {"error": f"no MCP server exposes tool '{name}'"}
        result = await session.call_tool(name, arguments=arguments)
        # MCP returns a list of content blocks; collapse text blocks to a string.
        parts = [c.text for c in result.content if getattr(c, "type", None) == "text"]
        return "\n".join(parts) if parts else result.content


async def connect_servers() -> tuple[MCPHub, list[dict], DispatchFn]:
    """Convenience wrapper. Caller is responsible for `async with` lifetime,
    so prefer using MCPHub directly in the agent loop."""
    hub = MCPHub()
    await hub.__aenter__()
    return hub, hub.tools, hub.dispatch
