const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const DATA_FILE = path.join(__dirname, 'usage_data.json');

console.log('');
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║   Parsing REAL Claude Code Conversation Data     ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log('');

// Initialize or load existing data
let usageData = {
  sessions: [],
  messages: [],
  tool_usage: [],
  file_edits: []
};

if (fs.existsSync(DATA_FILE)) {
  try {
    usageData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.log('⚠️  Could not read existing data, starting fresh');
  }
}

// Track what we've already processed
const existingSessions = new Set(usageData.sessions.map(s => s.session_id));

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(usageData, null, 2));
}

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

      // Count messages
      if (entry.type === 'user' || entry.type === 'assistant') {
        stats.messages++;

        usageData.messages.push({
          session_id: sessionId,
          role: entry.type,
          content_length: JSON.stringify(entry.message?.content || '').length,
          timestamp
        });
      }

      // Parse tool uses
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

            // If it's a file operation, track it
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

async function parseAllSessions() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.log('❌ Claude projects directory not found');
    console.log(`   Looking for: ${PROJECTS_DIR}`);
    return;
  }

  const projectDirs = fs.readdirSync(PROJECTS_DIR);
  let totalStats = {
    projects: 0,
    sessions: 0,
    newSessions: 0,
    messages: 0,
    toolUses: 0
  };

  for (const projectDir of projectDirs) {
    if (projectDir.startsWith('.')) continue;

    const projectPath = path.join(PROJECTS_DIR, projectDir);
    const stat = fs.statSync(projectPath);
    if (!stat.isDirectory()) continue;

    totalStats.projects++;
    console.log(`📁 Project: ${projectDir.replace(/-/g, '/')}`);

    const sessionFiles = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));

    for (const sessionFile of sessionFiles) {
      const sessionPath = path.join(projectPath, sessionFile);
      const sessionStats = fs.statSync(sessionPath);

      if (sessionStats.size === 0) continue;

      const sessionId = sessionFile.replace('.jsonl', '');
      totalStats.sessions++;

      // Skip if already processed
      if (existingSessions.has(sessionId)) {
        console.log(`  ⏭️  Session: ${sessionId} (already processed)`);
        continue;
      }

      totalStats.newSessions++;
      console.log(`  📄 Session: ${sessionId}`);
      console.log(`     Size: ${(sessionStats.size / 1024).toFixed(1)} KB`);

      try {
        const stats = await parseJSONLFile(sessionPath, sessionId);

        // Add session metadata
        usageData.sessions.push({
          session_id: sessionId,
          project: projectDir.replace(/-/g, '/'),
          file_size: sessionStats.size,
          created: sessionStats.birthtime.toISOString(),
          modified: sessionStats.mtime.toISOString()
        });

        console.log(`     Messages: ${stats.messages}`);
        console.log(`     Tool uses: ${stats.toolUses}`);

        // Show tool breakdown
        for (const [tool, count] of Object.entries(stats.toolCounts)) {
          console.log(`       ${tool}: ${count}`);
        }

        totalStats.messages += stats.messages;
        totalStats.toolUses += stats.toolUses;

        console.log(`     ✓ Parsed successfully\n`);
      } catch (e) {
        console.log(`     ✗ Error parsing: ${e.message}\n`);
      }
    }
  }

  // Save all data to file
  saveData();

  console.log('═══════════════════════════════════════════════════');
  console.log('Total Statistics:');
  console.log(`  Projects: ${totalStats.projects}`);
  console.log(`  Total Sessions: ${totalStats.sessions}`);
  console.log(`  New Sessions Parsed: ${totalStats.newSessions}`);
  console.log(`  Messages: ${totalStats.messages}`);
  console.log(`  Tool uses: ${totalStats.toolUses}`);
  console.log('═══════════════════════════════════════════════════\n');

  if (totalStats.newSessions > 0) {
    console.log(`✓ Parsed ${totalStats.newSessions} new session(s)!`);
    console.log(`  Data saved to: ${DATA_FILE}`);
  } else {
    console.log('✓ All sessions already processed!');
  }

  console.log('  Start server with: npm start');
  console.log('  Then open: http://localhost:5000\n');
}

parseAllSessions().catch(console.error);
