import { For, Show, createSignal } from "solid-js";
import type { PlayerVersion } from "../data/schema";
import { playerName, playerOverall, playerTags } from "../data/playerPresentation";
import { visibleStats, type StatsMode } from "../data/statsPolicy";
import { ROLE_LONG_LABELS } from "../draft/hints";
import { IconeDeRota } from "../pacotes/Icones";
import "./PlayerCard.css";
export function PlayerStats(props: { player: PlayerVersion; mode?: StatsMode; picked?: boolean; semOvr?: boolean }) {
  const visibility = () => visibleStats(props.mode, props.picked);
  // O PlayerCard ja mostra o OVR no selo do retrato (E-13); ai o bloco nao repete.
  const mostraOvr = () => props.semOvr !== true;
  return <Show when={visibility() === "full" || (visibility() === "overall" && mostraOvr())}>
    <div class="player-card__stats" aria-label="Atributos do jogador">
      <Show when={mostraOvr()}><strong title="Média dos atributos de início, meio e fim de jogo">OVR {playerOverall(props.player)}</strong></Show>
      <Show when={visibility() === "full"}>
        <span>Início {props.player.lanePhase}</span><span>Meio {props.player.midGame}</span><span>Fim {props.player.lateGame}</span>
        <For each={props.player.roles}>{role => <span>{ROLE_LONG_LABELS[role]} {props.player.roleStrength[role]}</span>}</For>
      </Show>
    </div>
  </Show>;
}
export function PlayerCard(props: { player: PlayerVersion; mode?: StatsMode; picked?: boolean }) {
  const [failedPhoto, setFailedPhoto] = createSignal<string>();
  return <article class="draft-player-card">
    <div class="player-card__portrait">
      <Show when={props.player.photo && failedPhoto() !== props.player.photo} fallback={<span class="player-card__initials">{playerName(props.player).slice(0, 2).toUpperCase()}</span>}>
        <img src={props.player.photo} alt={playerName(props.player)} onError={() => setFailedPhoto(props.player.photo)} />
      </Show>
      <Show when={visibleStats(props.mode, props.picked) !== "none"}>
        <span class="player-card__ovr" aria-label={`OVR ${playerOverall(props.player)}`}>
          <b>{playerOverall(props.player)}</b>
          <IconeDeRota rota={props.player.primaryRole} tamanho={16} />
        </span>
      </Show>
      <span class="player-card__role">{ROLE_LONG_LABELS[props.player.primaryRole]}</span>
    </div>
    <div class="player-card__body">
      <h3>{playerName(props.player)}</h3>
      <Show when={props.player.year !== undefined}><p class="player-card__year">{props.player.year}</p></Show>
      <div class="player-card__tags"><For each={playerTags(props.player)}>{tag => <span class="player-card__tag" tabindex="0">{tag.label}<Show when={tag.description}><span role="tooltip">{tag.description}</span></Show></span>}</For></div>
      <PlayerStats player={props.player} mode={props.mode} picked={props.picked} semOvr />
    </div>
  </article>;
}
