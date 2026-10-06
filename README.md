# LoL 7 a 0

Draft e simulador de torneios de LoL, com salas para jogar com amigos.

**Para instalar e jogar no Windows:** veja [o guia de instalacao](docs/INSTALACAO.md). O pacote inclui os programas necessarios, cria um atalho e busca atualizacoes ao iniciar. Quem entra na sala pelo link so precisa de um navegador.

Para desenvolver:

```powershell
npm ci
npm run dev
```

Para hospedar pelo codigo-fonte: `npm run play`. Veja [o guia das salas](server/README.md) para tunel, links e modos de host, e [os scripts](scripts/README.md) para calibracao e auditorias.

Para montar o ZIP de distribuicao no Windows: `npm run build` e `npm run package:windows`. A publicacao de releases e o funcionamento das atualizacoes estao no [guia de instalacao](docs/INSTALACAO.md).
