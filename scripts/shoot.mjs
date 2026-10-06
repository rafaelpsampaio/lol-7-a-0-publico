import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('tmp/shots', { recursive: true });
const browser = await chromium.launch({ channel:'msedge', headless:true });
const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
async function ct(t){ const b=page.locator(`button:has-text("${t}")`).first(); if(await b.count()){await b.click().catch(()=>{});return true;} return false; }
async function vis(t){ return (await page.locator(`text=${t}`).first().count())>0; }
async function shot(name){ await page.screenshot({ path:`tmp/shots/${name}.png`, fullPage:true }); console.log('shot', name); }
async function shotFold(name){ await page.screenshot({ path:`tmp/shots/${name}.png`, fullPage:false }); console.log('shot(fold)', name); }

await page.goto('http://localhost:5174',{waitUntil:'networkidle'});
await page.waitForTimeout(300);
await shot('launch');
// Player editor (Feature 3a) reachable from the launch menu.
if(await ct('Editar jogadores')){ await page.waitForTimeout(500); await shot('player-editor'); await ct('Voltar'); await page.waitForTimeout(300); }
// Fresh context has no save → single "Iniciar torneio" goes straight to team-edit.
await ct('Iniciar torneio'); await page.waitForTimeout(400);

// Team-edit screen (new)
await page.waitForTimeout(300);
await shot('team-edit');
await ct('Ir para o draft'); await page.waitForTimeout(300);

await ct('Iniciar draft'); await page.waitForTimeout(250);
await shot('draft');
for(let i=0;i<5;i++){ await ct('Escolher'); await page.waitForTimeout(200); }
await page.waitForTimeout(300);

// New captain-select step sits after the 5 draft picks.
await shot('captain');
await ct('Confirmar time'); await page.waitForTimeout(400);
await shot('bracket');

await ct('Iniciar série');
// champ-select (~5s) then playback — capture mid-playback to see the HUD + event feed
await page.waitForTimeout(9000);
await shot('playback');
await shotFold('playback-fold');
await ct('Pular para o fim');
await page.waitForTimeout(1500);
await shot('game-result');

for(let g=0; g<6; g++){
  if(await vis('Destaques da série')){ break; }
  await ct('Continuar'); await page.waitForTimeout(600);
  if(await vis('Destaques da série')){ break; }
  await ct('Jogar de novo'); await page.waitForTimeout(7000);
  await ct('Pular para o fim'); await page.waitForTimeout(1200);
}
await page.waitForTimeout(500);
await shot('series-result');
console.log('series visible:', await vis('Destaques da série'));
await browser.close();
