/**
 * src/pacotes/Icones.tsx
 *
 * Icones de linha das telas novas (E-12): rotas no espirito dos icones de
 * posicao do LoL, e os de interface. Nada de emoji.
 */

import type { JSX } from "solid-js";
import type { Role } from "../data/schema";

interface PropsDoSvg {
  tamanho?: number;
  class?: string;
  viewBox?: string;
  children: JSX.Element;
}

function Svg(props: PropsDoSvg) {
  return (
    <svg
      class={`pk-icone ${props.class ?? ""}`}
      width={props.tamanho ?? 20}
      height={props.tamanho ?? 20}
      viewBox={props.viewBox ?? "0 0 24 24"}
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

const LAMINA = "M12 1.8c1.9 4.6 2.1 11.2 0 20.4-2.1-9.2-1.9-15.8 0-20.4z";

const ROTA: Record<Role, () => JSX.Element> = {
  top: () => (
    <>
      <path fill="currentColor" d="M2.5 2.5h16l-4 4h-8v8l-4 4z" />
      <rect fill="currentColor" opacity=".5" x="10" y="10" width="4" height="4" rx=".5" />
      <path fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.4" d="M21.2 6.5v14.7H6.5" />
    </>
  ),
  adc: () => (
    <>
      <path fill="currentColor" d="M21.5 21.5h-16l4-4h8v-8l4-4z" />
      <rect fill="currentColor" opacity=".5" x="10" y="10" width="4" height="4" rx=".5" />
      <path fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.4" d="M2.8 17.5V2.8h14.7" />
    </>
  ),
  mid: () => (
    <>
      <path fill="currentColor" d="M16.5 2.5h5v5l-14 14h-5v-5z" />
      <path fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="1.4" d="M2.8 13V2.8H13M21.2 11v10.2H11" />
    </>
  ),
  jungle: () => (
    <g fill="currentColor">
      <path d={LAMINA} />
      <path d={LAMINA} transform="rotate(-32 12 22)" opacity=".7" />
      <path d={LAMINA} transform="rotate(32 12 22)" opacity=".7" />
    </g>
  ),
  support: () => (
    <g fill="currentColor">
      <path d="M12 2.5l3.6 4.4L12 10.6 8.4 6.9z" />
      <path d="M1 7h7.4l2.4 3.8-2.1 4.4z" opacity=".75" />
      <path d="M23 7h-7.4l-2.4 3.8 2.1 4.4z" opacity=".75" />
      <path d="M10.2 12h3.6l-.7 9.5h-2.2z" />
    </g>
  ),
};

export function IconeDeRota(props: { rota: Role; tamanho?: number; class?: string }) {
  return (
    <Svg tamanho={props.tamanho} class={props.class}>
      {ROTA[props.rota]()}
    </Svg>
  );
}

export type NomeDoIcone =
  | "espada"
  | "espadas"
  | "cartas"
  | "camera"
  | "mais"
  | "ok"
  | "alerta"
  | "voltar"
  | "seguir"
  | "busca"
  | "lapis"
  | "mais-opcoes"
  | "lixeira"
  | "planilha";

const LINHA = { fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" } as const;

const ICONES: Record<NomeDoIcone, () => JSX.Element> = {
  espada: () => (
    <g {...LINHA}>
      <path d="M20.5 3.5h-4L8 12l4 4 8.5-8.5z" />
      <path d="M5.5 13.5l5 5M8 16l-4.5 4.5" />
    </g>
  ),
  espadas: () => (
    <g {...LINHA}>
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" />
      <path d="M9.5 6.5L13 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" />
    </g>
  ),
  cartas: () => (
    <g {...LINHA}>
      <rect x="7.5" y="3.5" width="12" height="16" rx="2.5" />
      <path d="M4.5 7.5v11a2.5 2.5 0 0 0 2.5 2.5h9" />
    </g>
  ),
  camera: () => (
    <g {...LINHA}>
      <path d="M3.5 8.5a2 2 0 0 1 2-2h2.2l1.5-2h5.6l1.5 2h2.2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.8" r="3.6" />
    </g>
  ),
  mais: () => <path {...LINHA} stroke-width="2" d="M12 5v14M5 12h14" />,
  ok: () => (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M7.5 12.3l3 3 6-6.2" />
    </>
  ),
  alerta: () => (
    <>
      <path fill="currentColor" d="M10.3 3.6a2 2 0 0 1 3.4 0l8 13.8A2 2 0 0 1 20 20.4H4a2 2 0 0 1-1.7-3z" />
      <path stroke="#000" stroke-width="2.2" stroke-linecap="round" d="M12 9v4.5M12 17h.01" />
    </>
  ),
  voltar: () => <path {...LINHA} stroke-width="2" d="M15 5l-7 7 7 7" />,
  seguir: () => <path {...LINHA} stroke-width="2" d="M9 5l7 7-7 7" />,
  busca: () => (
    <g {...LINHA} stroke-width="2">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </g>
  ),
  lapis: () => <path {...LINHA} d="M4 20h4L19 9l-4-4L4 16z" />,
  "mais-opcoes": () => (
    <g fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </g>
  ),
  lixeira: () => <path {...LINHA} d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />,
  planilha: () => (
    <g {...LINHA}>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M4 9h16M4 14.5h16M10 9v11.5" />
    </g>
  ),
};

export function Icone(props: { nome: NomeDoIcone; tamanho?: number; class?: string }) {
  return (
    <Svg tamanho={props.tamanho} class={props.class}>
      {ICONES[props.nome]()}
    </Svg>
  );
}

/** Moldura hexagonal hextech dos icones grandes do menu. */
export function MolduraHex(props: { children: JSX.Element }) {
  return (
    <span class="pk-hex">
      <svg class="pk-hex__moldura" viewBox="0 0 58 64" aria-hidden="true">
        <path d="M29 2l25 14.5v31L29 62 4 47.5v-31z" fill="rgba(200,170,110,.08)" stroke="rgba(200,170,110,.55)" stroke-width="1.2" />
        <path d="M29 8l20 11.6v24.8L29 56 9 44.4V19.6z" fill="none" stroke="rgba(200,170,110,.2)" stroke-width="1" />
      </svg>
      {props.children}
    </span>
  );
}
