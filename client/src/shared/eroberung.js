// Spiellogik für das Eroberungsspiel – rein und ohne Browser, damit sie später auch der Server benutzen kann.
// Gebiete werden über ihre Nummer (Index in TERRITORIES) angesprochen. Besitzer: Spielernummer, NEUTRAL = neutrale Armeen (nur zu zweit).
import { TERRITORIES, REGIONS } from "./eroberungMap.js";
import { shuffle } from "./schwimmen.js";

export { TERRITORIES, REGIONS };
export const NEUTRAL = -1;
export const COLORS = ["Rot", "Blau", "Grün", "Gelb", "Lila", "Orange"];
export const SYMBOLS = ["Fußvolk", "Reiter", "Kanone"]; // Kartensymbole; Joker = 3
export const JOKER = 3;
const N = TERRITORIES.length;
const IDX = Object.fromEntries(TERRITORIES.map((t, i) => [t.id, i]));
export const ADJ = TERRITORIES.map((t) => t.adj.map((id) => IDX[id]));
export const REGION_OF = TERRITORIES.map((t) => t.region);
export const REGION_MEMBERS = Object.fromEntries(Object.keys(REGIONS).map((r) => [r, TERRITORIES.map((t, i) => (t.region === r ? i : -1)).filter((i) => i >= 0)]));
// Startarmeen je Spielerzahl (die Karte hat mehr Gebiete als üblich, daher etwas mehr als gewohnt)
export const START_ARMIES = { 2: 45, 3: 40, 4: 35, 5: 30, 6: 25 };
export const STEP = 3; // so viele Startarmeen setzt man pro Runde
// Balance: Die folgenden Zahlen stammen aus Tausenden simulierten Partien mit einfachen Computer-Spielern.
// Extra-Startarmeen nach Sitzplatz (0 = Startspieler): Bei wenigen Spielern hat der Startspieler einen Vorteil,
// bei vielen der Letzte (er setzt seine Startarmeen zuletzt und sieht, wo alle anderen stehen).
export const SEAT_BONUS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 2, 2], 5: [1, 1, 1, 1, 0], 6: [1, 2, 1, 0, 1, 0] };
const NEUTRAL_EXTRA = 1; // zusätzliche Armee auf jedem neutralen Gebiet
// Missionen (49 Gebiete). Ausgewählt wurden die Regionspaare, die etwa so oft gelingen wie der Durchschnitt.
export const MISSION_COUNT = 31; // „so viele Gebiete besitzen“
export const MISSION_COUNT2 = 16; // „so viele Gebiete mit je mind. 2 Armeen“
const REGION_MISSIONS = [ // "+" = und dazu eine dritte Region nach Wahl
  ["nordamerika", "europa"], ["asien", "ozeanien"], ["nordamerika", "afrika", "+"], ["nordamerika", "ozeanien", "+"],
  ["mittelmeer", "suedamerika"], ["arktis", "afrika", "+"], ["europa", "ozeanien", "+"], ["arktis", "asien"],
];

export const isAdj = (a, b) => ADJ[a].includes(b);
export const territoriesOf = (s, p) => s.owner.reduce((n, o) => n + (o === p), 0);
export const ownsRegion = (s, p, r) => REGION_MEMBERS[r].every((i) => s.owner[i] === p);
export const regionsOf = (s, p) => Object.keys(REGIONS).filter((r) => ownsRegion(s, p, r));

