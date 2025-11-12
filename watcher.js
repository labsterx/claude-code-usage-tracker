const chokidar = require('chokidar');
const path = require('path');
const os = require('os');
const fs = require('fs');
const readline = require('readline');
const http = require('http');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

console.log('');
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║   Claude Code Real-Time Watcher                  ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log('');
console.log(`👀 Watching: ${PROJECTS_DIR}`);
console.log('');

let processing = new Set();

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

    req.on('error', (e) => {
      // Silently fail if server not running
      resolve();
    });
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

  let stats = { messages: 0, toolUses: 0 };

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      if (entry.type === 'user' || entry.type === 'assistant') {
        stats.messages++;
        await sendToAPI({
          type: 'message',
          session_id: sessionId,
          role: entry.type,
          content_length: JSON.stringify(entry.message?.content || '').length
        });
      }

      if (entry.message && entry.message.content) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_use') {
            stats.toolUses++;
            const toolName = block.name;

            await sendToAPI({
              type: 'tool_usage',
              session_id: sessionId,
              tool_name: toolName,
              description: JSON.stringify(block.input).substring(0, 100),
              success: true
            });

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
      // Skip invalid lines
    }
  }

  return stats;
}

async function processFile(filePath) {
  // Prevent duplicate processing
  if (processing.has(filePath)) return;
  processing.add(filePath);

  try {
    if (!filePath.endsWith('.jsonl')) return;

    const stats = fs.statSync(filePath);
    if (stats.size === 0) return;

    const sessionId = path.basename(filePath, '.jsonl');
    const projectDir = path.basename(path.dirname(filePath));

    console.log(`📝 Processing: ${sessionId}`);

    // Send session metadata
    await sendToAPI({
      type: 'session',
      session_id: sessionId,
      project: projectDir.replace(/-/g, '/'),
      file_size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString()
    });

    // Parse the file
    const result = await parseJSONLFile(filePath, sessionId);
    console.log(`   ✓ ${result.messages} messages, ${result.toolUses} tools`);

  } catch (error) {
    console.error(`   ✗ Error: ${error.message}`);
  } finally {
    // Remove from processing set after a delay
    setTimeout(() => processing.delete(filePath), 5000);
  }
}

// Watch for changes
const watcher = chokidar.watch(PROJECTS_DIR, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: false,
  depth: 2,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 500
  }
});

watcher
  .on('add', filePath => {
    if (filePath.endsWith('.jsonl')) {
      processFile(filePath);
    }
  })
  .on('change', filePath => {
    if (filePath.endsWith('.jsonl')) {
      processFile(filePath);
    }
  })
  .on('error', error => console.error(`Watcher error: ${error}`))
  .on('ready', () => {
    console.log('✓ Watcher ready - monitoring for changes...');
    console.log('');
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nStopping watcher...');
  watcher.close();
  process.exit(0);
});
