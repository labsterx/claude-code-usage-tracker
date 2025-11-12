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

# Start the server (auto-parsing handled by server)
echo "🚀 Starting server (auto-parse enabled)..."
echo ""
node server.js
