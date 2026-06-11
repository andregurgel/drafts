# Drafter — Draft FC 26 · Copa 2026

App estático (HTML + CSS + JS puro, sem build) para montar um **draft de jogadores** do EA Sports FC 26 entre amigos, com formação editável no campo e base dos convocados da Copa do Mundo 2026.

## Rodar localmente
Abra o `index.html` no navegador (duplo clique). Não precisa de servidor.

## Como funciona
- 1 a 6 participantes, sorteio da ordem (linear / snake / aleatório) e limite por seleção.
- Cada time monta a formação no campo (arraste as bolas entre Defesa / Meio / Ataque) e escala 11 jogadores.
- Posição é **guia**: dá pra escalar qualquer jogador em qualquer vaga; fora de posição aparece um `!` de aviso (não bloqueia).
- Resumo por time com overall médio e exportação em PDF.

## Base de dados
- `data/players.json` — base app-ready (~1.100 jogadores de 48 seleções que existem no FC 26).
- `js/data.js` — gerado a partir do JSON (consumido pelo app).
- Regenerar: `node data/merge.js` (lê `data/squads/*.json`).

## Deploy (GitHub Pages)
Repositório publicado em **GitHub Pages** — site estático servido direto da branch `main`.
