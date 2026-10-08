import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const files = ['server.mjs'];
for (const directory of ['lib', 'api', 'public', 'scripts', 'tests']) {
  for (const entry of readdirSync(directory)) {
    if (/\.(mjs|js)$/.test(entry)) files.push(join(directory, entry));
  }
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const jsonFiles = ['package.json', 'vercel.json', 'public/manifest.json'].filter(existsSync);
for (const file of jsonFiles) {
  JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
console.log(`Checked ${files.length} JavaScript files and ${jsonFiles.length} JSON files.`);
