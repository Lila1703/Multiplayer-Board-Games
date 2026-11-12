// Spiellogik für Sudoku Battle – wird vom Server benutzt (Rätsel erzeugen, Eingaben prüfen) und vom Browser (Anzeige).
// Alle lösen gleichzeitig dasselbe Sudoku. Ein Gitter ist ein Array mit 81 Feldern (zeilenweise), 0 = leer.
export const LIVES = 3; // so viele Fehler darf man machen, beim letzten ist man raus
export const PENALTY = 10000; // Strafzeit pro Fehler in Millisekunden
export const LEVELS = { leicht: 40, mittel: 32, schwer: 26 }; // vorgegebene Zahlen
export const LEVEL_NAMES = { leicht: "Leicht", mittel: "Mittel", schwer: "Schwer" };

export const row = (i) => Math.floor(i / 9);
export const col = (i) => i % 9;
export const box = (i) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
// Stehen zwei Felder in derselben Zeile, Spalte oder im selben Block?
export const sees = (a, b) => row(a) === row(b) || col(a) === col(b) || box(a) === box(b);

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Zählt die Lösungen von g, höchstens bis limit. Ist limit erreicht, bleibt die zuletzt gefundene Lösung in g stehen.
// digits = Reihenfolge, in der Ziffern probiert werden (gemischt ergibt das ein zufälliges volles Gitter).
function solve(g, limit, digits) {
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) if (g[i]) { const b = 1 << g[i]; rows[row(i)] |= b; cols[col(i)] |= b; boxes[box(i)] |= b; }
  let count = 0;
  const step = () => {
    // Das Feld mit den wenigsten Möglichkeiten zuerst – so bleibt die Suche kurz
    let best = -1, bestUsed = 0, bestN = 10;
    for (let i = 0; i < 81 && bestN > 1; i++) {
      if (g[i]) continue;
      const used = rows[row(i)] | cols[col(i)] | boxes[box(i)];
      let n = 0;
      for (let d = 1; d <= 9; d++) if (!(used & (1 << d))) n++;
      if (n < bestN) { best = i; bestN = n; bestUsed = used; }
    }
    if (best < 0) return ++count >= limit;
    const r = row(best), c = col(best), bx = box(best);
    for (const d of digits) {
      const b = 1 << d;
      if (bestUsed & b) continue;
      g[best] = d; rows[r] |= b; cols[c] |= b; boxes[bx] |= b;
      if (step()) return true;
      g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[bx] &= ~b;
    }
    return false;
  };
  step();
  return count;
}

// Neues Rätsel mit genau einer Lösung: volles Gitter erzeugen, dann Zahlen wegnehmen, solange es eindeutig bleibt.
// Nicht jede zufällige Reihenfolge kommt bis zur gewünschten Zahl an Vorgaben herunter – dann zählt der beste von ein paar Versuchen.
export function generate(level) {
  const target = LEVELS[level] || LEVELS.mittel;
  let bestPuzzle = null, bestSolution = null, bestClues = 82;
  for (let attempt = 0; attempt < 6 && bestClues > target; attempt++) {
    const solution = new Array(81).fill(0);
    solve(solution, 1, shuffle([...DIGITS]));
    const puzzle = [...solution];
    let clues = 81;
    for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k))) {
      if (clues <= target) break;
      const d = puzzle[i];
      puzzle[i] = 0;
      if (solve([...puzzle], 2, DIGITS) === 1) clues--; else puzzle[i] = d;
    }
    if (clues < bestClues) { bestPuzzle = puzzle; bestSolution = solution; bestClues = clues; }
  }
  return { puzzle: bestPuzzle, solution: bestSolution };
}

export function createSudoku(names, opts, now) {
  const level = LEVELS[opts?.difficulty] ? opts.difficulty : "mittel";
  const { puzzle, solution } = generate(level);
  return {
    names, level, puzzle, solution, startedAt: now, endedAt: null, stage: "play", ranking: null,
    // grid = Vorgaben plus richtig eingetragene Zahlen, wrong = rot markierte falsche Zahlen
    players: names.map(() => ({ grid: [...puzzle], wrong: new Array(81).fill(0), lives: LIVES, errors: 0, doneAt: null, outAt: null })),
  };
}

const filled = (s, p) => p.grid.reduce((n, d, i) => n + (d && !s.puzzle[i] ? 1 : 0), 0);
const active = (p) => p.doneAt === null && p.outAt === null;

// Rangliste: zuerst alle, die fertig sind (Zeit inklusive Strafen), dann der Rest nach richtig gefüllten Feldern
function finish(s, now) {
  s.stage = "over"; s.endedAt = now;
  s.ranking = s.players
    .map((p, i) => ({
      i, errors: p.errors, filled: filled(s, p), out: p.outAt !== null,
      time: p.doneAt === null ? null : p.doneAt - s.startedAt + p.errors * PENALTY,
    }))
    .sort((a, b) => (a.time === null) - (b.time === null) || (a.time !== null ? a.time - b.time : b.filled - a.filled || a.errors - b.errors));
}

// Was Mitspieler sehen dürfen: das eigene Gitter, von den anderen nur den Fortschritt – und nie die Lösung
export function viewSudoku(s, pi) {
  const me = s.players[pi];
  return {
    names: s.names, level: s.level, puzzle: s.puzzle, startedAt: s.startedAt, endedAt: s.endedAt, stage: s.stage, ranking: s.ranking,
    now: Date.now(), // Serverzeit, damit die Uhr im Browser auch bei falsch gestellter Geräteuhr stimmt
    total: s.puzzle.filter((d) => !d).length,
    grid: me.grid, wrong: me.wrong,
    players: s.players.map((p) => ({ filled: filled(s, p), lives: p.lives, errors: p.errors, doneAt: p.doneAt, outAt: p.outAt })),
  };
}

// now = Serverzeit der Eingabe. Liefert zusätzlich wrong: true, wenn die eingetragene Zahl falsch war.
export function act(st, pi, a, now) {
  const s = structuredClone(st);
  const err = (error) => ({ error });
  if (s.stage !== "play") return err("Die Partie ist vorbei.");
  if (a.type === "finish") {
    if (pi !== 0) return err("Nur der Host kann die Partie auswerten.");
    finish(s, now);
    return { state: s };
  }
  const p = s.players[pi];
  if (!p || !active(p)) return err("Du spielst nicht mehr mit.");
  const cell = a.cell;
  if (!Number.isInteger(cell) || cell < 0 || cell > 80) return err("Ungültiges Feld.");
  if (p.grid[cell]) return err("Dieses Feld ist schon ausgefüllt.");
  if (a.type === "clear") { p.wrong[cell] = 0; return { state: s }; }
  if (a.type !== "set" || !DIGITS.includes(a.digit)) return err("Unbekannte Aktion.");

  const wrong = a.digit !== s.solution[cell];
  if (wrong) {
    if (p.wrong[cell] === a.digit) return err("Diese Zahl war hier schon falsch.");
    p.wrong[cell] = a.digit; p.lives--; p.errors++;
    if (p.lives <= 0) p.outAt = now;
  } else {
    p.grid[cell] = a.digit; p.wrong[cell] = 0;
    if (p.grid.every(Boolean)) p.doneAt = now;
  }
  if (!s.players.some(active)) finish(s, now);
  return { state: s, wrong };
}
