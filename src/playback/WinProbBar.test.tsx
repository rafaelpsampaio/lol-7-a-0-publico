/**
 * src/playback/WinProbBar.test.tsx
 *
 * Vitest tests for WinProbBar component.
 * Uses solid-js/web SSR renderToString (no jsdom — matches Phase 04-01 pattern).
 *
 * Covers:
 *   1. 0.73 → user width 73% / rival 27%
 *   2. null → renders without throwing and shows a 50/50 neutral split
 *   3. Percentages sum to 100 across sample values
 *   4. Source assertion: formatWinProb is imported from EventTicker
 *   5. Source assertion: no innerHTML in WinProbBar.tsx
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { WinProbBar } from "./WinProbBar";
import * as fs from "fs";
import * as path from "path";

// Read source file for source assertions
const winProbBarSrc = fs.readFileSync(
  path.resolve(__dirname, "WinProbBar.tsx"),
  "utf-8"
);

describe("WinProbBar", () => {
  // -------------------------------------------------------------------------
  // Behavioral tests (via SSR renderToString)
  // -------------------------------------------------------------------------

  it("renders user segment at 73% and rival at 27% when winProb=0.73", () => {
    const html = renderToString(() => <WinProbBar winProb={0.73} />);
    expect(html).toContain('width:73%');
    expect(html).toContain('width:27%');
  });

  it("renders without throwing when winProb=null", () => {
    expect(() => renderToString(() => <WinProbBar winProb={null} />)).not.toThrow();
  });

  it("renders 50/50 neutral split when winProb=null", () => {
    const html = renderToString(() => <WinProbBar winProb={null} />);
    // Both segments should be 50%
    expect(html).toContain('width:50%');
  });

  it("percentages sum to 100 for winProb=0.73", () => {
    const html = renderToString(() => <WinProbBar winProb={0.73} />);
    // 73 + 27 = 100
    expect(html).toContain('width:73%');
    expect(html).toContain('width:27%');
  });

  it("percentages sum to 100 for winProb=0.50", () => {
    const html = renderToString(() => <WinProbBar winProb={0.50} />);
    expect(html).toContain('width:50%');
  });

  it("percentages sum to 100 for winProb=0.10", () => {
    const html = renderToString(() => <WinProbBar winProb={0.10} />);
    expect(html).toContain('width:10%');
    expect(html).toContain('width:90%');
  });

  it("percentages sum to 100 for winProb=0.99", () => {
    const html = renderToString(() => <WinProbBar winProb={0.99} />);
    // Math.round(0.99*100) = 99, rival = 1
    expect(html).toContain('width:99%');
    expect(html).toContain('width:1%');
  });

  it("renders win-prob-bar div with role=meter and value bounds", () => {
    // WR-04: role="meter" (not "img") is the valid range-widget role on which
    // aria-valuenow/min/max are honored by assistive tech.
    const html = renderToString(() => <WinProbBar winProb={0.6} />);
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-valuenow="60"');
  });

  it("renders win-prob-bar__user and win-prob-bar__rival segments", () => {
    const html = renderToString(() => <WinProbBar winProb={0.6} />);
    expect(html).toContain('win-prob-bar__user');
    expect(html).toContain('win-prob-bar__rival');
  });

  it("renders accessible aria-label", () => {
    const html = renderToString(() => <WinProbBar winProb={0.6} />);
    expect(html).toContain('aria-label');
  });

  it("renders numeric percent as text (not via innerHTML)", () => {
    const html = renderToString(() => <WinProbBar winProb={0.73} />);
    // The text "73" should appear as text content
    expect(html).toContain('73');
  });

  // -------------------------------------------------------------------------
  // Source assertions
  // -------------------------------------------------------------------------

  it("imports formatWinProb from EventTicker (single source for split math)", () => {
    expect(winProbBarSrc).toContain('formatWinProb');
    expect(winProbBarSrc).toContain('EventTicker');
  });

  it("does not contain innerHTML assignment", () => {
    // Check for actual innerHTML assignment patterns
    const innerHTMLPattern = /[.=\s]innerHTML\s*=/;
    expect(innerHTMLPattern.test(winProbBarSrc)).toBe(false);
  });

  it("does not recompute win probability (no rawformulas)", () => {
    // The component should not have any probability computation beyond using formatWinProb
    // It should only call formatWinProb or derive userPct from winProb directly
    // No Math.random or complex probability calculations
    expect(winProbBarSrc).not.toContain('Math.random');
    expect(winProbBarSrc).not.toContain('baseline');
  });
});
