/**
 * src/playback/AttributionNotice.tsx
 *
 * Riot Games fan-content attribution notice (PLAY-06).
 *
 * Must render before any champion asset is displayed (Plan 02 wires this as
 * a gate above the portrait strip). Copy is in pt-BR per the project's
 * Copywriting Contract. Text rendered as JSX text nodes — no innerHTML (T-04-01).
 */

// ---------------------------------------------------------------------------
// AttributionNotice component
// ---------------------------------------------------------------------------

export function AttributionNotice() {
  return (
    <p class="attribution-notice" role="note">
      Conteúdo de fã · não endossado pela Riot Games. League of Legends e seus
      ativos são marcas da Riot Games, Inc.
    </p>
  );
}
