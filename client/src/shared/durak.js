// Spiellogik für Durak – wird vom Server benutzt (Mischen, Prüfen) und vom Browser (Anzeige).
// 36 Karten: id 0..35, Farbe = floor(id / 9) (Kreuz, Pik, Herz, Karo), Wert = id % 9 (6, 7, 8, 9, 10, B, D, K, A).
import { SUIT_NAMES, rankName, shuffle } from "./schwimmen.js";

export const HAND = 6; // so viele Karten hat jeder nach dem Geben und nach dem Nachziehen
export const MAX_ATTACK = 6; // höchstens so viele Angriffskarten pro Angriff
export const RANKS = ["6", "7", "8", "9", "10", "B", "D", "K", "A"];
export const suit = (id) => Math.floor(id / 9);
export const rank = (id) => id % 9;
export const cardName = (id) => `${SUIT_NAMES[suit(id)]} ${rankName(RANKS[rank(id)])}`; // „Pik Ass“, nicht „Pik A“

// Schlägt card die Karte target? Höhere Karte derselben Farbe, oder Trumpf auf eine Karte ohne Trumpf.
export const beats = (trump, card, target) =>
  suit(card) === suit(target) ? rank(card) > rank(target) : suit(card) === trump;

const nextActive = (s, i) => { do i = (i + 1) % s.names.length; while (s.done.includes(i)); return i; };
// Angreifer sind die beiden Sitznachbarn des Verteidigers: zuerst der Hauptangreifer, dann der Nachbar auf der anderen Seite.
export function attackers(s) {
  const other = nextActive(s, s.def);
  return other === s.att ? [s.att] : [s.att, other];
}
export const openCards = (s) => s.table.filter((p) => p.d === null).map((p) => p.a); // noch nicht geschlagene Angriffskarten
// Karten auf der Hand eines Spielers (geht mit dem Spielstand des Servers und mit der Ansicht eines Spielers)
const count = (s, i) => (s.counts ? s.counts[i] : s.hands[i].length);

// Darf ein Angreifer diese Karte legen? Die erste Karte ist frei, danach nur Werte, die schon auf dem Tisch liegen.
// Es dürfen nie mehr offene Karten liegen, als der Verteidiger Karten hat, und höchstens MAX_ATTACK Angriffskarten insgesamt.
export function canThrow(s, id) {
  if (!s.table.length) return true;
  if (s.table.length >= MAX_ATTACK || openCards(s).length >= count(s, s.def)) return false;
  return s.table.some((p) => rank(p.a) === rank(id) || (p.d !== null && rank(p.d) === rank(id)));
}

// Schieben: Solange noch nichts geschlagen ist, darf der Verteidiger eine Karte mit demselben Wert dazulegen.
// Dann muss sein nächster Nachbar alles abwehren – sofern der genug Karten dafür hat.
export const shiftTo = (s) => nextActive(s, s.def); // wer nach dem Schieben verteidigen müsste
export function canShift(s, id) {
  if (s.taking || !s.table.length || s.table.some((p) => p.d !== null) || rank(id) !== rank(s.table[0].a)) return false;
  return s.table.length < MAX_ATTACK && s.table.length < count(s, shiftTo(s));
}

export function createDurak(names) {
  const deck = shuffle(Array.from({ length: 36 }, (_, i) => i));
  const trumpCard = deck[0], trump = suit(trumpCard); // liegt offen unter dem Stapel und wird als Letzte gezogen
  const hands = names.map(() => deck.splice(-HAND)); // bei sechs Spielern ist der Stapel damit schon leer
  // Wer den niedrigsten Trumpf hat, greift zuerst an
  let att = -1, low = 99;
  hands.forEach((h, i) => h.forEach((id) => { if (suit(id) === trump && rank(id) < low) { low = rank(id); att = i; } }));
  if (att < 0) att = Math.floor(Math.random() * names.length);
  const s = {
    names, hands, deck, trump, trumpCard,
    att, def: 0, // Hauptangreifer und Verteidiger
    table: [], // Paare { a: Angriffskarte, d: Karte, die sie schlägt (oder null) }
    taking: false, // der Verteidiger hat aufgegeben und nimmt auf
    passed: [], // Angreifer, die nichts mehr dazulegen wollen
    last: null, // der vorige Angriff, damit alle sehen, wie er ausging
    discard: 0, // Zahl der weggelegten Karten
    done: [], // wer seine Karten los ist, in dieser Reihenfolge
    loser: null, stage: "play", msg: "",
  };
  s.def = nextActive(s, att);
  s.msg = `Trumpf ist ${SUIT_NAMES[trump]}. ${names[att]} ${low < 99 ? "hat den niedrigsten Trumpf und " : ""}greift ${names[s.def]} an.`;
  return s;
}

