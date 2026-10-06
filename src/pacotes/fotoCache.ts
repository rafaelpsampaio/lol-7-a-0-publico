/**
 * src/pacotes/fotoCache.ts
 *
 * O caminho da foto (/players/<id>.jpg) nunca muda, entao o navegador pode
 * reaproveitar a imagem antiga depois de uma troca. Aqui a sessao lembra quais
 * pessoas tiveram a foto trocada e a tela acrescenta ?v=<n> so na exibicao.
 * O JSON do pacote continua com o caminho canonico (secao 3.5).
 */

const trocadas = new Map<string, number>();
let ultimo = 0;

export function marcarFotoTrocada(personId: string): void {
  ultimo = Math.max(Date.now(), ultimo + 1);
  trocadas.set(personId, ultimo);
}

export function zerarFotosTrocadas(): void {
  trocadas.clear();
}

export function urlDaFoto(src: string | undefined): string | undefined {
  if (src === undefined) return undefined;
  const m = /^\/players\/([a-z0-9-]+)\.jpg$/.exec(src);
  if (m === null) return src;
  const v = trocadas.get(m[1]!);
  return v === undefined ? src : `${src}?v=${v}`;
}
