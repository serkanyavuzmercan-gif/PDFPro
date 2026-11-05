import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Injects the Content-Security-Policy; dev additionally allows Vite's HMR client. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'pdfpro-csp',
    transformIndexHtml(_html, ctx) {
      const dev = Boolean(ctx.server)
      const policy = [
        "default-src 'self'",
        `script-src 'self' 'wasm-unsafe-eval'${dev ? " 'unsafe-inline'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "worker-src 'self' blob:",
        `connect-src 'self'${dev ? ' ws: http://localhost:*' : ''}`,
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'"
      ].join('; ')
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    plugins: [contentSecurityPolicy(), react(), tailwindcss()]
  }
})
