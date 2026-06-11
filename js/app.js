'use strict';

/* ============================================================
   Drafter — app principal (vanilla JS)
   Fases: setup → draw → draft → summary
   ============================================================ */

const LS_KEY = 'drafter_state_v3';
const PLAYERS = window.PLAYERS;
const PLAYERS_BY_ID = {};
PLAYERS.forEach(p => { PLAYERS_BY_ID[p.id] = p; });

// Sigla da posição padronizada com o campo/formação (GOL, LD, LE, ZAG, VOL, MC, MEI, PD, CA, PE)
const POS_SIGLA = {
  GK: 'GOL', RB: 'LD', LB: 'LE', 'CB-R': 'ZAG', 'CB-L': 'ZAG',
  CDM: 'VOL', CM: 'MC', CAM: 'MEI', RW: 'PD', LW: 'PE', ST: 'CA',
};
const POS_LABELS = {
  GK: 'GOL — Goleiro', RB: 'LD — Lateral Dir', LB: 'LE — Lateral Esq', 'CB-R': 'ZAG — Zagueiro (D)',
  'CB-L': 'ZAG — Zagueiro (E)', CDM: 'VOL — Volante', CM: 'MC — Meio-campo', CAM: 'MEI — Meia',
  RW: 'PD — Ponta Dir', LW: 'PE — Ponta Esq', ST: 'CA — Centroavante',
};
const POS_ORDER = ['GK','RB','CB-R','CB-L','LB','CDM','CM','CAM','RW','LW','ST'];
// Converte um array de posições (códigos) nas siglas do campo, sem repetir
function posSiglas(posicoes) {
  const out = [];
  posicoes.forEach(p => { const s = POS_SIGLA[p]; if (s && out.indexOf(s) === -1) out.push(s); });
  return out.join(' · ');
}
// Bandeiras (emoji) por seleção
const FLAGS = {
  'México':'🇲🇽','Coreia do Sul':'🇰🇷','África do Sul':'🇿🇦','Tchéquia':'🇨🇿','Canadá':'🇨🇦','Bósnia':'🇧🇦',
  'Estados Unidos':'🇺🇸','Paraguai':'🇵🇾','Austrália':'🇦🇺','Costa do Marfim':'🇨🇮','Equador':'🇪🇨','Holanda':'🇳🇱',
  'Arábia Saudita':'🇸🇦','Uruguai':'🇺🇾','França':'🇫🇷','Senegal':'🇸🇳','Iraque':'🇮🇶','Noruega':'🇳🇴',
  'Jordânia':'🇯🇴','Portugal':'🇵🇹','RD Congo':'🇨🇩','Brasil':'🇧🇷','Argentina':'🇦🇷','Inglaterra':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Espanha':'🇪🇸','Alemanha':'🇩🇪','Bélgica':'🇧🇪','Suíça':'🇨🇭','Croácia':'🇭🇷','Turquia':'🇹🇷','Áustria':'🇦🇹',
  'Suécia':'🇸🇪','Colômbia':'🇨🇴','Japão':'🇯🇵','Irã':'🇮🇷','Uzbequistão':'🇺🇿','Catar':'🇶🇦','Gana':'🇬🇭',
  'Cabo Verde':'🇨🇻','Curaçao':'🇨🇼','Haiti':'🇭🇹','Escócia':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Panamá':'🇵🇦','Nova Zelândia':'🇳🇿',
  'Marrocos':'🇲🇦','Argélia':'🇩🇿','Egito':'🇪🇬','Tunísia':'🇹🇳',
};
function flag(selecao) { return FLAGS[selecao] || '🏳️'; }
const TEAM_COLORS = ['#e63946','#1d7874','#f4a261','#5a189a','#2a9d8f','#0353a4'];
const PICK_MODELS = {
  linear: { nome: 'Linear', desc: 'A mesma ordem se repete toda rodada.' },
  snake:  { nome: 'Snake (serpentina)', desc: 'A ordem inverte a cada rodada — mais justo.' },
  random: { nome: 'Aleatório', desc: 'Sorteia uma ordem nova a cada rodada.' },
};

let state = null;

