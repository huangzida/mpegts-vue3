// tsdown emits declaration files with a content hash (e.g. index-AbC123.d.ts).
// Rename them to the stable names the package.json "types"/"exports" fields point at.
// Run from the package directory after `tsdown` (CWD = package root, so "dist" resolves).
import { copyFileSync, readdirSync, renameSync } from 'node:fs'

const dir = 'dist'
for (const file of readdirSync(dir)) {
  if (file.startsWith('index-') && file.endsWith('.d.ts')) {
    renameSync(`${dir}/${file}`, `${dir}/index.d.ts`)
  } else if (file.startsWith('index-') && file.endsWith('.d.cts')) {
    renameSync(`${dir}/${file}`, `${dir}/index.d.cts`)
  }
}

// Copy the monorepo README into the package dir so `npm publish` ships it.
// README lives at repo root; npm only auto-includes a README found in the
// package dir itself. Single source of truth (root README) — the copies are
// gitignored, regenerated each build.
copyFileSync('../../README.md', 'README.md')

