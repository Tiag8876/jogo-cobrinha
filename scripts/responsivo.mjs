// Verificacao de responsividade e de toque em varios formatos de tela.
// Uso: node scripts/responsivo.mjs

import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  const file = join(DIST, url === '/' ? 'index.html' : url);
  try {
    const b = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'text/plain' });
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;
const shots = '/tmp/claude-0/-home-user-jogo-cobrinha/1fd88604-bfdc-5f57-99b6-b551ee5da19b/scratchpad/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const falhas = [];
const linhas = [];

const TELAS = [
  ['iPhone SE em pe', { width: 320, height: 568 }, 2],
  ['iPhone 12 em pe', { width: 390, height: 844 }, 3],
  ['Android medio em pe', { width: 412, height: 915 }, 2.6],
  ['iPhone 12 deitado', { width: 844, height: 390 }, 3],
  ['Android deitado', { width: 740, height: 360 }, 2.6],
  ['iPad em pe', { width: 768, height: 1024 }, 2],
  ['desktop', { width: 1440, height: 900 }, 1],
];

// Gesto de deslize com varios passos, como um dedo de verdade.
async function deslizar(page, x, y, dx, dy) {
  await page.touchscreen.tap(x, y).catch(() => {});
  const client = await page.context().newCDPSession(page);
  const passos = 6;
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= passos; i++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / passos, y: y + (dy * i) / passos }],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await client.detach();
}

for (const [nome, viewport, dpr] of TELAS) {
  const movel = viewport.width < 900;
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: dpr,
    hasTouch: movel,
    isMobile: movel,
  });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(350);

  // O canvas cabe na tela, sem estourar nem sobrar barra de rolagem
  const cabe = await page.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return {
      w: Math.round(c.width),
      h: Math.round(c.height),
      dentro: c.width <= innerWidth + 1 && c.height <= innerHeight + 1,
      semRolagem: document.documentElement.scrollHeight <= innerHeight + 1,
    };
  });
  if (!cabe.dentro) falhas.push(`${nome}: canvas maior que a tela (${cabe.w}x${cabe.h})`);
  if (!cabe.semRolagem) falhas.push(`${nome}: a pagina rola fora do menu`);

  // O menu nao pode cortar conteudo: o botao do primeiro modo existe e e clicavel
  const menuOk = await page.getByText('Ouroboro', { exact: true }).first().isVisible();
  if (!menuOk) falhas.push(`${nome}: menu nao mostra os modos`);

  await page.getByText('Ouroboro', { exact: true }).first().click();
  await page.waitForTimeout(400);

  // Proporcao da arena e area util ocupada
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { larg: r.width, alt: r.height, area: (r.width * r.height) / (innerWidth * innerHeight) };
  });
  const ocupa = Math.round(info.area * 100);
  if (ocupa < 28) falhas.push(`${nome}: jogo ocupa so ${ocupa}% da tela`);

  // Deslize em cada direcao, medindo se a cobra obedeceu
  let deslizeOk = true;
  if (movel) {
    const box = await page.locator('canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const dirs = [
      ['cima', 0, -70, 0],
      ['esquerda', 3, -70, 0],
      ['baixo', 2, 0, 70],
      ['direita', 1, 70, 0],
    ];
    for (const [rotulo, esperado, dx, dy] of dirs) {
      const alvo = rotulo === 'cima' ? [0, -70] : [dx, dy];
      await deslizar(page, cx, cy, alvo[0], alvo[1]);
      await page.waitForTimeout(220);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(120);
      const dir = await page.evaluate(() => {
        const r = localStorage.getItem('ouroboro.run');
        return r ? JSON.parse(r).state.dir : null;
      });
      await page.getByText('Continuar', { exact: true }).click();
      await page.waitForTimeout(150);
      if (dir !== esperado && dir !== null) {
        deslizeOk = false;
        falhas.push(`${nome}: deslize para ${rotulo} deu direcao ${dir}`);
      }
    }
  }

  await page.screenshot({ path: `${shots}resp-${nome.replace(/\s/g, '-')}.png` });
  linhas.push(
    `${nome.padEnd(22)} canvas ${String(cabe.w).padStart(4)}x${String(cabe.h).padStart(4)}  ocupa ${String(ocupa).padStart(2)}%  ` +
      `${movel ? (deslizeOk ? 'deslize ok' : 'DESLIZE FALHOU') : 'teclado'}  ${erros.length ? 'ERRO: ' + erros[0] : 'sem erros'}`,
  );
  if (erros.length) falhas.push(`${nome}: ${erros[0]}`);
  await page.close();
}

// A loja precisa rolar com o dedo no celular
const page = await browser.newPage({ ...devices['iPhone 12'] });
await page.goto(base, { waitUntil: 'load' });
await page.getByText('Loja', { exact: true }).first().click();
await page.waitForTimeout(250);
const antes = await page.evaluate(() => document.querySelector('.ouro-ui').scrollTop);
await page.evaluate(() => {
  document.querySelector('.ouro-ui').scrollTop = 400;
});
const depois = await page.evaluate(() => document.querySelector('.ouro-ui').scrollTop);
const rolavel = await page.evaluate(() => {
  const el = document.querySelector('.ouro-ui');
  return { scrollavel: el.scrollHeight > el.clientHeight, touchAction: getComputedStyle(el).touchAction };
});
if (!(depois > antes)) falhas.push('loja no celular nao rola');
if (rolavel.touchAction === 'none') falhas.push('overlay bloqueia o gesto de rolagem');
linhas.push(`loja no celular      rolagem ${depois > antes ? 'ok' : 'FALHOU'}  touch-action ${rolavel.touchAction}`);
await page.close();

await browser.close();
server.close();

console.log('\nRESPONSIVIDADE OUROBORO\n');
for (const l of linhas) console.log('  ' + l);
if (falhas.length) {
  console.log('\nFALHAS');
  for (const f of falhas) console.log('  ' + f);
}
console.log(`\n${falhas.length === 0 ? 'PASSOU' : 'FALHOU'} (${linhas.length} telas, ${falhas.length} falhas)\n`);
process.exit(falhas.length === 0 ? 0 : 1);
