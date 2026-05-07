# Praxis MCP Server

MCP (Model Context Protocol) server for Praxis - Connect AI agents like Claude, Cursor, and GPT agents to your goal journal.

## Features

- Full access to Praxis API via 50+ tools
- Goals management
- Notebook & diary entries
- Daily check-ins
- AI Axiom assistant
- Gamification (streaks, achievements, leaderboard)
- Buddies & messaging
- Trackers & calendar

## Quick Start

```bash
# Install
cd praxis-mcp-server
npm install
npm run build

# Get API key from Praxis Settings → API Access

# Run
PRAXIS_API_KEY=pk_live_xxx npm start
```

## Claude Desktop Config

```json
{
  "mcpServers": {
    "praxis": {
      "command": "npx",
      "args": ["praxis-mcp-server"],
      "env": {
        "PRAXIS_API_KEY": "pk_live_xxx"
      }
    }
  }
}
```

## Available Tools

| Tool                  | Description          |
| --------------------- | -------------------- |
| get_profile           | Get your profile     |
| get_goals             | Get your goals       |
| create_goal           | Create a new goal    |
| update_progress       | Update goal progress |
| get_notebook          | Get notebook entries |
| create_notebook_entry | Create entry         |
| get_daily_brief       | Get AI brief         |
| chat_with_axiom       | Chat with AI         |
| get_streak            | Get your streak      |
| get_leaderboard       | View leaderboard     |
| get_buddies           | Get your buddies     |
| send_message          | Send a message       |
| get_stats             | Get profile stats    |

## Environment Variables

| Variable       | Default                                         | Description              |
| -------------- | ----------------------------------------------- | ------------------------ |
| PRAXIS_API_KEY | -                                               | Your API key from Praxis |
| PRAXIS_API_URL | https://web-production-646a4.up.railway.app/api | Praxis API URL           |

## Railway Deployment

The MCP server supports both stdio (local) and HTTP/SSE (Railway) transports.

### Quick Deploy

1. Create new Railway project → Deploy from GitHub
2. Root Directory: `praxis-mcp-server/`
3. Add environment variables:

| Variable         | Value                                             |
| ---------------- | ------------------------------------------------- |
| `PRAXIS_API_KEY` | `pk_live_xxx` (from Settings → API Keys)          |
| `PRAXIS_API_URL` | `https://web-production-646a4.up.railway.app/api` |
| `TRANSPORT`      | `http`                                            |
| `PORT`           | `3456`                                            |

4. Railway will auto-detect `railway.toml` and deploy

### Health Check

`GET /health` → `{ "status": "ok", "transport": "http" }`

### HTTP MCP Config (Claude Desktop / Cursor)

```json
{
  "mcpServers": {
    "praxis": {
      "url": "https://your-mcp-server.railway.app/mcp"
    }
  }
}
```

## Development

```bash
npm run dev  # Watch mode
```
