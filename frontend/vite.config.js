import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api/* requests to the backend during dev to avoid CORS and ensure requests
    // from the browser reach the FastAPI server running on port 8000 inside the dev container.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const auth = req.headers && req.headers.authorization;
            if (auth) {
              proxyReq.setHeader('authorization', auth);
            }
          });
        },
      },
    },
  },
})
