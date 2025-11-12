const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const http = require('http');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

console.log('');
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║   Parsing REAL Claude Code Conversation Data     ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log('');

async function sendToAPI(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/log',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`Status: ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
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
    reads: 0,
    writes: 0,
    edits: 0,
    bash: 0,
    errors: 0
  };

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      // Count messages
      if (entry.type === 'user' || entry.type === 'assistant') {
        stats.messages++;

        // Send message to API
        await sendToAPI({
          type: 'message',
          session_id: sessionId,
          role: entry.type,
          content_length: JSON.stringify(entry.message?.content || '').length
        });
      }

      // Parse tool uses
      if (entry.message && entry.message.content) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_use') {
            stats.toolUses++;

            const toolName = block.name;
            stats[toolName.toLowerCase()] = (stats[toolName.toLowerCase()] || 0) + 1;

            // Send to API
            await sendToAPI({
              type: 'tool_usage',
              session_id: sessionId,
              tool_name: toolName,
              description: JSON.stringify(block.input).substring(0, 100),
              success: true
            });

            // If it's a file operation, track it
            if (toolName === 'Write' || toolName === 'Edit') {
              const filePath = block.input?.file_path;
              if (filePath) {
                await sendToAPI({
                  type: 'file_edit',
                  session_id: sessionId,
                  file_path: filePath,
                  operation: toolName.toLowerCase(),
                  lines_changed: toolName === 'Edit' ? 10 : 0
                });
              }
            }
          }
        }
      }
    } catch (e) {
      stats.errors++;
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
    messages: 0,
    toolUses: 0,
    files: {}
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

      console.log(`  📄 Session: ${sessionId}`);
      console.log(`     Size: ${(sessionStats.size / 1024).toFixed(1)} KB`);

      try {
        const stats = await parseJSONLFile(sessionPath, sessionId);

        // Send session metadata
        await sendToAPI({
          type: 'session',
          session_id: sessionId,
          project: projectDir.replace(/-/g, '/'),
          file_size: sessionStats.size,
          created: sessionStats.birthtime.toISOString(),
          modified: sessionStats.mtime.toISOString()
        });

        console.log(`     Messages: ${stats.messages}`);
        console.log(`     Tool uses: ${stats.toolUses}`);

        if (stats.read) console.log(`       Read: ${stats.read}`);
        if (stats.write) console.log(`       Write: ${stats.write}`);
        if (stats.edit) console.log(`       Edit: ${stats.edit}`);
        if (stats.bash) console.log(`       Bash: ${stats.bash}`);
        if (stats.glob) console.log(`       Glob: ${stats.glob}`);
        if (stats.grep) console.log(`       Grep: ${stats.grep}`);

        totalStats.messages += stats.messages;
        totalStats.toolUses += stats.toolUses;

        console.log(`     ✓ Sent to API\n`);
      } catch (e) {
        console.log(`     ✗ Error parsing: ${e.message}\n`);
      }
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('Total Statistics:');
  console.log(`  Projects: ${totalStats.projects}`);
  console.log(`  Sessions: ${totalStats.sessions}`);
  console.log(`  Messages: ${totalStats.messages}`);
  console.log(`  Tool uses: ${totalStats.toolUses}`);
  console.log('═══════════════════════════════════════════════════\n');
  console.log('✓ All real data imported!');
  console.log('  Open http://localhost:5000 to view your REAL usage!\n');
}

parseAllSessions().catch(console.error);
