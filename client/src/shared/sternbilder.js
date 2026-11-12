// Spiellogik für Sternbilder – kooperatives Kartenspiel: Man sieht alle Karten außer den eigenen.
// Gemeinsam baut ihr fünf Sternbilder (je eine Farbe) von 1 bis 5 auf. Wird vom Server (Prüfen, Mischen) und vom Browser (Anzeige) benutzt.
// 50 Karten: id 0..49, Farbe = floor(id / 10), pro Farbe: 3× 1, 2× 2, 2× 3, 2× 4, 1× 5.
export const COLORS = ["Rot", "Blau", "Grün", "Gelb", "Weiß"];
const NUMS = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];
export const color = (id) => Math.floor(id / 10);
export const num = (id) => NUMS[id % 10];
export const copies = (n) => NUMS.filter((x) => x === n).length;
export const cardName = (id) => `${COLORS[color(id)]} ${num(id)}`;
export const MAX_HINTS = 8, MAX_CLOUDS = 3;
export const handSize = (n) => (n <= 3 ? 5 : 4);
export const score = (s) => s.piles.reduce((a, b) => a + b, 0);

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
// Eine Handkarte:
//   u    = fortlaufende Zieh-Nummer. Verrät nichts über die Karte und bleibt beim Umsortieren gleich (fester Name der Karte).
//   c, n, notC, notN = was der Besitzer aus Hinweisen über sie weiß.
//   hot  = frischer Hinweis seit dem letzten eigenen Zug des Besitzers (1 = Farbe, 2 = Zahl, 3 = beides).
const fresh = (id, u) => ({ id, u, c: null, n: null, notC: [], notN: [], hot: 0 });

// opts.memory = Gedächtnis-Modus: Hinweise bleiben nur sichtbar, bis der Empfänger das nächste Mal am Zug war
export function createSternbilder(names, opts = {}) {
  const deck = shuffle(Array.from({ length: 50 }, (_, i) => i));
  const hs = handSize(names.length);
  let uid = 0;
  const hands = names.map(() => deck.splice(0, hs).map((id) => fresh(id, uid++)));
  return {
    names, memory: !!opts.memory, deck, hands, uid,
    picks: names.map(() => null), // pro Spieler die Zieh-Nummer der Karte, die er gerade ausgewählt hat – sehen alle, zum Zeigen
    piles: COLORS.map(() => 0), discard: [], hints: MAX_HINTS, clouds: 0,
    cur: 0, finalLeft: null, stage: "play", end: null, turn: 1, log: [], last: null,
  };
}

// Jeder sieht alle Hände außer der eigenen – von der eigenen nur, was er aus Hinweisen weiß.
// Im Gedächtnis-Modus schickt der Server nur die frischen Hinweise und nur die letzte Runde vom Verlauf: Den Rest muss man sich merken.
export function viewSternbilder(s, pi) {
  const over = s.stage === "over";
  const forget = s.memory && !over;
  const mask = (k, own) => ({
    ...k,
    id: own && !over ? null : k.id,
    ...(forget ? { c: k.hot & 1 ? k.c : null, n: k.hot & 2 ? k.n : null, notC: [], notN: [] } : null),
  });
  return {
    ...s, deck: undefined, deckCount: s.deck.length,
    hands: s.hands.map((h, i) => h.map((k) => mask(k, i === pi || pi < 0))), // pi = -1: der Fernseher sieht keine Karte
    log: forget ? s.log.slice(0, s.names.length) : s.log,
  };
}

// Würde ein Hinweis (Farbe oder Zahl) mindestens eine Karte treffen?
export const hintHits = (hand, h) => hand.map((k, i) => ((h.color !== undefined ? color(k.id) === h.color : num(k.id) === h.num) ? i : -1)).filter((i) => i >= 0);

function endTurn(s, pi) {
  s.hands[pi].forEach((k) => (k.hot = 0)); // wer am Zug war, hat seine frischen Hinweise gesehen
  if (s.piles.every((p) => p === 5)) { s.stage = "over"; s.end = "perfect"; return; }
  if (s.finalLeft !== null && --s.finalLeft === 0) { s.stage = "over"; s.end = "deck"; return; }
  s.cur = (s.cur + 1) % s.names.length; s.turn++;
}
function draw(s, pi) {
  if (!s.deck.length) return;
  s.hands[pi].unshift(fresh(s.deck.shift(), s.uid++)); // neue Karte kommt links dazu
  if (!s.deck.length) s.finalLeft = s.names.length + 1; // jeder (auch wer gerade zog) hat noch genau einen Zug
}
const log = (s, t) => { s.log.unshift(t); s.log.length = Math.min(s.log.length, 30); };

