import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// La web lee /data/*.json directamente: en desarrollo se sirven desde ./data y al
// compilar se copian a dist/data (sin backend).
const DATA = path.resolve('data');
function dataPlugin() {
  return {
    name: 'data-json',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const file = path.join(DATA, decodeURIComponent(req.url.split('?')[0]));
        if (!file.startsWith(DATA) || !file.endsWith('.json') || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        fs.createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const f of fs.readdirSync(DATA).filter((f) => f.endsWith('.json'))) {
        this.emitFile({ type: 'asset', fileName: `data/${f}`, source: fs.readFileSync(path.join(DATA, f)) });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), dataPlugin()],
  test: { include: ['test/**/*.test.js'] },
});
