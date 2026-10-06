/**
 * src/pacotes/FormularioDaCarta.tsx
 *
 * Formulario de uma carta (secao 3.4): ano, rota, fases com a nota geral,
 * traits e campeoes. Persona avancada, estilo e frase ficam fora (E-10).
 * Toda mudanca passa por `aplicar`, com uma operacao de rascunho.ts.
 */

import { createMemo, createSignal, For, Show, type JSX } from "solid-js";
import {
  MAX_PLAYER_TRAITS,
  PlayerTraitSchema,
  type ChampionEntry,
  type Mastery,
  type PlayerTrait,
  type PlayerVersion,
} from "../data/schema";
import { TRAIT_INFO } from "../data/traitInfo";
import { ChampionPortrait } from "../playback/ChampionPortrait";
import { POOL_MINIMO, ROTAS, notaGeral } from "./regrasDaCarta";
import {
  adicionarCampeao,
  alternarTrait,
  mudarAno,
  mudarConforto,
  mudarFase,
  mudarRota,
  removerCampeao,
  type FaseDaCarta,
  type Rascunho,
} from "./rascunho";
import { NOME_DA_ROTA } from "./resumo";
import { Icone, IconeDeRota } from "./Icones";

const TRAITS: PlayerTrait[] = PlayerTraitSchema.options;
const FASES: [FaseDaCarta, string][] = [
  ["lanePhase", "Rotas"],
  ["midGame", "Meio de jogo"],
  ["lateGame", "Fim de jogo"],
];
const CONFORTOS: Mastery[] = [1, 2, 3, 4, 5];

function Grupo(props: { titulo: string; children: JSX.Element }) {
  return (
    <section class="pk-grupo">
      <h4 class="pk-grupo__titulo">{props.titulo}</h4>
      <div class="pk-cartao">{props.children}</div>
    </section>
  );
}

function Linha(props: { rotulo: string; children: JSX.Element }) {
  return (
    <div class="pk-linha">
      <span class="pk-linha__rotulo">{props.rotulo}</span>
      {props.children}
    </div>
  );
}

