import { useState, useRef, useEffect } from "react";
import PlayerSetup from "../../components/PlayerSetup";
import Die3D from "../../components/Die3D";
import "./Ludo.css";

// 40 Felder des Rundwegs (Zeile, Spalte) auf einem 11x11-Raster, im Uhrzeigersinn
const TRACK = [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 5], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6],
[4, 7], [4, 8], [4, 9], [4, 10], [5, 10], [6, 10], [6, 9], [6, 8], [6, 7], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [10, 5],
[10, 4], [9, 4], [8, 4], [7, 4], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [5, 0]];
const START = [0, 10, 20, 30]; // Startfeld je Sitzplatz (Index im Rundweg)
const LANE = [[[5, 1], [5, 2], [5, 3], [5, 4]], [[1, 5], [2, 5], [3, 5], [4, 5]], [[5, 9], [5, 8], [5, 7], [5, 6]], [[9, 5], [8, 5], [7, 5], [6, 5]]];
const BASE = [[[1, 1], [1, 2], [2, 1], [2, 2]], [[1, 8], [1, 9], [2, 8], [2, 9]], [[8, 8], [8, 9], [9, 8], [9, 9]], [[8, 1], [8, 2], [9, 1], [9, 2]]];
const SEATS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

// Fortschritt einer Figur: -1 = im Haus, 0..39 = Rundweg ab eigenem Start, 40..43 = Zielfelder
const cellOf = (seat, prog, k) =>
  prog < 0 ? BASE[seat][k] : prog < 40 ? TRACK[(START[seat] + prog) % 40] : LANE[seat][prog - 40];
const pos = (r, c) => ({ left: `${(c * 100) / 11}%`, top: `${(r * 100) / 11}%` });

const FIELDS = (() => {
  const m = [];
  TRACK.forEach(([r, c], i) => { const p = START.indexOf(i); m.push({ r, c, cls: p >= 0 ? `start p${p}` : "track" }); });
  LANE.forEach((l, p) => l.forEach(([r, c]) => m.push({ r, c, cls: `lane p${p}` })));
  BASE.forEach((b, p) => b.forEach(([r, c]) => m.push({ r, c, cls: `base p${p}` })));
  m.push({ r: 5, c: 5, cls: "center" });
  return m;
})();

const fresh = (names) => ({
  names, seats: SEATS[names.length], pieces: names.map(() => [-1, -1, -1, -1]),
  cur: 0, die: 1, phase: "roll", tries: 3, rolling: false, msg: "", winner: null,
});

