const fs = require('fs');
const path = require('path');
const os = require('os');

const VSCODE_PATH = path.join(os.homedir(), 'Library/Application Support/Code/User');
const WORKSPACE_STORAGE = path.join(VSCODE_PATH, 'workspaceStorage');
const GLOBAL_STORAGE = path.join(VSCODE_PATH, 'globalStorage');

console.log('');
console.log('╔═══════════════════════════════════════════════════╗');
console.log('║     Claude Code Data Collector & Analyzer        ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log('');

// Scan for workspaces
console.log('🔍 Scanning VSCode workspace storage...\n');

try {
  const workspaceDirs = fs.readdirSync(WORKSPACE_STORAGE);
  let foundWorkspaces = 0;
  let totalChatSessions = 0;
  let claudeSessions = 0;

  for (const workspaceId of workspaceDirs) {
    const workspacePath = path.join(WORKSPACE_STORAGE, workspaceId);
    const workspaceJsonPath = path.join(workspacePath, 'workspace.json');

    if (fs.existsSync(workspaceJsonPath)) {
      try {
        const workspaceData = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf8'));
        foundWorkspaces++;

        console.log(`Workspace ${foundWorkspaces}: ${workspaceId}`);
        if (workspaceData.folder) {
          console.log(`  Path: ${workspaceData.folder}`);
        }

        // Check for chat sessions
        const chatSessionsPath = path.join(workspacePath, 'chatSessions');
        if (fs.existsSync(chatSessionsPath)) {
          const sessions = fs.readdirSync(chatSessionsPath).filter(f => f.endsWith('.json'));
          totalChatSessions += sessions.length;

          if (sessions.length > 0) {
            console.log(`  Chat sessions: ${sessions.length}`);

            // Check if any are Claude sessions
            for (const sessionFile of sessions) {
              try {
                const sessionPath = path.join(chatSessionsPath, sessionFile);
                const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

                if (session.responderUsername &&
                    (session.responderUsername.includes('Claude') ||
                     session.responderUsername.includes('Anthropic'))) {
                  claudeSessions++;
                  console.log(`    ✓ Claude session found: ${sessionFile}`);
                  console.log(`      Created: ${new Date(session.creationDate).toLocaleString()}`);
                  console.log(`      Messages: ${session.requests?.length || 0}`);
                }
              } catch (e) {
                // Skip invalid session
              }
            }
          }
        }

        // Check for state database
        const dbPath = path.join(workspacePath, 'state.vscdb');
        if (fs.existsSync(dbPath)) {
          const stats = fs.statSync(dbPath);
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          console.log(`  State DB: ${sizeMB} MB`);
        }

        console.log('');
      } catch (e) {
        // Skip invalid workspace
      }
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('Summary:');
  console.log(`  Total workspaces: ${foundWorkspaces}`);
  console.log(`  Total chat sessions: ${totalChatSessions}`);
  console.log(`  Claude sessions: ${claudeSessions}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Check global storage
  console.log('📦 Checking global storage for Claude Code data...\n');

  const globalDbPath = path.join(GLOBAL_STORAGE, 'state.vscdb');
  if (fs.existsSync(globalDbPath)) {
    const stats = fs.statSync(globalDbPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✓ Global state database found (${sizeMB} MB)`);
    console.log(`  Path: ${globalDbPath}`);
    console.log('');
  }

  const storageJsonPath = path.join(GLOBAL_STORAGE, 'storage.json');
  if (fs.existsSync(storageJsonPath)) {
    const stats = fs.statSync(storageJsonPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✓ Storage JSON found (${sizeKB} KB)`);
    console.log(`  Path: ${storageJsonPath}`);
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════\n');
  console.log('💡 Integration Ideas:\n');
  console.log('1. Parse chat session JSONs to extract tool usage');
  console.log('2. Watch chatSessions directories for new files');
  console.log('3. Build a VSCode extension to intercept calls');
  console.log('4. Create an MCP server for automatic tracking');
  console.log('');

} catch (error) {
  console.error('Error:', error.message);
  console.log('\nMake sure VSCode is installed and has been used.');
}
