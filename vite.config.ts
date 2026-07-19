/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Project Pages URL: https://klinton90.github.io/retirement-calc/
// Local `npm run dev` stays at `/`; CI/build for Pages uses the repo subpath.
const pagesBase =
  process.env.GITHUB_PAGES_BASE ??
  (process.env.GITHUB_ACTIONS === 'true' ? '/retirement-calc/' : '/')

// https://vite.dev/config/
export default defineConfig({
  base: pagesBase,
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
