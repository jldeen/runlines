import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { handleDeviceRequest } from './api/github/device.ts';

/** Serve the Vercel device-flow function locally so sign-in works in `npm run dev`/`preview`. */
function githubDeviceProxy(clientId: string | undefined): Plugin {
  const middleware: Connect.NextHandleFunction = async (req, res) => {
    try {
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) chunks.push(chunk as Uint8Array);
      const request = new Request('http://localhost/api/github/device', {
        method: req.method,
        headers: { 'Content-Type': String(req.headers['content-type'] || '') },
        body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
      });
      const response = await handleDeviceRequest(request, clientId);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(await response.text());
    } catch {
      res.statusCode = 500;
      res.end();
    }
  };
  return {
    name: 'runlines-github-device-proxy',
    configureServer(server) {
      server.middlewares.use('/api/github/device', middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/github/device', middleware);
    },
  };
}

// RunLines — Vite + React + TS.
// PWA: precache the built app shell; never cache cross-origin script fetches
// (raw.githubusercontent.com, api.github.com) so lines stay live; network-first navigation.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    githubDeviceProxy(loadEnv(mode, process.cwd(), '').VITE_GITHUB_CLIENT_ID),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'RunLines',
        short_name: 'RunLines',
        description: 'Memorize your lines, fast.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // Never cache script content or authenticated GitHub responses — always hit the network.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://raw.githubusercontent.com',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://api.github.com',
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 8765, strictPort: true },
  preview: { port: 8765, strictPort: true },
}));