// Was Mitspieler sehen dürfen: die eigene Hand, von den anderen nur die Zahl der Karten
export function viewDurak(s, pi) {
  return { ...s, hands: undefined, hand: s.hands[pi], counts: s.hands.map((h) => h.length), deck: s.deck.length };
}

// Angriff beenden: Karten weglegen oder aufnehmen, nachziehen, die Rollen für den nächsten Angriff verteilen
function endBout(s) {
  const d = s.def, took = s.taking;
  // Nachgezogen wird reihum ab dem Angreifer, der Verteidiger zuletzt (nach dem Schieben können alle Karten gelegt haben)
  const order = s.names.map((_, k) => (s.att + k) % s.names.length).filter((i) => i !== d && !s.done.includes(i));
  order.push(d);
  const cards = s.table.flatMap((p) => (p.d === null ? [p.a] : [p.a, p.d]));
  if (took) s.hands[d].push(...cards); else s.discard += cards.length;
  s.last = { table: s.table, took, def: d };
  s.table = []; s.taking = false; s.passed = [];
  s.msg = took ? `${s.names[d]} nimmt ${cards.length} ${cards.length === 1 ? "Karte" : "Karten"} auf.` : `${s.names[d]} hat alles abgewehrt – die Karten kommen weg.`;
  for (const i of order) while (s.hands[i].length < HAND && s.deck.length) s.hands[i].push(s.deck.pop());
  // Wer jetzt keine Karten mehr hat (der Stapel ist dann leer), ist fertig
  const out = order.filter((i) => !s.hands[i].length);
  s.done.push(...out);
  if (out.length) s.msg += ` ${out.map((i) => s.names[i]).join(" und ")} ${out.length === 1 ? "ist" : "sind"} fertig.`;

  const left = s.names.map((_, i) => i).filter((i) => !s.done.includes(i));
  if (left.length <= 1) {
    s.loser = left.length ? left[0] : null; // null: die letzten beiden wurden gleichzeitig fertig
    s.stage = "over";
    s.msg += s.loser === null ? " Unentschieden – niemand ist der Durak." : ` ${s.names[s.loser]} ist der Durak!`;
    return;
  }
  // Nach einer Abwehr greift der Verteidiger an; wer aufgenommen hat, wird übersprungen
  s.att = took || s.done.includes(d) ? nextActive(s, d) : d;
  s.def = nextActive(s, s.att);
  s.msg += ` ${s.names[s.att]} greift ${s.names[s.def]} an.`;
}

// Der Angriff endet, sobald der Verteidiger alles geschlagen hat (oder aufnimmt) und kein Angreifer mehr etwas dazulegen will oder kann
function settle(s) {
  if (!s.table.length) return;
  if (openCards(s).length && !s.taking) return; // erst muss der Verteidiger schlagen oder aufnehmen
  if (attackers(s).some((i) => !s.passed.includes(i) && s.hands[i].some((id) => canThrow(s, id)))) return;
  endBout(s);
}

