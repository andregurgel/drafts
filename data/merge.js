// Consolida data/squads/*.json -> data/players.json + js/data.js
const fs = require('fs');
const path = require('path');

const VALID = ['GK','RB','LB','CB-R','CB-L','CDM','CM','CAM','RW','LW','ST'];
const MAP = { LM:'LW', RM:'RW', RWB:'RB', LWB:'LB', CF:'ST' }; // normaliza códigos do FC para o nosso esquema

function normPos(arr) {
  const out = [];
  (arr || []).forEach(p => {
    let c = MAP[p] || p;
    if (VALID.includes(c) && !out.includes(c)) out.push(c);
  });
  return out;
}
function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const dir = path.join(__dirname, 'squads');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
let raw = [];
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  raw = raw.concat(arr);
}

const ids = new Set();
const players = [];
const problemas = [];
for (const p of raw) {
  let posicoes = normPos(p.posicoes);
  let principal = MAP[p.posicaoPrincipal] || p.posicaoPrincipal;
  if (!VALID.includes(principal)) principal = posicoes[0];
  if (principal && !posicoes.includes(principal)) posicoes.unshift(principal);
  else if (principal) { posicoes = [principal].concat(posicoes.filter(x => x !== principal)); }
  if (!posicoes.length) { problemas.push('sem posicao: ' + p.nome); continue; }
  principal = posicoes[0];

  let id = slug(p.nome); let n = 1;
  while (ids.has(id)) { n++; id = slug(p.nome) + '-' + n; }
  ids.add(id);

  players.push({
    id, nome: p.nome, overall: p.overall, clube: p.clube,
    selecao: p.selecao, posicaoPrincipal: principal, posicoes,
  });
}

// ordena por seleção, depois overall desc
players.sort((a, b) => a.selecao.localeCompare(b.selecao) || b.overall - a.overall);

fs.writeFileSync(path.join(__dirname, 'players.json'), JSON.stringify(players, null, 1));
fs.writeFileSync(path.join(__dirname, '..', 'js', 'data.js'),
  '// Gerado por data/merge.js a partir de data/squads/*.json\nwindow.PLAYERS = ' + JSON.stringify(players) + ';\n');

// estatísticas
const porSel = {}; const porPos = {};
players.forEach(p => { porSel[p.selecao] = (porSel[p.selecao]||0)+1; porPos[p.posicaoPrincipal] = (porPos[p.posicaoPrincipal]||0)+1; });
console.log('TOTAL jogadores:', players.length);
console.log('Seleções:', Object.keys(porSel).length);
console.log('Por posição principal:', JSON.stringify(porPos));
console.log('Multi-posição:', players.filter(p => p.posicoes.length > 1).length);
console.log('IDs únicos:', ids.size);
if (problemas.length) console.log('PROBLEMAS:', problemas);
console.log('\nPor seleção:');
Object.keys(porSel).sort().forEach(s => process.stdout.write(s + ':' + porSel[s] + '  '));
console.log('');
