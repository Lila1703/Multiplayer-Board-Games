import { useState, useRef } from "react";
import { CATS, score, upperSum, bonus, total } from "./scoring";
import "./Kniffel.css";

// Cube rotation (x, y) that brings each value to the front
const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const NO_HOLD = [false, false, false, false, false];

export function Die({ value, spins, held, disabled, onClick, innerRef, label }) {
  const [x, y] = FACE_ROT[value];
  const n = spins * 360;
  return (
    <button ref={innerRef} className={"die" + (held ? " held" : "")}
      disabled={disabled} onClick={onClick} aria-label={label}>
      <div className="cube" style={{ transform: `rotateX(${x + n}deg) rotateY(${y + n}deg)` }}>
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <div key={f} className={`face f${f}`}>
            {Array.from({ length: 9 }, (_, k) => (
              <span key={k} className={"pip" + (PIPS[f].includes(k) ? " on" : "")} />
            ))}
          </div>
        ))}
      </div>
    </button>
  );
}

const initial = (names) => ({
  phase: "play",
  players: names.map((name) => ({ name, scores: {} })),
  cur: 0, dice: [1, 1, 1, 1, 1], held: NO_HOLD, spins: [0, 0, 0, 0, 0],
  rolls: 3, rolled: false, busy: false,
});

function Setup({ onStart }) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"]);
  const start = (e) => {
    e.preventDefault();
    onStart(names.slice(0, count).map((n, i) => n.trim() || `Spieler ${i + 1}`));
  };
  return (
    <form onSubmit={start}>
      <h2>Kniffel</h2>
      <p>Wie viele Spieler?</p>
      <div className="opts">
        {[1, 2, 3, 4].map((n) => (
          <button type="button" key={n} className={n === count ? "on" : ""} onClick={() => setCount(n)}>{n}</button>
        ))}
      </div>
      <div className="names">
        {names.slice(0, count).map((name, i) => (
          <input key={i} value={name} maxLength={16} aria-label={`Name von Spieler ${i + 1}`}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))} />
        ))}
      </div>
      <div className="opts">
        <button type="submit" className="wide on">Spiel starten</button>
      </div>
    </form>
  );
}

export default function Kniffel({ onBack }) {
  const [s, setS] = useState({ ...initial(["Spieler 1"]), phase: "setup" });
  const dieRefs = useRef([]);
  const me = s.players[s.cur];

  function toggleHold(i) {
    if (!s.rolled || s.busy || s.rolls === 0) return;
    setS({ ...s, held: s.held.map((h, k) => (k === i ? !h : h)) });
  }

  function roll() {
    if (s.busy || s.rolls === 0) return;
    const dice = s.dice.map((v, i) => (s.held[i] ? v : 1 + Math.floor(Math.random() * 6)));
    const spins = s.spins.map((k, i) => (s.held[i] ? k : k + 2 + Math.floor(Math.random() * 2)));
    s.held.forEach((h, i) => {
      if (h) return;
      const el = dieRefs.current[i];
      const rest = "translateY(0) rotate(0deg)";
      el.animate(
        [
          { transform: rest },
          { transform: "translateY(-36px) rotate(-14deg)", offset: 0.25 },
          { transform: "translateY(0) rotate(10deg)", offset: 0.5 },
          { transform: "translateY(-12px) rotate(-6deg)", offset: 0.7 },
          { transform: rest },
        ],
        { duration: 950, easing: "ease-out" }
      );
    });
    setS({ ...s, dice, spins, rolls: s.rolls - 1, rolled: true, busy: true });
    setTimeout(() => setS((p) => ({ ...p, busy: false })), 1050);
  }

  function pick(cat) {
    if (s.busy || !s.rolled || cat in me.scores) return;
    const players = s.players.map((p, i) =>
      i === s.cur ? { ...p, scores: { ...p.scores, [cat]: score(cat, s.dice) } } : p
    );
    if (players.every((p) => Object.keys(p.scores).length === CATS.length)) {
      setS({ ...s, players, phase: "over" });
      return;
    }
    setS({ ...s, players, cur: (s.cur + 1) % players.length, held: NO_HOLD, rolls: 3, rolled: false });
  }

  const hint = s.busy ? "" : !s.rolled ? "Würfle zum Start deines Zugs."
    : s.rolls > 0 ? "Tippe auf Würfel, die du behalten willst – oder trage ein Ergebnis ein."
      : "Keine Würfe mehr – wähle ein Feld in der Tabelle.";

  const ranked = [...s.players].sort((a, b) => total(b) - total(a));
  const winners = ranked.filter((p) => total(p) === total(ranked[0]));

  const row = (c) => (
    <tr key={c.id}>
      <td>{c.name}</td>
      {s.players.map((p, i) => {
        const active = i === s.cur;
        let content = null;
        if (c.id in p.scores) content = p.scores[c.id];
        else if (active && s.rolled && !s.busy) {
          const v = score(c.id, s.dice);
          content = <button className={"pick" + (v === 0 ? " zero" : "")} onClick={() => pick(c.id)}>{v}</button>;
        }
        return <td key={i} className={active ? "active-col" : ""}>{content}</td>;
      })}
    </tr>
  );

  return (
    <main>
      <header>
        {onBack && <button className="ghost" style={{ margin: 0 }} onClick={onBack}>← Spielauswahl</button>}
        <h1>Kniffel</h1>
        <div className="status" aria-live="polite">
          <b>{me.name}</b> ist dran · {s.rolls} {s.rolls === 1 ? "Wurf" : "Würfe"} übrig
        </div>
      </header>

      <div className="layout">
        <section className="tray" aria-label="Würfel">
          <div className="dice">
            {s.dice.map((v, i) => (
              <Die key={i} value={v} spins={s.spins[i]} held={s.held[i]}
                disabled={!s.rolled || s.busy} label={`Würfel ${i + 1}`}
                innerRef={(el) => (dieRefs.current[i] = el)} onClick={() => toggleHold(i)} />
            ))}
          </div>
          <div className="controls">
            <button className="roll" onClick={roll} disabled={s.busy || s.rolls === 0}>
              {s.rolled ? "Nochmal würfeln" : "Würfeln"}
            </button>
            <p className="hint">{hint}</p>
          </div>
          <button className="ghost" onClick={() => setS({ ...s, phase: "setup" })}>Neues Spiel</button>
        </section>

        <section className="sheet">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Kategorie</th>
                  {s.players.map((p, i) => <th key={i} className={i === s.cur ? "active" : ""}>{p.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {CATS.filter((c) => c.up).map(row)}
                <tr>
                  <td>Bonus (ab 63)</td>
                  {s.players.map((p, i) => <td key={i}>{bonus(p) || `${upperSum(p)}/63`}</td>)}
                </tr>
                <tr className="sep"><td colSpan={s.players.length + 1} /></tr>
                {CATS.filter((c) => !c.up).map(row)}
                <tr className="sum">
                  <td>Gesamt</td>
                  {s.players.map((p, i) => <td key={i}>{total(p)}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {s.phase !== "play" && (
        <div className="overlay">
          <div className="card">
            {s.phase === "setup" ? (
              <Setup onStart={(names) => setS(initial(names))} />
            ) : (
              <>
                <h2>{winners.map((p) => p.name).join(" und ")} {winners.length > 1 ? "gewinnen" : "gewinnt"}!</h2>
                <p>{ranked.map((p) => <span key={p.name}>{p.name}: <b>{total(p)}</b><br /></span>)}</p>
                <div className="opts">
                  <button className="wide" onClick={() => setS(initial(s.players.map((p) => p.name)))}>Nochmal spielen</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