/* ---------------- Estado / persistência ---------------- */
function freshState() {
  return {
    phase: 'setup',
    numTeams: 4,
    restrictionMode: 'locked',  // modo único: formação no campo (posição é guia, não regra)
    maxSameNation: 0,           // 0 = sem limite; N = máx. jogadores da mesma seleção por time
    hideOverall: false,         // true = oculta overall durante picks/ajustes, revela só no resumo
    timerSeconds: 0,            // 0 = sem timer; N = segundos por pick (auto-pick ao estourar)
    picksPerTeam: 11,           // sempre 11 (slots da formação)
    pickModel: 'snake',
    teams: [],                   // {id, participant, name, formation, slots:[], players:[]}
    baseOrder: [],               // ids de time sorteados
    roundOrders: {},             // { round: [teamIds] }
    history: [],                 // {teamId, playerId, slotId}
    availableIds: [],
    subPassed: [],               // ids de times que mantiveram (fase de ajustes)
    subRotation: 0,              // contador de turnos da fase de ajustes
    selectedSlotId: null,
    filterPos: '',
    search: '',
  };
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
function load() {
  try { const s = localStorage.getItem(LS_KEY); if (s) state = JSON.parse(s); } catch (e) { state = null; }
  if (!state) state = freshState();
  ensureTeams();
}

/* ---------------- Helpers de times ---------------- */
function ensureTeams() {
  const cur = state.teams || [];
  const out = [];
  for (let i = 0; i < state.numTeams; i++) {
    out.push(cur[i] || { id: i + 1, participant: '', name: '', formation: '4-3-3', slots: [], players: [] });
    out[i].id = i + 1;
  }
  state.teams = out;
}
function getTeam(id) { return state.teams.find(t => t.id === id); }
function teamColor(id) { return TEAM_COLORS[(id - 1) % TEAM_COLORS.length]; }

/* ---------------- Ordem de picks ---------------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function computeRoundOrder(round) {
  if (state.pickModel === 'linear') return state.baseOrder.slice();
  if (state.pickModel === 'snake') return round % 2 === 1 ? state.baseOrder.slice() : state.baseOrder.slice().reverse();
  return shuffle(state.baseOrder);
}
function getRoundOrder(round) {
  if (!state.roundOrders[round]) state.roundOrders[round] = computeRoundOrder(round);
  return state.roundOrders[round];
}
function picksMade() { return state.history.length; }
function curRound() { return Math.floor(picksMade() / state.numTeams) + 1; }
function curIndex() { return picksMade() % state.numTeams; }
function currentTeamId() { return getRoundOrder(curRound())[curIndex()]; }
function draftComplete() { return picksMade() >= state.numTeams * state.picksPerTeam; }
// Próximos picks a partir do atual (não revela rodadas futuras no modo aleatório)
function upcomingPicks(count) {
  const out = [];
  const total = state.numTeams * state.picksPerTeam;
  const isRandom = state.pickModel === 'random';
  let n = picksMade();
  while (out.length < count && n < total) {
    const round = Math.floor(n / state.numTeams) + 1;
    if (isRandom && round > curRound()) break; // não decide rodadas aleatórias antes da hora
    out.push({ pickNo: n + 1, round, teamId: getRoundOrder(round)[n % state.numTeams], current: n === picksMade() });
    n++;
  }
  return out;
}

/* ---------------- Elegibilidade / formação (modo travado) ---------------- */
function eligibleForRole(role) {
  return state.availableIds
    .map(id => PLAYERS_BY_ID[id])
    .filter(p => window.eligByRole(role, p))
    .sort((a, b) => b.overall - a.overall);
}
// Contagem de papéis (por categoria) nos slots de um time
function roleCounts(team) {
  const c = { gk: 0, zag: 0, lat: 0, mei: 0, ata: 0 };
  team.slots.forEach(s => { c[window.roleCategory(s.role)]++; });
  return c;
}
// Mover um slot de papel mantém os mínimos? (simula oldRole→newRole)
function minimumsOkAfter(team, slot, newRole) {
  const c = roleCounts(team);
  c[window.roleCategory(slot.role)]--;
  c[window.roleCategory(newRole)]++;
  return c.zag >= window.MIN_CAT.zag && c.mei >= window.MIN_CAT.mei && c.ata >= window.MIN_CAT.ata;
}
let _flashTimer = null;
function flash(msg) {
  state._flash = msg;
  render();
  if (_flashTimer) clearTimeout(_flashTimer);
  _flashTimer = setTimeout(() => { state._flash = null; render(); }, 2200);
}

/* ---------------- Ações ---------------- */
function gotoPhase(p) { state.phase = p; save(); render(); }

function sortear() {
  state.baseOrder = shuffle(state.teams.map(t => t.id));
  state.roundOrders = {};
  save(); render();
}

function startDraft() {
  if (state.restrictionMode === 'locked') {
    state.teams.forEach(t => {
      const out = window.DEFAULT_LAYOUT.map((p, i) => ({
        id: 's' + i, role: p.role, x: p.x, y: p.y, playerId: null, fixed: false,
      }));
      out.unshift({ id: 'gk', role: 'GOL', x: 50, y: 93, playerId: null, fixed: true });
      t.slots = out;
      t.players = [];
      t.formation = '4-3-3';
      t.custom = false;
    });
    state.picksPerTeam = 11;
  } else {
    state.teams.forEach(t => { t.players = []; t.slots = []; });
  }
  state.availableIds = PLAYERS.map(p => p.id);
  state.history = [];
  state.roundOrders = {};
  state.selectedSlotId = null;
  gotoPhase('draft');
}

function doPick(playerId, slotId) {
  if (!state.availableIds.includes(playerId)) return;
  const team = getTeam(currentTeamId());
  if (nationBlocked(team, PLAYERS_BY_ID[playerId])) return;
  const slot = team.slots.find(s => s.id === slotId);
  if (!slot || slot.playerId) return;
  slot.playerId = playerId; // posição é guia: qualquer jogador pode entrar (fora de posição vira "!")
  state.availableIds = state.availableIds.filter(id => id !== playerId);
  state.history.push({ teamId: team.id, playerId: playerId, slotId: slotId || null });
  state.selectedSlotId = null;
  if (draftComplete()) enterPostDraft();
  save(); render();
}

function undo() {
  if (!state.history.length) return;
  const last = state.history.pop();
  state.availableIds.push(last.playerId);
  const team = getTeam(last.teamId);
  if (last.slotId) {
    const slot = team.slots.find(s => s.id === last.slotId);
    if (slot) slot.playerId = null;
  } else {
    team.players = team.players.filter(id => id !== last.playerId);
  }
  if (state.phase === 'summary') state.phase = 'draft';
  state.selectedSlotId = null;
  save(); render();
}

function novoDraft() {
  if (!confirm('Resetar tudo e voltar para a configuração inicial? Todo o draft atual será apagado.')) return;
  localStorage.removeItem(LS_KEY);
  state = freshState();
  ensureTeams();
  render();
}

/* ---------------- Fase de ajustes (substituições) ---------------- */
function offPositionSlots(team) {
  return team.slots.filter(s => s.playerId && !window.eligByRole(s.role, PLAYERS_BY_ID[s.playerId]));
}
function enterPostDraft() {
  state.subPassed = [];
  state.subRotation = 0;
  state.selectedSlotId = null;
  const anyOff = state.teams.some(t => offPositionSlots(t).length > 0);
  state.phase = anyOff ? 'subs' : 'summary';
}
function subActive() {
  return state.teams.filter(t => offPositionSlots(t).length > 0 && state.subPassed.indexOf(t.id) === -1);
}
function currentSubTeam() {
  const a = subActive();
  return a.length ? a[state.subRotation % a.length] : null;
}
function doSubPick(playerId, slotId) {
  const team = currentSubTeam();
  if (!team || !state.availableIds.includes(playerId)) return;
  if (nationBlocked(team, PLAYERS_BY_ID[playerId])) return;
  const slot = team.slots.find(s => s.id === slotId);
  if (!slot) return;
  if (slot.playerId) state.availableIds.push(slot.playerId); // devolve o antigo ao pool
  slot.playerId = playerId;
  state.availableIds = state.availableIds.filter(id => id !== playerId);
  state.selectedSlotId = null;
  state.subRotation++; // passa a vez (alterna entre os times)
  if (!subActive().length) state.phase = 'summary';
  save(); render();
}
function subPass() {
  const team = currentSubTeam();
  if (team) state.subPassed.push(team.id); // mantém como está; sai da fase
  state.selectedSlotId = null;
  if (!subActive().length) state.phase = 'summary';
  save(); render();
}
function activeTeamId() {
  if (state.phase === 'subs') { const t = currentSubTeam(); return t ? t.id : -1; }
  return currentTeamId();
}

/* ---------------- Cálculos de time ---------------- */
function teamPlayerIds(team) {
  if (state.restrictionMode === 'locked') return team.slots.filter(s => s.playerId).map(s => s.playerId);
  return team.players.slice();
}
function teamAvg(team) {
  const ids = teamPlayerIds(team);
  if (!ids.length) return 0;
  return Math.round(ids.reduce((s, id) => s + PLAYERS_BY_ID[id].overall, 0) / ids.length);
}
// Overall fica oculto durante picks/ajustes se a config pedir; sempre visível no resumo
function ovrVisible() { return state.phase === 'summary' || !state.hideOverall; }
function ovrText(n) { return ovrVisible() ? n : '?'; }
function avgText(team) { return ovrVisible() ? (teamAvg(team) || '—') : '?'; }
// Ordenação do pool: por overall normalmente; alfabética quando o overall está oculto (draft "às cegas")
function poolSort(team, slotRole) {
  const blind = state.hideOverall && state.phase !== 'summary';
  return (a, b) => {
    const ba = nationBlocked(team, a), bb = nationBlocked(team, b);
    if (ba !== bb) return ba ? 1 : -1;
    if (slotRole) { const ea = window.eligByRole(slotRole, a), eb = window.eligByRole(slotRole, b); if (ea !== eb) return ea ? -1 : 1; }
    return blind ? a.nome.localeCompare(b.nome) : b.overall - a.overall;
  };
}
function nationCount(team, selecao) {
  return teamPlayerIds(team).filter(id => PLAYERS_BY_ID[id].selecao === selecao).length;
}
function nationBlocked(team, player) {
  if (!state.maxSameNation) return false;
  return nationCount(team, player.selecao) >= state.maxSameNation;
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  document.getElementById('poolCount').textContent = PLAYERS.length;
  renderSteps();
  const app = document.getElementById('app');
  if (state.phase === 'setup') app.innerHTML = viewSetup();
  else if (state.phase === 'draw') app.innerHTML = viewDraw();
  else if (state.phase === 'draft') app.innerHTML = viewDraft();
  else if (state.phase === 'subs') app.innerHTML = viewSubs();
  else if (state.phase === 'summary') app.innerHTML = viewSummary();
  // refoco no campo de busca, se existir
  const s = document.getElementById('searchInput');
  if (s && (state.phase === 'draft' || state.phase === 'subs')) { s.focus(); s.value = state.search; s.setSelectionRange(s.value.length, s.value.length); }
  // timer do pick
  if (state.phase === 'draft' && state.timerSeconds) ensurePickTimer(); else stopPickTimer();
}

/* ---------------- Timer por pick + auto-pick ---------------- */
let _timerInterval = null, _timerDeadline = 0, _timerPick = -1;
function stopPickTimer() { if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; } }
function ensurePickTimer() {
  const pn = picksMade();
  if (_timerInterval && _timerPick === pn) return; // já rodando para este pick
  stopPickTimer();
  _timerPick = pn;
  _timerDeadline = Date.now() + state.timerSeconds * 1000;
  _timerInterval = setInterval(() => {
    if (state.rolePicker) { _timerDeadline += 250; return; } // pausa com dropdown aberto
    const rem = Math.max(0, Math.ceil((_timerDeadline - Date.now()) / 1000));
    const el = document.getElementById('pickTimer');
    if (el) { el.textContent = rem + 's'; el.classList.toggle('low', rem <= 10); }
    if (rem <= 0) { stopPickTimer(); autoPick(); }
  }, 250);
}
function autoPick() {
  if (state.phase !== 'draft') return;
  const team = getTeam(currentTeamId());
  const empty = team.slots.filter(s => !s.playerId);
  if (!empty.length) return;
  const avail = state.availableIds.map(id => PLAYERS_BY_ID[id])
    .filter(p => !nationBlocked(team, p)).sort((a, b) => b.overall - a.overall);
  if (!avail.length) return;
  // melhor jogador elegível para alguma vaga vazia; senão, melhor disponível na 1ª vaga
  let pick = null;
  for (const slot of empty) {
    const p = avail.find(x => window.eligByRole(slot.role, x));
    if (p && (!pick || p.overall > pick.p.overall)) pick = { slot, p };
  }
  if (!pick) pick = { slot: empty[0], p: avail[0] };
  doPick(pick.p.id, pick.slot.id);
}

