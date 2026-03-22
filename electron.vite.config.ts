import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  // ── Main process ──────────────────────────────────────────────────────────
  main: {
    build: {
      outDir: 'dist/main',
      lib: {
        entry: resolve(__dirname, 'electron/main/index.ts'),
      },
      rollupOptions: {
        // 'electron' must be external so Electron's runtime resolves it to the
        // built-in API. electron-updater is external so electron-builder can
        // include it in the asar without bundling its native bindings.
        external: ['electron', 'electron-updater'],
      },
    },
  },

  // ── Preload ───────────────────────────────────────────────────────────────
  preload: {
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload/index.ts'),
        external: ['electron'],
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },

  // ── Renderer (React app) ──────────────────────────────────────────────────
  renderer: {
    root: resolve(__dirname),
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    plugins: [react(), tailwindcss()],
    // Dev-mode Vite proxy — used when running in a browser outside Electron.
    // In packaged Electron builds the main-process IPC proxy is used instead.
    server: {
      proxy: {
        '/bitmidi-api': {
          target: 'https://bitmidi.com/api',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/bitmidi-api/, ''),
        },
        '/bitmidi-file': {
          target: 'https://bitmidi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/bitmidi-file/, ''),
        },
      },
    },
  },
});
