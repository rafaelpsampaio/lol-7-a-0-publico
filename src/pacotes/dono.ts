/**
 * src/pacotes/dono.ts
 *
 * O token do dono no navegador (E-11): o ?host= do link que o servidor imprime
 * ao subir fica guardado no localStorage, porque a sala tira ele da barra de
 * enderecos e o editor precisa dele depois de recarregar.
 */

export const CHAVE_DO_DONO = "lolseteazero:dono";

function armazemLocal(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function guardarTokenDoLink(
  busca: string = typeof window === "undefined" ? "" : window.location.search,
  armazem: Storage | null = armazemLocal()
): void {
  const token = new URLSearchParams(busca).get("host");
  if (token === null || token === "") return;
  try {
    armazem?.setItem(CHAVE_DO_DONO, token);
  } catch {
    // sem localStorage: o editor so salva enquanto a aba tiver o token
  }
}

export function tokenDoDono(armazem: Storage | null = armazemLocal()): string | null {
  try {
    return armazem?.getItem(CHAVE_DO_DONO) ?? null;
  } catch {
    return null;
  }
}
