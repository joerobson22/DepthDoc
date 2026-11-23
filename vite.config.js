import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

const GUIDE_FILE = 'multi-altitude-latex-guide.md';
const GUIDE_CONTENT = `# Multi-Altitude & LaTeX Authoring Guide

Use fenced \`:::\` containers to layer your proposal from executive takeaways down to mathematical proofs.

:::executive[1. Top-Level Executive Pillars]
\`:::executive[Title]\` blocks always remain at the top level—opening a new \`:::executive[...]\` automatically closes any prior executive block so pillars stay cleanly separated.

:::product[2. Nested Product & Sub-Product Layers]
\`:::product[Title]\` blocks can contain nested \`:::product[Sub-Product]\` blocks to organize modular features without cluttering the executive summary.

:::technical[3. Technical Architecture & Deep Dives]
Place system architecture inside \`:::technical[Title]\` and equations/code inside \`:::deep-dive[Title]\`.

:::deep-dive[4. Inline & Display LaTeX Formulas]
- **Inline Math:** Wrap expressions in single dollar signs like \`$\\sum \\text{Hours} \\le \\text{Capacity}$\` → $\\sum \\text{Hours} \\le \\text{Capacity}$.
- **Display Math:** Wrap standalone equations in double dollar signs \`$$ ... $$\`:
$$\\mathcal{L}(x, \\lambda) = f(x) + \\sum_{i=1}^{m} \\lambda_i g_i(x)$$
:::
:::
:::
:::`;

function localMarkdownDataPlugin() {
  const dataDir = path.resolve(process.cwd(), 'data');

  const ensureDataDir = () => {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const guidePath = path.join(dataDir, GUIDE_FILE);
    if (!fs.existsSync(guidePath)) {
      fs.writeFileSync(guidePath, GUIDE_CONTENT, 'utf-8');
    }
  };

  return {
    name: 'local-markdown-data-plugin',
    configureServer(server) {
      ensureDataDir();
      server.middlewares.use('/api/files', (req, res) => {
        ensureDataDir();
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'GET') {
          const files = fs
            .readdirSync(dataDir)
            .filter((f) => f.endsWith('.md'))
            .map((fileName) => {
              const full = path.join(dataDir, fileName);
              const stat = fs.statSync(full);
              return {
                fileName,
                content: fs.readFileSync(full, 'utf-8'),
                mtimeMs: stat.mtimeMs
              };
            });
          res.end(JSON.stringify({ files }));
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
            const targetPath = path.join(dataDir, safeName);

            if (req.method === 'POST') {
              fs.writeFileSync(targetPath, payload.content ?? '', 'utf-8');
              res.end(JSON.stringify({ ok: true, fileName: safeName }));
            } else if (req.method === 'DELETE') {
              if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
              res.end(JSON.stringify({ ok: true }));
            }
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localMarkdownDataPlugin()],
});