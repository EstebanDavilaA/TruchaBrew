import fs from 'node:fs';
import path from 'node:path';

const src = '.gsd/active/M28_P1_feature_spec.md';
const destDir = '.gsd/archive/specs';
const dest = path.join(destDir, 'M28_P1_feature_spec.md');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(src, dest);
fs.unlinkSync(src);

console.log(`Copied ${src} to ${dest} and deleted original from active`);
