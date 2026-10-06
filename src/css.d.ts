/**
 * Ambient module declaration for side-effect CSS imports.
 *
 * With `noUncheckedSideEffectImports` enabled in tsconfig, a bare
 * `import "./x.css"` needs a declared module to type-check. Vite handles the
 * actual bundling at build time; this only satisfies the type checker.
 */
declare module "*.css";
