import { spawn } from 'node:child_process';
const children = [
  spawn('npm', ['run', 'dev:api'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn('npm', ['run', 'dev:web'], { stdio: 'inherit', shell: process.platform === 'win32' })
];
function shutdown() { for (const child of children) child.kill(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
children.forEach(child => child.on('exit', code => { if (code && code !== 0) { shutdown(); process.exitCode = code; } }));
