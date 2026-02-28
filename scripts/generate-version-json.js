import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

let commit;
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  commit = 'unknown';
}

const data = {
  commit,
  version: pkg.version,
  buildTime: new Date().toISOString(),
};

const outDir = join(__dirname, '..', 'client', 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'version.json'), JSON.stringify(data, null, 2) + '\n');

console.log(`[version] Generated version.json: ${commit} v${pkg.version}`);
