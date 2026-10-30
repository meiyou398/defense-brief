import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from '../lib/preview.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const config = JSON.parse(await readFile(join(root, 'site.config.json'), 'utf8'));
const prefix = new URL(config.baseUrl).pathname.replace(/\/$/, '');
createPreviewServer(root, { port }).listen(port, '127.0.0.1', () => console.log(`预览：http://127.0.0.1:${port}${prefix}/`));
