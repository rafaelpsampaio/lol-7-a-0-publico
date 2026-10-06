# Sala do LoL 7 a 0 — como abrir para os amigos

De 2 a 8 pessoas na mesma sala. Uma pessoa hospeda, as outras so abrem um link.

## Abrir a sala

```
npm run play
```

Compila o jogo e sobe o servidor. Use esse quando tiver mudado o codigo ou for
a primeira vez do dia.

```
npm run server
```

Sobe o servidor com o build que ja existe. Mais rapido, quando nada mudou.

## Os dois links impressos

Ao subir, o console mostra algo assim:

```
=== LoL 7 a 0 — sala aberta ===
Voce (host): http://localhost:7070/?host=8f2c...-...-...
Amigos na sua rede: http://192.168.15.23:7070/
```

- **`Voce (host)`** e o seu, e so seu. O `?host=` no fim e o que te da os
  poderes de host (publicar a base, mexer nas configuracoes). Abra ele no seu
  navegador — o token some da barra de enderecos assim que a pagina carrega,
  entao pode compartilhar tela a vontade.
- **`Amigos na sua rede`** e o que voce manda no grupo. Todo mundo no mesmo
  wi-fi abre esse. Se aparecer mais de um, mande o que comeca com `192.168.`
  ou `10.`.

O lobby do host tambem mostra esses links de amigos (sem o token), com botao
de copiar — e o link publico do tunel assim que ele fica pronto.

Quem abre o link cai direto na sala (o menu do jogo solo nao aparece). Cada
pessoa escolhe um apelido e um nome de time e entra; o nome nao pode repetir,
e a sigla que o time vai usar no chaveamento aparece ja no formulario. As vagas
que sobrarem viram times controlados pelo computador.

## Como a noite anda

1. **Lobby.** O host confere os tres passos do cartao "Preparar o draft"
   (convidar, base de jogadores, tempo por turno) e clica em "Comecar o draft".
   O botao diz o que falta quando ainda nao da para comecar.
2. **Draft.** Cinco voltas, sempre na mesma ordem (os times aparecem na ordem
   de escolha). Na sua vez a tela e o titulo da aba avisam "Sua vez!".
3. **Torneio, rodada a rodada.** Cada rodada simula as series no servidor e
   leva cada pessoa para a serie do proprio time. O resultado de uma serie da
   rodada atual so aparece para quem ja assistiu ao jogo que a decidiu (ou
   clicou "Mostrar resultados desta rodada") — inclusive placar, "Eliminado" e
   o campeao. Quando todo mundo marca "Pronto para seguir", a proxima rodada
   comeca; a barra do rodape diz quem ainda falta. O host pode "Seguir agora
   sem esperar".
4. **Quando todos os times da sala caem**, a sala vota no proprio chaveamento:
   "Continuar assistindo" (empate tambem continua) ou "Pular para o podio" (o
   resto e simulado na hora e o campeao e coroado). A votacao so abre depois
   que todo mundo assistiu a serie em que caiu.
5. **Podio.** Campeao, classificacao final dos 8 times e destaques do torneio
   (media por jogo). O host pode clicar em "Revanche": todo mundo volta ao lobby
   com os mesmos times, sem reabrir o servidor.

"Assistir juntos" (so o host liga, no chaveamento) poe a sala inteira na mesma
serie, no mesmo ponto; so o host avanca os jogos e escolhe a serie.

## Quem chega atrasado

Quem abre o link depois que o draft comecou entra para **assistir**: so o
apelido, sem time, sem voto e sem "pronto". Na Revanche, quem estava assistindo
vira jogador se ainda houver vaga.

## Amigo fora da sua rede

### Servidor em um PC, host em qualquer lugar

Para ligar o servidor e deixar os amigos conduzirem toda a sala pelo mesmo
link, sem abrir um navegador no computador do servidor:

```
npm run play:online
```

Esse comando compila o jogo e sobe o servidor com `--tunnel --host-auto`.
Precisa do cloudflared instalado (veja abaixo). Compartilhe a URL pública
`https://…trycloudflare.com` impressa no terminal, sem adicionar token.
Quem recebe só precisa de um navegador; pode estar em outra rede.

Com o build pronto, também pode usar:

```
npm run server -- --tunnel --host-auto
```

- O primeiro jogador que concluir uma entrada válida no lobby vira host.
  Só abrir a página não ocupa esse papel. O link dá acesso à sala: quem entrar
  antes dos amigos pode assumir o controle.
