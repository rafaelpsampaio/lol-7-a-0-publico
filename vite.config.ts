import { defineConfig, type Plugin } from "vite";
import solidPlugin from "vite-plugin-solid";
import { fileURLToPath } from "node:url";
import { criarHandlerDosPacotes } from "./server/pacotes/handler";
import { ehLoopback, mesmaOrigem } from "./server/pacotes/dono";

/**
 * npm run dev e vite preview: a mesma API do editor de pacotes (secao 6.3 da
 * spec 2026-10-05-editor-de-pacotes-design). Sem sala, nao ha token do dono:
 * a escrita vale so de loopback E da mesma origem (E-11): loopback sozinho deixa
 * qualquer site aberto no navegador do dono (ou outro dev server em localhost)
 * criar e apagar pacotes, e o CORS padrao do Vite aceita origens localhost.
 */
function pacotesNoVite(): Plugin {
  const handler = criarHandlerDosPacotes({
    raizPublic: fileURLToPath(new URL("./public", import.meta.url)),
    ehDono: (req) => ehLoopback(req.socket.remoteAddress) && mesmaOrigem(req.headers),
  });
  return {
    name: "lol7a0-pacotes",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handler(req, res)) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handler(req, res)) next();
      });
    },
  };
}

export default defineConfig({
  plugins: [solidPlugin(), pacotesNoVite()],
  build: {
    target: "es2020",
  },
});
