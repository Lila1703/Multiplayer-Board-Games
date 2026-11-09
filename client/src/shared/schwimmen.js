// Spiellogik für Schwimmen (31) – wird vom Server benutzt (Mischen, Prüfen) und vom Browser (Anzeige).
// Skatblatt mit 32 Karten: id 0..31, Farbe = floor(id / 8) (Kreuz, Pik, Herz, Karo), Wert = id % 8 (7, 8, 9, 10, B, D, K, A).
export const SUITS = ["♣", "♠", "♥", "♦"];
export const SUIT_NAMES = ["Kreuz", "Pik", "Herz", "Karo"];
export const RANKS = ["7", "8", "9", "10", "B", "D", "K", "A"];
export const LIVES = 3; // danach schwimmt man (lives = 0), beim nächsten Verlust ist man raus (lives = -1)

export const suit = (id) => Math.floor(id / 8);
export const rank = (id) => id % 8;
const value = (id) => (rank(id) === 7 ? 11 : rank(id) >= 3 ? 10 : rank(id) + 7);
export const cardName = (id) => `${SUIT_NAMES[suit(id)]} ${RANKS[rank(id)]}`;

// Punkte einer Hand: höchste Summe einer Farbe; drei gleiche Werte = 30,5; drei Asse ("Feuer") = 33
export function score(hand) {
  if (hand.every((id) => rank(id) === rank(hand[0]))) return rank(hand[0]) === 7 ? 33 : 30.5;
  return Math.max(...[0, 1, 2, 3].map((c) => hand.filter((id) => suit(id) === c).reduce((a, id) => a + value(id), 0)));
}
// Liegen 7, 8 und 9 in der Mitte (Farbe egal), darf man sie gegen drei neue Karten tauschen lassen
export const canRenew = (middle) => [...middle].map(rank).sort().join() === "0,1,2";
export const fmt = (p) => String(p).replace(".", ",");

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const alive = (s) => s.lives.map((l, i) => (l >= 0 ? i : -1)).filter((i) => i >= 0);
const nextAlive = (s, i) => { do i = (i + 1) % s.names.length; while (s.lives[i] < 0); return i; };

function draw3(s) {
  if (s.deck.length < 3) { s.deck = shuffle([...s.deck, ...s.used]); s.used = []; }
  return s.deck.splice(0, 3);
}

function deal(s) {
  s.deck = shuffle(Array.from({ length: 32 }, (_, i) => i));
  s.used = [];
  s.hands = s.names.map((_, i) => (s.lives[i] >= 0 ? s.deck.splice(0, 3) : []));
  s.middle = s.deck.splice(0, 3);
  s.cur = nextAlive(s, s.dealer);
  s.closer = null; s.passes = 0; s.stage = "play"; s.result = null;
  s.msg = `${s.names[s.dealer]} hat gegeben.`;
  // Wer schon beim Geben 31 oder Feuer hat, deckt sofort auf
  const lucky = alive(s).find((i) => score(s.hands[i]) >= 31);
  if (lucky !== undefined) endRound(s, lucky);
}

export function createSchwimmen(names) {
  const s = { names, lives: names.map(() => LIVES), dealer: names.length - 1, roundNo: 1, winner: null };
  deal(s);
  return s;
}

// Runde auswerten. instant = Spieler, der mit 31 / Feuer sofort aufgedeckt hat (sonst null)
function endRound(s, instant = null) {
  const players = alive(s);
  const pts = s.names.map((_, i) => (s.lives[i] >= 0 ? score(s.hands[i]) : null));
  const feuer = instant !== null && pts[instant] === 33;
  const low = Math.min(...players.map((i) => pts[i]));
  // Feuer: alle anderen verlieren ein Leben; sonst verliert, wer am wenigsten hat (bei Gleichstand alle)
  let losers = feuer ? players.filter((i) => i !== instant) : players.filter((i) => pts[i] === low);
  // Würden alle Übrigen gleichzeitig untergehen, geht keiner unter – dann wird nochmal gespielt
  const sinking = losers.filter((i) => s.lives[i] === 0);
  const rescued = sinking.length > 0 && sinking.length === players.length;
  if (rescued) losers = [];
  const before = [...s.lives];
  losers.forEach((i) => s.lives[i]--);
  s.result = { pts, losers, instant, feuer, rescued, before, closer: s.closer };
  const left = alive(s);
  if (left.length === 1) { s.winner = left[0]; s.stage = "over"; } else s.stage = "between";
}

// Was Mitspieler sehen dürfen: während der Runde nur die eigene Hand
export function viewSchwimmen(s, pi) {
  const reveal = s.stage !== "play";
  return { ...s, hands: reveal ? s.hands : undefined, hand: s.hands[pi], deck: s.deck.length, used: undefined };
}

export function act(st, pi, a) {
  const s = structuredClone(st);
  const err = (error) => ({ error });
  if (a.type === "next") {
    if (s.stage !== "between") return err("Gerade nicht möglich.");
    s.dealer = nextAlive(s, s.dealer); s.roundNo++; deal(s);
    return { state: s };
  }
  if (s.stage !== "play") return err("Die Runde ist vorbei.");
  if (s.cur !== pi) return err("Du bist nicht dran.");
  const hand = s.hands[pi], name = s.names[pi];

  if (a.type === "renew") {
    if (!canRenew(s.middle)) return err("Nur wenn 7, 8 und 9 in der Mitte liegen.");
    s.used.push(...s.middle); s.middle = draw3(s);
    s.msg = `${name} lässt die 7, 8, 9 weglegen – drei neue Karten in der Mitte.`;
    return { state: s }; // kein Zug verbraucht: man ist mit den neuen Karten weiter dran
  }
  if (a.type === "swap") {
    const h = hand.indexOf(a.hand), m = s.middle.indexOf(a.middle);
    if (h < 0 || m < 0) return err("Ungültige Karten.");
    hand[h] = a.middle; s.middle[m] = a.hand; s.passes = 0;
    s.msg = `${name} tauscht ${cardName(a.hand)} gegen ${cardName(a.middle)}.`;
  } else if (a.type === "swapAll") {
    [s.hands[pi], s.middle] = [s.middle, hand]; s.passes = 0;
    s.msg = `${name} tauscht alle drei Karten.`;
  } else if (a.type === "pass") {
    s.passes++;
    s.msg = `${name} schiebt.`;
    // Haben alle hintereinander geschoben, kommen drei neue Karten in die Mitte
    if (s.passes >= alive(s).length - (s.closer !== null ? 1 : 0)) {
      s.used.push(...s.middle); s.middle = draw3(s); s.passes = 0;
      s.msg += " Alle haben geschoben – neue Karten in der Mitte.";
    }
  } else if (a.type === "close") {
    if (s.closer !== null) return err("Es hat schon jemand zugemacht.");
    s.closer = pi;
    s.msg = `${name} macht zu! Jeder ist noch einmal dran.`;
  } else return err("Unbekannte Aktion.");

  if (score(s.hands[pi]) >= 31) { endRound(s, pi); return { state: s }; } // 31 oder Feuer: sofort aufdecken
  s.cur = nextAlive(s, pi);
  if (s.cur === s.closer) endRound(s);
  return { state: s };
}
