import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'src/shared/contracts');
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const backendIndex = args.indexOf('--backend');
const backend = path.resolve(
    backendIndex >= 0 ? args[backendIndex + 1] : path.join(root, '../bookaria-backend'),
);
const check = args.includes('--check');
const verify = args.includes('--verify');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifestFile = path.join(destination, 'contract-manifest.json');
const relativeFile = (file) => {
    if (!/^(?:api\/)?[a-z-]+\.schema\.ts$/.test(file))
        throw new Error(`Unsafe contract file: ${file}`);
    return path.join(destination, file);
};
async function loadManifest() {
    try {
        return JSON.parse(await readFile(manifestFile, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}
async function verifySnapshot(manifest, checkVersion = true) {
    if (manifest?.version !== 1)
        throw new Error('Missing or unsupported contract manifest. Run contract:sync.');
    for (const [file, expected] of Object.entries(manifest.files)) {
        if (hash(await readFile(relativeFile(file))) !== expected)
            throw new Error(`Generated schema changed: ${file}`);
    }
    const installed = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    if (checkVersion && installed.dependencies?.zod !== manifest.zod)
        throw new Error(`Pin zod to backend version ${manifest.zod}.`);
}
try {
    const previous = await loadManifest();
    if (verify) {
        await verifySnapshot(previous);
        console.log('Contract snapshot hashes and pinned Zod version are valid.');
    } else {
        const source = path.join(backend, 'src/schema');
        const backendPackage = JSON.parse(
            await readFile(path.join(backend, 'package.json'), 'utf8'),
        );
        const frontendPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
        const zod = backendPackage.dependencies.zod;
        if (frontendPackage.dependencies?.zod !== zod)
            throw new Error(`Install exactly zod@${zod} before syncing.`);
        const files = new Map();
        async function collect(dir, prefix = '') {
            for (const entry of await readdir(dir, { withFileTypes: true })) {
                if (entry.isDirectory() && entry.name === 'api')
                    await collect(path.join(dir, entry.name), 'api/');
                if (!entry.isFile() || !entry.name.endsWith('.schema.ts')) continue;
                const rel = prefix + entry.name;
                relativeFile(rel);
                const bytes = Buffer.from(
                    (await readFile(path.join(dir, entry.name), 'utf8')).replace(/\r\n/g, '\n'),
                );
                const content = bytes.toString('utf8');
                // The shared contract may depend only on Zod and other schemas in this snapshot.
                for (const match of content.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
                    const specifier = match[1];
                    if (specifier === 'zod') continue;
                    const resolved = path.posix.normalize(
                        path.posix.join(path.posix.dirname(rel), `${specifier}.ts`),
                    );
                    if (
                        !specifier.startsWith('.') ||
                        resolved.startsWith('../') ||
                        !resolved.endsWith('.schema.ts')
                    ) {
                        throw new Error(`Non-browser contract import in ${rel}: ${specifier}`);
                    }
                }
                files.set(rel, bytes);
            }
        }
        await collect(source);
        if (!files.has('api/auth.schema.ts') || !files.has('dto.schema.ts'))
            throw new Error('Incomplete backend schema source.');
        for (const [file, bytes] of files) {
            for (const match of bytes.toString('utf8').matchAll(/from\s*['"]([^'"]+)['"]/g)) {
                if (match[1] === 'zod') continue;
                const target = path.posix.normalize(
                    path.posix.join(path.posix.dirname(file), `${match[1]}.ts`),
                );
                if (!files.has(target)) throw new Error(`Missing schema dependency ${target}`);
            }
        }
        const manifest = {
            version: 1,
            zod,
            files: Object.fromEntries(
                [...files]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([file, bytes]) => [file, hash(bytes)]),
            ),
        };
        if (check) {
            await verifySnapshot(previous);
            if (JSON.stringify(previous) !== JSON.stringify(manifest))
                throw new Error(
                    'Backend schemas have changed. Run contract:sync and review the diff.',
                );
            console.log('Frontend contract matches the selected backend source.');
        } else {
            // This directory is generated. Never remove arbitrary project folders.
            if (previous) await verifySnapshot(previous, false);
            await mkdir(destination, { recursive: true });
            for (const [file, bytes] of files) {
                const target = relativeFile(file);
                await mkdir(path.dirname(target), { recursive: true });
                await writeFile(target, bytes);
            }
            for (const file of Object.keys(previous?.files || {})) {
                if (!files.has(file)) await unlink(relativeFile(file));
            }
            await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
            console.log(
                `Synced ${files.size} browser-safe schema files. Generated files must not be edited.`,
            );
        }
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
