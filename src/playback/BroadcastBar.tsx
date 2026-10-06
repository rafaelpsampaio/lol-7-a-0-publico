/**
 * src/playback/BroadcastBar.tsx
 *
 * LoL broadcast-style top HUD: team tags, kill score, tower counts, team gold,
 * a dragon-stack row (real elemental icons) per team and the central Baron timer.
 * Driven by the score + map snapshots on the latest event (DEFAULT_* before the
 * first event so it shows from 00:00). No emojis — real objective art only.
 */

import { For, Show } from "solid-js";
import type { GameEvent } from "../sim/types";
import {
  DEFAULT_SCORE, DEFAULT_MAP, dragonIcon, BARON_ICON, HERALD_ICON, GRUB_ICON,
  fmtGold, fmtClock,
} from "./playbackDefaults";

interface Props {
  event: GameEvent | null;
  userTeamName: string;
  rivalTeamName: string;
  userTeamTag: string;
  rivalTeamTag: string;
  /**
   * Lado de quem assiste, para o selo VOCÊ (rotulosDosLados, PlaybackScreen).
   * `null`: espectador sem time na partida, sem selo. Omitido: sem selo.
   */
  ladoVoce?: "user" | "rival" | null;
}

export function BroadcastBar(props: Props) {
  const score = () => props.event?.score ?? DEFAULT_SCORE;
  const map = () => props.event?.map ?? DEFAULT_MAP;

  const TeamSide = (p: { side: "user" | "rival" }) => {
    const s = () => score();
    const tag = p.side === "user" ? props.userTeamTag : props.rivalTeamTag;
    const name = p.side === "user" ? props.userTeamName : props.rivalTeamName;
    const towers = () => (p.side === "user" ? s().userTowers : s().rivalTowers);
    const gold = () => (p.side === "user" ? s().userGold : s().rivalGold);
    const dragons = () => (p.side === "user" ? s().userDragonEls : s().rivalDragonEls);
    const baron = () => (p.side === "user" ? s().userBaron : s().rivalBaron);
    const elder = () => (p.side === "user" ? s().userElder : s().rivalElder);
    // D-06: rotulo pt-BR de comp por time — leitura opcional encadeada (tolera eventos legados sem o campo).
    // Comp neutra (label vazio) ou campo ausente => sem badge (Show when=comp()).
    const comp = () => map()?.compProfile?.[p.side]?.label ?? "";
    return (
      <div class={`bcast-team bcast-team--${p.side}`}>
        <div class="bcast-team-top">
          <span class="bcast-tag">{tag}</span>
          <span class="bcast-name">{name}</span>
          <Show when={props.ladoVoce === p.side}><span class="bcast-voce">VOCÊ</span></Show>
          <Show when={comp()}><span class="bcast-comp">{comp()}</span></Show>
          <span class="bcast-stat" title="Torres">⌂ {towers()}</span>
          <span class="bcast-stat bcast-gold">{fmtGold(gold())}</span>
          <Show when={baron()}><span class="bcast-buff bcast-buff--baron">BARÃO</span></Show>
          <Show when={elder()}><span class="bcast-buff bcast-buff--elder">ANCIÃO</span></Show>
        </div>
        <div class="bcast-drakes">
          <For each={dragons()}>
            {(el) => <img class="bcast-drake" src={dragonIcon(el)} alt={el} />}
          </For>
        </div>
      </div>
    );
  };

  return (
    <div class="bcast" aria-label="Placar da partida">
      <TeamSide side="user" />

      <div class="bcast-center">
        <div class="bcast-score">
          <span class="bcast-k bcast-k--user">{score().userKills}</span>
          <span class="bcast-vs">–</span>
          <span class="bcast-k bcast-k--rival">{score().rivalKills}</span>
        </div>
        <div class="bcast-objective">
          <img
            class="bcast-obj-img"
            src={map().heraldAlive ? HERALD_ICON : map().voidgrubsAlive > 0 ? GRUB_ICON : BARON_ICON}
            alt="objetivo"
          />
          <span class="bcast-obj-timer">
            {map().heraldAlive
              ? "Arauto"
              : map().voidgrubsAlive > 0
                ? `Larvas ${map().voidgrubsAlive}`
                : map().baronAlive
                  ? "Barão"
                  : fmtClock(map().baronInSec)}
          </span>
        </div>
      </div>

      <TeamSide side="rival" />
    </div>
  );
}
