import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

// User documents live in data/saved/. The usage guide (data/usage-guide.md) sits outside
// that folder, so this API can never overwrite or delete it.
const SAVED_DIR = path.resolve(process.cwd(), 'data', 'saved');

function savedDocsApi(req, res) {
  fs.mkdirSync(SAVED_DIR, { recursive: true });
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    const files = fs
      .readdirSync(SAVED_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((fileName) => {
        const full = path.join(SAVED_DIR, fileName);
        return {
          fileName,
          content: fs.readFileSync(full, 'utf-8'),
          mtimeMs: fs.statSync(full).mtimeMs
        };
      });
    res.end(JSON.stringify({ files }));
    return;
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}');
      const safeName = path.basename(payload.fileName || '');
      if (!safeName.endsWith('.md')) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid .md filename' }));
        return;
      }
      const targetPath = path.join(SAVED_DIR, safeName);
      if (req.method === 'POST') {
        fs.writeFileSync(targetPath, payload.content ?? '', 'utf-8');
      } else if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      res.end(JSON.stringify({ ok: true, fileName: safeName }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(err) }));
    }
  });
}

function savedDocsPlugin() {
  return {
    name: 'depthdoc-saved-docs',
    configureServer(server) {
      server.middlewares.use('/api/files', savedDocsApi);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/files', savedDocsApi);
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), savedDocsPlugin()],
});
