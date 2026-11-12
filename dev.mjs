import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

function run(name, command, args, cwd) {
  const proc = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });

  proc.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
  });

  return proc;
}

console.log('🚀 Starting PATRIK AI in auto-reload dev mode...');

const backend = run('backend', 'node', ['--watch', 'server.js'], join(rootDir, 'backend'));
const frontend = run('frontend', 'npm', ['run', 'dev'], join(rootDir, 'frontend'));

process.on('SIGINT', () => {
  backend.kill();
  frontend.kill();
  process.exit();
});