// Verstärkung zu Beginn des Zuges: Gebiete / 3 (mind. 3) plus Boni für ganze Regionen
export function reinforcements(s, p) {
  return Math.max(3, Math.floor(territoriesOf(s, p) / 3)) + regionsOf(s, p).reduce((n, r) => n + REGIONS[r].bonus, 0);
}
// Wert des nächsten Karten-Sets: 4, 6, 8, 10, 12, 15, danach je 5 mehr
export const setValue = (k) => (k < 5 ? 4 + 2 * k : 15 + 5 * (k - 5));
const sym = (c) => (c >= N ? JOKER : c % 3); // Karten 0..N-1 zeigen das Gebiet c, N und N+1 sind Joker
export const cardSymbol = sym;
export const cardTerritory = (c) => (c < N ? c : null);
export function isSet(cards) {
  if (cards.length !== 3) return false;
  const s = cards.map(sym), jokers = s.filter((x) => x === JOKER).length, rest = [...new Set(s.filter((x) => x !== JOKER))];
  return jokers >= 1 || rest.length === 1 || rest.length === 3;
}
// Bestes Set in einer Hand: möglichst ohne Joker und mit einem eigenen Gebiet auf einer Karte (+2)
export function bestSet(s, p) {
  const h = s.cards[p];
  let best = null, score = -Infinity;
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) for (let k = j + 1; k < h.length; k++) {
    const set = [h[i], h[j], h[k]];
    if (!isSet(set)) continue;
    const sc = (set.some((c) => c < N && s.owner[c] === p) ? 2 : 0) - set.filter((c) => c >= N).length;
    if (sc > score) { score = sc; best = set; }
  }
  return best;
}

export const alive = (s) => s.names.map((_, i) => i).filter((i) => s.alive[i]);
const nextPlayer = (s, i) => { do i = (i + 1) % s.names.length; while (!s.alive[i]); return i; };

// Missionen verteilen: Gebietsziele für alle, Regionspaare, und „Spieler X ausschalten“ ab drei Spielern
function dealMissions(names) {
  const n = names.length;
  const pool = [
    ...REGION_MISSIONS.map(([a, b, extra]) => ({ type: "regions", regions: [a, b], extra: extra === "+" })),
    { type: "count", n: MISSION_COUNT, min: 1 },
    { type: "count", n: MISSION_COUNT2, min: 2 },
  ];
  if (n >= 3) for (let t = 0; t < n; t++) pool.push({ type: "kill", target: t });
  for (let tries = 0; ; tries++) {
    const deck = shuffle([...pool]);
    const got = names.map(() => deck.pop());
    if (got.every((m, i) => m.type !== "kill" || m.target !== i) || tries > 50) return got.map((m, i) => (m.type === "kill" && m.target === i ? { type: "count", n: MISSION_COUNT, min: 1 } : m));
  }
}

export function missionText(m, names) {
  const R = (r) => REGIONS[r].name;
  if (m.type === "regions") return `Erobere ${R(m.regions[0])} und ${R(m.regions[1])}${m.extra ? " und dazu eine dritte Region deiner Wahl" : ""}.`;
  if (m.type === "count") return m.min > 1 ? `Besetze ${m.n} Gebiete mit jeweils mindestens ${m.min} Armeen.` : `Besetze ${m.n} Gebiete.`;
  return `Schalte ${names[m.target]} (${COLORS[m.target]}) aus. Schafft das jemand anders, musst du stattdessen ${MISSION_COUNT} Gebiete besetzen.`;
}

// Ist die Mission von Spieler p gerade erfüllt?
export function missionDone(s, p) {
  const m = s.missions[p];
  if (m.type === "regions") {
    if (!m.regions.every((r) => ownsRegion(s, p, r))) return false;
    return !m.extra || regionsOf(s, p).length >= 3;
  }
  if (m.type === "count") return s.owner.filter((o, i) => o === p && s.armies[i] >= m.min).length >= m.n;
  return !s.alive[m.target] && s.killedBy[m.target] === p;
}

