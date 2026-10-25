/* Servidor local sin dependencias; no se necesita para el alojamiento estático. */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const filename = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const target = path.resolve(root, `.${filename}`);
      if (!target.startsWith(root + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const type = contentTypes[path.extname(target)];
      if (!type) {
        response.writeHead(404).end('Not found');
        return;
      }
      const content = await fs.readFile(target);
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      response.end(content);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`STILL HERE. — http://127.0.0.1:${port}`);
  });
}

module.exports = { createServer };
