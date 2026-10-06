/**
 * src/pacotes/PreviaDaCarta.tsx
 *
 * A carta como aparece no draft (o PlayerCard real), com o selo da nota
 * geral, atualizando a cada edicao (secao 3.4).
 */

import type { PlayerVersion } from "../data/schema";
import { PlayerCard } from "../components/PlayerCard";

export function PreviaDaCarta(props: { carta: PlayerVersion }) {
  return (
    <div class="pk-previa__corpo">
      <p class="pk-rotulo">No draft</p>
      <PlayerCard player={props.carta} mode="overall" />
      <p class="pk-previa__nota">Muda na hora em que você edita ano, rota, fases, traits ou foto.</p>
    </div>
  );
}
