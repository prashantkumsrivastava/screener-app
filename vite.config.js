import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { handleJsonDbApi } from './server/jsonDb.js'

function jsonDbPlugin() {
  return {
    name: 'vite-plugin-jsondb',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.includes('/api/db')) {
          const handled = await handleJsonDbApi(req, res);
          if (!handled && !res.headersSent) {
            next();
          }
        } else {
          next();
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: '/screener-app/', // -- github pages deploy changes
  plugins: [react(), jsonDbPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      },
      '/api/yahoo2': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo2/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      }
    }
  }
})


