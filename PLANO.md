# Drafter — Plano do Projeto

App **HTML simples** (single-page, sem backend) para montar um **draft de jogadores** do FC 26 entre amigos, operado por **um único usuário** numa só tela/computador. O pool de jogadores vem da lista já existente nesta pasta: [`fc26_copa2026_melhores_por_posicao.md`](./fc26_copa2026_melhores_por_posicao.md).

---

## 1. Objetivo

Permitir que **uma pessoa** conduza, do início ao fim, um draft entre até **6 participantes**:

1. Configura os participantes e seus times.
2. Sorteia a ordem dos picks e escolhe o **modelo de draft**.
3. Conduz a escolha de jogadores, rodada a rodada.
4. Vê o **resumo de cada time** e **exporta em PDF**.

Foco em **simplicidade**: um único `index.html` (ou poucos arquivos), rodando direto no navegador, sem instalação nem servidor.

---

## 2. Stack técnica

| Item | Escolha | Motivo |
|------|---------|--------|
| Estrutura | HTML5 + CSS + **JavaScript vanilla** (sem framework) | Simples, abre com duplo clique |
| Build | Nenhum | Sem Node/bundler |
| Dados dos jogadores | Arquivo `players.json` (gerado a partir do `.md`) | Fácil de consumir em JS |
| Persistência | `localStorage` | Não perder o draft ao recarregar |
| Export PDF | [`html2pdf.js`](https://github.com/eKoopmans/html2pdf.js) (via CDN) **ou** `window.print()` com CSS `@media print` | Sem dependência pesada |
| Estilo | CSS próprio (ou Pico.css / Water.css via CDN p/ acelerar) | UI rápida e limpa |

> **UI em pt-BR** (labels, botões, mensagens). Código/variáveis em inglês.

---

## 3. Fonte de dados — jogadores

O pool de escolha é a base completa de **~1.100 jogadores** de **48 seleções** da Copa 2026 que existem no FC 26 — arquivo [`data/players.json`](./data/players.json) (gerado por `data/merge.js` a partir de `data/squads/*.json`). Referência legível por seleção: [`fc26_copa2026_convocados.md`](./fc26_copa2026_convocados.md). _(O `fc26_copa2026_melhores_por_posicao.md` é a curadoria antiga de top-10 por posição, mantida só como histórico.)_

**Tarefa de preparação:** converter o `.md` num `players.json` com a forma:

```json
[
  {
    "id": "dembele",
    "nome": "Ousmane Dembélé",
    "overall": 90,
    "clube": "Paris Saint-Germain",
    "selecao": "França",
    "posicaoPrincipal": "ST",
    "posicoes": ["ST", "RW"],
    "posicaoLabel": "Centroavante / Ponta Direita"
  }
]
```

- `posicaoPrincipal`: código da posição em que entrou na lista (GK, RB, CB-R, CB-L, LB, CDM, CM, CAM, RW, LW, ST).
- **`posicoes`: array com TODAS as posições que o jogador pode atuar** (principal + secundárias do FC 26). Ex.: Dembélé = `["ST", "RW"]`, Koundé = `["RB", "CB-R"]`.
- Cada jogador é **único** e some do pool ao ser escolhido.
- Útil ter filtro/busca por **posição**, **overall** e **nome** na tela de pick.

> **Enriquecimento de dados:** a lista `.md` traz só a posição principal de cada um. Para o modo Travado funcionar bem, o `players.json` deve receber as **posições secundárias** do FC 26 (multi-posição). Pode ser preenchido na conversão (várias estrelas do pool jogam em 2+ posições).

---

## 4. Fluxo da aplicação (4 fases)

```
[1] Configuração  →  [2] Sorteio & Modelo  →  [3] Draft (picks)  →  [4] Resumo & Export PDF
```

Navegação por etapas (wizard). Estado guardado em `localStorage` a cada ação.

### Fase 1 — Configuração dos participantes
- Definir **quantidade de times: 1 a 6**.
- Definir **máx. de jogadores da mesma seleção por time** (Sem limite / 1–5) — ao pickar, jogadores de uma seleção que já atingiu o limite ficam bloqueados ("seleção cheia"). Vale para os dois modos.
- Definir o **modo de restrição de posição** (ver seção 6):
  - **Livre** — cada um escolhe qualquer jogador; define-se um **nº de jogadores por time** (padrão **11**, validar `times × jogadores ≤ total do pool`).
  - **Travado (formação)** — cada participante escolhe uma **formação tática** (estilo 7a0); o nº de jogadores por time passa a ser **fixo em 11** (os slots da formação).
- Para cada participante:
  - **Nome do participante** (ex.: "André")
  - **Nome do time** (ex.: "Centauros FC")
  - **Formação** (somente no modo Travado) — dropdown com as formações disponíveis (4-3-3, 4-4-2, etc.)
  - (opcional) cor/escudo emoji para diferenciar visualmente
- Botão **"Avançar"** habilita só com tudo preenchido.

### Fase 2 — Sorteio da ordem & modelo de pick
- Botão **"Sortear ordem"**: embaralha os participantes e define a ordem da 1ª rodada (animação simples opcional).
- Mostrar a ordem sorteada (1º, 2º, ... 6º).
- Permitir **re-sortear** antes de confirmar.
- Escolher o **modelo de draft** (ver seção 5).
- Botão **"Iniciar draft"**.

### Fase 3 — Draft (escolha dos jogadores)
- Mostrar de forma destacada: **"Vez de: [Participante] — [Time]"**, rodada atual (ex.: "Rodada 3 de 11").
- **Pool de jogadores** disponível, com busca por nome, filtro por posição e ordenação por overall.
- O fluxo do pick muda conforme o modo de restrição:

  **Modo Livre:**
  - Clicar num jogador → confirma o pick → jogador sai do pool e entra no time da vez → passa pro próximo da ordem.

  **Modo Travado (formação) — estilo 7a0:**
  - O time da vez aparece como um **campo com a formação escolhida** e os slots posicionais (GOL, LD, ZAG, ZAG, LE, VOL, MC, MEI, PD, CA, PE…) — os já preenchidos mostram o jogador, os vazios ficam destacados.
  - O dono **clica num slot vazio** → o pool é **filtrado para os jogadores elegíveis** àquele slot (ver elegibilidade na seção 6) → escolhe o jogador → ele é alocado **naquela posição** (é aqui que "o dono já escolhe onde ele vai atuar").
  - Se o slot escolhido não tiver mais jogadores elegíveis no pool, oferecer **relaxar para posições adjacentes** (fallback) ou trocar de slot.
- Painel lateral com **prévia de cada time** (jogadores já escolhidos / formação preenchendo).
- (opcional) Box score por time: overall médio + médias de **ataque/defesa** (como no 7a0).
- (opcional) Botão **"Desfazer último pick"**.
- Ao completar todas as rodadas (ou todos os slots) → vai para o Resumo.

### Fase 4 — Resumo & exportação
- Card por time com: nome do participante, nome do time, lista de jogadores (posição, overall, clube, seleção) e **overall médio do time**.
- Botão **"Exportar PDF"** → gera um PDF com todos os times (uma seção/página por time, ou tudo numa folha).
- Botão **"Novo draft"** (limpa o `localStorage`).

---

## 5. Modelos de pick (escolha do usuário na Fase 2)

| Modelo | Como funciona | Uso típico |
|--------|---------------|-----------|
| **Linear** | A ordem se repete igual toda rodada: 1→2→3→4→5→6, 1→2→3... | Mais simples |
| **Snake (serpentina)** | Inverte a cada rodada: 1→2→...→6, depois 6→5→...→1, e repete | **Padrão recomendado** — mais justo |
| **Aleatório por rodada** | Sorteia uma nova ordem a cada rodada | Caótico/divertido |

> Implementar como uma função `getPickOrder(round, baseOrder, model)` que devolve a sequência de participantes daquela rodada.

---

## 6. Restrição de posição — modo Travado (formação livre por áreas)

Inspirado no **7a0**, mas **sem formação fixa**: o campo é dividido em **3 faixas verticais (Ataque · Meio · Defesa)** e o usuário **arrasta as "bolas"** (slots) para montar a própria formação durante os picks. O papel de cada bola é definido por **onde ela está**.

### 6.1. Modos
- **Livre:** sem restrição. Qualquer jogador, qualquer quantidade (até `picksPerTeam`).
- **Travado:** cada time monta a formação no campo (11 bolas: 1 goleiro fixo + 10 de linha arrastáveis). Cada pick preenche uma bola com um jogador **elegível ao papel** dela. Total fixo de **11 por time**.

### 6.2. Papel pela área (faixa + lane)
A bola assume um papel conforme a **faixa vertical** e, em Defesa/Ataque, a **lane horizontal** (central x lados):

| Área | Central | Lado esquerdo | Lado direito |
|------|---------|---------------|--------------|
| **Defesa** (y ≥ 62) | ZAG (zagueiro) | LE (lateral esq) | LD (lateral dir) |
| **Meio** (40–62) | MEI (meio-campista) | MEI | MEI |
| **Ataque** (y < 40) | CA (centroavante) | PE (ponta esq) | PD (ponta dir) |

Ao arrastar, o papel e a cor da bola se atualizam ao vivo. Reposicionar dentro da mesma área não muda o papel; cruzar para outra área/lane muda.

### 6.3. Elegibilidade papel → posições do pool
Cada papel aceita as posições correspondentes do FC 26 (sem fallback — as áreas já são amplas):

| Papel | Posições elegíveis |
|-------|--------------------|
| GOL | GK |
| LE | LB |
| LD | RB |
| ZAG | CB-R, CB-L |
| MEI | CDM, CM, CAM |
| PE | LW |
| PD | RW |
| CA | ST |

### 6.3.1. Jogadores multi-posição
Um jogador é **elegível para uma bola se QUALQUER posição do seu array `posicoes`** casar com o papel. Ex.: **Dembélé** (`["ST","RW"]`) serve em **CA** ou **PD**; **Koundé** (`["RB","CB-R"]`) em **LD** ou **ZAG**; **Gvardiol** (`["LB","CB-L"]`) em **LE** ou **ZAG** — **o dono decide onde escalar**. No resumo/PDF aparece o papel em que foi escalado.

### 6.3.2. Mínimos obrigatórios e edição
- **Mínimos:** 1 goleiro (fixo), **≥2 zagueiros (ZAG central)**, **≥2 meio-campistas**, **≥1 atacante**. Arrastar uma bola que violaria um mínimo é bloqueado (com aviso).
- **Trocar jogador de posição:** arrastar uma bola **cheia** para área compatível move o jogador; soltar sobre outra bola **troca** os dois (validando elegibilidade cruzada).
- **Checklist ao vivo** no topo do campo mostra os mínimos (verde/vermelho) e a contagem de cada papel.

### 6.4. ⚠️ Profundidade do pool (ponto de atenção)
Com **10 jogadores/posição** e **6 times**, formações que pedem 2+ da mesma posição ainda podem apertar a primária:
- **Papéis amplos (folgados):** ZAG aceita CB-R+CB-L = **20**; MEI aceita CDM+CM+CAM = **30**. Sobra de sobra mesmo com 6 times.
- **Papéis de posição única (10 cada):** GOL (GK), LE (LB), LD (RB), PE (LW), PD (RW), CA (ST). Se muitos times empilharem o mesmo papel central (ex.: vários CA), pode esgotar — mas, com formação livre, o usuário pode redistribuir as bolas para papéis com pool sobrando. Multi-posição (`posicoes`) ajuda bastante.

> A formação livre + elegibilidade por área tornaram o aperto muito menos provável que no modelo de formação fixa.

---

## 7. Exportação em PDF

- Opção A (recomendada): **`html2pdf.js`** via CDN — renderiza uma `<div>` de resumo estilizada em PDF, com um clique.
- Opção B: **`window.print()`** + folha de estilo `@media print` (zero dependência), usuário escolhe "Salvar como PDF".
- Conteúdo do PDF: cabeçalho ("Draft FC 26 — [data]"), e por time: participante, time, tabela de jogadores e overall médio.

---

## 8. Estrutura de arquivos sugerida

```
drafter/
├── PLANO.md                                  (este arquivo)
├── fc26_copa2026_melhores_por_posicao.md     (fonte dos jogadores)
├── index.html                                (app — markup das 4 fases)
├── css/
│   └── style.css
├── js/
│   ├── app.js          (controle de fases / estado / localStorage)
│   ├── draft.js        (lógica de ordem, modelos de pick, picks)
│   └── pdf.js          (geração do resumo em PDF)
└── data/
    └── players.json    (gerado a partir do .md)
```

> Se preferir **ainda mais simples**: tudo num único `index.html` com `<style>` e `<script>` inline + `players.json`.

---

## 9. Modelo de estado (em memória / localStorage)

```js
const state = {
  phase: 'setup',            // setup | draw | draft | summary
  numTeams: 6,
  restrictionMode: 'locked', // free | locked
  picksPerTeam: 11,          // no modo locked é sempre 11 (slots da formação)
  pickModel: 'snake',        // linear | snake | random
  teams: [
    {
      id: 1,
      participant: 'André',
      name: 'Centauros FC',
      formation: '4-3-3',    // só no modo locked
      // no modo locked: slots com posição e jogador alocado
      slots: [
        { slot: 'GOL', playerId: null },
        { slot: 'LD',  playerId: null },
        // ... 11 slots conforme a formação
      ],
      players: []            // no modo free: lista simples de ids
    }
    // ...
  ],
  baseOrder: [3, 1, 5, 2, 6, 4], // ordem sorteada (ids de time)
  currentRound: 1,
  currentPickIndex: 0,
  availablePlayers: [ /* ids ainda no pool */ ],
}
```

---

## 10. Etapas de implementação (ordem sugerida)

1. **Gerar `players.json`** a partir do `.md`, **incluindo o array `posicoes`** (multi-posição) de cada jogador.
2. **Esqueleto HTML** com as 4 seções (só uma visível por vez).
3. **Fase 1** — formulário de times + escolha do modo (Livre/Travado) + formação por time (se Travado) + validações.
4. **Fase 2** — sorteio da ordem + seleção do modelo de pick.
5. **Definir as formações** (templates de slots) e a função de **elegibilidade** (slot → `posicoes` do jogador, com fallback).
6. **Fase 3 (Livre)** — render do pool, busca/filtro, pick simples + avanço de turno.
7. **Fase 3 (Travado)** — campo com slots da formação, clicar-slot → pool filtrado por elegibilidade → alocar jogador no slot (incl. multi-posição).
8. **Fase 4** — resumo + overall médio (e, no Travado, a escalação por posição).
9. **Exportação PDF**.
10. **Persistência** em `localStorage` + botão "Novo draft".
11. Polimento visual.

---

## 11. Decisões assumidas (ajustar se quiser)

- **1 jogador por time por vez**, sem repetição global (pool compartilhado).
- **Restrição de posição configurável:** modo **Livre** (escolhe quem quiser) ou **Travado** (preenche slots de uma formação por time, estilo 7a0). Padrão sugerido: oferecer os dois, começar com Livre selecionado.
- **Padrão de jogadores por time:** Livre = configurável (1 a pool÷times); Travado = 11 fixo (slots da formação).
- **Formações iniciais:** 4-3-3 e 4-4-2; demais entram depois.
- **Elegibilidade com fallback:** slot tenta a posição primária; se esgotar no pool, libera adjacentes sob aviso (evita travar — ver seção 6.4).
- **Modelo de pick padrão sugerido:** Snake.
- App **offline**, single-user, numa só máquina (passa o mouse/teclado entre amigos ou um conduz).

---

## 12. Melhorias futuras (fora do escopo inicial)

- Mais formações e formações personalizadas.
- Permitir definir uma formação **única para todos** (em vez de uma por time).
- Timer por pick.
- Modo "auto-pick" (melhor overall disponível) caso alguém demore.
- Tema visual por seleção/clube.
- Compartilhar resultado por link/imagem além do PDF.
