/**
 * src/pacotes/foto.ts
 *
 * Recorte da foto no navegador (E-08): quadrado central, 512x512, JPEG 0,85.
 * O canvas so existe no navegador; recorteCentral e a parte testavel.
 */

import { TAMANHO_MAXIMO_DA_FOTO } from "./regrasDaCarta";

export const LADO_DA_FOTO = 512;

export function recorteCentral(largura: number, altura: number): { x: number; y: number; lado: number } {
  const lado = Math.min(largura, altura);
  return { x: Math.round((largura - lado) / 2), y: Math.round((altura - lado) / 2), lado };
}

export async function recortarFoto(arquivo: File): Promise<{ dados: Blob; previa: string }> {
  if (!arquivo.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new Error("Não consegui abrir essa imagem.");
  }
  const { x, y, lado } = recorteCentral(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = LADO_DA_FOTO;
  canvas.height = LADO_DA_FOTO;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("Seu navegador não deixou recortar a imagem.");
  ctx.drawImage(bitmap, x, y, lado, lado, 0, 0, LADO_DA_FOTO, LADO_DA_FOTO);
  bitmap.close();
  const dados = await new Promise<Blob>((ok, falha) =>
    canvas.toBlob((b) => (b === null ? falha(new Error("Não consegui gerar o JPEG.")) : ok(b)), "image/jpeg", 0.85)
  );
  if (dados.size > TAMANHO_MAXIMO_DA_FOTO) throw new Error("A foto ficou grande demais (mais de 1 MB).");
  return { dados, previa: URL.createObjectURL(dados) };
}