export function act(st, pi, a) {
  const s = structuredClone(st);
  const err = (error) => ({ error });
  if (s.stage !== "play") return err("Das Spiel ist vorbei.");

  // Eigene Karten umsortieren geht jederzeit, auch wenn man nicht dran ist. order = alle eigenen Zieh-Nummern in neuer Reihenfolge.
  if (a.type === "sort") {
    const hand = s.hands[pi];
    if (!hand || !Array.isArray(a.order) || a.order.length !== hand.length || new Set(a.order).size !== hand.length) return err("Ungültige Reihenfolge.");
    const next = a.order.map((u) => hand.find((k) => k.u === u));
    if (next.some((k) => !k)) return err("Ungültige Reihenfolge.");
    s.hands[pi] = next;
    return { state: s };
  }

  // Eine eigene Karte auswählen (u) oder die Auswahl aufheben (null) – auch jederzeit. Die Mitspieler sehen, welche gemeint ist.
  if (a.type === "pick") {
    const hand = s.hands[pi];
    if (!hand || (a.u !== null && !hand.some((k) => k.u === a.u))) return err("Ungültige Karte.");
    s.picks[pi] = a.u;
    return { state: s };
  }

  if (s.cur !== pi) return err("Du bist nicht dran.");
  const name = s.names[pi];

  if (a.type === "hint") {
    if (s.hints === 0) return err("Keine Hinweise mehr übrig – spiel oder wirf eine Karte ab.");
    const to = a.to;
    if (!Number.isInteger(to) || to < 0 || to >= s.names.length || to === pi) return err("Ungültiger Mitspieler.");
    const h = Number.isInteger(a.color) && a.color >= 0 && a.color < 5 ? { color: a.color }
      : Number.isInteger(a.num) && a.num >= 1 && a.num <= 5 ? { num: a.num } : null;
    if (!h) return err("Ungültiger Hinweis.");
    const hits = hintHits(s.hands[to], h);
    if (!hits.length) return err("Ein Hinweis muss mindestens eine Karte treffen.");
    s.hands[to].forEach((k, i) => {
      const hit = hits.includes(i);
      if (h.color !== undefined) { if (hit) { k.c = h.color; k.hot |= 1; } else if (!k.notC.includes(h.color)) k.notC.push(h.color); }
      else if (hit) { k.n = h.num; k.hot |= 2; } else if (!k.notN.includes(h.num)) k.notN.push(h.num);
    });
    s.hints--;
    const what = h.color !== undefined ? COLORS[h.color] : `${h.num}er`;
    s.last = { type: "hint", by: pi, to };
    log(s, `${name} → ${s.names[to]}: ${hits.length === 1 ? "diese Karte ist" : `diese ${hits.length} Karten sind`} ${what}.`);
    endTurn(s, pi);
    return { state: s };
  }

  if (a.type === "play" || a.type === "discard") {
    const hand = s.hands[pi];
    const slot = hand.findIndex((k) => k.u === a.u); // Karte über ihre Zieh-Nummer, nicht über den Platz – der kann sich durchs Sortieren ändern
    if (slot < 0) return err("Ungültige Karte.");
    if (a.type === "discard" && s.hints === MAX_HINTS) return err("Alle Hinweise sind noch da – Abwerfen geht erst, wenn einer verbraucht ist.");
    const [k] = hand.splice(slot, 1);
    if (s.picks[pi] === k.u) s.picks[pi] = null;
    const c = color(k.id), n = num(k.id);
    if (a.type === "discard") {
      s.discard.push(k.id); s.hints++;
      s.last = { type: "discard", by: pi, card: k.id };
      log(s, `${name} wirft ${cardName(k.id)} ab und bekommt einen Hinweis zurück.`);
    } else if (s.piles[c] === n - 1) {
      s.piles[c] = n;
      const bonus = n === 5 && s.hints < MAX_HINTS;
      if (bonus) s.hints++;
      s.last = { type: "play", by: pi, card: k.id, ok: true };
      log(s, `${name} legt ${cardName(k.id)} an.${n === 5 ? ` Sternbild ${COLORS[c]} ist komplett!${bonus ? " (+1 Hinweis)" : ""}` : ""}`);
    } else {
      s.discard.push(k.id); s.clouds++;
      s.last = { type: "play", by: pi, card: k.id, ok: false };
      log(s, `${name} spielt ${cardName(k.id)} – passt nicht! Eine Wolke zieht auf (${s.clouds}/${MAX_CLOUDS}).`);
      if (s.clouds >= MAX_CLOUDS) { s.stage = "over"; s.end = "clouds"; return { state: s }; }
    }
    draw(s, pi);
    endTurn(s, pi);
    return { state: s };
  }
  return err("Unbekannte Aktion.");
}

// Punkte am Ende: bei drei Wolken ist der Himmel verdeckt – 0 Punkte
export const finalScore = (s) => (s.end === "clouds" ? 0 : score(s));
export function rating(p) {
  if (p === 25) return "Perfekt – der ganze Himmel leuchtet!";
  if (p >= 21) return "Großartig – die Sterne werden noch lange von euch erzählen.";
  if (p >= 16) return "Sehr gut – ein prächtiger Sternenhimmel.";
  if (p >= 11) return "Ordentlich – da geht noch mehr.";
  if (p >= 6) return "Ein paar Sterne funkeln schon.";
  return "Die Nacht bleibt ziemlich dunkel.";
}
