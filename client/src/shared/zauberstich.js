// Spiellogik für Zauberstich – Stichspiel mit Ansagen. Wird vom Server benutzt (Mischen, Prüfen) und vom Browser (Anzeige).
// 60 Karten: id 0..51 Zahlenkarten (4 Farben x 1–13), 52..55 Zauberhüte (gewinnen immer), 56..59 Nieten (verlieren immer).
export const COLORS = ["Rot", "Blau", "Grün", "Gelb"];
export const isCrown = (id) => id >= 52 && id < 56;
export const isBlank = (id) => id >= 56;
export const isNum = (id) => id < 52;
export const color = (id) => Math.floor(id / 13);
export const num = (id) => (id % 13) + 1;
export const cardName = (id) => (isCrown(id) ? "Zauberhut" : isBlank(id) ? "Niete" : `${COLORS[color(id)]} ${num(id)}`);

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const nextP = (s, i) => (i + 1) % s.names.length;

// Welche Farbe muss bedient werden? null = freie Wahl (noch keine Zahlenkarte, oder ein Zauberhut wurde zuerst gespielt)
export function leadColor(trick) {
  const first = trick.find((t) => !isBlank(t.card));
  return first && isNum(first.card) ? color(first.card) : null;
}

// Zauberhüte und Nieten darf man immer spielen; sonst muss man die angespielte Farbe bedienen, wenn man kann
export function canPlay(hand, trick, card) {
  if (!isNum(card)) return true;
  const led = leadColor(trick);
  return led === null || color(card) === led || !hand.some((id) => isNum(id) && color(id) === led);
}

// Wer gewinnt den Stich? Erster Zauberhut > höchster Trumpf > höchste Karte der angespielten Farbe; nur Nieten: die erste
export function trickWinner(trick, trump) {
  const crown = trick.find((t) => isCrown(t.card));
  if (crown) return crown.p;
  const led = leadColor(trick);
  if (led === null) return trick[0].p;
  const best = (c) => trick.filter((t) => isNum(t.card) && color(t.card) === c).sort((a, b) => num(b.card) - num(a.card))[0];
  return (trump !== null && best(trump)) ? best(trump).p : best(led).p;
}

// Variante "Ansagen dürfen nicht aufgehen": Der Letzte darf nicht so ansagen, dass die Summe genau der Stichzahl entspricht.
// Gibt die verbotene Ansage zurück (oder null, wenn alles erlaubt ist).
export function forbiddenBid(s) {
  if (!s.noEven || s.stage !== "bid" || s.bids.filter((b) => b === null).length !== 1) return null;
  const n = s.round - s.bids.reduce((a, b) => a + (b ?? 0), 0);
  return n >= 0 ? n : null;
}

export const maxRounds = (n) => Math.min(20, Math.floor(60 / n));

function deal(s) {
  const deck = shuffle(Array.from({ length: 60 }, (_, i) => i));
  s.hands = s.names.map(() => deck.splice(0, s.round));
  s.trumpCard = deck.length ? deck[0] : null; // in der letzten Runde bleibt keine Karte übrig: kein Trumpf
  s.trump = s.trumpCard !== null && isNum(s.trumpCard) ? color(s.trumpCard) : null;
  s.bids = s.names.map(() => null); s.tricks = s.names.map(() => 0);
  s.trick = []; s.lastTrick = null; s.winnerOfTrick = null; s.result = null;
  if (s.trumpCard !== null && isCrown(s.trumpCard)) { s.stage = "trump"; s.cur = s.dealer; s.msg = "Zauberhut aufgedeckt – der Geber wählt Trumpf."; }
  else { s.stage = "bid"; s.cur = nextP(s, s.dealer); s.msg = ""; }
}

export function createZauberstich(names, opts = {}) {
  const s = { names, noEven: opts.noEven !== false, round: 1, rounds: maxRounds(names.length), dealer: names.length - 1, scores: names.map(() => 0), history: [], winners: null };
  deal(s);
  return s;
}

// Was Mitspieler sehen dürfen: nur die eigene Hand, von den anderen die Kartenzahl
export function viewZauberstich(s, pi) {
  return { ...s, hands: undefined, hand: s.hands[pi], sizes: s.hands.map((h) => h.length) };
}

// Nach der kurzen Anzeige des vollen Stichs: Stich einsammeln, ggf. Runde werten (vom Server zeitverzögert aufgerufen)
export function collect(st) {
  const s = structuredClone(st);
  if (s.stage !== "show") return s;
  const w = s.winnerOfTrick;
  s.tricks[w]++; s.lastTrick = s.trick; s.trick = []; s.cur = w; s.winnerOfTrick = null;
  if (s.hands.every((h) => !h.length)) {
    const pts = s.names.map((_, i) => (s.bids[i] === s.tricks[i] ? 20 + 10 * s.tricks[i] : -10 * Math.abs(s.bids[i] - s.tricks[i])));
    pts.forEach((p, i) => (s.scores[i] += p));
    s.result = { bids: s.bids, tricks: s.tricks, pts };
    s.history.push(s.result);
    if (s.round >= s.rounds) {
      const top = Math.max(...s.scores);
      s.winners = s.scores.map((x, i) => (x === top ? i : -1)).filter((i) => i >= 0);
      s.stage = "over";
    } else s.stage = "between";
  } else s.stage = "play";
  return s;
}

export function act(st, pi, a) {
  const s = structuredClone(st);
  const err = (error) => ({ error });
  if (a.type === "next") {
    if (s.stage !== "between") return err("Gerade nicht möglich.");
    s.round++; s.dealer = nextP(s, s.dealer); deal(s);
    return { state: s };
  }
  if (s.cur !== pi) return err("Du bist nicht dran.");
  const name = s.names[pi];

  if (a.type === "trump") {
    if (s.stage !== "trump") return err("Gerade nicht möglich.");
    if (![0, 1, 2, 3].includes(a.color)) return err("Ungültige Farbe.");
    s.trump = a.color; s.stage = "bid"; s.cur = nextP(s, s.dealer);
    s.msg = `${name} wählt ${COLORS[a.color]} als Trumpf.`;
    return { state: s };
  }
  if (a.type === "bid") {
    if (s.stage !== "bid") return err("Gerade wird nicht angesagt.");
    if (!Number.isInteger(a.n) || a.n < 0 || a.n > s.round) return err("Ungültige Ansage.");
    if (a.n === forbiddenBid(s)) return err(`Die Ansagen dürfen nicht aufgehen – ${a.n} ist nicht erlaubt.`);
    s.bids[pi] = a.n; s.msg = `${name} sagt ${a.n} an.`;
    s.cur = nextP(s, pi);
    if (s.bids.every((b) => b !== null)) { s.stage = "play"; s.cur = nextP(s, s.dealer); }
    return { state: s };
  }
  if (a.type === "play") {
    if (s.stage !== "play") return err("Gerade wird nicht gespielt.");
    const hand = s.hands[pi];
    if (!hand.includes(a.card)) return err("Ungültige Karte.");
    if (!canPlay(hand, s.trick, a.card)) return err(`Du musst ${COLORS[leadColor(s.trick)]} bedienen.`);
    s.hands[pi] = hand.filter((id) => id !== a.card);
    s.trick.push({ p: pi, card: a.card }); s.msg = "";
    if (s.trick.length === s.names.length) {
      s.winnerOfTrick = trickWinner(s.trick, s.trump); s.stage = "show";
      s.msg = `${s.names[s.winnerOfTrick]} gewinnt den Stich.`;
    } else s.cur = nextP(s, pi);
    return { state: s };
  }
  return err("Unbekannte Aktion.");
}
