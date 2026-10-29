import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewer = path.resolve(root, '../bookaria-viewer');
const destination = path.join(root, 'src/shared/scene-runtime');
const check = process.argv.includes('--check');
const hash = (content) => createHash('sha256').update(content).digest('hex');
const normalize = (content) => content.replace(/\r\n/g, '\n');
const outputs = {};
for (const name of ['buildScene.ts', 'InteractionRunner.ts']) {
    const original = normalize(await readFile(path.join(viewer, 'src/scene-core', name), 'utf8'));
    let content = original
        .replaceAll("'../shared/contracts/", "'../contracts/")
        .replaceAll("'../shared/scene/", "'../scene/")
        .replace("'../shared/api'", "'./fetchBytes'");
    if (name === 'buildScene.ts')
        content = content
            .replace("import { fetchBytes } from './fetchBytes';\n", '')
            .replace(
                'import { InteractionRunner, sleep }',
                "import { fetchBytes } from './fetchBytes';\nimport { InteractionRunner, sleep }",
            );
    if (name === 'InteractionRunner.ts') {
        content = content.replace(
            `    constructor(
        private rules: InteractionRule[],
        private execute: ActionExecutor,
        private onError: (message: string) => void = () => {},
        private delay = sleep,
    ) {}`,
            `    private rules: InteractionRule[];
    private execute: ActionExecutor;
    private onError: (message: string) => void;
    private delay: typeof sleep;
    constructor(rules: InteractionRule[], execute: ActionExecutor, onError: (message: string) => void = () => {}, delay = sleep) {
        this.rules = rules;
        this.execute = execute;
        this.onError = onError;
        this.delay = delay;
    }`,
        );
    }
    outputs[name] = { original, content };
}
const api = normalize(await readFile(path.join(viewer, 'src/shared/api.ts'), 'utf8'));
const fetchBytes = api.slice(api.indexOf('export async function fetchBytes('));
outputs['fetchBytes.ts'] = { original: fetchBytes, content: fetchBytes };
const require = createRequire(import.meta.url);
const biome = path.join(path.dirname(require.resolve('@biomejs/biome/package.json')), 'bin/biome');
for (const [name, value] of Object.entries(outputs)) {
    const result = spawnSync(
        process.execPath,
        [biome, 'format', '--stdin-file-path', path.join(destination, name)],
        { input: value.content, encoding: 'utf8', cwd: root },
    );
    if (result.status !== 0) throw new Error(result.stderr || 'Could not format runtime snapshot.');
    value.content = normalize(result.stdout);
}
const manifest = {
    source: 'bookaria-viewer/src/scene-core',
    files: Object.fromEntries(
        Object.entries(outputs).map(([name, value]) => [
            name,
            { source: hash(value.original), snapshot: hash(value.content) },
        ]),
    ),
};
await mkdir(destination, { recursive: true });
for (const [name, value] of Object.entries(outputs)) {
    const file = path.join(destination, name);
    if (check) {
        if (normalize(await readFile(file, 'utf8')) !== value.content)
            throw new Error(`Preview runtime drift: ${name}. Run pnpm preview:sync.`);
    } else await writeFile(file, value.content);
}
const manifestFile = path.join(destination, 'runtime-manifest.json');
if (check) {
    if (
        JSON.stringify(JSON.parse(await readFile(manifestFile, 'utf8'))) !==
        JSON.stringify(manifest)
    )
        throw new Error('Preview runtime manifest drift.');
    console.log('Studio and Viewer use matching scene and interaction runtimes.');
} else {
    await writeFile(manifestFile, `${JSON.stringify(manifest, null, 4)}\n`);
    console.log('Preview runtime synchronized from Viewer.');
}