function renderSteps() {
  const steps = [['setup', '1 · Configurar'], ['draw', '2 · Sorteio'], ['draft', '3 · Draft'], ['summary', '4 · Resumo']];
  const order = ['setup', 'draw', 'draft', 'summary'];
  const curIdx = state.phase === 'subs' ? 2 : order.indexOf(state.phase);
  document.getElementById('steps').innerHTML = steps.map(([k, label], i) => {
    const cls = i === curIdx ? 'step active' : (i < curIdx ? 'step done' : 'step');
    return `<span class="${cls}">${label}</span>`;
  }).join('');
}

/* ---------------- View: Setup ---------------- */
function viewSetup() {
  const teamCards = state.teams.map((t, i) => `
    <div class="team-config" style="--c:${teamColor(t.id)}">
      <div class="team-config-head">Participante ${i + 1}</div>
      <label>Nome do participante
        <input type="text" data-action="team-field" data-i="${i}" data-field="participant" value="${esc(t.participant)}" placeholder="Ex.: André">
      </label>
    </div>`).join('');

  const maxPicks = Math.floor(PLAYERS.length / state.numTeams);

  return `
  <section class="panel">
    <h1>Configurar o draft</h1>
    <div class="config-row">
      <label class="field">Quantidade de times
        <select data-action="num-teams">
          ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${state.numTeams === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </label>

      <div class="field">Jogadores por time
        <div class="locked-note">11 (slots da formação)</div>
      </div>

      <label class="field">Máx. da mesma seleção / time
        <select data-action="max-nation">
          <option value="0" ${state.maxSameNation === 0 ? 'selected' : ''}>Sem limite</option>
          ${[1,2,3,4,5].map(n => `<option value="${n}" ${state.maxSameNation === n ? 'selected' : ''}>${n} jogador${n > 1 ? 'es' : ''}</option>`).join('')}
        </select>
      </label>

      <label class="field">Tempo por pick
        <select data-action="timer">
          <option value="0" ${state.timerSeconds === 0 ? 'selected' : ''}>Sem timer</option>
          ${[30,45,60,90].map(n => `<option value="${n}" ${state.timerSeconds === n ? 'selected' : ''}>${n}s</option>`).join('')}
        </select>
      </label>

      <label class="field">Overall dos jogadores
        <select data-action="hide-ovr">
          <option value="0" ${!state.hideOverall ? 'selected' : ''}>Visível</option>
          <option value="1" ${state.hideOverall ? 'selected' : ''}>Oculto até o resumo</option>
        </select>
      </label>
    </div>

    <p class="hint">Cada time monta a própria formação no campo (arraste as bolas entre Defesa/Meio/Ataque) e escala 11 jogadores. A posição é uma <b>guia</b>: dá pra escalar qualquer jogador em qualquer vaga — fora de posição aparece um <b style="color:#e63946">!</b> de aviso, sem travar o draft.</p>

    <div class="teams-grid">${teamCards}</div>

    <div class="actions-bar">
      <span id="setupError" class="error"></span>
      <button class="btn primary" data-action="to-draw">Avançar para o sorteio →</button>
    </div>
  </section>`;
}

