// Spiellogik für Phase 10 – wird vom Server benutzt (Mischen, Prüfen) und vom Browser (Anzeige).
// Karten sind Zahlen 0..107: 0-95 Zahlenkarten (4 Farben x 1-12 x 2), 96-103 Joker, 104-107 Aussetzen.
export const PHASES = [
  [{ k: "set", n: 3 }, { k: "set", n: 3 }], [{ k: "set", n: 3 }, { k: "run", n: 4 }],
  [{ k: "set", n: 4 }, { k: "run", n: 4 }], [{ k: "run", n: 7 }], [{ k: "run", n: 8 }], [{ k: "run", n: 9 }],
  [{ k: "set", n: 4 }, { k: "set", n: 4 }], [{ k: "color", n: 7 }],
  [{ k: "set", n: 5 }, { k: "set", n: 2 }], [{ k: "set", n: 5 }, { k: "set", n: 3 }],
];
export const groupLabel = (r) =>
  r.k === "set" ? `${r.n} gleiche Zahlen` : r.k === "run" ? `Folge à ${r.n}` : `${r.n} Karten einer Farbe`;

export const info = (id) =>
  id < 96 ? { t: "n", c: Math.floor(id / 24), n: (id % 12) + 1 } : id < 104 ? { t: "w" } : { t: "s" };
const points = (id) => { const c = info(id); return c.t === "s" ? 15 : c.t === "w" ? 25 : c.n <= 9 ? 5 : 10; };

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

function deal(s) {
  const deck = shuffle(Array.from({ length: 108 }, (_, i) => i));
  s.hands = s.names.map(() => deck.splice(0, 10));
  s.discard = deck.splice(deck.findIndex((id) => info(id).t !== "s"), 1);
  s.deck = deck; s.melds = [];
  s.laid = s.names.map(() => false); s.skipped = s.names.map(() => false);
  s.cur = s.first; s.stage = "draw"; s.msg = ""; s.out = null; s.points = null;
}

// opts.scoring: true = mit Strafpunkten, sonst (Standard) ohne Strafpunkte
export function createPhase10(names, opts = {}) {
  const s = { names, scoring: !!opts.scoring, phases: names.map(() => 1), scores: names.map(() => 0), first: 0, handNo: 1, winner: null };
  deal(s);
  return s;
}

// Was Mitspieler sehen dürfen: nur die eigene Hand, von den anderen nur die Kartenzahl
export function viewP10(s, pi) {
  const reveal = s.stage === "between" || s.stage === "over";
  return { ...s, hands: reveal ? s.hands : undefined, hand: s.hands[pi], sizes: s.hands.map((h) => h.length),
    deck: s.deck.length, discard: s.discard[s.discard.length - 1], discardCount: s.discard.length };
}

function makeMeld(req, ids, owner) {
  const cards = ids.map(info);
  const nat = cards.filter((c) => c.t === "n");
  if (ids.length !== req.n || cards.some((c) => c.t === "s") || nat.length === 0) return null;
  if (req.k === "set") return nat.every((c) => c.n === nat[0].n) ? { owner, kind: "set", num: nat[0].n, cards: ids } : null;
  if (req.k === "color") return nat.every((c) => c.c === nat[0].c) ? { owner, kind: "color", color: nat[0].c, cards: ids } : null;
  const ns = nat.map((c) => c.n);
  if (new Set(ns).size !== ns.length) return null;
  const lo = Math.min(...ns), hi = Math.max(...ns), start = Math.min(lo, 13 - req.n);
  return start + req.n - 1 >= hi ? { owner, kind: "run", lo: start, hi: start + req.n - 1, cards: ids } : null;
}

export function canHit(m, id) {
  const c = info(id);
  if (c.t === "s") return false;
  if (m.kind === "set") return c.t === "w" || c.n === m.num;
  if (m.kind === "color") return c.t === "w" || c.c === m.color;
  return c.t === "w" ? m.hi < 12 || m.lo > 1 : (c.n === m.hi + 1 && m.hi < 12) || (c.n === m.lo - 1 && m.lo > 1);
}

function applyHit(m, id) {
  const c = info(id);
  if (m.kind === "run") {
    if (c.t === "w") { if (m.hi < 12) m.hi++; else m.lo--; } else if (c.n === m.hi + 1) m.hi++; else m.lo--;
  }
  m.cards.push(id);
}

function advance(s) {
  s.cur = (s.cur + 1) % s.names.length;
  while (s.skipped[s.cur]) { s.skipped[s.cur] = false; s.cur = (s.cur + 1) % s.names.length; }
  s.stage = "draw";
}

// out = Spieler, der ausgegangen ist (oder null, wenn die Runde ohne Strafpunkte endet, weil alle ihre Phase geschafft haben)
function handEnd(s, out) {
  s.out = out;
  s.points = s.hands.map((h, i) => (i === out ? 0 : h.reduce((a, id) => a + points(id), 0)));
  s.points.forEach((p, i) => { if (s.scoring) s.scores[i] += p; if (s.laid[i]) s.phases[i]++; });
  const done = s.phases.map((p, i) => (p > 10 ? i : -1)).filter((i) => i >= 0);
  if (done.length) { // Mehrere gleichzeitig fertig: mit Strafpunkten zählt der Punktestand, sonst wer die wenigsten Restpunkte auf der Hand hat (wer ausgegangen ist, hat 0)
    s.winner = done.sort((a, b) => (s.scoring ? s.scores[a] - s.scores[b] : 0) || s.points[a] - s.points[b])[0]; s.stage = "over"; } else s.stage = "between";
}

