import { useState, useRef, useEffect } from "react";
import { Die } from "../games/kniffel/Kniffel";
import { CATS, score, upperSum, bonus, total } from "../games/kniffel/scoring";

export default function OnlineKniffel({ room, me, socket, onLeave }) {
  const s = room.state;
  const myTurn = s.cur === me.index && !s.over;
  const [spins, setSpins] = useState([0, 0, 0, 0, 0]);
  const [settled, setSettled] = useState(true); // Würfel sind zur Ruhe gekommen
  const dieRefs = useRef([]);
  const lastRoll = useRef(s.rollId);

  useEffect(() => {
    if (s.rollId === lastRoll.current) return;
    lastRoll.current = s.rollId;
    setSpins((sp) => sp.map((k, i) => (s.rolledMask[i] ? k + 2 + Math.floor(Math.random() * 2) : k)));
    s.rolledMask.forEach((m, i) => {
      if (!m) return;
      dieRefs.current[i]?.animate([
        { transform: "translateY(0) rotate(0deg)" },
        { transform: "translateY(-36px) rotate(-14deg)", offset: 0.25 },
        { transform: "translateY(0) rotate(10deg)", offset: 0.5 },
        { transform: "translateY(-12px) rotate(-6deg)", offset: 0.7 },
        { transform: "translateY(0) rotate(0deg)" },
      ], { duration: 950, easing: "ease-out" });
    });
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 1050);
    return () => clearTimeout(t);
  }, [s.rollId]);

  const players = s.names.map((name, i) => ({ name, scores: s.scores[i] }));
  const who = room.players[s.cur];
  const canRoll = myTurn && s.rolls > 0 && settled;
  const canPick = myTurn && s.rolled && settled;
  const hint = !settled ? "" : !myTurn ? `${who.name} ist dran …` : !s.rolled ? "Du bist dran – würfle!"
    : s.rolls > 0 ? "Tippe auf Würfel, die du behalten willst – oder trage ein Ergebnis ein."
    : "Keine Würfe mehr – wähle ein Feld in der Tabelle.";

  const row = (c) => (
    <tr key={c.id}>
      <td>{c.name}</td>
      {players.map((p, i) => {
        const active = i === s.cur;
        let content = null;
        if (c.id in p.scores) content = p.scores[c.id];
        else if (active && s.rolled && settled && !s.over) {
          // Vorschau nur in der Spalte des Spielers am Zug – für alle sichtbar, anklicken kann nur er
          const v = score(c.id, s.dice);
          content = canPick
            ? <button className={"pick" + (v === 0 ? " zero" : "")} onClick={() => socket.emit("k:pick", c.id)}>{v}</button>
            : <span className={"peek" + (v === 0 ? " zero" : "")}>{v}</span>;
        }
        return <td key={i} className={active ? "active-col" : ""}>{content}</td>;
      })}
    </tr>
  );

  const ranked = [...players].sort((a, b) => total(b) - total(a));
  const winners = ranked.filter((p) => total(p) === total(ranked[0]));

  return (
    <main>
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onLeave}>← Verlassen</button>
        <h1>Online Kniffel · {room.code}</h1>
        <div className="status" aria-live="polite">
          <b>{who.name}</b> ist dran{who.connected ? "" : " (offline)"} · {s.rolls} {s.rolls === 1 ? "Wurf" : "Würfe"} übrig
        </div>
      </header>

      <div className="layout">
        <section className="tray" aria-label="Würfel">
          <div className="dice">
            {s.dice.map((v, i) => (
              <Die key={i} value={v} spins={spins[i]} held={s.held[i]} label={`Würfel ${i + 1}`}
                disabled={!myTurn || !s.rolled || s.rolls === 0 || !settled}
                innerRef={(el) => (dieRefs.current[i] = el)} onClick={() => socket.emit("k:hold", i)} />
            ))}
          </div>
          <div className="controls">
            <button className="roll" disabled={!canRoll} onClick={() => socket.emit("k:roll")}>
              {s.rolled ? "Nochmal würfeln" : "Würfeln"}
            </button>
            <p className="hint">{hint}</p>
          </div>
        </section>

        <section className="sheet"><div className="scroll"><table>
          <thead><tr><th>Kategorie</th>
            {players.map((p, i) => <th key={i} className={i === s.cur ? "active" : ""}>{p.name}{i === me.index ? " (du)" : ""}</th>)}
          </tr></thead>
          <tbody>
            {CATS.filter((c) => c.up).map(row)}
            <tr><td>Bonus (ab 63)</td>{players.map((p, i) => <td key={i}>{bonus(p) || `${upperSum(p)}/63`}</td>)}</tr>
            <tr className="sep"><td colSpan={players.length + 1} /></tr>
            {CATS.filter((c) => !c.up).map(row)}
            <tr className="sum"><td>Gesamt</td>{players.map((p, i) => <td key={i}>{total(p)}</td>)}</tr>
          </tbody>
        </table></div></section>
      </div>

      {s.over && settled && (
        <div className="overlay"><div className="card">
          <h2>{winners.map((p) => p.name).join(" und ")} {winners.length > 1 ? "gewinnen" : "gewinnt"}!</h2>
          <p>{ranked.map((p) => <span key={p.name}>{p.name}: <b>{total(p)}</b><br /></span>)}</p>
          {me.index === 0
            ? <div className="opts"><button className="wide on" onClick={() => socket.emit("start")}>Nochmal spielen</button></div>
            : <p>Warte auf den Host …</p>}
          <button className="ghost" onClick={onLeave}>Raum verlassen</button>
        </div></div>
      )}
    </main>
  );
}
