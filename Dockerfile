FROM node:24-alpine

WORKDIR /app

# Run your MCP server command via npx
CMD ["npx", "-y", "blockend", "mcp"]