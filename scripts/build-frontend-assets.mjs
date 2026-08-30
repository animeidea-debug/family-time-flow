import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = join(root, 'web', 'html', 'family-time-flow', 'assets');
const checkOnly = process.argv.includes('--check');
const buildDir = mkdtempSync(join(tmpdir(), 'ftf-assets-'));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const artifacts = [
  {
    name: 'gsap.min.js',
    source: join(root, 'node_modules', 'gsap', 'dist', 'gsap.min.js')
  },
  {
    name: 'flatpickr.min.css',
    source: join(root, 'node_modules', 'flatpickr', 'dist', 'flatpickr.min.css')
  },
  {
    name: 'flatpickr.min.js',
    source: join(root, 'node_modules', 'flatpickr', 'dist', 'flatpickr.min.js')
  },
  {
    name: 'flatpickr-zh.js',
    source: join(root, 'node_modules', 'flatpickr', 'dist', 'l10n', 'zh.js')
  }
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

try {
  const tailwind = spawnSync(process.execPath, [
    join(root, 'node_modules', 'tailwindcss', 'lib', 'cli.js'),
    '-c', join(root, 'tailwind.config.js'),
    '-i', join(root, 'web', 'assets', 'src', 'app.css'),
    '-o', join(buildDir, 'app.min.css'),
    '--minify'
  ], { cwd: root, encoding: 'utf8' });

  if (tailwind.status !== 0) {
    process.stderr.write(tailwind.stdout || '');
    process.stderr.write(tailwind.stderr || '');
    throw new Error('Tailwind asset build failed');
  }

  for (const artifact of artifacts) {
    copyFileSync(artifact.source, join(buildDir, artifact.name));
  }

  const artifactNames = ['app.min.css', ...artifacts.map(item => item.name)];
  const manifest = {
    generatedBy: 'scripts/build-frontend-assets.mjs',
    versions: {
      daisyui: packageJson.devDependencies.daisyui,
      flatpickr: packageJson.devDependencies.flatpickr,
      gsap: packageJson.devDependencies.gsap,
      tailwindcss: packageJson.devDependencies.tailwindcss
    },
    assets: Object.fromEntries(artifactNames.map(name => [name, sha256(join(buildDir, name))]))
  };
  writeFileSync(join(buildDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const outputs = [...artifactNames, 'manifest.json'];
  if (checkOnly) {
    for (const name of outputs) {
      const expected = join(buildDir, name);
      const committed = join(targetDir, name);
      if (!existsSync(committed) || !readFileSync(expected).equals(readFileSync(committed))) {
        fail(`Frontend asset is missing or stale: ${name}. Run npm run build:frontend.`);
      }
    }
  } else {
    mkdirSync(targetDir, { recursive: true });
    for (const name of outputs) copyFileSync(join(buildDir, name), join(targetDir, name));
    console.log(`Built ${outputs.length} offline frontend assets.`);
  }
} finally {
  rmSync(buildDir, { recursive: true, force: true });
}
