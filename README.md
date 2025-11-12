# Claude Code Usage Tracker

> **Track and visualize your real Claude Code conversation history with beautiful charts and insights**

A lightweight Node.js web application that parses your local Claude Code data (stored in `~/.claude/`) and visualizes your AI coding assistant usage patterns through an interactive dashboard.

## ✨ Features

- 👀 **Real-Time Monitoring** - Automatically detects and parses new conversations as they happen!
- 📊 **Real Data Analytics** - Parses actual Claude Code conversation files (`.jsonl` format)
- 🎨 **Beautiful Dashboard** - Responsive web UI with Chart.js visualizations
- 💬 **Session Tracking** - View all your chat sessions with detailed statistics
- 🔧 **Tool Usage Breakdown** - See which tools you use most (Bash, Write, Edit, etc.)
- 📈 **Timeline Charts** - Visualize activity over the last 30 days
- 📄 **File Edit Tracking** - Track which files you modify most frequently
- 🚀 **Zero Configuration** - Just run and view your data
- 💾 **No Database Required** - Uses simple JSON file storage

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- Claude Code installed and used at least once (creates `~/.claude/` directory)

### Installation

```bash
# Clone or download this repository
cd claude-log

# Install dependencies
npm install

# Parse your Claude Code data and start server
./start.sh
```

Or manually:

```bash
npm install
npm run parse    # Parse existing data from ~/.claude/ (writes to usage_data.json)
npm start        # Start server (loads data + enables real-time monitoring)
```

**Open your browser:** http://localhost:5000

### How It Works Now

