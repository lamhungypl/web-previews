import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/web-previews/',
  plugins: [react(), tailwindcss()],
  resolve: {
    // Read `paths` from tsconfig.json (which references tsconfig.app.json
    // where the `@/*` mapping lives). Vite 8 docs:
    // https://vite.dev/guide/features#paths
    tsconfigPaths: true,
  },
})
