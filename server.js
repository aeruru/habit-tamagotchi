import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['src/index.html', 'text/html']],
  ['/style.css', ['src/style.css', 'text/css']],
  ['/app.js', ['src/app.js', 'text/javascript']],
  ['/habit-edit-reporting/check-ins.js', ['src/habit-edit-reporting/check-ins.js', 'text/javascript']],
  ['/habit-edit-reporting/editor.js', ['src/habit-edit-reporting/editor.js', 'text/javascript']],
  ['/habit-edit-reporting/format.js', ['src/habit-edit-reporting/format.js', 'text/javascript']],
  ['/habit-edit-reporting/history.js', ['src/habit-edit-reporting/history.js', 'text/javascript']],
  ['/habit-edit-reporting/settings.js', ['src/habit-edit-reporting/settings.js', 'text/javascript']],
  ['/habit-engine/index.js', ['src/habit-engine/index.js', 'text/javascript']],
  ['/integrations/google.js', ['src/integrations/google.js', 'text/javascript']],
  ['/pet-display/web/panel.js', ['src/pet-display/web/panel.js', 'text/javascript']],
  ['/pet-display/web/scene.js', ['src/pet-display/web/scene.js', 'text/javascript']],
]);
const port = Number(process.env.PORT ?? 43183);
createServer(async (request, response) => {
  const file = files.get(request.url.split('?')[0]);
  if (!file) return response.writeHead(404).end();
  try {
    response.setHeader('Content-Type', file[1] + '; charset=utf-8');
    response.end(await readFile(new URL(file[0], import.meta.url)));
  } catch {
    response.writeHead(500).end();
  }
}).listen(port, '127.0.0.1', () => console.log('http://localhost:' + port));
