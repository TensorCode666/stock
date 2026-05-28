/** GitHub Pages SPA：404 回退到 index.html */
import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist');
copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
console.log('copied dist/index.html → dist/404.html');
