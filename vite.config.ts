import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

const rootDir = dirname(fileURLToPath(import.meta.url));

// A content hash of the client-facing app, not a timestamp/commit SHA: a
// commit that only touches tests, CI, or docs shouldn't bump this and
// prompt every open tab to refresh for no reason.
function computeAppVersion(): string {
  const TEST_FILE = /\.(test|spec)\.ts$/;
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!TEST_FILE.test(entry.name)) files.push(full);
    }
  }

  walk(join(rootDir, 'src'));
  if (existsSync(join(rootDir, 'public'))) walk(join(rootDir, 'public'));
  files.push(join(rootDir, 'index.html'));

  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(file);
    hash.update(readFileSync(file));
  }
  return hash.digest('hex').slice(0, 12);
}

function versionFilePlugin(): Plugin {
  const version = computeAppVersion();
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [versionFilePlugin()],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
