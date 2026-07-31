/**
 * Vite config used exclusively by `tauri build` / `tauri dev`.
 * No PORT or BASE_PATH env vars required.
 */
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  // Needed for Tauri IPC to work
  clearScreen: false,
  build: {
    // Tauri reads frontendDist: "../dist" relative to src-tauri/
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // WebView2 on Windows 10+ supports modern JS
    target: ['chrome105'],
    minify: true,
    sourcemap: false,
  },
  server: {
    // Tauri sets TAURI_DEV_HOST when running on a remote host
    host: process.env.TAURI_DEV_HOST || 'localhost',
    port: 1420,
    strictPort: true,
  },
});
