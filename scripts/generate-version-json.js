const { execSync } = require('child_process');
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

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
