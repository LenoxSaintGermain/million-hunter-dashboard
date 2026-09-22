#!/usr/bin/env node
/**
 * Linear MCP Bridge Utility for Third Signal OS
 * Uses official Linear MCP over streamable HTTP / stdio
 */
import { spawn } from "child_process";

export function callLinearMcp(toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn("npx", ["-y", "mcp-remote", "https://mcp.linear.app/mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let buf = "";
    let initialized = false;
    const timeout = setTimeout(() => {
      p.kill();
      reject(new Error(`Timeout calling Linear MCP tool "${toolName}"`));
    }, 30000);

    p.stdout.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop(); // keep last incomplete line
      for (const line of lines) {
        if (!line.trim().startsWith("{")) continue;
        try {
          const parsed = JSON.parse(line.trim());
          if (parsed.id === 2) {
            clearTimeout(timeout);
            p.kill();
            resolve(parsed.result);
            return;
          } else if (parsed.result && parsed.result.serverInfo && !initialized) {
            initialized = true;
            // Send initialized notification
            p.stdin.write(
              JSON.stringify({
                jsonrpc: "2.0",
                method: "notifications/initialized",
              }) + "\n"
            );
            // Call the tool
            p.stdin.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: {
                  name: toolName,
                  arguments: args,
                },
              }) + "\n"
            );
          }
        } catch (e) {
          // ignore parsing error for non-json debug lines
        }
      }
    });

    p.stderr.on("data", () => {});

    // Send initialize request
    p.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "third-signal-linear-mcp", version: "1.0.0" },
        },
      }) + "\n"
    );
  });
}

// CLI Interface
if (process.argv[1] && process.argv[1].endsWith("linear-mcp.mjs")) {
  const [,, cmd, ...rest] = process.argv;

  async function run() {
    try {
      if (!cmd || cmd === "--help" || cmd === "-h") {
        console.log(`
Usage:
  node scripts/linear-mcp.mjs list-issues [limit]
  node scripts/linear-mcp.mjs get-issue <issueId>
  node scripts/linear-mcp.mjs list-comments <issueId>
  node scripts/linear-mcp.mjs append-comment <issueId> <markdownBody>
  node scripts/linear-mcp.mjs call <toolName> '<jsonArgs>'
        `);
        return;
      }

      if (cmd === "list-issues") {
        const limit = rest[0] ? parseInt(rest[0], 10) : 10;
        const res = await callLinearMcp("list_issues", { limit });
        const text = res.content?.[0]?.text;
        const data = text ? JSON.parse(text) : res;
        console.log(JSON.stringify(data, null, 2));
      } else if (cmd === "get-issue") {
        const id = rest[0];
        if (!id) throw new Error("Missing issueId");
        const res = await callLinearMcp("get_issue", { id });
        const text = res.content?.[0]?.text;
        const data = text ? JSON.parse(text) : res;
        console.log(JSON.stringify(data, null, 2));
      } else if (cmd === "list-comments") {
        const issueId = rest[0];
        if (!issueId) throw new Error("Missing issueId");
        const res = await callLinearMcp("list_comments", { issueId });
        const text = res.content?.[0]?.text;
        const data = text ? JSON.parse(text) : res;
        console.log(JSON.stringify(data, null, 2));
      } else if (cmd === "append-comment") {
        const issueId = rest[0];
        const body = rest.slice(1).join(" ");
        if (!issueId || !body) throw new Error("Usage: append-comment <issueId> <bodyText>");
        const res = await callLinearMcp("save_comment", { issueId, body });
        const text = res.content?.[0]?.text;
        const data = text ? JSON.parse(text) : res;
        console.log(JSON.stringify(data, null, 2));
      } else if (cmd === "call") {
        const toolName = rest[0];
        const rawArgs = rest[1] || "{}";
        const args = JSON.parse(rawArgs);
        const res = await callLinearMcp(toolName, args);
        const text = res.content?.[0]?.text;
        const data = text ? JSON.parse(text) : res;
        console.log(JSON.stringify(data, null, 2));
      } else {
        throw new Error(`Unknown command "${cmd}"`);
      }
    } catch (err) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  }

  run();
}
