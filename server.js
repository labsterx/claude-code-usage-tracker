const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 5000;

// Data storage file
const DATA_FILE = 'usage_data.json';
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize data storage
function initData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      sessions: [],
      tool_usage: [],
      file_edits: [],
      messages: [],
      vscode_data: [],
      token_usage: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    return { sessions: [], tool_usage: [], file_edits: [], messages: [], vscode_data: [], token_usage: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// API Routes

// Serve the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Log events
app.post('/api/log', (req, res) => {
  try {
    const { type, session_id = 'default', ...eventData } = req.body;
    const data = readData();
    const timestamp = new Date().toISOString();

    if (type === 'tool_usage') {
      data.tool_usage.push({
        session_id,
        timestamp,
        tool_name: eventData.tool_name,
        description: eventData.description || '',
        success: eventData.success !== false
      });
    }
    else if (type === 'file_edit') {
      data.file_edits.push({
        session_id,
        timestamp,
        file_path: eventData.file_path,
        operation: eventData.operation,
        lines_changed: eventData.lines_changed || 0
      });
    }
    else if (type === 'message') {
      data.messages.push({
        session_id,
        timestamp,
        role: eventData.role,
        content_length: eventData.content_length || 0
      });
    }
    else if (type === 'vscode_data') {
      data.vscode_data.push({
        timestamp,
        workspace_id: eventData.workspace_id,
        data_type: eventData.data_type,
        data: eventData.data
      });
    }
    else if (type === 'session') {
      // Check if session already exists
      if (!data.sessions) data.sessions = [];
      const existingIndex = data.sessions.findIndex(s => s.session_id === session_id);
      if (existingIndex >= 0) {
        data.sessions[existingIndex] = {
          ...data.sessions[existingIndex],
          ...eventData,
          session_id
        };
      } else {
        data.sessions.push({
          session_id,
          ...eventData
        });
      }
    }

    writeData(data);
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Error logging event:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get overview statistics
app.get('/api/stats/overview', (req, res) => {
  try {
    const data = readData();

    const totalTools = data.tool_usage.length;
    const totalEdits = data.file_edits.length;
    const totalMessages = data.messages.length;

    // Calculate token usage
    const tokenStats = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      total_tokens: 0
    };

    if (data.token_usage) {
      data.token_usage.forEach(item => {
        tokenStats.input_tokens += item.input_tokens || 0;
        tokenStats.output_tokens += item.output_tokens || 0;
        tokenStats.cache_read_tokens += item.cache_read_input_tokens || 0;
        tokenStats.cache_write_tokens += item.cache_creation_input_tokens || 0;
      });
      tokenStats.total_tokens = tokenStats.input_tokens + tokenStats.output_tokens;
    }

    // Count tool usage
    const toolCounts = {};
    data.tool_usage.forEach(item => {
      toolCounts[item.tool_name] = (toolCounts[item.tool_name] || 0) + 1;
    });

    const topTools = Object.entries(toolCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      total_tools: totalTools,
      total_edits: totalEdits,
      total_messages: totalMessages,
      tokens: tokenStats,
      top_tools: topTools
    });
  } catch (error) {
    console.error('Error getting overview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tool usage statistics
app.get('/api/stats/tools', (req, res) => {
  try {
    const data = readData();

    const toolCounts = {};
    data.tool_usage.forEach(item => {
      toolCounts[item.tool_name] = (toolCounts[item.tool_name] || 0) + 1;
    });

    const tools = Object.entries(toolCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json(tools);
  } catch (error) {
    console.error('Error getting tool stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get usage timeline
app.get('/api/stats/timeline', (req, res) => {
  try {
    const data = readData();

    const dateCounts = {};
    data.tool_usage.forEach(item => {
      const date = item.timestamp.split('T')[0];
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    });

    const timeline = Object.entries(dateCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    res.json(timeline);
  } catch (error) {
    console.error('Error getting timeline:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get file statistics
app.get('/api/stats/files', (req, res) => {
  try {
    const data = readData();

    const fileCounts = {};
    const fileLines = {};

    data.file_edits.forEach(item => {
      fileCounts[item.file_path] = (fileCounts[item.file_path] || 0) + 1;
      fileLines[item.file_path] = (fileLines[item.file_path] || 0) + item.lines_changed;
    });

    const files = Object.keys(fileCounts)
      .map(path => ({
        path,
        edits: fileCounts[path],
        lines: fileLines[path]
      }))
      .sort((a, b) => b.edits - a.edits)
      .slice(0, 20);

    res.json(files);
  } catch (error) {
    console.error('Error getting file stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get VSCode workspace data
app.get('/api/vscode/workspaces', (req, res) => {
  try {
    const data = readData();
    res.json(data.vscode_data);
  } catch (error) {
    console.error('Error getting workspace data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all sessions
app.get('/api/sessions', (req, res) => {
  try {
    const data = readData();

    // Group messages and tools by session
    const sessionMap = {};

    // Count messages per session
    data.messages.forEach(msg => {
      if (!sessionMap[msg.session_id]) {
        sessionMap[msg.session_id] = {
          session_id: msg.session_id,
          message_count: 0,
          tool_count: 0,
          file_count: 0,
          first_timestamp: msg.timestamp,
          last_timestamp: msg.timestamp
        };
      }
      sessionMap[msg.session_id].message_count++;
      if (msg.timestamp < sessionMap[msg.session_id].first_timestamp) {
        sessionMap[msg.session_id].first_timestamp = msg.timestamp;
      }
      if (msg.timestamp > sessionMap[msg.session_id].last_timestamp) {
        sessionMap[msg.session_id].last_timestamp = msg.timestamp;
      }
    });

    // Count tools per session
    data.tool_usage.forEach(tool => {
      if (sessionMap[tool.session_id]) {
        sessionMap[tool.session_id].tool_count++;
      }
    });

    // Count files per session
    data.file_edits.forEach(file => {
      if (sessionMap[file.session_id]) {
        sessionMap[file.session_id].file_count++;
      }
    });

    // Add session metadata if available
    if (data.sessions) {
      data.sessions.forEach(session => {
        if (sessionMap[session.session_id]) {
          sessionMap[session.session_id] = {
            ...sessionMap[session.session_id],
            ...session
          };
        }
      });
    }

    const sessions = Object.values(sessionMap)
      .sort((a, b) => new Date(b.last_timestamp) - new Date(a.last_timestamp));

    res.json(sessions);
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session details
app.get('/api/sessions/:sessionId', (req, res) => {
  try {
    const data = readData();
    const sessionId = req.params.sessionId;

    const messages = data.messages.filter(m => m.session_id === sessionId);
    const tools = data.tool_usage.filter(t => t.session_id === sessionId);
    const files = data.file_edits.filter(f => f.session_id === sessionId);

    // Find session metadata
    const sessionMeta = data.sessions?.find(s => s.session_id === sessionId) || {};

    res.json({
      session_id: sessionId,
      ...sessionMeta,
      messages,
      tools,
      files,
      stats: {
        total_messages: messages.length,
        total_tools: tools.length,
        total_files: files.length
      }
    });
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-parse all existing sessions on first run
async function autoParseIfNeeded() {
  // Check if data file exists and has sessions
  if (fs.existsSync(DATA_FILE)) {
    const data = readData();
    if (data.sessions && data.sessions.length > 0) {
      console.log(`✓ Found existing data: ${data.sessions.length} sessions`);
      return false; // Already parsed
    }
  }

  // Check if Claude directory exists
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.log('⚠️  ~/.claude/projects not found - no data to parse');
    return false;
  }

  console.log('');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   First Run: Parsing Existing Conversations      ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('');

  let usageData = {
    sessions: [],
    messages: [],
    tool_usage: [],
    file_edits: [],
    token_usage: []
  };

  async function parseJSONLFile(filePath, sessionId) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let stats = {
      messages: 0,
      toolUses: 0,
      toolCounts: {}
    };

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const entry = JSON.parse(line);
        const timestamp = entry.timestamp || new Date().toISOString();

        if (entry.type === 'user' || entry.type === 'assistant') {
          stats.messages++;
          usageData.messages.push({
            session_id: sessionId,
            role: entry.type,
            content_length: JSON.stringify(entry.message?.content || '').length,
            timestamp
          });

          // Extract token usage from assistant messages
          if (entry.type === 'assistant' && entry.message?.usage) {
            const usage = entry.message.usage;
            usageData.token_usage.push({
              session_id: sessionId,
              input_tokens: usage.input_tokens || 0,
              output_tokens: usage.output_tokens || 0,
              cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
              cache_read_input_tokens: usage.cache_read_input_tokens || 0,
              timestamp
            });
          }
        }

        if (entry.message && entry.message.content) {
          for (const block of entry.message.content) {
            if (block.type === 'tool_use') {
              stats.toolUses++;
              const toolName = block.name;
              stats.toolCounts[toolName] = (stats.toolCounts[toolName] || 0) + 1;

              usageData.tool_usage.push({
                session_id: sessionId,
                tool_name: toolName,
                description: JSON.stringify(block.input).substring(0, 100),
                success: true,
                timestamp
              });

              if (toolName === 'Write' || toolName === 'Edit') {
                const filePath = block.input?.file_path;
                if (filePath) {
                  usageData.file_edits.push({
                    session_id: sessionId,
                    file_path: filePath,
                    operation: toolName.toLowerCase(),
                    lines_changed: toolName === 'Edit' ? 10 : 0,
                    timestamp
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip invalid lines
      }
    }

    return stats;
  }

  const projectDirs = fs.readdirSync(PROJECTS_DIR);
  let totalStats = {
    projects: 0,
    sessions: 0,
    messages: 0,
    toolUses: 0
  };

  for (const projectDir of projectDirs) {
    if (projectDir.startsWith('.')) continue;

    const projectPath = path.join(PROJECTS_DIR, projectDir);
    const stat = fs.statSync(projectPath);
    if (!stat.isDirectory()) continue;

    totalStats.projects++;
    const sessionFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));

    for (const sessionFile of sessionFiles) {
      const sessionPath = path.join(projectPath, sessionFile);
      const sessionStats = fs.statSync(sessionPath);

      if (sessionStats.size === 0) continue;

      const sessionId = sessionFile.replace('.jsonl', '');
      totalStats.sessions++;

      try {
        const stats = await parseJSONLFile(sessionPath, sessionId);

        usageData.sessions.push({
          session_id: sessionId,
          project: projectDir.replace(/-/g, '/'),
          file_size: sessionStats.size,
          created: sessionStats.birthtime.toISOString(),
          modified: sessionStats.mtime.toISOString()
        });

        totalStats.messages += stats.messages;
        totalStats.toolUses += stats.toolUses;

        process.stdout.write('.');
      } catch (e) {
        // Skip errors
      }
    }
  }

  // Save parsed data
  writeData(usageData);

  console.log('\n');
  console.log(`✓ Parsed ${totalStats.sessions} sessions`);
  console.log(`  Messages: ${totalStats.messages}`);
  console.log(`  Tool uses: ${totalStats.toolUses}`);
  console.log('');

  return true; // Did parse
}

// Start watcher for real-time monitoring
function startWatcher() {
  const chokidar = require('chokidar');

  if (!fs.existsSync(PROJECTS_DIR)) {
    console.log('⚠️  ~/.claude/projects not found - skipping watcher');
    return;
  }

  console.log('👀 Real-time watcher: ENABLED');

  let processing = new Set();

  async function processFile(filePath) {
    if (processing.has(filePath)) return;
    if (!filePath.endsWith('.jsonl')) return;

    processing.add(filePath);

    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) return;

      const sessionId = path.basename(filePath, '.jsonl');
      const projectDir = path.basename(path.dirname(filePath));

      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const data = readData();
      let newMessages = 0;
      let newTools = 0;

      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line);

          if (entry.type === 'user' || entry.type === 'assistant') {
            data.messages.push({
              session_id: sessionId,
              timestamp: new Date().toISOString(),
              role: entry.type,
              content_length: JSON.stringify(entry.message?.content || '').length
            });
            newMessages++;
          }

          if (entry.message && entry.message.content) {
            for (const block of entry.message.content) {
              if (block.type === 'tool_use') {
                const toolName = block.name;
                data.tool_usage.push({
                  session_id: sessionId,
                  timestamp: new Date().toISOString(),
                  tool_name: toolName,
                  description: JSON.stringify(block.input).substring(0, 100),
                  success: true
                });
                newTools++;

                if (toolName === 'Write' || toolName === 'Edit') {
                  const filePath = block.input?.file_path;
                  if (filePath) {
                    data.file_edits.push({
                      session_id: sessionId,
                      timestamp: new Date().toISOString(),
                      file_path: filePath,
                      operation: toolName.toLowerCase(),
                      lines_changed: 10
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          // Skip invalid lines
        }
      }

      if (newMessages > 0 || newTools > 0) {
        writeData(data);
        console.log(`📝 Updated: ${sessionId} (+${newMessages} msg, +${newTools} tools)`);
      }

    } catch (error) {
      // Silently skip errors
    } finally {
      setTimeout(() => processing.delete(filePath), 5000);
    }
  }

  const watcher = chokidar.watch(PROJECTS_DIR, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 2,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500
    }
  });

  watcher
    .on('change', processFile)
    .on('add', processFile);
}

// Start server
initData();
app.listen(PORT, async () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Claude Code Usage Tracker - Node.js Edition    ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('');

  // Auto-parse if needed
  await autoParseIfNeeded();

  console.log(`🚀 Dashboard: http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log('');

  // Start real-time watcher
  startWatcher();

  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');
});
