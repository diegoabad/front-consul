import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// En dev: NO inyectamos aquí; Vite lee .env y expone VITE_API_URL. En build (Netlify) sí inyectamos desde process.env.
const isBuild = process.argv.includes('build');
const apiUrl = (process.env.VITE_API_URL || process.env.API_URL || '').trim();
if (isBuild) {
  console.log('[Vite build] API URL:', apiUrl || '(vacío → el front usará localhost en producción)');
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) return 'vendor';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
    chunkSizeWarningLimit: 550,
  },
  define: isBuild
    ? { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl) }
    : {},
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
