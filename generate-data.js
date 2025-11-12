const http = require('http');

const API_URL = 'localhost';
const API_PORT = 5000;

// Sample data
const TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'Task', 'WebFetch', 'TodoWrite'];
const FILES = [
  '/Users/user/project/src/main.py',
  '/Users/user/project/src/utils.py',
  '/Users/user/project/tests/test_main.py',
  '/Users/user/project/README.md',
  '/Users/user/project/requirements.txt',
  '/Users/user/project/app.py',
  '/Users/user/project/config.py',
  '/Users/user/project/models/user.py',
  '/Users/user/project/views/api.py',
  '/Users/user/project/static/css/style.css'
];
const OPERATIONS = ['edit', 'create', 'delete'];

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sendEvent(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: API_URL,
      port: API_PORT,
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

async function generateData(numEvents = 100) {
  console.log(`Generating ${numEvents} sample events...\n`);

  const sessionId = `session_${randomInt(1000, 9999)}`;

  for (let i = 0; i < numEvents; i++) {
    const eventType = random(['tool_usage', 'file_edit', 'message']);

    let data;
    if (eventType === 'tool_usage') {
      data = {
        type: 'tool_usage',
        session_id: sessionId,
        tool_name: random(TOOLS),
        description: `Sample tool usage ${i}`,
        success: Math.random() > 0.1
      };
    } else if (eventType === 'file_edit') {
      data = {
        type: 'file_edit',
        session_id: sessionId,
        file_path: random(FILES),
        operation: random(OPERATIONS),
        lines_changed: randomInt(1, 50)
      };
    } else {
      data = {
        type: 'message',
        session_id: sessionId,
        role: random(['user', 'assistant']),
        content_length: randomInt(50, 500)
      };
    }

    try {
      await sendEvent(data);
      console.log(`✓ Event ${i + 1}/${numEvents} logged`);
    } catch (error) {
      console.log(`✗ Failed to log event ${i + 1}: ${error.message}`);
    }
  }

  console.log(`\n✓ Successfully generated ${numEvents} sample events!`);
  console.log('Open http://localhost:5000 to view the dashboard\n');
}

const numEvents = parseInt(process.argv[2]) || 100;
generateData(numEvents);
