// 動作確認用のスモークテスト: npm install → npm test
// ゲームを開き、掘削・離陸・マップ表示を自動で動かして、JSエラーがないか確認する。
// スクリーンショットは tools/shots/ に保存される。
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'tools', 'shots');
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.click('#startB');

// 一番浅い鉄鉱脈の真上に移動して掘る
await page.evaluate(() => {
  const g = window.__game, p = g.planets[0];
  let best = null;
  for (const d of p.deps) if (d.t === 'iron') { const r = Math.hypot(d.x, d.y); if (!best || r > best.r) best = { r, a: Math.atan2(d.y, d.x) }; }
  g.ship.phi = best.a;
});
await page.evaluate(() => { window.__game.inp.d = true; });
await page.waitForTimeout(5000);
await page.evaluate(() => { window.__game.inp.d = false; });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(shots, '1-drill.png') });
const cargo = await page.evaluate(() => window.__game.ship.cargoN);

await page.evaluate(() => { window.__game.inp.t = true; });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__game.inp.t = false; });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(shots, '2-fly.png') });
const state = await page.evaluate(() => window.__game.ship.state);

await page.click('#bMap');
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(shots, '3-map.png') });
await browser.close();

console.log({ cargoCollected: cargo, stateAfterThrust: state, errors });
const ok = errors.length === 0 && cargo > 0 && state === 'flying';
console.log(ok ? 'OK' : 'NG');
process.exit(ok ? 0 : 1);
