'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#42a5f5', // J - light blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const highscoresListEl = document.getElementById('highscores-list');
const overlayHighscoresList = document.getElementById('overlay-highscores-list');
const bestComboEverEl = document.getElementById('best-combo-ever');
const maxLinesEverEl = document.getElementById('max-lines-ever');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const overlayStats = document.getElementById('overlay-stats');
const saveScoreSection = document.getElementById('save-score-section');
const playerNameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');

const THEME_KEY = 'tetris-theme';
const HIGHSCORES_KEY = 'tetris-highscores';
const ALLTIME_KEY = 'tetris-alltime';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor, blockHighlightColor;
let combo, maxCombo;

function cacheThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  gridColor = styles.getPropertyValue('--grid-line').trim();
  blockHighlightColor = styles.getPropertyValue('--block-highlight').trim();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  cacheThemeColors();
  if (board) {
    draw();
    drawNext();
  }
}

function toggleTheme() {
  const active = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(active);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = -1;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = blockHighlightColor;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function isValidHighscoreEntry(entry) {
  return entry
    && typeof entry.name === 'string'
    && typeof entry.score === 'number'
    && typeof entry.lines === 'number'
    && typeof entry.level === 'number'
    && typeof entry.date === 'string';
}

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isValidHighscoreEntry) : [];
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable/full — ignore, keep playing without persistence
  }
}

function loadAllTimeBests() {
  try {
    const raw = localStorage.getItem(ALLTIME_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object'
      ? { bestCombo: parsed.bestCombo || 0, maxLines: parsed.maxLines || 0 }
      : { bestCombo: 0, maxLines: 0 };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveAllTimeBests(bests) {
  try {
    localStorage.setItem(ALLTIME_KEY, JSON.stringify(bests));
  } catch {
    // localStorage unavailable/full — ignore, keep playing without persistence
  }
}

function renderAllTimeBests() {
  const bests = loadAllTimeBests();
  bestComboEverEl.textContent = bests.bestCombo;
  maxLinesEverEl.textContent = bests.maxLines;
}

function updateAllTimeBests() {
  const bests = loadAllTimeBests();
  let changed = false;
  if (maxCombo > bests.bestCombo) { bests.bestCombo = maxCombo; changed = true; }
  if (lines > bests.maxLines) { bests.maxLines = lines; changed = true; }
  if (changed) saveAllTimeBests(bests);
  renderAllTimeBests();
}

function renderHighscoreList(listEl, scores, highlightDate) {
  listEl.innerHTML = '';
  if (scores.length === 0) {
    const li = document.createElement('li');
    li.className = 'highscore-empty';
    li.textContent = 'Sin récords aún';
    listEl.appendChild(li);
    return;
  }
  scores.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'highscore-entry';
    if (highlightDate && entry.date === highlightDate) {
      li.classList.add('highscore-highlight');
    }
    const name = document.createElement('span');
    name.className = 'highscore-name';
    name.textContent = entry.name;
    const value = document.createElement('span');
    value.className = 'highscore-value';
    value.textContent = entry.score.toLocaleString();
    li.appendChild(name);
    li.appendChild(value);
    listEl.appendChild(li);
  });
}

function renderHighscoreTables(highlightDate) {
  const scores = loadHighscores();
  renderHighscoreList(highscoresListEl, scores, highlightDate);
  renderHighscoreList(overlayHighscoresList, scores, highlightDate);
}

function qualifiesForHighscores(candidateScore) {
  const scores = loadHighscores();
  if (scores.length < 5) return true;
  return candidateScore > scores[scores.length - 1].score;
}

function saveHighscore(name) {
  const scores = loadHighscores();
  const entry = {
    name: name || 'Jugador',
    score,
    lines,
    level,
    date: new Date().toISOString(),
  };
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  scores.splice(5);
  saveHighscores(scores);
  return entry;
}

function handleSaveScore() {
  const name = playerNameInput.value.trim().slice(0, 12) || 'Jugador';
  const entry = saveHighscore(name);
  saveScoreSection.classList.add('hidden');
  renderHighscoreTables(entry.date);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayStats.textContent = `Líneas: ${lines} · Nivel: ${level} · Combo máx.: ${maxCombo}`;
  updateAllTimeBests();
  if (qualifiesForHighscores(score) && score > 0) {
    saveScoreSection.classList.remove('hidden');
    playerNameInput.value = '';
    renderHighscoreTables(null);
    overlay.classList.remove('hidden');
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    saveScoreSection.classList.add('hidden');
    renderHighscoreTables(null);
    overlay.classList.remove('hidden');
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlayStats.textContent = '';
    saveScoreSection.classList.add('hidden');
    overlayHighscoresList.innerHTML = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = -1;
  maxCombo = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlayStats.textContent = '';
  saveScoreSection.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeToggleBtn.addEventListener('click', toggleTheme);
saveScoreBtn.addEventListener('click', handleSaveScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    e.preventDefault();
    handleSaveScore();
  }
});
resetScoresBtn.addEventListener('click', () => {
  if (confirm('¿Seguro que quieres borrar los récords?')) {
    localStorage.removeItem(HIGHSCORES_KEY);
    localStorage.removeItem(ALLTIME_KEY);
    renderHighscoreTables(null);
    renderAllTimeBests();
  }
});

cacheThemeColors();
themeToggleBtn.textContent = document.documentElement.getAttribute('data-theme') === 'light' ? '☀️' : '🌙';
renderHighscoreTables(null);
renderAllTimeBests();
init();