export function FormularioDaCarta(props: {
  carta: PlayerVersion;
  erros: string[];
  campeoes: ChampionEntry[];
  aplicar: (f: (r: Rascunho) => Rascunho) => void;
  onRemover: () => void;
}) {
  const id = () => props.carta.id;
  const [dica, setDica] = createSignal<PlayerTrait | null>(null);
  const [adicionando, setAdicionando] = createSignal(false);
  const [busca, setBusca] = createSignal("");
  const porId = createMemo(() => new Map(props.campeoes.map((c) => [c.id, c])));
  const traitDaDica = () => dica() ?? props.carta.traits[props.carta.traits.length - 1] ?? null;
  const opcoes = createMemo(() => {
    const tem = new Set(props.carta.championPool.map((c) => c.championId));
    const q = busca().trim().toLowerCase();
    return props.campeoes
      .filter((c) => !tem.has(c.id) && (q === "" || c.name.toLowerCase().includes(q) || c.id.includes(q)))
      .slice(0, 60);
  });

  return (
    <div class="pk-formulario">
      <Show when={props.erros.length > 0}>
        <ul class="pk-erros" role="alert">
          <For each={props.erros}>{(e) => <li>{e}</li>}</For>
        </ul>
      </Show>

      <Grupo titulo="Carta">
        <Linha rotulo="Ano">
          <input
            type="number"
            min="2011"
            max="2035"
            placeholder="opcional"
            value={props.carta.year ?? ""}
            onChange={(e) => {
              const v = e.currentTarget.value.trim();
              props.aplicar((r) => mudarAno(r, id(), v === "" ? undefined : Number(v)));
            }}
          />
        </Linha>
        <Linha rotulo="Rota">
          <div class="pk-rotas" role="radiogroup" aria-label="Rota da carta">
            <For each={ROTAS}>
              {(rota) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={props.carta.primaryRole === rota}
                  class="pk-rota"
                  classList={{ "pk-rota--on": props.carta.primaryRole === rota }}
                  onClick={() => props.aplicar((r) => mudarRota(r, id(), rota))}
                >
                  <IconeDeRota rota={rota} tamanho={22} />
                  {NOME_DA_ROTA[rota]}
                </button>
              )}
            </For>
          </div>
        </Linha>
      </Grupo>

      <Grupo titulo="Fases do jogo">
        <For each={FASES}>
          {([campo, rotulo]) => (
            <Linha rotulo={rotulo}>
              <div class="pk-slider">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={props.carta[campo]}
                  aria-label={rotulo}
                  onInput={(e) => props.aplicar((r) => mudarFase(r, id(), campo, Number(e.currentTarget.value)))}
                />
                <span class="pk-slider__valor">{props.carta[campo]}</span>
              </div>
            </Linha>
          )}
        </For>
        <Linha rotulo="Nota geral">
          <div class="pk-nota">
            <span class="pk-nota__numero">{notaGeral(props.carta)}</span>
            <span class="pk-nota__texto">Média das três fases. É a força da carta na rota, calculada sozinha.</span>
          </div>
        </Linha>
      </Grupo>

      <Grupo titulo={`Traits · ${props.carta.traits.length} de ${MAX_PLAYER_TRAITS}`}>
        <div class="pk-chips">
          <For each={TRAITS}>
            {(t) => {
              const ligada = () => props.carta.traits.includes(t);
              const apagada = () => !ligada() && props.carta.traits.length >= MAX_PLAYER_TRAITS;
              return (
                <button
                  type="button"
                  class="pk-chip"
                  classList={{ "pk-chip--on": ligada(), "pk-chip--apagada": apagada() }}
                  aria-pressed={ligada()}
                  disabled={apagada()}
                  title={TRAIT_INFO[t].description}
                  onMouseEnter={() => setDica(t)}
                  onFocus={() => setDica(t)}
                  onClick={() => props.aplicar((r) => alternarTrait(r, id(), t))}
                >
                  {TRAIT_INFO[t].label}
                </button>
              );
            }}
          </For>
        </div>
        <Show when={traitDaDica()}>
          {(t) => <p class="pk-dica">{`${TRAIT_INFO[t()].label}: ${TRAIT_INFO[t()].description}.`}</p>}
        </Show>
      </Grupo>

      <Grupo titulo={`Campeões · ${props.carta.championPool.length} no pool, mínimo ${POOL_MINIMO}`}>
        <div class="pk-campeoes">
          <For each={props.carta.championPool}>
            {(cm) => {
              const c = () => porId().get(cm.championId);
              return (
                <div class="pk-campeao">
                  <ChampionPortrait championId={cm.championId} name={c()?.name ?? cm.championId} image={c()?.image} size={36} />
                  <div>
                    <div class="pk-campeao__nome">{c()?.name ?? cm.championId}</div>
                    <div class="pk-conforto" role="radiogroup" aria-label={`Conforto com ${c()?.name ?? cm.championId}`}>
                      <For each={CONFORTOS}>
                        {(n) => (
                          <button
                            type="button"
                            role="radio"
                            aria-checked={cm.mastery === n}
                            aria-label={`Conforto ${n}`}
                            classList={{ "pk-conforto--on": n <= cm.mastery }}
                            onClick={() => props.aplicar((r) => mudarConforto(r, id(), cm.championId, n))}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="pk-campeao__tirar"
                    aria-label={`Tirar ${c()?.name ?? cm.championId}`}
                    onClick={() => props.aplicar((r) => removerCampeao(r, id(), cm.championId))}
                  >
                    <Icone nome="lixeira" tamanho={14} />
                  </button>
                </div>
              );
            }}
          </For>
          <button type="button" class="pk-campeao pk-campeao--novo" onClick={() => setAdicionando((v) => !v)}>
            <Icone nome="mais" tamanho={16} />
            Adicionar
          </button>
        </div>
        <Show when={adicionando()}>
          <div class="pk-busca-campeao">
            <input type="search" placeholder="Buscar campeão" value={busca()} onInput={(e) => setBusca(e.currentTarget.value)} />
            <div class="pk-opcoes">
              <For each={opcoes()}>
                {(c) => (
                  <button type="button" onClick={() => props.aplicar((r) => adicionarCampeao(r, id(), c.id))}>
                    <ChampionPortrait championId={c.id} name={c.name} image={c.image} size={28} />
                    {c.name}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Grupo>

      <button type="button" class="pk-perigo" onClick={() => props.onRemover()}>
        <Icone nome="lixeira" tamanho={16} />
        Remover esta carta
      </button>
    </div>
  );
}
