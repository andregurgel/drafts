// ============================================================
//  Sistema de PAPÉIS por ZONA (modo Travado = formação livre)
//  O campo é dividido em 3 faixas (Ataque / Meio / Defesa).
//  Ao soltar a "bola" numa faixa, um DROPDOWN escolhe o papel
//  específico daquela área. Sem lanes horizontais.
// ============================================================

window.ROLES = {
  GOL: { label: 'GOL', nome: 'Goleiro',         elig: ['GK'] },
  LE:  { label: 'LE',  nome: 'Lateral Esquerdo', elig: ['LB'] },
  LD:  { label: 'LD',  nome: 'Lateral Direito',  elig: ['RB'] },
  ZAG: { label: 'ZAG', nome: 'Zagueiro',         elig: ['CB-R', 'CB-L'] },
  VOL: { label: 'VOL', nome: 'Volante',          elig: ['CDM', 'CM'] },
  MC:  { label: 'MC',  nome: 'Meio-campo',       elig: ['CM', 'CDM', 'CAM'] },
  MEI: { label: 'MEI', nome: 'Meia',             elig: ['CAM', 'CM'] },
  PE:  { label: 'PE',  nome: 'Ponta Esquerda',   elig: ['LW'] },
  PD:  { label: 'PD',  nome: 'Ponta Direita',    elig: ['RW'] },
  CA:  { label: 'CA',  nome: 'Centroavante',     elig: ['ST'] },
};

// Faixas verticais (y: 0 = ataque/topo, 100 = defesa/fundo)
window.ZBANDS = { atkMax: 40, midMax: 62 }; // atk: y<40 | meio: 40-62 | defesa: 62-87 | GK: >87

// Zona a partir de y
window.zoneFromY = function (y) {
  if (y >= window.ZBANDS.midMax) return 'def';
  if (y >= window.ZBANDS.atkMax) return 'mid';
  return 'atk';
};

// Papéis disponíveis em cada zona (opções do dropdown)
window.ZONE_ROLES = { def: ['ZAG', 'LE', 'LD'], mid: ['VOL', 'MC', 'MEI'], atk: ['PE', 'CA', 'PD'] };
window.ZONE_LABEL = { def: 'DEFESA', mid: 'MEIO', atk: 'ATAQUE' };
window.ZONE_SHORT = { def: 'DEF', mid: 'MEIO', atk: 'ATA' };

// Categoria de um papel (para os mínimos)
window.roleCategory = function (role) {
  if (role === 'GOL') return 'gk';
  if (role === 'ZAG') return 'zag';
  if (role === 'LE' || role === 'LD') return 'lat';
  if (role === 'VOL' || role === 'MC' || role === 'MEI') return 'mei';
  return 'ata'; // PE, PD, CA
};

// Mínimos obrigatórios por categoria (GK é fixo = 1)
window.MIN_CAT = { zag: 2, mei: 2, ata: 1 };

// Jogador elegível para um papel?
window.eligByRole = function (role, player) {
  return player.posicoes.some(p => window.ROLES[role].elig.includes(p));
};

// Formações-preset: 10 jogadores de linha (GK à parte). Nome = forma def-meio-ataque.
window.FORMATIONS = {
  '4-3-3': [
    { role: 'LE', x: 16, y: 74 }, { role: 'ZAG', x: 39, y: 77 }, { role: 'ZAG', x: 61, y: 77 }, { role: 'LD', x: 84, y: 74 },
    { role: 'VOL', x: 50, y: 58 }, { role: 'MC', x: 32, y: 47 }, { role: 'MEI', x: 68, y: 47 },
    { role: 'PE', x: 20, y: 25 }, { role: 'CA', x: 50, y: 19 }, { role: 'PD', x: 80, y: 25 },
  ],
  '4-4-2': [
    { role: 'LE', x: 16, y: 74 }, { role: 'ZAG', x: 39, y: 77 }, { role: 'ZAG', x: 61, y: 77 }, { role: 'LD', x: 84, y: 74 },
    { role: 'MEI', x: 16, y: 50 }, { role: 'MC', x: 40, y: 54 }, { role: 'VOL', x: 60, y: 54 }, { role: 'MEI', x: 84, y: 50 },
    { role: 'CA', x: 38, y: 22 }, { role: 'CA', x: 62, y: 22 },
  ],
  '3-5-2': [
    { role: 'ZAG', x: 28, y: 79 }, { role: 'ZAG', x: 50, y: 81 }, { role: 'ZAG', x: 72, y: 79 },
    { role: 'MEI', x: 12, y: 50 }, { role: 'MC', x: 33, y: 53 }, { role: 'VOL', x: 50, y: 62 }, { role: 'MC', x: 67, y: 53 }, { role: 'MEI', x: 88, y: 50 },
    { role: 'CA', x: 38, y: 20 }, { role: 'CA', x: 62, y: 20 },
  ],
  '5-3-2': [
    { role: 'LE', x: 10, y: 66 }, { role: 'ZAG', x: 32, y: 79 }, { role: 'ZAG', x: 50, y: 81 }, { role: 'ZAG', x: 68, y: 79 }, { role: 'LD', x: 90, y: 66 },
    { role: 'MC', x: 32, y: 50 }, { role: 'VOL', x: 50, y: 55 }, { role: 'MEI', x: 68, y: 50 },
    { role: 'CA', x: 38, y: 22 }, { role: 'CA', x: 62, y: 22 },
  ],
  '3-4-3': [
    { role: 'ZAG', x: 28, y: 79 }, { role: 'ZAG', x: 50, y: 81 }, { role: 'ZAG', x: 72, y: 79 },
    { role: 'MEI', x: 14, y: 52 }, { role: 'VOL', x: 40, y: 57 }, { role: 'MC', x: 60, y: 57 }, { role: 'MEI', x: 86, y: 52 },
    { role: 'PE', x: 20, y: 24 }, { role: 'CA', x: 50, y: 18 }, { role: 'PD', x: 80, y: 24 },
  ],
  '4-5-1': [
    { role: 'LE', x: 16, y: 74 }, { role: 'ZAG', x: 39, y: 77 }, { role: 'ZAG', x: 61, y: 77 }, { role: 'LD', x: 84, y: 74 },
    { role: 'MEI', x: 14, y: 50 }, { role: 'MC', x: 33, y: 55 }, { role: 'VOL', x: 50, y: 60 }, { role: 'MC', x: 67, y: 55 }, { role: 'MEI', x: 86, y: 50 },
    { role: 'CA', x: 50, y: 20 },
  ],
};

// Layout inicial = 4-3-3
window.DEFAULT_LAYOUT = window.FORMATIONS['4-3-3'];
