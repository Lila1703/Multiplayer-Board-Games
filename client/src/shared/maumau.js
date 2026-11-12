// Spiellogik für Mau-Mau – wird vom Server benutzt (Mischen, Prüfen) und vom Browser (Anzeige).
// Skatblatt wie bei Schwimmen: id 0..31, Farbe = floor(id / 8), Wert = id % 8 (7, 8, 9, 10, B, D, K, A).
import { SUIT_NAMES, suit, rank, cardName, shuffle } from "./schwimmen.js";

export const HAND = 5; // Karten pro Spieler beim Geben
const SEVEN = 0, EIGHT = 1, JACK = 4;
export const isJack = (id) => rank(id) === JACK;

// Darf diese Karte jetzt gelegt werden? s braucht nur top, wish und pending (geht also auch mit der Ansicht eines Spielers).
export function playable(s, id) {
  if (s.pending) return rank(id) === SEVEN; // offene Sieben: nur eine weitere Sieben hilft
  if (isJack(id)) return !isJack(s.top); // Bube passt auf alles, nur nicht auf einen Buben
  if (s.wish !== null) return suit(id) === s.wish;
  return suit(id) === suit(s.top) || rank(id) === rank(s.top);
}

const nextActive = (s, i) => { do i = (i + 1) % s.names.length; while (s.done.includes(i)); return i; };

// Zieht bis zu n Karten. Ist der Stapel leer, wird der Ablagestapel (ohne die oberste Karte) neu gemischt.
function take(s, n) {
  const got = [];
  while (got.length < n) {
    if (!s.deck.length) {
      if (!s.used.length) break; // wirklich nichts mehr da
      s.deck = shuffle(s.used); s.used = [];
    }
    got.push(s.deck.pop());
  }
  return got;
}

export function createMauMau(names) {
  const deck = shuffle(Array.from({ length: 32 }, (_, i) => i));
  const hands = names.map(() => deck.splice(0, HAND));
  const cur = Math.floor(Math.random() * names.length);
  return {
    names, hands, deck, used: [], top: deck.pop(), // die erste offene Karte hat keine Sonderwirkung
    wish: null, // gewünschte Farbe nach einem Buben
    pending: 0, // Karten, die der Spieler am Zug wegen einer Sieben ziehen muss
    cur, drew: false, drawn: null, // drew: hat in diesem Zug schon gezogen, drawn: die gezogene Karte
    done: [], // wer fertig ist, in der Reihenfolge der Plätze
    loser: null, stage: "play", msg: `${names[cur]} fängt an.`,
  };
}

// Was Mitspieler sehen dürfen: die eigene Hand, von den anderen nur die Zahl der Karten
export function viewMauMau(s, pi) {
  return { ...s, hands: undefined, hand: s.hands[pi], counts: s.hands.map((h) => h.length), deck: s.deck.length, used: undefined,
    drawn: s.cur === pi ? s.drawn : null };
}

export function act(st, pi, a) {
  const s = structuredClone(st);
  const err = (error) => ({ error });
  if (s.stage !== "play") return err("Die Partie ist vorbei.");
  if (s.cur !== pi) return err("Du bist nicht dran.");
  const hand = s.hands[pi], name = s.names[pi];
  const pass = () => { s.cur = nextActive(s, pi); s.drew = false; s.drawn = null; };

  if (a.type === "draw") {
    if (s.drew) return err("Du hast schon gezogen.");
    if (s.pending) {
      // Strafkarten einer Sieben: ziehen und der Nächste ist dran
      const got = take(s, s.pending);
      hand.push(...got); s.pending = 0;
      s.msg = `${name} zieht ${got.length} Karten.`;
      pass();
      return { state: s };
    }
    const got = take(s, 1);
    hand.push(...got);
    if (got.length && hand.some((id) => playable(s, id))) {
      s.drew = true; s.drawn = got[0];
      s.msg = `${name} zieht eine Karte.`;
    } else {
      s.msg = got.length ? `${name} zieht eine Karte und kann nicht legen.` : `${name} kann nicht legen, und es gibt keine Karten mehr zum Ziehen.`;
      pass();
    }
    return { state: s };
  }
  if (a.type === "pass") {
    if (!s.drew) return err("Erst eine Karte legen oder ziehen.");
    s.msg = `${name} legt nichts.`;
    pass();
    return { state: s };
  }
  if (a.type !== "play") return err("Unbekannte Aktion.");

  const id = a.card, h = hand.indexOf(id);
  if (h < 0) return err("Diese Karte hast du nicht.");
  if (!playable(s, id)) return err(s.pending ? "Du musst ziehen oder eine 7 legen." : "Diese Karte passt nicht.");
  const jack = isJack(id);
  if (jack && ![0, 1, 2, 3].includes(a.wish)) return err("Wünsch dir eine Farbe.");
  hand.splice(h, 1);
  s.used.push(s.top); s.top = id;
  s.wish = jack ? a.wish : null;
  if (rank(id) === SEVEN) s.pending += 2;
  s.msg = `${name} legt ${cardName(id)}`;

  if (!hand.length) {
    s.done.push(pi);
    s.msg += ` und ist fertig (Platz ${s.done.length})!`;
    const left = s.names.map((_, i) => i).filter((i) => !s.done.includes(i));
    if (left.length === 1) { s.loser = left[0]; s.stage = "over"; s.drew = false; s.drawn = null; return { state: s }; }
  } else s.msg += hand.length === 1 ? " – Mau!" : ".";
  if (jack) s.msg += ` Gewünscht ist ${SUIT_NAMES[a.wish]}.`;

  pass();
  if (rank(id) === EIGHT) {
    s.msg += ` ${s.names[s.cur]} setzt aus.`;
    s.cur = nextActive(s, s.cur);
  } else if (s.pending) s.msg += ` ${s.names[s.cur]} muss ${s.pending} Karten ziehen oder eine 7 legen.`;
  return { state: s };
}
