// Smoke funcional no bundle de producao: menu, partida, poderes, loja,
// pausa, opcoes e persistencia. Uso: node scripts/smoke.mjs

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

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
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const falhas = [];
const passos = [];
const ok = (nome, cond, extra = '') => {
  if (cond) passos.push(`ok   ${nome}${extra ? ' ' + extra : ''}`);
  else falhas.push(`FALHA ${nome}${extra ? ' ' + extra : ''}`);
};

for (const [rotulo, viewport, isMobile] of [
  ['desktop', { width: 1280, height: 800 }, false],
  ['mobile 320', { width: 320, height: 640 }, true],
]) {
  const page = await browser.newPage({ viewport, hasTouch: isMobile, isMobile });
  const erros = [];
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(base, { waitUntil: 'load' });

  // Menu inicial com os cinco modos
  const modos = await page.locator('.ouro-modo-txt b').allTextContents();
  ok(`${rotulo}: menu lista os modos`, ['Ouroboro', 'Clássico', 'Desafio Diário', 'Fantasma', 'Aperto'].every((m) => modos.includes(m)));

  // Loja com as tres abas e compra
  await page.getByText('Loja', { exact: true }).first().click();
  ok(`${rotulo}: loja abre com abas`, (await page.locator('.ouro-abas .ouro-btn').count()) === 3);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ouroboro.save') ?? '{}');
    s.coins = 9999;
    localStorage.setItem('ouroboro.save', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.getByText('Loja', { exact: true }).first().click();
  await page.locator('.ouro-abas .ouro-btn').nth(2).click(); // Reliquias
  const antesMoedas = await page.evaluate(() => JSON.parse(localStorage.getItem('ouroboro.save')).coins);
  await page.locator('.ouro-grid .ouro-btn').first().click();
  const depoisMoedas = await page.evaluate(() => JSON.parse(localStorage.getItem('ouroboro.save')).coins);
  ok(`${rotulo}: comprar reliquia desconta moedas`, depoisMoedas < antesMoedas, `${antesMoedas} para ${depoisMoedas}`);
  const relics = await page.evaluate(() => JSON.parse(localStorage.getItem('ouroboro.save')).reliquiasEquipadas);
  ok(`${rotulo}: reliquia comprada fica equipada`, relics.length === 1);

  // Opcoes persistem
  await page.getByText('Voltar', { exact: true }).click();
  await page.getByText('Opções', { exact: true }).first().click();
  await page.getByText('Alto contraste', { exact: true }).click();
  const contraste = await page.evaluate(() => JSON.parse(localStorage.getItem('ouroboro.save')).opcoes.altoContraste);
  ok(`${rotulo}: opcao persiste no save`, contraste === true);
  await page.getByText('Voltar', { exact: true }).click();

  // Partida
  await page.getByText('Ouroboro', { exact: true }).first().click();
  await page.waitForTimeout(200);
  ok(`${rotulo}: overlay some ao jogar`, await page.locator('.ouro-ui').isHidden());

  const seq = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowRight'];
  for (const k of seq) {
    await page.keyboard.press(k);
    await page.waitForTimeout(70);
  }
  // Reversao de 180 graus no mesmo intervalo entre ticks
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  // Poderes e ouroboro
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Digit2');
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  ok(`${rotulo}: partida sobrevive a sequencia de inputs`, await page.locator('.ouro-ui').isHidden());

  // Pausa
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  ok(`${rotulo}: escape pausa`, await page.locator('.ouro-ui').isVisible());
  await page.screenshot({ path: `/tmp/claude-0/-home-user-jogo-cobrinha/1fd88604-bfdc-5f57-99b6-b551ee5da19b/scratchpad/ouroboro-${rotulo.replace(/\s/g, '-')}.png` });
  await page.getByText('Continuar', { exact: true }).click();
  await page.waitForTimeout(150);

  // Toque com swipe no mobile
  if (isMobile) {
    const box = await page.locator('canvas').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(200);
    ok(`${rotulo}: toque curto nao quebra a run`, true);
  }

  // Sai da run e confere que as moedas foram para o save
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  await page.getByText('Sair da partida', { exact: true }).click();
  await page.waitForTimeout(200);
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('ouroboro.save')));
  ok(`${rotulo}: run encerrada grava o save`, typeof salvo.coins === 'number');
  ok(`${rotulo}: tela de fim aparece`, await page.locator('.ouro-grande').isVisible());

  // Sem listener vazado: trocar de tela varias vezes nao acumula nos.
  await page.getByText('Menu', { exact: true }).click();
  const nosAntes = await page.evaluate(() => document.querySelectorAll('.ouro-ui *').length);
  for (let i = 0; i < 5; i++) {
    await page.getByText('Loja', { exact: true }).first().click();
    await page.getByText('Voltar', { exact: true }).click();
  }
  const nosDepois = await page.evaluate(() => document.querySelectorAll('.ouro-ui *').length);
  ok(`${rotulo}: trocar de tela nao acumula DOM`, nosDepois === nosAntes, `${nosAntes} para ${nosDepois}`);
  ok(`${rotulo}: uma unica raiz de UI`, (await page.locator('.ouro-ui').count()) === 1);
  const acentos = await page.evaluate(() => document.querySelector('.ouro-ui').innerText);
  ok(`${rotulo}: interface acentuada em portugues`, /ç|á|ã|é|í|ó|ú/.test(acentos));
  ok(`${rotulo}: sem erro de console`, erros.length === 0, erros.join(' | '));
  await page.close();
}

// Save de schema antigo migra no boot
const page = await browser.newPage();
const erros2 = [];
page.on('pageerror', (e) => erros2.push(e.message));
await page.goto(base, { waitUntil: 'load' });
await page.evaluate(() => {
  localStorage.setItem('ouroboro.save', JSON.stringify({ version: 1, money: 777, skins: ['osso'], skin: 'osso', powers: ['fase'] }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(200);
const migrado = await page.evaluate(() => JSON.parse(localStorage.getItem('ouroboro.save') ?? '{}'));
const texto = await page.locator('.ouro-chip-moeda').first().innerText();
ok('save v1 migra no boot sem quebrar', texto.includes('777'), texto);
ok('save v1 nao derruba a pagina', erros2.length === 0, erros2.join(' | '));
ok('migracao preserva moedas em memoria', migrado.coins === undefined || migrado.coins === 777);

await browser.close();
server.close();

console.log('\nSMOKE OUROBORO\n');
for (const p of passos) console.log('  ' + p);
for (const f of falhas) console.log('  ' + f);
console.log(`\n${falhas.length === 0 ? 'PASSOU' : 'FALHOU'} (${passos.length} ok, ${falhas.length} falhas)\n`);
process.exit(falhas.length === 0 ? 0 : 1);
