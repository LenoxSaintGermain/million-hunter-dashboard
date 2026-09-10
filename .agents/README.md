# Local Capital Scout wiring

Copy `mcp_config.example.json` into the MCP client configuration used for this
workspace, replace only the two Alpaca placeholders with an Alpaca **Paper**
key pair, and restart the client so it discovers the current tool list.

The toolset allow-list is intentional. Capital Scout is a read-only research
agent; do not add `account`, `trading`, `watchlists`, or `locates` unless the
product owner makes a separate, explicit decision and the server-side paper
gates are updated first.

The repository contains no Alpaca credentials.