- Se o host desconectar, tem **60 segundos** para voltar. Depois disso, assume
  o primeiro jogador conectado na ordem de entrada, em qualquer fase, inclusive
  draft, torneio e pódio. Quem só está assistindo não recebe o controle.
- Se todos caírem, a sala espera. Após o prazo, o primeiro jogador elegível
  que voltar assume; se o host original voltar antes de haver substituto,
  continua no controle. O host anterior não recupera o controle automaticamente
  quando já existe um substituto.
- A transferência manual pelo botão **Tornar host** continua disponível no
  lobby. Uma segunda aba do mesmo jogador mantém o host conectado.
- Uma troca automática desliga **Assistir juntos**, mantendo cada pessoa na
  sua série. O novo host pode ligar a exibição conjunta novamente.
- O modo e o host ficam no snapshot. Um reinício dá ao host salvo um novo prazo
  de 60 segundos para reconectar. A identidade depende do mesmo navegador e
  endereço; outro endereço de túnel exige entrar novamente.
- O host da sala pode escolher/publicar a base e conduzir o multiplayer, mas
  **não ganha permissão para editar os arquivos dos pacotes**. O terminal
  imprime um link separado **Editar pacotes (dono)**: mantenha-o privado.

O PC do servidor deve continuar ligado, sem suspensão, com o servidor e o
túnel rodando. O túnel não exige abrir portas no roteador, mas a rede precisa
permitir suas conexões de saída. O endereço `trycloudflare.com` é temporário,
muda ao criar outro túnel e não oferece garantia de disponibilidade. Um
endereço permanente exige configurar um túnel com domínio fixo separadamente.

`--host-auto` também funciona só na LAN, sem `--tunnel`. O modo fica salvo:
para voltar ao controle manual, inicie outra sala sem a flag, usando
`--nova-sala` (isso descarta a partida anterior).

### Túnel com controle manual

Suba com `--tunnel`:

```
npm run server -- --tunnel
```

