// Copy dist/index.html → dist/404.html so GitHub Pages can serve SPA deep-links.
import { copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(__dirname, '..', 'dist')

await copyFile(path.join(dist, 'index.html'), path.join(dist, '404.html'))
console.log('postbuild: copied dist/index.html → dist/404.html')
