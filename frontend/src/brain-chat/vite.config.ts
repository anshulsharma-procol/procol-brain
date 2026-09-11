import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))

/**
 * Library build for `@procol/brain-chat`.
 *
 * Deliberately separate from the console's vite.config.ts: the SDK ships to
 * third-party React apps, so it must not pull in Tailwind or assume anything
 * about the host's build. React stays external and the CSS Modules hash matches
 * the console's `pb-` convention.
 */
export default defineConfig({
  root: here,
  plugins: [react()],

  css: {
    modules: {
      generateScopedName: 'pb-[local]-[hash:base64:5]',
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: true,
    lib: {
      entry: fileURLToPath(new URL('./index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/],
      output: {
        // Single stylesheet, imported by consumers as
        // `@procol/brain-chat/styles.css`.
        assetFileNames: 'styles.[ext]',
      },
    },
  },
})