/* ---------------- View: Draw (sorteio + modelo) ---------------- */
function viewDraw() {
  const sorteado = state.baseOrder.length > 0;
  const orderList = sorteado ? state.baseOrder.map((id, i) => {
    const t = getTeam(id);
    return `<li style="--c:${teamColor(id)}"><span class="pos">${i + 1}º</span> <b>${esc(t.participant || ('Participante ' + id))}</b></li>`;
  }).join('') : '';

  return `
  <section class="panel">
    <h1>Sorteio & modelo de pick</h1>

    <div class="field">Modelo de draft
      <div class="model-cards">
        ${Object.keys(PICK_MODELS).map(k => `
          <button class="model-card ${state.pickModel === k ? 'on' : ''}" data-action="model" data-model="${k}">
            <b>${PICK_MODELS[k].nome}</b><small>${PICK_MODELS[k].desc}</small>
          </button>`).join('')}
      </div>
    </div>

    <div class="draw-area">
      <button class="btn" data-action="sortear">🎲 ${sorteado ? 'Sortear novamente' : 'Sortear ordem'}</button>
      ${sorteado ? `<ol class="order-list">${orderList}</ol>` : '<p class="hint">Clique para sortear a ordem dos picks.</p>'}
    </div>

    <div class="actions-bar">
      <button class="btn ghost" data-action="to-setup">← Voltar</button>
      <button class="btn primary" data-action="start" ${sorteado ? '' : 'disabled'}>Iniciar draft →</button>
    </div>
  </section>`;
}

/* ---------------- View: Draft ---------------- */
function viewDraft() {
  const teamId = currentTeamId();
  const team = getTeam(teamId);
  const total = state.numTeams * state.picksPerTeam;

  const header = `
    <div class="draft-header">
      <div class="turn" style="--c:${teamColor(teamId)}">
        <span class="turn-label">Vez de</span>
        <b>${esc(team.participant || ('Participante ' + teamId))}</b>
      </div>
      <div class="progress">
        Rodada <b>${curRound()}</b>/${state.picksPerTeam} · Pick <b>${picksMade() + 1}</b>/${total}
        <div class="bar"><span style="width:${(picksMade() / total) * 100}%"></span></div>
      </div>
      ${state.timerSeconds ? `<span class="pick-timer" id="pickTimer">${state.timerSeconds}s</span>` : ''}
      <button class="btn ghost small" data-action="undo" ${picksMade() ? '' : 'disabled'}>↶ Desfazer</button>
    </div>`;

  const main = state.restrictionMode === 'locked' ? draftLocked(team) : draftFree();
  const aside = teamsAside();

  return `<section class="draft-wrap">${header}${upcomingStrip()}<div class="draft-body">${main}${aside}</div></section>`;
}

function upcomingStrip() {
  if (state.numTeams < 2) return '';
  const list = upcomingPicks(8);
  if (!list.length) return '';
  let lastRound = list[0].round;
  const chips = list.map((u, i) => {
    const t = getTeam(u.teamId);
    const nome = esc(t.participant || ('P' + u.teamId));
    const sep = i > 0 ? (u.round !== lastRound ? '<span class="up-sep rnd">· R' + u.round + ' ·</span>' : '<span class="up-sep">›</span>') : '';
    lastRound = u.round;
    return `${sep}<span class="up-chip ${u.current ? 'now' : ''}" style="--c:${teamColor(u.teamId)}">${u.current ? '▶ ' : ''}${nome}</span>`;
  }).join('');
  const random = state.pickModel === 'random' ? '<span class="up-more">próximas rodadas sorteadas na hora</span>' : '';
  return `<div class="upcoming"><span class="up-label">Próximos:</span>${chips}${random}</div>`;
}

function poolFilters(extra) {
  return `
    <div class="pool-filters">
      <input type="text" id="searchInput" data-action="search" placeholder="Buscar jogador..." value="${esc(state.search)}">
      <select data-action="filter-pos">
        <option value="">Todas as posições</option>
        ${POS_ORDER.map(p => `<option value="${p}" ${state.filterPos === p ? 'selected' : ''}>${POS_LABELS[p]}</option>`).join('')}
      </select>
      ${extra || ''}
    </div>`;
}

function matchesFilter(p) {
  if (state.filterPos && !p.posicoes.includes(state.filterPos)) return false;
  if (state.search && p.nome.toLowerCase().indexOf(state.search.toLowerCase()) === -1) return false;
  return true;
}

function playerCard(p, opts) {
  opts = opts || {};
  const blocked = opts.blocked;
  const isDisabled = blocked || opts.disabled;
  const cls = (opts.tier === 'fallback' ? ' fallback' : '') + (blocked ? ' blocked' : '') + (isDisabled ? ' disabled' : '');
  const act = isDisabled ? '' : `data-action="${opts.sub ? 'sub-pick' : 'pick'}" data-player="${p.id}"`;
  let tag = '';
  if (blocked) tag = '<span class="tag warn">seleção cheia</span>';
  else if (opts.offPos) tag = '<span class="tag offpos">! fora de posição</span>';
  return `
    <button class="pcard${cls}${opts.offPos ? ' offpos' : ''}" ${act}>
      <span class="ovr${ovrVisible() ? '' : ' ovr-hidden'}">${ovrText(p.overall)}</span>
      <span class="pinfo">
        <b>${flag(p.selecao)} ${esc(p.nome)}</b>
        <small>${posSiglas(p.posicoes)} · ${esc(p.selecao)}</small>
        <small class="club">${esc(p.clube)}</small>
      </span>
      ${tag}
    </button>`;
}

