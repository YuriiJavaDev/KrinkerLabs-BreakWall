// Bundles src/ with esbuild into dist/: index.html, game.css, app.js. `--test` builds the checks into dist/tests.js instead.
import { createRequire } from 'node:module';
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let esbuild;
try { esbuild = require('esbuild'); } catch { esbuild = require('/opt/npm-tools/node_modules/esbuild'); }

const test = process.argv.includes('--test');
const dist = path.join(here, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

if (test) {
  await esbuild.build({ entryPoints: [path.join(here, 'test/tests.ts')], bundle: true, platform: 'node', format: 'esm',
    outfile: path.join(dist, 'tests.js'), logLevel: 'warning' });
} else {
  await esbuild.build({ entryPoints: [path.join(here, 'src/main.ts')], bundle: true, minify: true, format: 'esm',
    target: 'es2020', outfile: path.join(dist, 'app.js'), logLevel: 'warning' });
  for (const f of ['index.html', 'game.css']) copyFileSync(path.join(here, f), path.join(dist, f));
}
console.log(test ? 'tests built' : 'built');
