// tsdown emits declaration files with a content hash (e.g. index-AbC123.d.ts).
// Rename them to the stable names the package.json "types"/"exports" fields point at.
// Run from the package directory after `tsdown` (CWD = package root, so "dist" resolves).
import { readdirSync, renameSync } from 'node:fs'

const dir = 'dist'
for (const file of readdirSync(dir)) {
  if (file.startsWith('index-') && file.endsWith('.d.ts')) {
    renameSync(`${dir}/${file}`, `${dir}/index.d.ts`)
  } else if (file.startsWith('index-') && file.endsWith('.d.cts')) {
    renameSync(`${dir}/${file}`, `${dir}/index.d.cts`)
  }
}
