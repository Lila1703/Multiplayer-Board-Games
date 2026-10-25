// Spiellogik für "Mensch ärgere dich nicht" – wird vom Server UND vom Browser benutzt.
export const TRACK = [[4,0],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[1,4],[0,4],[0,5],[0,6],[1,6],[2,6],[3,6],[4,6],
  [4,7],[4,8],[4,9],[4,10],[5,10],[6,10],[6,9],[6,8],[6,7],[6,6],[7,6],[8,6],[9,6],[10,6],[10,5],
  [10,4],[9,4],[8,4],[7,4],[6,4],[6,3],[6,2],[6,1],[6,0],[5,0]];
export const START = [0, 10, 20, 30];
export const LANE = [[[5,1],[5,2],[5,3],[5,4]], [[1,5],[2,5],[3,5],[4,5]], [[5,9],[5,8],[5,7],[5,6]], [[9,5],[8,5],[7,5],[6,5]]];
export const BASE = [[[1,1],[1,2],[2,1],[2,2]], [[1,8],[1,9],[2,8],[2,9]], [[8,8],[8,9],[9,8],[9,9]], [[8,1],[8,2],[9,1],[9,2]]];
export const SEATS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

export const cellOf = (seat, prog, k) =>
  prog < 0 ? BASE[seat][k] : prog < 40 ? TRACK[(START[seat] + prog) % 40] : LANE[seat][prog - 40];
export const pos = (r, c) => ({ left: `${(c * 100) / 11}%`, top: `${(r * 100) / 11}%` });

export const FIELDS = (() => {
  const m = [];
  TRACK.forEach(([r, c], i) => { const p = START.indexOf(i); m.push({ r, c, cls: p >= 0 ? `start p${p}` : "track" }); });
  LANE.forEach((l, p) => l.forEach(([r, c]) => m.push({ r, c, cls: `lane p${p}` })));
  BASE.forEach((b, p) => b.forEach(([r, c]) => m.push({ r, c, cls: `base p${p}` })));
  m.push({ r: 5, c: 5, cls: "center" });
  return m;
})();

export const createGame = (names) => ({
  names, seats: SEATS[names.length], pieces: names.map(() => [-1, -1, -1, -1]),
  cur: 0, die: 1, rollId: 0, phase: "roll", tries: 3, msg: "", winner: null,
});

// Darf Figur k des Spielers i mit der aktuellen Augenzahl ziehen?
export const movable = (s, i, k) => {
  const prog = s.pieces[i][k];
  if (prog < 0) return s.die === 6 && !s.pieces[i].includes(0);
  const np = prog + s.die;
  return np <= 43 && !s.pieces[i].includes(np);
};

export function roll(s) {
  const n = { ...s, die: 1 + Math.floor(Math.random() * 6), rollId: s.rollId + 1, msg: "" };
  if (s.pieces[s.cur].some((_, k) => movable(n, s.cur, k))) return { ...n, phase: "move" };
  return { ...n, phase: "wait", msg: "Kein Zug möglich." };
}

// Nach "Kein Zug möglich": nächster Spieler (oder nochmal würfeln)
export function afterWait(s) {
  const allBase = s.pieces[s.cur].every((q) => q < 0);
  const stay = s.die === 6 || (allBase && s.tries > 1);
  return { ...s, phase: "roll", msg: "", cur: stay ? s.cur : (s.cur + 1) % s.names.length,
    tries: s.die === 6 ? 3 : stay ? s.tries - 1 : 3 };
}

export function move(s, k) {
  const i = s.cur;
  const pcs = s.pieces.map((a) => [...a]);
  const np = pcs[i][k] < 0 ? 0 : pcs[i][k] + s.die;
  pcs[i][k] = np;
  let msg = "";
  if (np < 40) {
    const abs = (START[s.seats[i]] + np) % 40;
    pcs.forEach((a, j) => {
      if (j === i) return;
      a.forEach((q, m) => {
        if (q >= 0 && q < 40 && (START[s.seats[j]] + q) % 40 === abs) { a[m] = -1; msg = `${s.names[i]} wirft ${s.names[j]} raus!`; }
      });
    });
  }
  const won = pcs[i].every((q) => q >= 40);
  const again = s.die === 6 && !won;
  return { ...s, pieces: pcs, phase: "roll", tries: 3, msg,
    cur: won || again ? i : (i + 1) % s.names.length, winner: won ? i : null };
}