function draftFree() {
  const cur = getTeam(currentTeamId());
  const pool = state.availableIds.map(id => PLAYERS_BY_ID[id]).filter(matchesFilter).sort((a, b) => {
    const ba = nationBlocked(cur, a), bb = nationBlocked(cur, b);
    if (ba !== bb) return ba ? 1 : -1;   // bloqueados por seleção vão pro fim
    return b.overall - a.overall;
  });
  const CAP = 150;
  const shown = pool.slice(0, CAP);
  const extra = pool.length - shown.length;
  return `
    <div class="pool">
      ${poolFilters()}
      <div class="pool-count">${pool.length} disponíveis${nationNote()}${extra > 0 ? ` · mostrando ${CAP}, refine a busca` : ''}</div>
      <div class="pool-grid">${shown.map(p => playerCard(p, { blocked: nationBlocked(cur, p) })).join('') || '<p class="muted">Nenhum jogador encontrado.</p>'}</div>
    </div>`;
}

function nationNote() {
  return state.maxSameNation ? ` · máx ${state.maxSameNation}/seleção` : '';
}

function draftLocked(team) {
  const c = roleCounts(team);
  const filledCount = team.slots.filter(s => s.playerId).length;

  const reqs = [
    { nome: 'Goleiro', n: c.gk, min: 1 },
    { nome: 'Zagueiros', n: c.zag, min: 2 },
    { nome: 'Meio', n: c.mei, min: 2 },
    { nome: 'Ataque', n: c.ata, min: 1 },
  ];
  const reqBar = `<div class="reqs">` +
    reqs.map(r => `<span class="req ${r.n >= r.min ? 'ok' : 'bad'}">${r.nome} <b>${r.n}</b>/${r.min}</span>`).join('') +
    (c.lat ? `<span class="req lat">Laterais ${c.lat}</span>` : '') + `</div>`;

  const bands = `
    <div class="zone z-atk"><span>ATAQUE</span></div>
    <div class="zone z-mid"><span>MEIO</span></div>
    <div class="zone z-def"><span>DEFESA</span></div>`;

  const slotsHtml = team.slots.map(s => {
    const filled = s.playerId ? PLAYERS_BY_ID[s.playerId] : null;
    const cat = window.roleCategory(s.role);
    const sel = state.selectedSlotId === s.id ? ' selected' : '';
    const offPos = filled && !window.eligByRole(s.role, filled);
    const cls = `slot ${filled ? 'filled' : 'empty'} cat-${cat}${s.fixed ? ' fixed' : ' draggable'}${sel}${offPos ? ' offpos' : ''}`;
    const warn = offPos ? `<span class="slot-warn" title="Fora de posição">!</span>` : '';
    const inner = filled
      ? `${warn}<span class="slot-ovr">${ovrText(filled.overall)}</span><span class="slot-name">${flag(filled.selecao)} ${esc(shortName(filled.nome))}</span><span class="slot-role">${window.ROLES[s.role].label}</span>`
      : `<span class="slot-role big">${window.ROLES[s.role].label}</span>`;
    return `<button class="${cls}" data-slot="${s.id}" style="left:${s.x}%;top:${s.y}%">${inner}</button>`;
  }).join('');

  const flashHtml = state._flash ? `<div class="pitch-flash">${esc(state._flash)}</div>` : '';

  let pickerHtml = '';
  if (state.rolePicker) {
    const rp = state.rolePicker;
    const slot = team.slots.find(s => s.id === rp.slotId);
    if (slot) {
      const opts = window.ZONE_ROLES[rp.zone].map(role => {
        const cur = role === rp.origRole ? ' cur' : '';
        return `<button class="rp-opt cat-${window.roleCategory(role)}${cur}" data-action="set-role" data-role="${role}"><b>${window.ROLES[role].label}</b><small>${window.ROLES[role].nome}</small></button>`;
      }).join('');
      const below = slot.y < 38;
      const px = Math.max(16, Math.min(84, slot.x));
      const tf = below ? 'translate(-50%, 30px)' : 'translate(-50%, calc(-100% - 30px))';
      pickerHtml = `
        <div class="rp-overlay" data-action="cancel-picker"></div>
        <div class="role-picker" style="left:${px}%;top:${slot.y}%;transform:${tf}">
          <div class="rp-title">${window.ZONE_LABEL[rp.zone]} · escolha a posição</div>
          ${opts}
          <button class="rp-cancel" data-action="cancel-picker">cancelar</button>
        </div>`;
    }
  }

  const pitch = `
    <div class="pitch-wrap">
      <div class="formation-head">
        <h3>${esc(team.participant || ('Participante ' + team.id))} <span class="formation-label">${formationLabel(team)}</span></h3>
        <select data-action="set-formation" class="formation-select">
          <option value="">Trocar formação…</option>
          ${Object.keys(window.FORMATIONS).map(f => `<option value="${f}">${f}</option>`).join('')}
        </select>
      </div>
      ${reqBar}
      <div class="pitch" id="pitch">
        ${bands}
        ${slotsHtml}
        ${flashHtml}
        ${pickerHtml}
      </div>
      <div class="pitch-meta">Preenchidos ${filledCount}/11 · média ${avgText(team)} · <span class="muted">arraste as bolas para remontar</span></div>
    </div>`;

  let poolHtml;
  if (!state.selectedSlotId) {
    poolHtml = `<div class="pool"><div class="hint big">👈 Clique numa <b>posição vazia</b> para escalar.<br><small>Arraste as bolas entre <b>Defesa · Meio · Ataque</b> (e nas laterais/centro) para mudar a formação ou trocar um jogador de posição.</small></div></div>`;
  } else {
    const slot = team.slots.find(s => s.id === state.selectedSlotId);
    if (!slot || slot.playerId) { state.selectedSlotId = null; return draftLocked(team); }
    const role = window.ROLES[slot.role];
    // mostra TODOS os disponíveis (elegíveis ao papel primeiro); qualquer um pode ser escalado
    const pool = state.availableIds.map(id => PLAYERS_BY_ID[id]).filter(matchesFilter).sort(poolSort(team, slot.role));
    const nElig = pool.filter(p => window.eligByRole(slot.role, p)).length;
    poolHtml = `
      <div class="pool">
        ${poolFilters(`<button class="btn ghost small" data-action="clear-slot">✕ trocar posição</button>`)}
        <div class="pool-count">Escalando: <b>${role.nome}</b> · ${nElig} na posição / ${pool.length} no total${nationNote()}${pool.length > 150 ? ' · mostrando 150' : ''}</div>
        <div class="pool-grid">${pool.slice(0, 150).map(p => playerCard(p, { blocked: nationBlocked(team, p), offPos: !window.eligByRole(slot.role, p) })).join('') || '<p class="muted">Nenhum jogador.</p>'}</div>
      </div>`;
  }

  return `<div class="locked-main">${pitch}${poolHtml}</div>`;
}

