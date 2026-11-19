#!/usr/bin/env node
/**
 * Cross-platform helper for the Python AI service.
 *   node scripts/python.js install   -> creates ai-service/.venv and installs requirements
 *   node scripts/python.js run       -> starts the Flask service
 *   node scripts/python.js test      -> runs ai-service/test_models.py
 *   node scripts/python.js train     -> refits the selected models (fast)
 *   node scripts/python.js evaluate  -> full model comparison + report (several minutes)
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const AI_DIR = path.join(__dirname, '..', 'ai-service');
const VENV = path.join(AI_DIR, '.venv');
const isWin = process.platform === 'win32';
const venvPython = path.join(VENV, isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python');

function findSystemPython() {
  const candidates = isWin ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]];
  for (const [cmd, pre] of candidates) {
    const r = spawnSync(cmd, [...pre, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' });
    if (r.status === 0) {
      const [major, minor] = r.stdout.trim().split('.').map(Number);
      if (major === 3 && minor >= 8) return { cmd, pre, version: r.stdout.trim() };
    }
  }
  return null;
}

function fail(msg) {
  console.error(`\n[AI ] ${msg}\n`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: AI_DIR, ...opts });
  if (r.status !== 0) fail(`Command failed: ${cmd} ${args.join(' ')}`);
}

function pythonForRun() {
  if (fs.existsSync(venvPython)) return { cmd: venvPython, pre: [] };
  const sys = findSystemPython();
  if (!sys) fail('Python 3.8+ was not found. Install it from https://www.python.org/downloads/ (tick "Add python.exe to PATH"), then run: npm run setup');
  console.log('[AI ] Virtual environment not found - using system Python. Run "npm run setup" to install requirements.');
  return sys;
}

const action = process.argv[2];

if (action === 'install') {
  const sys = findSystemPython();
  if (!sys) fail('Python 3.8+ was not found. Install it from https://www.python.org/downloads/ (tick "Add python.exe to PATH") and run "npm run setup" again.');
  console.log(`[AI ] Using Python ${sys.version} (${sys.cmd})`);
  if (!fs.existsSync(venvPython)) {
    console.log('[AI ] Creating virtual environment in ai-service/.venv ...');
    run(sys.cmd, [...sys.pre, '-m', 'venv', '.venv']);
  }
  console.log('[AI ] Installing Python requirements ...');
  run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', 'requirements.txt']);
  console.log('[AI ] Training the disease-risk models on the bundled datasets (a few seconds) ...');
  run(venvPython, ['train_models.py']);
  console.log('[AI ] Python AI service ready.');
} else if (['run', 'test', 'train', 'evaluate'].includes(action)) {
  const py = pythonForRun();
  const args = {
    run: ['app.py'],
    test: ['test_models.py'],
    train: ['train_models.py'],
    evaluate: ['train_models.py', '--evaluate'],
  }[action];
  const child = spawn(py.cmd, [...py.pre, ...args], { stdio: 'inherit', cwd: AI_DIR, env: { ...process.env, PYTHONUNBUFFERED: '1' } });
  child.on('exit', (code) => process.exit(code ?? 0));
  ['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => child.kill(sig)));
} else {
  console.log('Usage: node scripts/python.js <install|run|test|train|evaluate>');
  process.exit(1);
}
