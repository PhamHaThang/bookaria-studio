// Optional maintenance command. Normal install/build never downloads vendor files.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const source = 'https://registry.npmjs.org/mind-ar/-/mind-ar-1.2.5.tgz';
const integrity =
    'sha512-YsbiNYaNbI/AMSXYfL+c/vJaFD/RB8uKtAOhmMyOkGZ0vBnEM8+KPh3ee8BH35ldtVudziJpv62qqV6dns/Evw==';
const archive = process.argv[2]
    ? await readFile(process.argv[2])
    : Buffer.from(await (await fetch(source)).arrayBuffer());
if (`sha512-${createHash('sha512').update(archive).digest('base64')}` !== integrity)
    throw new Error('MindAR package integrity mismatch');
const bytes = gunzipSync(archive, { maxOutputLength: 100 * 1024 * 1024 });
const entries = new Map();
// Read regular files only; paths from the tar are never used as output paths.
for (let offset = 0; offset + 512 <= bytes.length; ) {
    const header = bytes.subarray(offset, offset + 512);
    if (!header.some((value) => value !== 0)) break;
    const name = header.subarray(0, 100).toString().replace(/\0.*$/s, '');
    const size = Number.parseInt(
        header.subarray(124, 136).toString().replace(/\0.*$/s, '').trim(),
        8,
    );
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > bytes.length)
        throw new Error('Invalid archive');
    if (header[156] === 0 || header[156] === 48)
        entries.set(name, bytes.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
}
const target = new URL('../public/vendor/mindar-1.2.5/', import.meta.url);
await mkdir(target, { recursive: true });
const queue = ['mindar-image.prod.js'],
    files = {};
while (queue.length) {
    const name = queue.pop();
    if (files[name]) continue;
    if (!/^[\w.-]+\.js$/.test(name)) throw new Error('Invalid vendor module name');
    const data = entries.get(`package/dist/${name}`);
    if (!data) throw new Error(`Missing module ${name}`);
    await writeFile(new URL(name, target), data);
    files[name] = createHash('sha256').update(data).digest('hex');
    for (const match of data.toString().matchAll(/(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/g))
        queue.push(match[1]);
}
const license = entries.get('package/LICENSE');
if (!license) throw new Error('Missing license');
await writeFile(new URL('LICENSE', target), license);
files.LICENSE = createHash('sha256').update(license).digest('hex');
await writeFile(
    new URL('manifest.json', target),
    `${JSON.stringify({ package: 'mind-ar', version: '1.2.5', source, integrity, files }, null, 2)}\n`,
);
console.log(`Verified and vendored MindAR 1.2.5: ${Object.keys(files).length} files.`);
