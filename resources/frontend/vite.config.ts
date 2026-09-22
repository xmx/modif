import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': import.meta.dirname + '/src',
    },
  },
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
    // 仅面向最新版 Chrome，不做旧浏览器降级，产物更小更快
    target: 'chrome120',
    cssMinify: true,
  },
  server: {
    host: '0.0.0.0',
    port: 8867,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8866',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})