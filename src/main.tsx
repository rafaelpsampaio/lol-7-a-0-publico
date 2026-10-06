/**
 * src/main.tsx
 *
 * SolidJS application entry point.
 * Replaces the Phase 1 console.log stub (src/main.ts).
 */

import { render } from "solid-js/web";
import "./styles.css";
import { App } from "./App";

const root = document.getElementById("app");
if (!root) throw new Error("Root element #app not found");

render(() => <App />, root);
