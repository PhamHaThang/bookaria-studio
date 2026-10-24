import { cp, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pdfjs-dist/package.json'));
const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const destination = resolve('public/vendor/pdfjs', version);
await mkdir(destination, { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs'])
    await cp(resolve(root, folder), resolve(destination, folder), { recursive: true });
await cp(resolve(root, 'LICENSE'), resolve(destination, 'LICENSE'));
console.log(`PDF.js ${version}: local fonts and decoders ready.`);
