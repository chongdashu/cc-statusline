import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'], // Use ESM for inquirer compatibility
  dts: false, // Disable for now due to inquirer type issues
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node'
  },
  target: 'node16',
  outDir: 'dist'
})