import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy BitMidi API calls to bypass browser CORS restrictions.
      // /bitmidi-api/... → https://bitmidi.com/api/...
      '/bitmidi-api': {
        target: 'https://bitmidi.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bitmidi-api/, ''),
      },
      // Proxy BitMidi file downloads (uploads bucket)
      // /bitmidi-file/... → https://bitmidi.com/...
      '/bitmidi-file': {
        target: 'https://bitmidi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bitmidi-file/, ''),
      },
    },
  },
})
