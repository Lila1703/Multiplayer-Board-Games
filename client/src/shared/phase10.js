// Spiellogik für Phase 10 – wird vom Server benutzt (Mischen, Prüfen) und vom Browser (Anzeige).
// Karten sind Zahlen 0..107: 0-95 Zahlenkarten (4 Farben x 1-12 x 2), 96-103 Joker, 104-107 Aussetzen.
export const PHASES = [
  [{ k: "set", n: 3 }, { k: "set", n: 3 }], [{ k: "set", n: 3 }, { k: "run", n: 4 }],
  [{ k: "set", n: 4 }, { k: "run", n: 4 }], [{ k: "run", n: 7 }], [{ k: "run", n: 8 }], [{ k: "run", n: 9 }],
  [{ k: "set", n: 4 }, { k: "set", n: 4 }], [{ k: "color", n: 7 }],
  [{ k: "set", n: 5 }, { k: "set", n: 2 }], [{ k: "set", n: 5 }, { k: "set", n: 3 }],
];
export const PHASE_NAMES = [
  "2 Drillinge",
  "Drilling + Viererfolge",
  "Vierling + Viererfolge",
  "Siebenerfolge",
  "Achterfolge",
  "Neunerfolge",
  "2 Vierlinge",
  "7 Karten einer Farbe",
  "Fünfling + Zwilling",
  "Fünfling + Drilling",
];

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

// Welche Handkarten gehören schon zu fertigen Gruppen der Phase? (für die Hervorhebung in der Hand)
// Bei Folgen wird pro Zahl nur eine Karte gewählt; Joker nur, wenn sie wirklich gebraucht werden.
export function doneCards(hand, phase) {
  const reqs = PHASES[phase - 1];
  if (!reqs) return { ids: new Set(), complete: false, groups: [] };
  const nat = hand.filter((id) => info(id).t === "n");
  const wild = hand.filter((id) => info(id).t === "w");
  const candidates = (req, avail) => {
    const A = nat.filter((id) => avail.has(id)), W = wild.filter((id) => avail.has(id)), out = [];
    const add = (ids, missing) => { if (missing <= W.length) out.push([...ids, ...W.slice(0, missing)]); };
    if (req.k === "run") {
      for (let s = 1; s + req.n - 1 <= 12; s++) {
        const ids = [];
        for (let v = s; v < s + req.n; v++) { const f = A.find((id) => info(id).n === v); if (f !== undefined) ids.push(f); }
        if (ids.length) add(ids, req.n - ids.length);
      }
    } else {
      const groups = req.k === "set" ? 12 : 4;
      for (let g = req.k === "set" ? 1 : 0; g < (req.k === "set" ? 13 : groups); g++) {
        const L = A.filter((id) => (req.k === "set" ? info(id).n === g : info(id).c === g));
        if (L.length) add(L.slice(0, req.n), req.n - Math.min(L.length, req.n));
      }
    }
    return out;
  };
  let best = { n: -1, wilds: 0, ids: [], gs: [] };
  const go = (i, avail, count, wilds, ids, gs) => {
    if (i === reqs.length) {
      if (count > best.n || (count === best.n && wilds < best.wilds)) best = { n: count, wilds, ids, gs };
      return;
    }
    for (const g of candidates(reqs[i], avail)) {
      const rest = new Set(avail);
      g.forEach((id) => rest.delete(id));
      go(i + 1, rest, count + 1, wilds + g.filter((id) => info(id).t === "w").length, [...ids, ...g], [...gs, g]);
    }
    go(i + 1, avail, count, wilds, ids, [...gs, null]);
  };
  go(0, new Set(hand), 0, 0, [], []);
  // groups: eine fertige Kartengruppe pro Anforderung der Phase (in derselben Reihenfolge), sonst null
  return { ids: new Set(best.ids), complete: best.n === reqs.length, groups: best.gs };
}

// Was Mitspieler sehen dürfen: nur die eigene Hand, von den anderen nur die Kartenzahl
export function viewP10(s, pi) {
  const reveal = s.stage === "between" || s.stage === "over";
  return { ...s, hands: reveal ? s.hands : undefined, hand: s.hands[pi], sizes: s.hands.map((h) => h.length),
    deck: s.deck.length, discard: s.discard[s.discard.length - 1], discardCount: s.discard.length };
}

// Folge aus diesen Karten: Mit welchen Zahlen kann sie beginnen? Mehrere Möglichkeiten gibt es nur,
// wenn Joker an den Rand gelegt werden (z. B. 5 6 7 + Joker = 4–7 oder 5–8).
export function runStarts(n, ids) {
  const cards = ids.map(info);
  const ns = cards.filter((c) => c.t === "n").map((c) => c.n);
  if (ids.length !== n || cards.some((c) => c.t === "s") || !ns.length || new Set(ns).size !== ns.length) return [];
  const out = [];
  for (let s = Math.max(1, Math.max(...ns) - n + 1); s <= Math.min(Math.min(...ns), 13 - n); s++) out.push(s);
  return out;
}

