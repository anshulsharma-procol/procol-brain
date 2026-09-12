import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

/**
 * ============================================================================
 *  WHERE THE CONSOLE FINDS THE BRAIN
 * ============================================================================
 *
 * By default the console calls the tunnel directly: `VITE_BRAIN_API_URL` is the
 * full ngrok URL, so the domain is what appears in the Network tab and in every
 * curl, and this proxy is not in the path at all. `platform/api/index.ts` sends
 * `ngrok-skip-browser-warning` on every request, which is what keeps a free
 * tunnel from answering the browser with its HTML interstitial.
 *
 * The proxy below is the fallback for the two things a direct connection cannot
 * fix by itself, and it is here rather than deleted because either one turns up
 * only against a live tunnel:
 *
 *   1. CORS. Sending a custom header makes every request preflighted, so the
 *      backend has to answer OPTIONS and allow `ngrok-skip-browser-warning`
 *      by name. A backend that does not is unreachable from the browser.
 *   2. SSE. `EventSource` cannot set headers at all, so the live transcript
 *      has no way to carry the bypass header — if a tunnel interstitials it,
 *      no amount of client code will help.
 *
 * Both disappear behind a same-origin proxy, because then the browser is only
 * ever talking to this dev server. To switch: set `VITE_BRAIN_API_URL=/api` and
 * point `VITE_BRAIN_API_TARGET` at the tunnel.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_BRAIN_API_TARGET?.replace(/\/+$/, '')

  const proxy: ProxyOptions = {
    target: target ?? 'http://localhost:4000',
    changeOrigin: true,
    secure: true,
    // SSE must arrive as it is written, not in one lump at the end of the run.
    // The transcript is the demo; buffering it would show nothing for 25
    // seconds and then everything.
    configure(server) {
      server.on('proxyReq', (request) => {
        request.setHeader('ngrok-skip-browser-warning', 'true')
        request.setHeader('accept-encoding', 'identity')
      })
    },
  }

  return {
    plugins: [react(), tailwindcss()],

    server: {
      proxy: { '/api': proxy },
    },

    preview: {
      proxy: { '/api': proxy },
    },

    css: {
      modules: {
        // The Brain Chat widget is style-isolated by convention: every class it
        // emits starts with `pb-`, so it can never collide with Tailwind or with
        // the console's own styles - and it stays extractable as a package.
        generateScopedName: 'pb-[local]-[hash:base64:5]',
      },
    },
  }
})
