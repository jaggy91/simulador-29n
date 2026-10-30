import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { VEDA_FILES, stripVeda } from './src/veda.js';

// La web lee /data/*.json directamente: en desarrollo se sirven desde ./data y al
// compilar se copian a dist/data (sin backend). Durante la veda electoral
// (`vite build --mode veda`) solo se copian los de VEDA_FILES.
const DATA = path.resolve('data');
function dataPlugin(veda) {
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
      const files = fs.readdirSync(DATA).filter((f) => f.endsWith('.json') && (!veda || VEDA_FILES.includes(f.slice(0, -5))));
      for (const f of files) this.emitFile({ type: 'asset', fileName: `data/${f}`, source: fs.readFileSync(path.join(DATA, f)) });
    },
  };
}

// En la versión de veda, la metodología se incluye ya sin los bloques con cifras de
// encuestas: no basta con ocultarlos en el navegador, no deben estar en el código publicado.
function methodologyPlugin(veda) {
  return {
    name: 'metodologia-veda',
    enforce: 'pre',
    load(id) {
      if (!veda || !id.includes('?raw') || !id.split('?')[0].endsWith('METODOLOGIA.md')) return null;
      return `export default ${JSON.stringify(stripVeda(fs.readFileSync(path.resolve('METODOLOGIA.md'), 'utf8')))};`;
    },
  };
}

export default defineConfig(({ mode }) => {
  const veda = mode === 'veda';
  return {
    base: './',
    plugins: [react(), dataPlugin(veda), methodologyPlugin(veda)],
    define: { __VEDA_BUILD__: JSON.stringify(veda) },
    test: { include: ['test/**/*.test.js'] },
  };
});