export function createEroberung(names) {
  const n = names.length;
  const owners = [...names.keys()];
  if (n === 2) owners.push(NEUTRAL); // zu zweit bekommen neutrale Armeen einen Teil der Welt
  const first = Math.floor(Math.random() * n);
  const order = shuffle([...Array(N).keys()]);
  const owner = Array(N).fill(0), armies = Array(N).fill(1);
  // reihum verteilen, beim Startspieler beginnend
  const rot = [...owners.slice(owners.indexOf(first)), ...owners.slice(0, owners.indexOf(first))];
  order.forEach((t, k) => { owner[t] = rot[k % rot.length]; });
  owner.forEach((o, t) => { if (o === NEUTRAL) armies[t] += NEUTRAL_EXTRA; });
  const s = {
    names, owner, armies, alive: names.map(() => true), killedBy: names.map(() => null),
    cur: first, first, phase: "setup",
    // noch zu setzende Startarmeen; zu zweit und zu dritt gleichen Extra-Armeen den Vorteil des Startspielers aus
    setupLeft: names.map((_, i) => START_ARMIES[n] - owner.filter((o) => o === i).length + (SEAT_BONUS[n]?.[(i - first + n) % n] || 0)),
    step: 0, // in diesem Schritt schon gesetzt
    pool: 0, // Armeen, die gerade eingesetzt werden müssen
    back: null, // nach dem Einsetzen zurück zum Angriff (nach Pflichttausch mitten im Zug)
    cards: names.map(() => []), deck: shuffle([...Array(N + 2).keys()]), used: [], trades: 0,
    conquered: false, occupy: null, roll: null, rollId: 0,
    missions: dealMissions(names),
    winner: null, how: null, msg: `${names[first]} beginnt mit dem Einsetzen.`, turn: 0,
  };
  return s;
}

// Beginn eines normalen Zuges
function startTurn(s, p) {
  s.cur = p; s.phase = "reinforce"; s.conquered = false; s.occupy = null; s.back = null; s.turn++;
  s.pool = reinforcements(s, p);
  const bonus = regionsOf(s, p);
  s.msg = `${s.names[p]} bekommt ${s.pool} Armeen${bonus.length ? ` (mit Bonus für ${bonus.map((r) => REGIONS[r].name).join(", ")})` : ""}.`;
}

function checkWin(s, p) {
  const others = alive(s).filter((i) => i !== p);
  if (!others.length) { s.winner = p; s.how = "all"; }
  else if (missionDone(s, p)) { s.winner = p; s.how = "mission"; }
  if (s.winner !== null) { s.phase = "over"; s.msg = `${s.names[p]} gewinnt!`; return true; }
  return false;
}

// Alle eigenen Gebiete, die von from aus über eigene Gebiete erreichbar sind
export function reachable(s, from) {
  const p = s.owner[from], seen = new Set([from]), q = [from];
  while (q.length) for (const b of ADJ[q.pop()]) if (!seen.has(b) && s.owner[b] === p) { seen.add(b); q.push(b); }
  seen.delete(from);
  return seen;
}

const rollDice = (k) => Array.from({ length: k }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);

