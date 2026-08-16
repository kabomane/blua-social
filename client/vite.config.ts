import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Le mode `https` est réservé au développement local. Les certificats sont
  // générés par `npm run cert:dev` et ne sont pas versionnés.
  const https =
    mode === 'https'
      ? {
          key: readFileSync(new URL('./.cert/dev-key.pem', import.meta.url)),
          cert: readFileSync(new URL('./.cert/dev-cert.pem', import.meta.url)),
        }
      : undefined

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      https,
      proxy: {
        // Les appels /api du client sont relayés vers le serveur Node.
        '/api': 'http://localhost:3001',
      },
    },
  }
})
