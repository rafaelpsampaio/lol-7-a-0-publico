import { For, Show } from "solid-js";
import type { RoomStore } from "../net/store";
export function ReadyStatus(props: { store: RoomStore }) {
  const tournament = () => props.store.tournament?.();
  return <Show when={(tournament()?.barreira.length ?? 0) > 0}>
    <section class="room-card" aria-label="Prontos para a próxima fase">
      <h3>Prontos para seguir</h3>
      <ul class="room-ready-list" aria-live="polite">
        <For each={tournament()?.barreira ?? []}>{id => <li classList={{ "is-ready": tournament()?.ready.includes(id) }}>
          <span>{tournament()?.ready.includes(id) ? "✓ Pronto" : props.store.state()?.players.find(p => p.publicId === id)?.connected === false ? "◷ Reconectando · aguardando Ready" : "◷ Assistindo"}</span> {props.store.state()?.players.find(p => p.publicId === id)?.nickname}
        </li>}</For>
      </ul>
    </section>
  </Show>;
}