export function act(st, pi, a) {
  const s = structuredClone(st);
  const err = (error) => ({ error });
  if (a.type === "next") {
    if (s.stage !== "between") return err("Gerade nicht möglich.");
    s.first = (s.first + 1) % s.names.length; s.handNo++; deal(s);
    return { state: s };
  }
  if (s.stage === "between" || s.stage === "over") return err("Die Runde ist vorbei.");
  if (s.cur !== pi) return err("Du bist nicht dran.");
  const hand = s.hands[pi];
  const has = (id) => Number.isInteger(id) && hand.includes(id);
  const needPlay = s.stage !== "play" ? "Zuerst eine Karte ziehen." : null;

  if (a.type === "draw") {
    if (s.stage !== "draw") return err("Du hast schon gezogen.");
    if (a.from === "discard") {
      if (info(s.discard[s.discard.length - 1]).t === "s") return err("Aussetzen-Karten darfst du nicht nehmen.");
      hand.push(s.discard.pop());
    } else {
      if (!s.deck.length && s.discard.length > 1) { const top = s.discard.pop(); s.deck = shuffle(s.discard); s.discard = [top]; }
      if (!s.deck.length) return err("Der Stapel ist leer.");
      hand.push(s.deck.pop());
    }
    s.stage = "play"; s.msg = "";
    return { state: s };
  }
  if (needPlay) return err(needPlay);

  if (a.type === "lay") {
    if (s.laid[pi]) return err("Du hast deine Phase schon abgelegt.");
    const req = PHASES[s.phases[pi] - 1], g = a.groups;
    if (!Array.isArray(g) || g.length !== req.length) return err("Falsche Anzahl Gruppen.");
    const all = g.flat();
    if (new Set(all).size !== all.length || !all.every(has)) return err("Ungültige Karten.");
    const melds = g.map((ids, i) => makeMeld(req[i], ids, pi));
    if (melds.some((m) => !m)) return err("Diese Karten passen nicht zur Phase.");
    s.hands[pi] = hand.filter((id) => !all.includes(id));
    s.melds.push(...melds); s.laid[pi] = true; s.msg = `${s.names[pi]} legt Phase ${s.phases[pi]} ab.`;
    if (!s.hands[pi].length) handEnd(s, pi);
    else if (!s.scoring && s.laid.every(Boolean)) handEnd(s, null); // ohne Strafpunkte: sofort weiter, sobald alle ihre Phase haben
    return { state: s };
  }
  if (a.type === "extra") {
    // Weitere Gruppe nach der eigenen Phase: Gruppen gleicher Zahl (ab 3) oder Folgen (ab 4), je nachdem, was die Phase enthält
    if (!s.laid[pi]) return err("Lege zuerst deine Phase ab.");
    const min = { set: 3, run: 4 }[a.kind], ids = a.ids;
    if (!min || !PHASES[s.phases[pi] - 1].some((r) => r.k === a.kind)) return err("Diese Art Gruppe ist in deiner Phase nicht erlaubt.");
    if (!Array.isArray(ids) || ids.length < min || new Set(ids).size !== ids.length || !ids.every(has)) return err(`Du brauchst mindestens ${min} gültige Karten.`);
    const m = makeMeld({ k: a.kind, n: ids.length }, ids, pi);
    if (!m) return err("Diese Karten bilden keine gültige Gruppe.");
    s.hands[pi] = hand.filter((id) => !ids.includes(id));
    s.melds.push(m); s.msg = `${s.names[pi]} legt eine weitere Gruppe ab.`;
    if (!s.hands[pi].length) handEnd(s, pi);
    return { state: s };
  }
  if (a.type === "hit") {
    if (!s.laid[pi]) return err("Lege zuerst deine Phase ab.");
    const m = s.melds[a.meld];
    if (!m || !has(a.card) || !canHit(m, a.card)) return err("Diese Karte passt dort nicht.");
    applyHit(m, a.card);
    s.hands[pi] = hand.filter((id) => id !== a.card);
    if (!s.hands[pi].length) handEnd(s, pi);
    return { state: s };
  }
  if (a.type === "discard") {
    if (!has(a.card)) return err("Ungültige Karte.");
    if (info(a.card).t === "s") {
      if (!Number.isInteger(a.target) || a.target === pi || !s.names[a.target]) return err("Wähle, wer aussetzen soll.");
      s.skipped[a.target] = true; s.msg = `${s.names[a.target]} muss aussetzen.`;
    }
    s.hands[pi] = hand.filter((id) => id !== a.card);
    s.discard.push(a.card);
    if (!s.hands[pi].length) handEnd(s, pi); else advance(s);
    return { state: s };
  }
  return err("Unbekannte Aktion.");
}
