import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

if (process.platform !== 'win32') throw new Error('Empacote no Windows ou use o workflow de release.');
const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Use uma versao semver estavel.');
const out = resolve(root, 'release', `package-${version}-${Date.now()}`);
const app = resolve(out, 'app');
await mkdir(resolve(app, 'runtime'), { recursive: true });
await build({
  entryPoints: [resolve(root, 'server/main.ts')], outfile: resolve(app, 'server/main.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node24',
  // Dependencias CommonJS (ws/sirv) precisam de require em um bundle ESM.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  external: ['bufferutil', 'utf-8-validate'],
});
await cp(resolve(root, 'dist'), resolve(app, 'dist'), { recursive: true });
await cp(resolve(root, 'public'), resolve(app, 'public'), { recursive: true });
for (const file of ['common.ps1', 'launcher.ps1']) {
  await cp(resolve(root, 'distribution', file), resolve(app, file));
}
for (const file of ['Instalar.bat', 'install.ps1', 'iniciar.ps1', 'Jogar.bat', 'Jogar-na-rede-local.bat']) {
  await cp(resolve(root, 'distribution', file), resolve(out, file));
}
await cp(resolve(root, 'docs/INSTALACAO.md'), resolve(out, 'LEIA-ME.md'));
await writeFile(resolve(app, 'app.json'), JSON.stringify({ version }, null, 2));

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000), headers: { 'User-Agent': 'LoL-7-a-0-packager' } });
  if (!response.ok) throw new Error(`Download falhou: ${url} (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}
// Uma versao Node fixa para builds reproduziveis; checksum oficial obrigatorio.
const nodeVersion = '24.19.0';
const nodeFile = `node-v${nodeVersion}-win-x64.zip`;
const nodeUrl = `https://nodejs.org/dist/v${nodeVersion}/`;
const sums = (await download(`${nodeUrl}SHASUMS256.txt`)).toString('utf8');
const sum = sums.split('\n').find(line => line.trim().endsWith(` ${nodeFile}`))?.split(/\s+/)[0];
const nodeZip = await download(`${nodeUrl}${nodeFile}`);
if (!sum || createHash('sha256').update(nodeZip).digest('hex') !== sum) throw new Error('Checksum do Node invalido.');
const nodeArchive = resolve(out, 'node.zip');
await writeFile(nodeArchive, nodeZip);
// Caminhos chegam ao PowerShell como argumentos, nunca como codigo interpolado.
const expand = resolve(root, 'scripts/expand-runtime.ps1');
execFileSync('powershell.exe', ['-NoProfile', '-File', expand, '-Archive', nodeArchive, '-Destination', resolve(out, 'node-runtime'), '-App', app], { stdio: 'inherit' });

const cloudRelease = JSON.parse((await download('https://api.github.com/repos/cloudflare/cloudflared/releases/latest')).toString('utf8'));
const cloudAsset = cloudRelease.assets.find(asset => asset.name === 'cloudflared-windows-amd64.exe');
if (!cloudAsset?.digest?.match(/^sha256:[a-f0-9]{64}$/)) throw new Error('cloudflared sem checksum oficial.');
const cloudBinary = await download(cloudAsset.browser_download_url);
if (`sha256:${createHash('sha256').update(cloudBinary).digest('hex')}` !== cloudAsset.digest) throw new Error('Checksum do cloudflared invalido.');
await writeFile(resolve(app, 'runtime/cloudflared.exe'), cloudBinary);
await writeFile(resolve(app, 'runtime/versions.json'), JSON.stringify({ node: nodeVersion, cloudflared: cloudRelease.tag_name }, null, 2));
// A licenca do Node e copiada pelo expand-runtime; a do cloudflared acompanha o binario.
await writeFile(resolve(app, 'runtime/cloudflared-LICENSE'), await download(`https://raw.githubusercontent.com/cloudflare/cloudflared/${cloudRelease.tag_name}/LICENSE`));
const zip = resolve(root, 'release/LoL-7-a-0-windows-x64.zip');
execFileSync('powershell.exe', ['-NoProfile', '-File', resolve(root, 'scripts/archive-release.ps1'), '-Package', out, '-Archive', zip], { stdio: 'inherit' });
const hash = createHash('sha256').update(await readFile(zip)).digest('hex');
await writeFile(`${zip}.sha256`, `${hash}  LoL-7-a-0-windows-x64.zip\n`);
console.log(`Pacote pronto: ${zip}`);
