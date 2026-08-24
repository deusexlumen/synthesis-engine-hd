import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    ...(mode === 'development' ? [inspectAttr()] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the dependencies that dominate the bundle into their own
        // chunks. They change far less often than app code, so a release only
        // invalidates the app chunk instead of forcing every client to
        // re-download React and Framer Motion.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          // Rollup ids use forward slashes on every platform.
          const parts = id.split('/node_modules/');
          const pkg = parts[parts.length - 1].split('/')[0];

          if (['react', 'react-dom', 'react-router', 'scheduler'].includes(pkg)) {
            return 'vendor-react';
          }
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
            return 'vendor-motion';
          }
          if (id.includes('@radix-ui')) {
            return 'vendor-radix';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          return 'vendor';
        },
      },
    },
  },
}));
