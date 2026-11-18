// Development server: compiles with tsc (NestJS needs the decorator metadata that esbuild-based runners
// such as tsx do not emit), then keeps the compiler and the server in watch mode together.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const node = process.execPath;

if (!existsSync('backend.env')) {
  console.error('backend.env not found. Copy backend.env.example to backend.env and fill it in (see README).');
  process.exit(1);
}

const first = spawnSync(node, [tsc, '-p', 'tsconfig.build.json'], { stdio: 'inherit' });
if (first.status !== 0) process.exit(first.status ?? 1);

const children = [
  spawn(node, [tsc, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], { stdio: 'inherit' }),
  spawn(node, ['--watch-path=dist', '--env-file=backend.env', 'dist/main.js'], { stdio: 'inherit' }),
];

const stop = (code = 0) => {
  for (const child of children) child.kill();
  process.exit(code);
};
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of children) child.on('exit', (code) => code && stop(code));
