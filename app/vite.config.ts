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

          // The PDF stack is reached only through the dynamic import in
          // PDFExportButton, so these chunks stay lazy. They are named
          // separately so neither crosses the 500kB warning threshold —
          // raising that limit instead would also hide a regression in the
          // chunks that DO load on first paint.
          if (id.includes('jspdf')) {
            return 'vendor-pdf';
          }
          if (id.includes('html2canvas')) {
            return 'vendor-canvas';
          }

          // Everything else is left to Rollup. A catch-all 'vendor' chunk
          // would be statically imported by the entry, which hoists the
          // dependencies of dynamic imports into the initial load — jspdf and
          // html2canvas alone added ~750kB that way, defeating the lazy
          // import in PDFExportButton.
          return undefined;
        },
      },
    },
  },
}));