// Karten einer Folge nach Position sortiert (ab start); Joker stehen an der Stelle der Zahl, die sie ersetzen
export function runOrder(ids, start) {
  const wilds = ids.filter((id) => info(id).t === "w");
  const byNum = new Map(ids.filter((id) => info(id).t === "n").map((id) => [info(id).n, id]));
  return ids.map((_, k) => byNum.get(start + k) ?? wilds.pop());
}

// start (nur Folgen, optional): gewünschte erste Zahl; ohne Angabe liegen Joker möglichst oben
function makeMeld(req, ids, owner, start) {
  const cards = ids.map(info);
  const nat = cards.filter((c) => c.t === "n");
  if (ids.length !== req.n || cards.some((c) => c.t === "s") || nat.length === 0) return null;
  if (req.k === "set") return nat.every((c) => c.n === nat[0].n) ? { owner, kind: "set", num: nat[0].n, cards: ids } : null;
  if (req.k === "color") return nat.every((c) => c.c === nat[0].c) ? { owner, kind: "color", color: nat[0].c, cards: ids } : null;
  const starts = runStarts(req.n, ids);
  if (!starts.length) return null;
  const lo = start === undefined || start === null ? starts[starts.length - 1] : start;
  if (!starts.includes(lo)) return null;
  return { owner, kind: "run", lo, hi: lo + req.n - 1, cards: runOrder(ids, lo) };
}

// Folge: Steht an der Stelle der Zahl dieser Karte ein Joker? Dann darf man ihn austauschen. Gibt den Index zurück (sonst -1).
export function jokerSlot(m, id) {
  const c = info(id);
  if (m.kind !== "run" || c.t !== "n" || c.n < m.lo || c.n > m.hi) return -1;
  return info(m.cards[c.n - m.lo]).t === "w" ? c.n - m.lo : -1;
}

export function canHit(m, id) {
  const c = info(id);
  if (c.t === "s") return false;
  if (m.kind === "set") return c.t === "w" || c.n === m.num;
  if (m.kind === "color") return c.t === "w" || c.c === m.color;
  if (c.t === "w") return m.hi < 12 || m.lo > 1;
  return (c.n === m.hi + 1 && m.hi < 12) || (c.n === m.lo - 1 && m.lo > 1) || jokerSlot(m, id) >= 0;
}

// end (nur Joker an Folgen): "lo" = vorne anlegen, "hi" = hinten anlegen; ohne Angabe hinten, falls möglich
function applyHit(m, id, end) {
  const c = info(id);
  if (m.kind !== "run") { m.cards.push(id); return; }
  const atEnd = c.t === "w" ? m.hi < 12 && (end !== "lo" || m.lo === 1) : c.n === m.hi + 1;
  if (atEnd) { m.hi++; m.cards.push(id); } else { m.lo--; m.cards.unshift(id); }
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
    const melds = g.map((ids, i) => makeMeld(req[i], ids, pi, a.starts?.[i]));
    if (melds.some((m) => !m)) return err("Diese Karten passen nicht zur Phase.");
    s.hands[pi] = hand.filter((id) => !all.includes(id));
    s.melds.push(...melds); s.laid[pi] = true; s.msg = `${s.names[pi]} legt Phase ${s.phases[pi]} ab.`;
    if (!s.hands[pi].length) handEnd(s, pi); // ausgegangen
    else if (!s.scoring && s.laid.every(Boolean)) handEnd(s, null); // ohne Strafpunkte: sofort weiter, sobald alle ihre Phase haben
    return { state: s };
  }
  if (a.type === "hit") {
    if (!s.laid[pi]) return err("Lege zuerst deine Phase ab.");
    const m = s.melds[a.meld];
    if (!m || !has(a.card) || !canHit(m, a.card)) return err("Diese Karte passt dort nicht.");
    const slot = jokerSlot(m, a.card);
    if (slot >= 0) {
      // Joker austauschen: Er wandert auf die Hand des Spielers
      const joker = m.cards[slot];
      m.cards[slot] = a.card;
      s.hands[pi] = hand.filter((id) => id !== a.card).concat(joker);
      s.msg = `${s.names[pi]} tauscht einen Joker aus.`;
      return { state: s };
    }
    applyHit(m, a.card, a.end);
    s.hands[pi] = hand.filter((id) => id !== a.card);
    if (!s.hands[pi].length) handEnd(s, pi); // ausgegangen
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