function teamsAside() {
  return `
    <aside class="teams-aside">
      <h3>Times</h3>
      ${state.teams.map(t => {
        const ids = teamPlayerIds(t);
        const isCur = t.id === activeTeamId();
        return `
        <div class="team-mini ${isCur ? 'current' : ''}" style="--c:${teamColor(t.id)}">
          <div class="tm-head"><b>${esc(t.participant || ('Participante ' + t.id))}</b><span>${ids.length}${state.restrictionMode === 'locked' ? '/11' : ''} · méd ${avgText(t)}</span></div>
          <div class="tm-players">${ids.map(id => {
            const p = PLAYERS_BY_ID[id];
            return `<span class="chip">${ovrText(p.overall)} ${flag(p.selecao)} ${esc(shortName(p.nome))}</span>`;
          }).join('') || '<span class="muted">—</span>'}</div>
        </div>`;
      }).join('')}
    </aside>`;
}

/* ---------------- View: Ajustes (substituições) ---------------- */
function viewSubs() {
  const team = currentSubTeam();
  if (!team) { state.phase = 'summary'; return viewSummary(); }
  const offSlots = offPositionSlots(team);

  const bands = `
    <div class="zone z-atk"><span>ATAQUE</span></div>
    <div class="zone z-mid"><span>MEIO</span></div>
    <div class="zone z-def"><span>DEFESA</span></div>`;

  const slotsHtml = team.slots.map(s => {
    const filled = s.playerId ? PLAYERS_BY_ID[s.playerId] : null;
    const cat = window.roleCategory(s.role);
    const off = filled && !window.eligByRole(s.role, filled);
    const sel = state.selectedSlotId === s.id ? ' selected' : '';
    const cls = `slot ${filled ? 'filled' : 'empty'} cat-${cat}${off ? ' offpos' : ''}${sel}`;
    const warn = off ? `<span class="slot-warn">!</span>` : '';
    const act = off ? `data-action="sub-select" data-slot="${s.id}"` : '';
    const inner = filled
      ? `${warn}<span class="slot-ovr">${ovrText(filled.overall)}</span><span class="slot-name">${flag(filled.selecao)} ${esc(shortName(filled.nome))}</span><span class="slot-role">${window.ROLES[s.role].label}</span>`
      : `<span class="slot-role big">${window.ROLES[s.role].label}</span>`;
    return `<button class="${cls}" ${act} style="left:${s.x}%;top:${s.y}%">${inner}</button>`;
  }).join('');

  const pitch = `
    <div class="pitch-wrap">
      <div class="formation-head"><h3>${esc(team.participant || ('Participante ' + team.id))} <span class="formation-label">${formationLabel(team)}</span></h3></div>
      <div class="pitch">${bands}${slotsHtml}</div>
      <div class="pitch-meta">${offSlots.length} fora de posição — clique num <b style="color:#e63946">!</b> para substituir.</div>
    </div>`;

  let poolHtml;
  if (!state.selectedSlotId) {
    poolHtml = `<div class="pool"><div class="hint big">👈 Clique numa vaga com <b style="color:#e63946">!</b> para escolher um substituto na posição,<br><small>ou clique em <b>Manter assim</b> se estiver satisfeito com o time.</small></div></div>`;
  } else {
    const slot = team.slots.find(s => s.id === state.selectedSlotId);
    const atual = PLAYERS_BY_ID[slot.playerId];
    const role = window.ROLES[slot.role];
    const pool = state.availableIds.map(id => PLAYERS_BY_ID[id]).filter(matchesFilter).sort(poolSort(team, slot.role));
    poolHtml = `
      <div class="pool">
        ${poolFilters(`<button class="btn ghost small" data-action="sub-clear">✕ cancelar</button>`)}
        <div class="pool-count">Substituir ${atual ? `<b>${flag(atual.selecao)} ${esc(shortName(atual.nome))}</b>` : ''} por <b>${role.nome}</b>${nationNote()}${pool.length > 150 ? ' · mostrando 150' : ''}</div>
        <div class="pool-grid">${pool.slice(0, 150).map(p => playerCard(p, { blocked: nationBlocked(team, p), offPos: !window.eligByRole(slot.role, p), sub: true })).join('') || '<p class="muted">Nenhum jogador.</p>'}</div>
      </div>`;
  }

  const header = `
    <div class="draft-header">
      <div class="turn" style="--c:${teamColor(team.id)}">
        <span class="turn-label">Ajustes · vez de</span>
        <b>${esc(team.participant || ('Participante ' + team.id))}</b>
      </div>
      <div class="progress">Times com jogador <b style="color:#e63946">!</b> fora de posição alternam pra substituir. ${subActive().length} time(s) restante(s).</div>
      <button class="btn primary small" data-action="sub-pass">Manter assim ✓</button>
    </div>`;

  return `<section class="draft-wrap">${header}<div class="draft-body"><div class="locked-main">${pitch}${poolHtml}</div>${teamsAside()}</div></section>`;
}

