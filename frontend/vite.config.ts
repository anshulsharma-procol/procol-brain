import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

/**
 * ============================================================================
 *  WHERE THE CONSOLE FINDS THE BRAIN
 * ============================================================================
 *
 * The backend is not on this machine — it is a tunnelled ngrok host. Pointing
 * the browser straight at it fails three different ways, so the dev server
 * proxies instead and all three go away at once:
 *
 *   1. CORS. A tunnelled backend that has not allowlisted this origin rejects
 *      every request. Through the proxy the browser only ever talks to
 *      localhost, so there is no cross-origin request to reject.
 *   2. ngrok's browser interstitial. A free tunnel answers browser-shaped
 *      requests with an HTML warning page instead of the JSON asked for,
 *      unless `ngrok-skip-browser-warning` is set. The proxy sets it on every
 *      request, so no caller has to remember.
 *   3. SSE. `EventSource` cannot send custom headers at all — so the live
 *      transcript could never carry that header itself, and a direct
 *      connection would be served the interstitial with no way around it.
 *
 * `VITE_BRAIN_API_TARGET` is the tunnel. `VITE_BRAIN_API_URL` stays a
 * same-origin `/api`, so nothing above the adapter knows any of this happened.
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
