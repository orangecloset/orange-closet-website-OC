import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          const p = id.replace(/\\/g, '/')
          if (p.includes('jspdf') || p.includes('html2canvas')) return
          if (p.includes('@neondatabase/')) return 'vendor-auth'
          if (p.includes('@dnd-kit')) return 'vendor-dnd'
          if (p.includes('browser-image-compression')) return 'vendor-upload'
          if (p.includes('qr-code-styling')) return 'vendor-qr'
          if (p.includes('lucide-react')) return 'vendor-icons'
          if (
            p.includes('react-markdown') ||
            p.includes('remark') ||
            p.includes('micromark') ||
            p.includes('mdast') ||
            p.includes('unist') ||
            p.includes('hast') ||
            p.includes('vfile') ||
            p.includes('unified') ||
            p.includes('property-information')
          ) return 'vendor-markdown'
          if (
            p.includes('/react/') ||
            p.includes('/react-dom/') ||
            p.includes('/react-router') ||
            p.includes('/scheduler/') ||
            p.includes('/react-is/') ||
            p.includes('/@remix-run/')
          ) return 'vendor-react'
        },
      },
    },
  },
})