/* ---------------- View: Summary ---------------- */
function viewSummary() {
  const ROLE_SORT = ['GOL', 'LE', 'ZAG', 'LD', 'MEI', 'PE', 'CA', 'PD'];
  const cards = state.teams.map(t => {
    let sub = '&nbsp;';
    let rows;
    if (state.restrictionMode === 'locked') {
      sub = formationLabel(t);
      rows = t.slots.slice().sort((a, b) => ROLE_SORT.indexOf(a.role) - ROLE_SORT.indexOf(b.role)).map(s => {
        const p = s.playerId ? PLAYERS_BY_ID[s.playerId] : null;
        const off = p && !window.eligByRole(s.role, p);
        return `<tr><td class="pos-cell">${window.ROLES[s.role].label}</td>${p
          ? `<td>${flag(p.selecao)} ${esc(p.nome)}${off ? ' <span class="sum-warn" title="Fora de posição">!</span>' : ''}</td><td class="ovr-cell">${p.overall}</td><td class="muted">${esc(p.clube)}</td><td>${esc(p.selecao)}</td>`
          : `<td colspan="4" class="muted">—</td>`}</tr>`;
      }).join('');
    } else {
      rows = teamPlayerIds(t).map(id => PLAYERS_BY_ID[id]).sort((a, b) => POS_ORDER.indexOf(a.posicaoPrincipal) - POS_ORDER.indexOf(b.posicaoPrincipal))
        .map(p => `<tr><td class="pos-cell">${POS_SIGLA[p.posicaoPrincipal]}</td><td>${esc(p.nome)}</td><td class="ovr-cell">${p.overall}</td><td class="muted">${esc(p.clube)}</td><td>${esc(p.selecao)}</td></tr>`).join('');
    }
    return `
      <div class="summary-card" style="--c:${teamColor(t.id)}">
        <div class="sc-head">
          <div><b>${esc(t.participant || ('Participante ' + t.id))}</b><small>${sub}</small></div>
          <div class="sc-avg"><span>${teamAvg(t)}</span>overall médio</div>
        </div>
        <table class="sc-table"><tbody>${rows}</tbody></table>
      </div>`;
  }).join('');

  return `
  <section class="panel">
    <div class="summary-top">
      <h1>Resumo do draft</h1>
      <div>
        <button class="btn" data-action="export-pdf">⬇ Exportar PDF</button>
        <button class="btn ghost" data-action="novo">Novo draft</button>
      </div>
    </div>
    <div id="summaryPrint">
      <div class="print-title">Draft FC 26 · Copa 2026</div>
      <div class="summary-grid">${cards}</div>
    </div>
  </section>`;
}

/* ---------------- Utilidades ---------------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function shortName(nome) {
  const parts = nome.split(' ');
  if (parts.length === 1) return nome;
  return parts[parts.length - 1].length > 2 ? parts[parts.length - 1] : nome;
}

function exportPDF() {
  const el = document.getElementById('summaryPrint');
  const opt = {
    margin: 8,
    filename: 'draft-fc26-copa2026.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'avoid-all'] },
  };
  window.html2pdf().set(opt).from(el).save();
}

/* ============================================================
   Eventos (delegação)
   ============================================================ */
function setupErrorMsg(msg) {
  const e = document.getElementById('setupError');
  if (e) e.textContent = msg || '';
}

function validateSetup() {
  for (const t of state.teams) {
    if (!t.participant.trim()) return 'Preencha o nome de todos os participantes.';
  }
  if (state.restrictionMode === 'free') {
    const total = state.numTeams * state.picksPerTeam;
    if (state.picksPerTeam < 1) return 'Jogadores por time deve ser ao menos 1.';
    if (total > PLAYERS.length) return `Total de ${total} jogadores excede o pool de ${PLAYERS.length}. Reduza times ou jogadores por time.`;
  }
  return '';
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.getAttribute('data-action');

  if (a === 'to-draw') {
    const err = validateSetup();
    if (err) { setupErrorMsg(err); return; }
    gotoPhase('draw');
  }
  else if (a === 'to-setup') gotoPhase('setup');
  else if (a === 'model') { state.pickModel = el.getAttribute('data-model'); state.roundOrders = {}; save(); render(); }
  else if (a === 'sortear') sortear();
  else if (a === 'start') startDraft();
  else if (a === 'select-slot') { state.selectedSlotId = el.getAttribute('data-slot'); save(); render(); }
  else if (a === 'set-role') setSlotRole(el.getAttribute('data-role'));
  else if (a === 'cancel-picker') cancelRolePicker();
  else if (a === 'clear-slot') { state.selectedSlotId = null; save(); render(); }
  else if (a === 'pick') doPick(el.getAttribute('data-player'), state.selectedSlotId);
  else if (a === 'sub-select') { state.selectedSlotId = el.getAttribute('data-slot'); save(); render(); }
  else if (a === 'sub-clear') { state.selectedSlotId = null; save(); render(); }
  else if (a === 'sub-pick') doSubPick(el.getAttribute('data-player'), state.selectedSlotId);
  else if (a === 'sub-pass') subPass();
  else if (a === 'undo') undo();
  else if (a === 'export-pdf') exportPDF();
  else if (a === 'novo' || a === 'reset-all') novoDraft();
});

document.addEventListener('change', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.getAttribute('data-action');
  if (a === 'num-teams') { state.numTeams = parseInt(el.value, 10); ensureTeams(); save(); render(); }
  else if (a === 'max-nation') { state.maxSameNation = parseInt(el.value, 10) || 0; save(); }
  else if (a === 'timer') { state.timerSeconds = parseInt(el.value, 10) || 0; save(); }
  else if (a === 'hide-ovr') { state.hideOverall = el.value === '1'; save(); render(); }
  else if (a === 'set-formation') { if (el.value) applyFormation(getTeam(currentTeamId()), el.value); }
  else if (a === 'picks') { state.picksPerTeam = parseInt(el.value, 10) || 1; save(); }
  else if (a === 'filter-pos') { state.filterPos = el.value; save(); render(); }
  else if (a === 'team-field') {
    const i = parseInt(el.getAttribute('data-i'), 10);
    state.teams[i][el.getAttribute('data-field')] = el.value;
    save();
  }
});

document.addEventListener('input', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.getAttribute('data-action');
  if (a === 'team-field') {
    const i = parseInt(el.getAttribute('data-i'), 10);
    state.teams[i][el.getAttribute('data-field')] = el.value;
    save();
  } else if (a === 'search') {
    state.search = el.value; save(); render();
  } else if (a === 'picks') {
    state.picksPerTeam = parseInt(el.value, 10) || 1; save();
  }
});

/* ============================================================
   Arrastar bolas no campo (modo travado) — pointer events
   ============================================================ */
let dragState = null;

