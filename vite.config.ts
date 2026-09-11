import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

/**
 * Two jobs in one config:
 *
 *  - `vite` (serve)  -> runs the local demo host in `examples/procol-console`
 *  - `vite build`    -> builds the publishable library from `src/index.ts`
 *
 * The demo is never part of the published package.
 */
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === 'build'
      ? [
          libInjectCss(),
          dts({
            tsconfigPath: './tsconfig.build.json',
            include: ['src'],
            insertTypesEntry: true,
            // Roll every declaration into one self-contained dist/index.d.ts.
            // Per-file output emits extensionless relative re-exports, which
            // are errors under moduleResolution node16/nodenext - consumers
            // silently get `any` because skipLibCheck hides them.
            bundleTypes: true,
          }),
        ]
      : []),
  ],

  // Scoped, readable class names. Every emitted class starts with `pb-`, so the
  // widget can never collide with host application styles.
  css: {
    modules: {
      generateScopedName: 'pb-[local]-[hash:base64:5]',
    },
  },

  server: {
    port: 5180,
  },

  build: {
    target: 'es2020',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'ProcolBrainChat',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
  },
}))
