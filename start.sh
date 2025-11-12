#!/bin/bash

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║      Claude Code Usage Tracker                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Parse real Claude Code data
echo "🔍 Parsing Claude Code data from ~/.claude/..."
echo ""
node parse-real-data.js
echo ""

# Start the server
echo "🚀 Starting server..."
echo ""
node server.js