export function act(st, pi, a) {
  const s = structuredClone(st);
  const err = (error) => ({ error });
  if (s.stage !== "play") return err("Die Partie ist vorbei.");
  const hand = s.hands[pi], name = s.names[pi], def = s.names[s.def];
  const isAttacker = attackers(s).includes(pi);
  const h = hand.indexOf(a.card);

  if (a.type === "attack") {
    if (!isAttacker) return err(pi === s.def ? "Du wirst angegriffen." : "Du greifst gerade nicht an.");
    if (h < 0) return err("Diese Karte hast du nicht.");
    if (!s.table.length && pi !== s.att) return err(`${s.names[s.att]} legt die erste Karte.`);
    if (!canThrow(s, a.card)) {
      return err(s.table.length >= MAX_ATTACK ? `Mehr als ${MAX_ATTACK} Angriffskarten gehen nicht.`
        : openCards(s).length >= s.hands[s.def].length ? `${def} hat nicht genug Karten für noch einen Angriff.`
          : "Nur Werte, die schon auf dem Tisch liegen.");
    }
    hand.splice(h, 1);
    s.msg = s.table.length ? `${name} legt ${cardName(a.card)} dazu.` : `${name} greift ${def} mit ${cardName(a.card)} an.`;
    s.table.push({ a: a.card, d: null });
    s.last = null; s.passed = [];
  } else if (a.type === "defend") {
    if (pi !== s.def) return err("Du wirst gerade nicht angegriffen.");
    if (s.taking) return err("Du nimmst schon auf.");
    if (h < 0) return err("Diese Karte hast du nicht.");
    const pair = s.table.find((p) => p.a === a.target && p.d === null);
    if (!pair) return err("Diese Karte liegt nicht offen auf dem Tisch.");
    if (!beats(s.trump, a.card, pair.a)) return err(`${cardName(a.card)} schlägt ${cardName(pair.a)} nicht.`);
    hand.splice(h, 1);
    pair.d = a.card;
    s.msg = `${name} schlägt ${cardName(pair.a)} mit ${cardName(a.card)}.`;
    s.passed = []; // mit der neuen Karte liegt vielleicht ein neuer Wert auf dem Tisch
  } else if (a.type === "shift") {
    if (pi !== s.def) return err("Du wirst gerade nicht angegriffen.");
    if (s.taking) return err("Du nimmst schon auf.");
    if (h < 0) return err("Diese Karte hast du nicht.");
    const next = shiftTo(s);
    if (!canShift(s, a.card)) {
      return err(!s.table.length ? "Es gibt nichts zu schieben."
        : s.table.some((p) => p.d !== null) ? "Schieben geht nur, solange noch nichts geschlagen ist."
          : rank(a.card) !== rank(s.table[0].a) ? `Zum Schieben brauchst du eine Karte mit dem Wert ${rankName(RANKS[rank(s.table[0].a)])}.`
            : s.table.length >= MAX_ATTACK ? `Mehr als ${MAX_ATTACK} Angriffskarten gehen nicht.`
              : `${s.names[next]} hat nicht genug Karten, um das abzuwehren.`);
    }
    hand.splice(h, 1);
    s.table.push({ a: a.card, d: null });
    s.att = pi; s.def = next; s.passed = []; // wer schiebt, greift jetzt selbst an
    s.msg = `${name} schiebt mit ${cardName(a.card)} weiter: Jetzt wird ${s.names[next]} angegriffen.`;
  } else if (a.type === "take") {
    if (pi !== s.def) return err("Du wirst gerade nicht angegriffen.");
    if (s.taking || !openCards(s).length) return err("Es gibt nichts aufzunehmen.");
    s.taking = true; s.passed = [];
    s.msg = `${name} nimmt auf. Die Angreifer dürfen noch Karten dazulegen.`;
  } else if (a.type === "done") {
    if (!isAttacker) return err("Du greifst gerade nicht an.");
    if (!s.table.length || (openCards(s).length && !s.taking)) return err(`Erst ist ${def} dran.`);
    if (!s.passed.includes(pi)) s.passed.push(pi);
    s.msg = `${name} legt nichts mehr dazu.`;
  } else return err("Unbekannte Aktion.");

  settle(s);
  return { state: s };
}