export function act(st, pi, a) {
  const s = structuredClone(st);
  const err = (error) => ({ error });
  if (s.phase === "over") return err("Die Partie ist vorbei.");
  if (pi !== s.cur) return err("Du bist nicht dran.");
  const name = s.names[pi];
  const mine = (t) => Number.isInteger(t) && t >= 0 && t < N && s.owner[t] === pi;

  // --- Startarmeen einsetzen ---
  if (s.phase === "setup") {
    if (a.type !== "place" && a.type !== "autoplace") return err("Erst die Startarmeen einsetzen.");
    const want = Math.min(STEP - s.step, s.setupLeft[pi]);
    if (a.type === "place") {
      if (!mine(a.t)) return err("Setz deine Armeen in eigene Gebiete.");
      const k = Math.max(1, Math.min(want, a.n || 1));
      s.armies[a.t] += k; s.setupLeft[pi] -= k; s.step += k;
      s.msg = `${name} setzt ${k === 1 ? "eine Armee" : `${k} Armeen`} nach ${TERRITORIES[a.t].name}.`;
    } else {
      // Alle restlichen Startarmeen zufällig verteilen
      const own = s.owner.map((o, i) => (o === pi ? i : -1)).filter((i) => i >= 0);
      for (let k = s.setupLeft[pi]; k > 0; k--) s.armies[own[Math.floor(Math.random() * own.length)]]++;
      s.msg = `${name} verteilt die restlichen ${s.setupLeft[pi]} Startarmeen zufällig.`;
      s.setupLeft[pi] = 0;
    }
    if (s.setupLeft[pi] > 0 && s.step < STEP) return { state: s };
    s.step = 0;
    if (s.setupLeft.every((x) => x === 0)) {
      startTurn(s, s.first); // wer zuerst eingesetzt hat, beginnt auch den ersten Zug
      s.msg = "Alle Armeen stehen. " + s.msg;
      return { state: s };
    }
    let nx = pi;
    do nx = (nx + 1) % s.names.length; while (s.setupLeft[nx] === 0);
    s.cur = nx;
    return { state: s };
  }

  // --- Karten tauschen (beim Verstärken oder als Pflicht nach dem Ausschalten eines Spielers) ---
  if (a.type === "trade") {
    if (s.phase !== "reinforce") return err("Karten tauscht man beim Verstärken.");
    const set = a.cards || bestSet(s, pi);
    const hand = s.cards[pi];
    if (!set || !isSet(set) || !set.every((c) => hand.includes(c)) || new Set(set).size !== 3) return err("Das ist kein gültiges Set.");
    const v = setValue(s.trades++);
    s.cards[pi] = hand.filter((c) => !set.includes(c));
    s.used.push(...set);
    s.pool += v;
    // +2 direkt auf ein eigenes Gebiet, das auf einer der Karten abgebildet ist
    const bonusT = set.find((c) => c < N && s.owner[c] === pi);
    if (bonusT !== undefined) s.armies[bonusT] += 2;
    s.msg = `${name} tauscht ein Set gegen ${v} Armeen${bonusT !== undefined ? ` (und 2 extra nach ${TERRITORIES[bonusT].name})` : ""}.`;
    checkWin(s, pi);
    return { state: s };
  }

  // --- Verstärken ---
  if (s.phase === "reinforce") {
    if (a.type === "place") {
      if (s.cards[pi].length >= 5) return err("Mit 5 oder mehr Karten musst du zuerst ein Set eintauschen.");
      if (!s.pool) return err("Du hast keine Armeen mehr zum Einsetzen.");
      if (!mine(a.t)) return err("Setz deine Armeen in eigene Gebiete.");
      const k = Math.max(1, Math.min(s.pool, a.n || 1));
      s.armies[a.t] += k; s.pool -= k;
      s.msg = `${name} setzt ${k === 1 ? "eine Armee" : `${k} Armeen`} nach ${TERRITORIES[a.t].name}.`;
      if (checkWin(s, pi)) return { state: s };
      if (!s.pool && !bestSet(s, pi)) s.phase = "attack";
      return { state: s };
    }
    if (a.type === "toAttack") {
      if (s.pool) return err("Setz erst alle Armeen ein.");
      if (s.cards[pi].length >= 5) return err("Mit 5 oder mehr Karten musst du zuerst ein Set eintauschen.");
      s.phase = "attack";
      return { state: s };
    }
    return err("Setz erst deine Armeen ein.");
  }

  // --- Nach einer Eroberung: Armeen nachziehen ---
  if (s.phase === "occupy") {
    if (a.type !== "occupy") return err("Erst Armeen in das eroberte Gebiet ziehen.");
    // a.n = zusätzliche Armeen (die gewürfelte Zahl ist schon eingezogen)
    const { from, to, moved } = s.occupy;
    const k = Math.max(0, Math.min(s.armies[from] - 1, Math.floor(a.n) || 0));
    s.armies[from] -= k; s.armies[to] += k;
    s.occupy = null; s.phase = "attack";
    const all = moved + k;
    s.msg = `${name} zieht ${all} ${all === 1 ? "Armee" : "Armeen"} nach ${TERRITORIES[to].name}.`;
    if (checkWin(s, pi)) return { state: s };
    // Wer durch das Ausschalten auf 5 Karten kommt, muss sofort tauschen und die Armeen einsetzen
    if (s.cards[pi].length >= 5) { s.phase = "reinforce"; s.back = "attack"; s.msg += " Du hast jetzt 5 oder mehr Karten und musst tauschen."; }
    return { state: s };
  }

  // --- Angreifen ---
  if (s.phase === "attack") {
    if (a.type === "attack") {
      const { from, to } = a;
      if (!mine(from)) return err("Greif aus einem eigenen Gebiet an.");
      if (s.armies[from] < 2) return err("Zum Angreifen braucht das Gebiet mindestens 2 Armeen.");
      if (!Number.isInteger(to) || s.owner[to] === pi || !isAdj(from, to)) return err("Du kannst nur ein fremdes Nachbargebiet angreifen.");
      const def = s.owner[to];
      let lossA = 0, lossD = 0, dice;
      do {
        dice = Math.max(1, Math.min(3, a.dice || 3, s.armies[from] - 1));
        const ra = rollDice(dice), rd = rollDice(Math.min(2, s.armies[to]));
        let la = 0, ld = 0;
        for (let k = 0; k < Math.min(ra.length, rd.length); k++) (ra[k] > rd[k] ? ld++ : la++);
        s.armies[from] -= la; s.armies[to] -= ld; lossA += la; lossD += ld;
        s.roll = { att: ra, def: rd, from, to, lossA: la, lossD: ld, defOwner: def };
        s.rollId++;
      } while (a.blitz && s.armies[to] > 0 && s.armies[from] > 1);
      const who = def === NEUTRAL ? "die Neutralen" : s.names[def];
      s.msg = `${name} greift ${TERRITORIES[to].name} an: ${name} verliert ${lossA}, ${who} ${lossD}.`;
      if (s.armies[to] > 0) return { state: s };
      // erobert
      s.owner[to] = pi; s.conquered = true;
      s.msg = `${name} erobert ${TERRITORIES[to].name}!`;
      if (def !== NEUTRAL && !s.owner.includes(def)) {
        s.alive[def] = false; s.killedBy[def] = pi;
        s.cards[pi].push(...s.cards[def]); s.cards[def] = [];
        s.msg += ` ${s.names[def]} ist ausgeschaltet.`;
        // Wer einen anderen als Ziel hatte, muss jetzt Gebiete sammeln
        s.missions.forEach((m, i) => { if (m.type === "kill" && m.target === def && i !== pi) s.missions[i] = { type: "count", n: MISSION_COUNT, min: 1, from: def }; });
      }
      // So viele Armeen ziehen sofort ein, wie zuletzt gewürfelt wurde; weitere darf man danach nachziehen
      const min = Math.min(dice, s.armies[from] - 1);
      s.armies[from] -= min; s.armies[to] += min;
      if (checkWin(s, pi)) return { state: s };
      if (s.armies[from] > 1) { s.phase = "occupy"; s.occupy = { from, to, moved: min }; }
      else if (s.cards[pi].length >= 5) { s.phase = "reinforce"; s.back = "attack"; }
      return { state: s };
    }
    if (a.type === "endAttack") { s.phase = "fortify"; s.msg = `${name} greift nicht mehr an.`; return { state: s }; }
    return err("Jetzt wird angegriffen – oder beende den Angriff.");
  }

  // --- Verschieben, dann Zugende ---
  if (s.phase === "fortify") {
    if (a.type === "fortify") {
      const { from, to } = a;
      if (!mine(from) || !mine(to) || from === to) return err("Verschiebe zwischen zwei eigenen Gebieten.");
      if (!reachable(s, from).has(to)) return err("Die Gebiete müssen über eigene Gebiete verbunden sein.");
      const k = Math.min(s.armies[from] - 1, Math.max(1, a.n || 1));
      if (k < 1) return err("Im Gebiet muss mindestens eine Armee bleiben.");
      s.armies[from] -= k; s.armies[to] += k;
      s.msg = `${name} verschiebt ${k} ${k === 1 ? "Armee" : "Armeen"} von ${TERRITORIES[from].name} nach ${TERRITORIES[to].name}.`;
    } else if (a.type !== "endTurn") return err("Verschiebe Armeen oder beende den Zug.");
    if (checkWin(s, pi)) return { state: s };
    endTurn(s, pi);
    return { state: s };
  }
  return err("Unbekannte Aktion.");
}

function endTurn(s, pi) {
  let got = "";
  if (s.conquered) {
    if (!s.deck.length) { s.deck = shuffle(s.used); s.used = []; }
    if (s.deck.length) { s.cards[pi].push(s.deck.pop()); got = ` ${s.names[pi]} bekommt eine Karte.`; }
  }
  const before = s.msg;
  startTurn(s, nextPlayer(s, pi));
  s.msg = (before ? before + got + " " : "") + s.msg;
}