export default function Ludo({ onBack }) {
  const [g, setG] = useState(null);
  const [spins, setSpins] = useState(0);
  const [hover, setHover] = useState(null); // Figur, über der die Maus gerade ist
  const dieRef = useRef(null);

  // Spielfeld so drehen, dass der Spieler am Zug unten links sitzt (Sitz 3 = unten links)
  const boardRef = useRef(null);
  const quarterRef = useRef(3); // bisherige Drehung in Vierteldrehungen (im Uhrzeigersinn)
  const prevBase = useRef(3);
  const base = g ? (3 - g.seats[g.cur] + 4) % 4 : 3;
  useEffect(() => {
    const d = ((base - prevBase.current + 5) % 4) - 1; // kürzeste Richtung: -1, 0, 1 oder 2
    prevBase.current = base;
    if (!d) return;
    const from = quarterRef.current * 90;
    const to = from + d * 90;
    quarterRef.current += d;
    const el = boardRef.current;
    if (!el) return;
    el.style.transform = `rotate(${to}deg)`;
    el.animate(
      [
        { transform: `rotate(${from}deg) scale(1)` },
        { transform: `rotate(${(from + to) / 2}deg) scale(0.7)`, offset: 0.5 },
        { transform: `rotate(${to}deg) scale(1)` },
      ],
      { duration: 900, delay: 400, easing: "ease-in-out", fill: "backwards" }
    );
  }, [base]);

  if (!g) {
    return (
      <div className="overlay"><div className="card">
        <PlayerSetup title="Mensch ärgere dich nicht" min={2} max={4} onBack={onBack} onStart={(n) => setG(fresh(n))} />
      </div></div>
    );
  }

  const n = g.names.length;
  const seat = (i) => g.seats[i];
  const movable = (s, i, k) => {
    const prog = s.pieces[i][k];
    if (prog < 0) return s.die === 6 && !s.pieces[i].includes(0);
    const np = prog + s.die;
    return np <= 43 && !s.pieces[i].includes(np);
  };

  function roll() {
    if (g.phase !== "roll" || g.rolling) return;
    const die = 1 + Math.floor(Math.random() * 6);
    setSpins((s) => s + 2 + Math.floor(Math.random() * 2));
    dieRef.current.animate([
      { transform: "translateY(0) rotate(0deg)" },
      { transform: "translateY(-36px) rotate(-14deg)", offset: 0.25 },
      { transform: "translateY(0) rotate(10deg)", offset: 0.5 },
      { transform: "translateY(-12px) rotate(-6deg)", offset: 0.7 },
      { transform: "translateY(0) rotate(0deg)" },
    ], { duration: 950, easing: "ease-out" });
    setG({ ...g, rolling: true, msg: "", die });
    setTimeout(() => finish(die), 1050);
  }

  function finish(die) {
    const next = { ...g, die, rolling: false };
    if (g.pieces[g.cur].some((_, k) => movable(next, g.cur, k))) {
      setG({ ...next, phase: "move" });
      return;
    }
    const allBase = g.pieces[g.cur].every((q) => q < 0);
    const stay = die === 6 || (allBase && g.tries > 1);
    const adv = { cur: stay ? g.cur : (g.cur + 1) % n, tries: die === 6 ? 3 : stay ? g.tries - 1 : 3 };
    setG({ ...next, phase: "wait", msg: "Kein Zug möglich." });
    setTimeout(() => setG((x) => ({ ...x, ...adv, phase: "roll", msg: "" })), 900);
  }

  function move(i, k) {
    setHover(null);
    const pcs = g.pieces.map((a) => [...a]);
    const np = pcs[i][k] < 0 ? 0 : pcs[i][k] + g.die;
    pcs[i][k] = np;
    let msg = "";
    if (np < 40) {
      const abs = (START[seat(i)] + np) % 40;
      pcs.forEach((a, j) => {
        if (j === i) return;
        a.forEach((q, m) => {
          if (q >= 0 && q < 40 && (START[seat(j)] + q) % 40 === abs) { a[m] = -1; msg = `${g.names[i]} wirft ${g.names[j]} raus!`; }
        });
      });
    }
    const won = pcs[i].every((q) => q >= 40);
    const again = g.die === 6 && !won;
    setG({
      ...g, pieces: pcs, phase: "roll", tries: 3, msg,
      cur: won || again ? g.cur : (g.cur + 1) % n, winner: won ? i : null
    });
  }

  const me = g.cur;
  const allBase = g.pieces[me].every((q) => q < 0);
  const hint = g.msg || (g.phase === "move" ? "Tippe auf eine leuchtende Figur oder auf das blinkende Zielfeld."
    : allBase ? `Du brauchst eine 6 (Versuch ${4 - g.tries} von 3).` : "Würfle!");

  return (
    <main>
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onBack}>← Spielauswahl</button>
        <h1>Mensch ärgere dich nicht</h1>
        <div className="status" aria-live="polite">
          <span className={`dot p${seat(me)}`} /><b>{g.names[me]}</b> ist dran
        </div>
      </header>

      <div className="layout">
        <section className="tray">
          <div className="dicebox"><Die3D value={g.die} spins={spins} innerRef={dieRef} /></div>
          <div className="controls">
            <button className="roll" onClick={roll} disabled={g.phase !== "roll" || g.rolling}>Würfeln</button>
            <p className="hint">{hint}</p>
          </div>
          <button className="ghost" onClick={() => setG(null)}>Neues Spiel</button>
        </section>

        <section className="board" aria-label="Spielfeld" ref={boardRef}
          style={{ transform: `rotate(${quarterRef.current * 90}deg)` }}>
          {FIELDS.map((f, i) => <div key={i} className={`cell ${f.cls}`} style={pos(f.r, f.c)} />)}
          {g.phase === "move" && g.pieces[me].map((prog, k) => {
            if (!movable(g, me, k)) return null;
            const [r, c] = cellOf(seat(me), prog < 0 ? 0 : prog + g.die, k);
            return <button key={`v${k}`} className={`preview p${seat(me)}${hover === k ? " on" : ""}`} style={pos(r, c)}
              aria-label={`Figur ${k + 1} hierher ziehen`} onClick={() => move(me, k)}
              onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} />;
          })}
          {g.pieces.map((a, i) => a.map((prog, k) => {
            const [r, c] = cellOf(seat(i), prog, k);
            const can = g.phase === "move" && g.cur === i && movable(g, i, k);
            return (
              <button key={`${i}-${k}`} className={`piece p${seat(i)}${can ? " can" : ""}`} style={pos(r, c)}
                disabled={!can} onClick={() => move(i, k)}
                onMouseEnter={() => can && setHover(k)} onMouseLeave={() => setHover(null)}
                onFocus={() => can && setHover(k)} onBlur={() => setHover(null)} aria-label={`${g.names[i]} Figur ${k + 1}`} />
            );
          }))}
        </section>
      </div>

      {g.winner !== null && (
        <div className="overlay"><div className="card">
          <h2>{g.names[g.winner]} gewinnt!</h2>
          <div className="opts">
            <button className="wide" onClick={() => setG(fresh(g.names))}>Nochmal spielen</button>
          </div>
          <button className="ghost" onClick={onBack}>Zur Spielauswahl</button>
        </div></div>
      )}
    </main>
  );
}
