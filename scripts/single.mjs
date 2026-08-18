// Gera dist/ouroboro.html: o jogo inteiro em um arquivo, que abre com
// duplo clique, sem servidor. Uso: npm run single

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const DIST = new URL('../dist/', import.meta.url).pathname;

const html = await readFile(DIST + 'index.html', 'utf8');
const nomes = await readdir(DIST + 'assets');
const js = await readFile(DIST + 'assets/' + nomes.find((n) => n.endsWith('.js')), 'utf8');

// O script sai do head e entra no fim do body: script classico inline roda
// na hora, entao precisa vir depois do canvas existir.
const saida = html
  .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/, '')
  .replace('</body>', `<script>${js}</script></body>`);

await writeFile(DIST + 'ouroboro.html', saida);
console.log(`dist/ouroboro.html: ${(saida.length / 1024).toFixed(1)} KB, gzip ${(gzipSync(Buffer.from(saida), { level: 9 }).length / 1024).toFixed(1)} KB`);