1. **Initial Parse**: Run `npm run parse` once - this reads all existing conversations and writes to `usage_data.json` (no server needed)
2. **Start Server**: Run `npm start` - loads the data file and starts real-time monitoring
3. **Real-Time Updates**: Server automatically detects new conversations in `~/.claude/` as you use Claude Code
4. **Auto-Refresh**: Dashboard updates every 30 seconds to show latest data
5. **Re-run Parse**: If you want to re-process all data, just run `npm run parse` again (it's now standalone!)

## 📊 Dashboard Features

### Overview Cards
- Total tools used across all sessions
- Files edited count
- Messages exchanged with Claude

### Interactive Charts
1. **Tool Usage Distribution** - Doughnut chart showing Read, Write, Edit, Bash, etc.
2. **Usage Timeline** - 30-day activity line chart
3. **File Statistics** - Most frequently edited files with counts
4. **Session Cards** - All your conversations with metadata

### Session Details
Each session card shows:
- Session ID and timestamp
- Project/directory path
- Message count
- Tool usage count
- File edit count

## 🗂️ Project Structure

```
claude-log/
├── server.js              # Express server (main application)
├── parse-real-data.js     # Parses ~/.claude/ conversation data
├── collector.js           # VSCode workspace scanner (informational)
├── generate-data.js       # Sample data generator (for testing)
├── package.json           # Dependencies
├── start.sh               # One-command startup script
├── public/                # Frontend files
│   ├── index.html        # Dashboard UI
│   ├── css/style.css     # Styling with gradient design
│   └── js/dashboard.js   # Chart.js visualizations
└── usage_data.json        # Your parsed data (auto-generated)
```

## 🔍 How It Works

### Data Source

Claude Code stores all conversation history in:
```
~/.claude/projects/[project-name]/[session-id].jsonl
```

Each `.jsonl` file contains:
- User messages
- Assistant responses
- Tool uses (Read, Write, Edit, Bash, Grep, Glob, etc.)
- File operations with paths
- Timestamps for every action

### Data Format Example

```json
{
  "type": "assistant",
  "message": {
    "content": [
      {
        "type": "tool_use",
        "name": "Write",
        "input": {
          "file_path": "/path/to/file.js",
          "content": "..."
        }
      }
    ]
  },
  "timestamp": "2025-11-12T10:15:30.123Z"
}
```

### Parsing Process

1. Scans `~/.claude/projects/` for all conversation files
2. Reads each `.jsonl` file line by line
3. Extracts tool usage, messages, and file operations
4. Aggregates statistics by session
5. Stores in `usage_data.json` for fast dashboard access

## 📝 NPM Scripts

```bash
npm start       # Start the dashboard server
npm run parse   # Parse real Claude Code data from ~/.claude/
npm run collect # Scan VSCode workspaces (informational)
```

## 🌐 API Endpoints

The server provides these REST APIs:

- `GET /` - Dashboard HTML
- `GET /api/stats/overview` - Overview statistics
- `GET /api/stats/tools` - Tool usage breakdown
- `GET /api/stats/timeline` - 30-day usage timeline
- `GET /api/stats/files` - Most edited files
- `GET /api/sessions` - All chat sessions with metadata
- `GET /api/sessions/:id` - Detailed session information
- `POST /api/log` - Log new events (used by parser)

## 📈 Example Data

From actual usage:

```json
{
  "total_tools": 123,
  "total_edits": 33,
  "total_messages": 343,
  "top_tools": [
    { "name": "Bash", "count": 58 },
    { "name": "Write", "count": 22 },
    { "name": "Read", "count": 12 },
    { "name": "Edit", "count": 11 },
    { "name": "TodoWrite", "count": 8 }
  ]
}
```

## 🎯 Use Cases

- **Track Productivity** - See how much coding assistance you're getting
- **Identify Patterns** - What tools and files you work with most
- **Session Review** - Browse past conversations and their outcomes
- **Project Insights** - Compare activity across different projects
- **Time Analysis** - Understand your peak usage times

## 🔄 Updating Data

To refresh with latest conversations:

```bash
npm run parse
```

The dashboard auto-refreshes every 30 seconds while open.

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Storage**: JSON file (no database needed)
- **Frontend**: Vanilla JavaScript + Chart.js
- **Dependencies**: Only 3 (express, cors, chokidar)

## 🐛 Troubleshooting

**Getting "ECONNRESET" or "Status: 403" errors when running `npm run parse`?**
- **This is expected!** The parser now works standalone (no server required)
- Simply run: `npm run parse` (it will write directly to `usage_data.json`)
- Then start the server: `npm start`
- The old version required the server to be running first - that's been fixed!

**No data showing?**
```bash
# Ensure Claude Code has been used
ls ~/.claude/projects/

# Re-parse data
rm usage_data.json
npm run parse
npm start
```

**Port 5000 in use?**
```bash
lsof -ti:5000 | xargs kill
# Or edit server.js to change PORT
```

**Can't find ~/.claude/ directory?**
- Make sure Claude Code VSCode extension is installed
- Use Claude Code at least once to create the directory
- Check: `ls -la ~/.claude/`

## 🚀 Future Enhancements

- [ ] Real-time file watching for automatic updates
- [ ] Export reports (PDF, CSV, JSON)
- [ ] Multi-project comparison view
- [ ] Token usage tracking (if available)
- [ ] Session duration analytics
- [ ] Language/file type breakdown
- [ ] Weekly/monthly summary reports
- [ ] Dark mode toggle
- [ ] Search and filter sessions
- [ ] Click session cards to view full conversation

## 📄 License

MIT License - Free to use and modify

## 🤝 Contributing

This is a hackathon project. Ideas and improvements welcome!

Possible contributions:
- Add more visualization types
- Improve data parsing for newer Claude Code formats
- Build browser extension integration
- Add MCP server support
- Create mobile-responsive improvements

## 🔒 Privacy

- All data stays on your local machine
- Server only binds to localhost:5000
- No data sent to external services
- Usage data stored in local `usage_data.json`

## 📸 Screenshots

The dashboard includes:
1. **Overview Section** - 3 stat cards with totals
2. **Tool Usage Chart** - Interactive doughnut showing distribution
3. **Timeline Graph** - 30-day activity line chart
4. **Files Table** - Most edited files with counts
5. **Session Cards** - Clickable cards for each conversation

---

**Built with ❤️ for the Claude Code community**

*Track your AI coding journey and discover your usage patterns!*