Precisa do [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
instalado. Ele imprime uma URL publica (`https://algo-aleatorio.trycloudflare.com`)
— e essa que voce manda para quem esta longe. A URL da LAN continua valendo
para quem esta na sua casa.

## Flags

| Flag | O que faz |
| --- | --- |
| `--port 8080` | Usa outra porta. O padrao e 7070. Serve quando a porta esta ocupada — o servidor avisa e sugere isso. |
| `--tunnel` | Sobe um tunel cloudflared para amigos fora da rede. |
| `--host-auto` | O primeiro jogador assume; queda de 60s passa o controle para outro jogador conectado. O modo fica salvo na sala. |
| `--nova-sala` | Joga fora a sala anterior e comeca do zero. |

Com `npm run server`, as flags vao depois de `--`:

```
npm run server -- --port 8080 --nova-sala
```

## Comecar uma sala limpa

A sala fica salva em disco, entao um reinicio do servidor no meio do jogo nao
perde ninguem. Mas a sala da semana passada atrapalha: os nomes de time estao
ocupados, as 8 vagas estao presas por gente que nem vai jogar.

```
npm run server -- --nova-sala
```

Sala anterior com mais de 12 horas ja e descartada sozinha — o console avisa
quando isso acontece.

## Quem cai, volta

Se a conexao cai (wi-fi piscou, notebook dormiu, o servidor reiniciou), a
sala tenta voltar sozinha — a faixa no topo mostra "Tentando voltar em N s" e
tem "Tentar agora". Recarregar ou reabrir o link tambem funciona: o navegador
lembra o apelido e o time e entra sem formulario, no mesmo lugar. Tem que ser o
mesmo navegador, sem limpar os dados do site.

No lobby, o host pode **Remover** quem caiu e nao vai voltar (libera a vaga e o
nome). Cada um pode **Trocar nome** do proprio time enquanto o draft nao
comecou.

"Sair da sala" leva ao menu do jogo solo sem perder o lugar; uma faixa no topo
oferece "Voltar para a sala".

## O que fica em `server/data/`

Nada disso vai para o git (a pasta inteira esta no `.gitignore`).

| Arquivo | O que e |
| --- | --- |
| `room.json` | O retrato da sala: quem entrou, os times, a fase. Reescrito a cada mudanca. |
| `players.json` | A base de jogadores que a sala esta usando. Na primeira subida e uma copia de `public/players.json`. |
| `players.backup.json` | A base anterior, guardada automaticamente antes de cada publicacao. |
| `dono.token` | Segredo do dono do editor. No modo automático é separado do token da sala; não compartilhe. |
| `server.log` | Tudo que o servidor imprimiu nesta subida (mesmo conteudo do terminal). Comeca zerado toda vez que voce sobe o servidor de novo — serve pra investigar depois o que rolou numa sessao de teste. |

Para zerar tudo mesmo — sala e base — apague a pasta `server/data` inteira e
suba de novo.

## Publicar a base de jogadores

Quem hospeda ve, no lobby, o passo **Base de jogadores**: a base padrao do
jogo, o pacote **Amigos** (que vem com o jogo, em `public/packs/amigos.json`)
e os pacotes que ele ja tem neste navegador (criados em "Pacotes" no jogo
solo), cada um dizendo se da para 8 times ou quantas cartas faltam em cada
rota. "Usar esta base" publica para todo mundo. Um `players.json` tambem
serve, em "Opcao avancada". So funciona antes do draft comecar, e so para o
host.

Se o arquivo estiver quebrado ou nao for uma base valida, aparece a razao na
tela e nada e sobrescrito — a base que estava valendo continua valendo.

A regra do baralho: carta escolhida sai do baralho de todos, e a mesma pessoa
pode estar em times diferentes com cartas diferentes, nunca duas vezes no mesmo
time. Por isso a base so e liberada quando nenhuma sequencia de escolhas deixa
um dos 8 times sem jogador numa rota. Quando falta, carta de quem so joga
aquela rota resolve; outra versao de quem ja joga a rota pode nao resolver.

O pacote Amigos foi gerado do `macacos.xlsx` com `npm run pack:amigos`. Depois
disso, edite o JSON direto (rodar o script de novo sobrescreve as edicoes).

## Depois de mudar o codigo

O servidor indexa os arquivos do `dist/` quando sobe: depois de um `npm run
build`, reinicie o servidor (`npm run play` ja faz os dois). A sala volta do
snapshot, ninguem perde o lugar.

## Roteiro de teste manual (2 pessoas/agentes)

**Achado do teste inicial (2026-08-27):** os dois lados entraram pelo link de
host (`?host=...`). Isso deixa os dois com poderes de host e nunca exercita o
fluxo de convidado de verdade — quem so abre o link de LAN. Todo teste
seguinte precisa cobrir os dois papeis.

- [ ] Suba uma sala limpa: `npm run server -- --nova-sala`.
- [ ] **Lado 1 (host):** abra o link `Voce (host)` (o que tem `?host=` no
      fim).
- [ ] **Lado 2 (convidado):** abra um dos links que o lobby do host mostra em
      "Convide os amigos" — **sem** `?host=` na URL.
- [ ] Escolher apelido e nome de time nos dois lados (nomes de time nao podem
      repetir; a sigla aparece no formulario).
- [ ] No lado convidado, confirmar que **nao** aparece o cartao "Preparar o
      draft" — base, tempo e comecar sao so do host (`not_host` no servidor).
- [ ] Completar o draft nos dois lados.
- [ ] Na primeira rodada, voltar ao chaveamento no meio da serie: o placar dela
      tem de aparecer como "? × ?" ate o jogo decisivo ser visto.
- [ ] Recarregar a pagina de um dos lados no meio do torneio: ele volta sozinho,
      sem formulario, no mesmo time.
- [ ] Acompanhar o torneio ate o podio, marcando "Pronto para seguir" a cada
      rodada. Se todos os times humanos cairem antes da final, testar a
      votacao ("Pular para o podio" tem de coroar um campeao).
- [ ] No podio, o host clica "Revanche": todo mundo volta ao lobby.
- [ ] Depois do teste, olhar `server/data/server.log` e `server/data/room.json`
      pra conferir o que aconteceu e se apareceu algum erro no meio do caminho.

## Host em outro computador

A máquina que executa o servidor e a pessoa que organiza a sala podem ser
 diferentes. No lobby, o host escolhe **Tornar host** ao lado de outro jogador
 conectado e confirma **Transferir controle**. O novo host recebe os controles
 imediatamente; o anterior continua como convidado. O link de host antigo é
 desativado, e cada navegador mantém seu novo papel ao reconectar.

A base publicada permanece. O novo host deve revisar tempo, atributos e caos
antes de começar: opções ainda não aplicadas ficam no navegador de quem editou.
A transferência está disponível antes do draft. O computador do servidor deve
continuar ligado, mesmo quando outra pessoa assume o controle.

No modo manual, também é possível começar com um host remoto: envie em particular a essa pessoa
 o endereço de rede (ou do túnel) com o `?host=TOKEN` impresso no terminal.
 `localhost` só funciona na máquina do servidor. Convites comuns devem continuar
 sem o token.
