import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  css: {
    modules: {
      // The Brain Chat widget is style-isolated by convention: every class it
      // emits starts with `pb-`, so it can never collide with Tailwind or with
      // the console's own styles - and it stays extractable as a package.
      generateScopedName: 'pb-[local]-[hash:base64:5]',
    },
  },
})
