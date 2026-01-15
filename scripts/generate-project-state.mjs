import { readFile, readdir, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

async function fileSha(path) {
  try {
    const c = await readFile(path, 'utf8');
    return crypto.createHash('sha256').update(c).digest('hex');
  } catch {
    return null;
  }
}

async function listFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isFile()) files.push(full);
      else if (e.isDirectory()) {
        const sub = await listFiles(full);
        files.push(...sub);
      }
    }
    return files;
  } catch {
    return [];
  }
}

function gitCommit() {
  try {
    return execSync('git rev-parse --verify HEAD').toString().trim();
  } catch {
    return null;
  }
}

async function discoverToolsInDist() {
  const toolsDir = join(process.cwd(), 'dist', 'tools');
  try {
    const entries = await readdir(toolsDir);
    const tools = [];
    for (const fname of entries) {
      if (!fname.endsWith('.js') && !fname.endsWith('.mjs') && !fname.endsWith('.cjs')) continue;
      const txt = await readFile(join(toolsDir, fname), 'utf8').catch(() => '');
      const re = /server\.registerTool\(\s*['"`]([^'"`]+)['"`]/g;
      let m;
      while ((m = re.exec(txt))) {
        tools.push({ name: m[1], file: fname });
      }
    }
    return tools;
  } catch {
    return [];
  }
}

async function readEnvKeys() {
  try {
    const txt = await readFile(join(process.cwd(), '.env.example'), 'utf8');
    const keys = [];
    for (const line of txt.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) keys.push(t.slice(0, i));
    }
    return keys;
  } catch {
    return [];
  }
}

async function main() {
  const cwd = process.cwd();
  const commit = gitCommit();
  const pkg = JSON.parse((await readFile(join(cwd, 'package.json'), 'utf8')) || '{}');
  const lockSha = await fileSha(join(cwd, 'package-lock.json'));
  const tsconfigSha = await fileSha(join(cwd, 'tsconfig.json'));
  const srcFiles = await listFiles(join(cwd, 'src')).catch(() => []);
  const distFiles = await listFiles(join(cwd, 'dist')).catch(() => []);
  const envKeys = await readEnvKeys();
  const tools = await discoverToolsInDist();

  const manifest = {
    generated_at: new Date().toISOString(),
    git: { commit },
    project: {
      name: pkg.name || null,
      version: pkg.version || null,
      main: pkg.main || null,
      scripts: pkg.scripts || {},
    },
    checksums: {
      package_lock: lockSha,
      tsconfig: tsconfigSha,
    },
    counts: {
      src_files: srcFiles.length,
      dist_files: distFiles.length,
    },
    env_keys: envKeys,
    discovered_tools: tools,
  };

  const snapshotsDir = join(cwd, 'snapshots');
  const name = `project-state-${commit ? commit.slice(0,8) : 'unknown'}.json`;
  await writeFile(join(snapshotsDir, name), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Wrote', join('snapshots', name));
}

main().catch((err) => {
  console.error('Failed to generate project state:', err);
  process.exit(1);
});
