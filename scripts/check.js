#!/usr/bin/env node
/**
 * "npm run check" - diagnoses the most common reasons the app does not connect.
 */
const net = require('net');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const ok = (m) => console.log(`  [OK]   ${m}`);
const bad = (m, fix) => console.log(`  [FAIL] ${m}\n         -> ${fix}`);

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const s = net.createConnection({ port, host });
    s.setTimeout(1500);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.on('error', () => resolve(false));
  });
}

async function httpJson(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return await r.json();
  } catch (e) {
    return null;
  }
}

(async () => {
  console.log('\nMediTrack environment check\n');

  const [major] = process.versions.node.split('.').map(Number);
  if (major >= 18) ok(`Node.js ${process.versions.node}`);
  else bad(`Node.js ${process.versions.node} is too old`, 'Install Node.js 18 LTS or newer from https://nodejs.org');

  const py = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
  const found = py.map((c) => [c, spawnSync(c, ['--version'], { encoding: 'utf8' })]).find(([, r]) => r.status === 0);
  if (found) ok(`Python found: ${(found[1].stdout || found[1].stderr).trim()} (${found[0]})`);
  else bad('Python not found', 'Install Python 3.8+ from https://www.python.org (tick "Add to PATH")');

  for (const [dir, label] of [['node_modules', 'root'], ['backend/node_modules', 'backend'], ['frontend/node_modules', 'frontend']]) {
    if (fs.existsSync(path.join(root, dir))) ok(`${label} packages installed`);
    else bad(`${label} packages missing`, 'Run: npm run setup');
  }
  if (fs.existsSync(path.join(root, 'ai-service', '.venv'))) ok('Python virtual environment installed');
  else bad('Python virtual environment missing', 'Run: npm run setup');

  if (await portOpen(27017)) ok('MongoDB is listening on 127.0.0.1:27017');
  else bad('MongoDB is NOT reachable on 127.0.0.1:27017', 'Start it: Windows "net start MongoDB" (admin) | macOS "brew services start mongodb-community" | Linux "sudo systemctl start mongod"');

  const api = await httpJson('http://127.0.0.1:5000/api/health');
  if (api) {
    ok('Backend API is running on :5000');
    if (api.database === 'UP') ok('Backend is connected to MongoDB');
    else bad('Backend is running but NOT connected to MongoDB', 'Start MongoDB; the backend reconnects automatically');
  } else {
    console.log('  [--]   Backend API not running on :5000 (start it with: npm run dev)');
  }

  const ai = await httpJson('http://127.0.0.1:8000/health');
  if (ai) ok('Python AI service is running on :8000');
  else console.log('  [--]   Python AI service not running on :8000 (it starts with: npm run dev)');

  console.log('');
})();
