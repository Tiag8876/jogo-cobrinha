// Teste de estresse e verificacao de console. Roda o bundle de producao
// em Chromium headless: cobra com 200 segmentos e 400 particulas.
// Uso: node scripts/bench.mjs

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, extname } from 'node:path';
import { readdir } from 'node:fs/promises';

const DIST = new URL('../dist/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  const file = join(DIST, url === '/' ? 'index.html' : url);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('nao encontrado');
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

// Tamanho real do bundle
let totalRaw = 0;
let totalGz = 0;
const arquivos = [];
for (const nome of await readdir(join(DIST, 'assets'))) {
  const p = join(DIST, 'assets', nome);
  const buf = await readFile(p);
  const gz = gzipSync(buf, { level: 9 }).length;
  totalRaw += (await stat(p)).size;
  totalGz += gz;
  arquivos.push({ nome, raw: buf.length, gz });
}
const html = await readFile(join(DIST, 'index.html'));
totalRaw += html.length;
totalGz += gzipSync(html, { level: 9 }).length;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });

const erros = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') erros.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));

// Tempo ate jogavel
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/?stress=1`, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('canvas')?.width > 0);
const tempoAteJogavel = Date.now() - t0;

// Aquece 1,5 s: instalacao do service worker e primeiro layout sao custo
// unico de carga e nao fazem parte do orcamento de frame do jogo.
await page.waitForTimeout(1500);

// Requisicoes de rede depois do carregamento
let requisicoesDepois = 0;
page.on('request', () => requisicoesDepois++);

// Mede fps por 6 segundos com a cena cheia
const medida = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      let pior = 0;
      let anterior = performance.now();
      const inicio = anterior;
      function loop(now) {
        const dt = now - anterior;
        anterior = now;
        if (frames > 10 && dt > pior) pior = dt;
        frames++;
        if (now - inicio < 6000) requestAnimationFrame(loop);
        else resolve({ fps: (frames * 1000) / (now - inicio), piorFrameMs: pior });
      }
      requestAnimationFrame(loop);
    }),
);

const cena = await page.evaluate(() => {
  const t = document.querySelector('canvas');
  return { w: t.width, h: t.height };
});

await browser.close();
server.close();

const linha = (k, v) => console.log(`${k.padEnd(30)} ${v}`);
console.log('\nRELATORIO OUROBORO\n');
for (const a of arquivos) linha(`  ${a.nome}`, `${(a.raw / 1024).toFixed(1)} KB, gzip ${(a.gz / 1024).toFixed(1)} KB`);
linha('bundle total gzip', `${(totalGz / 1024).toFixed(1)} KB (meta 150 KB)`);
linha('bundle total bruto', `${(totalRaw / 1024).toFixed(1)} KB`);
linha('tempo ate jogavel', `${tempoAteJogavel} ms (meta 1000 ms)`);
linha('fps no estresse', `${medida.fps.toFixed(1)} (meta 60)`);
linha('pior frame', `${medida.piorFrameMs.toFixed(1)} ms (meta 16,6)`);
linha('requisicoes pos carga', String(requisicoesDepois));
linha('canvas', `${cena.w}x${cena.h}`);
linha('erros e avisos no console', erros.length === 0 ? 'nenhum' : erros.join(' | '));

const falhou =
  totalGz > 150 * 1024 || medida.fps < 55 || erros.length > 0 || tempoAteJogavel > 1000 || requisicoesDepois > 0;
console.log(`\n${falhou ? 'FALHOU' : 'PASSOU'}\n`);
process.exit(falhou ? 1 : 0);
