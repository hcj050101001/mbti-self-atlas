// Test-only static host. The app remains a standalone, offline HTML file.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.env.APP_E2E_PORT || 4178);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('APP_E2E_PORT must be a port from 1024 to 65535');

// A fixed allowlist prevents the test server from exposing sources or local files.
const pages = new Map([
  ['/', readFileSync(new URL('../index.html', import.meta.url))],
  ['/index.html', readFileSync(new URL('../index.html', import.meta.url))],
  ['/publish/index.html', readFileSync(new URL('../publish/index.html', import.meta.url))],
]);
const server = createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const body = pages.get(pathname);
  if (!body) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
});
server.listen(port, '127.0.0.1', () => console.log(`Built HTML test host: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