function findSlotAt(team, x, y, selfId) {
  let best = null, bd = 9; // limiar de proximidade (%)
  team.slots.forEach(s => {
    if (s.id === selfId || s.fixed) return;
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = s; }
  });
  return best;
}

// Soltar a bola sobre outra bola → mover jogador (alvo vazio) ou trocar (alvo cheio)
function handleDropOnSlot(team, src, target) {
  if (!src.playerId && !target.playerId) return; // nada a fazer
  // troca livre (posição é guia; desencaixe vira "!")
  const tmp = src.playerId; src.playerId = target.playerId; target.playerId = tmp;
  save(); render();
}

// Reposicionar a bola → fixa a posição e abre o dropdown de papel da zona
function openRolePicker(team, slot, x, y) {
  const zone = window.zoneFromY(y);
  state.rolePicker = { slotId: slot.id, origRole: slot.role, origX: slot.x, origY: slot.y, zone };
  slot.x = Math.round(Math.max(7, Math.min(93, x)));
  slot.y = Math.round(Math.max(10, Math.min(85, y)));
  render();
}
function setSlotRole(role) {
  const rp = state.rolePicker; if (!rp) return;
  const team = getTeam(currentTeamId());
  const slot = team.slots.find(s => s.id === rp.slotId); if (!slot) return;
  slot.role = role; // qualquer papel é permitido; desencaixe do jogador vira "!"
  team.custom = true; // edição manual → formação vira custom
  state.rolePicker = null;
  save(); render();
}
function cancelRolePicker() {
  const rp = state.rolePicker; if (!rp) return;
  const team = getTeam(currentTeamId());
  const slot = team.slots.find(s => s.id === rp.slotId);
  if (slot) { slot.x = rp.origX; slot.y = rp.origY; }
  state.rolePicker = null;
  render();
}

// Rótulo da formação: nome do preset, ou "D-M-A custom" se editada manualmente
function formationLabel(team) {
  const c = roleCounts(team);
  const shape = `${c.zag + c.lat}-${c.mei}-${c.ata}`;
  return team.custom ? `${shape} custom` : (team.formation || shape);
}

// Aplica uma formação-preset ao time, preservando jogadores já escalados
function applyFormation(team, name) {
  const tpl = window.FORMATIONS[name];
  if (!tpl) return;
  const gk = team.slots.find(s => s.fixed) || { id: 'gk', role: 'GOL', x: 50, y: 93, playerId: null, fixed: true };
  const oldFilled = team.slots.filter(s => !s.fixed && s.playerId).map(s => ({ pid: s.playerId, role: s.role }));
  const newSlots = tpl.map((s, i) => ({ id: 's' + i, role: s.role, x: s.x, y: s.y, playerId: null, fixed: false }));
  const pending = [];
  // 1) encaixa cada jogador num slot de papel elegível e do mesmo papel anterior
  oldFilled.forEach(o => {
    const player = PLAYERS_BY_ID[o.pid];
    const slot = newSlots.find(s => !s.playerId && s.role === o.role && window.eligByRole(s.role, player));
    if (slot) slot.playerId = o.pid; else pending.push(o.pid);
  });
  // 2) qualquer slot elegível
  const still = [];
  pending.forEach(pid => {
    const player = PLAYERS_BY_ID[pid];
    const slot = newSlots.find(s => !s.playerId && window.eligByRole(s.role, player));
    if (slot) slot.playerId = pid; else still.push(pid);
  });
  // 3) sobrou? ocupa de preferência uma vaga da mesma zona, MANTENDO o papel do slot — vira "!"
  still.forEach(pid => {
    const pcat = window.roleCategory(PLAYERS_BY_ID[pid].posicaoPrincipal);
    const slot = newSlots.find(s => !s.playerId && window.roleCategory(s.role) === pcat)
              || newSlots.find(s => !s.playerId);
    if (slot) slot.playerId = pid;
  });
  team.slots = [gk].concat(newSlots);
  team.formation = name;
  team.custom = false; // aplicar preset = forma limpa (desencaixes mostram "!")
  save(); render();
}

document.addEventListener('pointerdown', e => {
  if (state.phase !== 'draft' || state.restrictionMode !== 'locked') return;
  if (state.rolePicker) return; // dropdown aberto: não arrastar
  const slotEl = e.target.closest('.slot');
  if (!slotEl) return;
  const pitch = slotEl.closest('.pitch');
  if (!pitch) return;
  const team = getTeam(currentTeamId());
  const slot = team.slots.find(s => s.id === slotEl.getAttribute('data-slot'));
  if (!slot) return;
  dragState = { slot, slotEl, pitch, team, startX: e.clientX, startY: e.clientY, curX: slot.x, curY: slot.y, moved: false, fixed: slot.fixed };
  try { slotEl.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
});

document.addEventListener('pointermove', e => {
  if (!dragState || dragState.fixed) return;
  const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
  if (!dragState.moved && Math.hypot(dx, dy) < 5) return;
  dragState.moved = true;
  const rect = dragState.pitch.getBoundingClientRect();
  let px = ((e.clientX - rect.left) / rect.width) * 100;
  let py = ((e.clientY - rect.top) / rect.height) * 100;
  px = Math.max(7, Math.min(93, px));
  py = Math.max(10, Math.min(85, py)); // não invade a faixa do goleiro
  dragState.curX = px; dragState.curY = py;
  const el = dragState.slotEl;
  el.style.left = px + '%'; el.style.top = py + '%';
  el.classList.add('dragging');
  const lbl = el.querySelector('.slot-role');
  if (lbl) lbl.textContent = window.ZONE_SHORT[window.zoneFromY(py)];
});

document.addEventListener('pointerup', () => {
  if (!dragState) return;
  const ds = dragState; dragState = null;
  if (!ds.moved) {
    // clique: slot vazio → selecionar para escalar
    if (!ds.slot.playerId) { state.selectedSlotId = ds.slot.id; save(); render(); }
    return;
  }
  const target = findSlotAt(ds.team, ds.curX, ds.curY, ds.slot.id);
  // mover/trocar se houver jogador envolvido; senão reposiciona + abre dropdown de papel
  if (target && (ds.slot.playerId || target.playerId)) handleDropOnSlot(ds.team, ds.slot, target);
  else openRolePicker(ds.team, ds.slot, ds.curX, ds.curY);
});

/* ---------------- Boot ---------------- */
load();
render();
