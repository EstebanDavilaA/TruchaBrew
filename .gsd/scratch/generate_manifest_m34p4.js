import fs from 'node:fs';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const target = process.argv[2] || 'pre';
const filename = `.gsd/scratch/manifest_m34p4_${target}.txt`;

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .map(f => f.trim())
  .filter(Boolean)
  .filter(f => !f.startsWith('.gsd/scratch/manifest_m34p4_') && !f.startsWith('.gsd/scratch/generate_manifest_m34p4.js'))
  .filter(f => {
    try {
      return fs.existsSync(f) && fs.statSync(f).isFile();
    } catch {
      return false;
    }
  })
  .sort();

const lines = files.map(file => {
  const content = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `${hash}  ${file}`;
});

fs.writeFileSync(filename, lines.join('\n') + '\n', 'utf8');
console.log(`Wrote ${filename} with ${lines.length} files`);
