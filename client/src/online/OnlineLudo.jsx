import { useState, useRef, useEffect } from "react";
import Die3D from "../components/Die3D";
import { FIELDS, cellOf, movable, pos } from "../shared/ludo";
import "../games/ludo/Ludo.css";

export default function OnlineLudo({ room, me, socket, onLeave }) {
  const s = room.state;
  const seat = s.seats[me.index];
  const myTurn = s.cur === me.index;
  const [settled, setSettled] = useState(true); // Würfel ist zur Ruhe gekommen
  const [spins, setSpins] = useState(0);
  const [hover, setHover] = useState(null);
  const dieRef = useRef(null);
  const lastRoll = useRef(s.rollId);

  useEffect(() => {
    if (s.rollId === lastRoll.current) return;
    lastRoll.current = s.rollId;
    setSpins((x) => x + 2 + Math.floor(Math.random() * 2));
    dieRef.current?.animate([
      { transform: "translateY(0) rotate(0deg)" },
      { transform: "translateY(-36px) rotate(-14deg)", offset: 0.25 },
      { transform: "translateY(0) rotate(10deg)", offset: 0.5 },
      { transform: "translateY(-12px) rotate(-6deg)", offset: 0.7 },
      { transform: "translateY(0) rotate(0deg)" },
    ], { duration: 950, easing: "ease-out" });
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 1050);
    return () => clearTimeout(t);
  }, [s.rollId]);

  const canMove = myTurn && s.phase === "move" && settled && s.winner === null;
  const canRoll = myTurn && s.phase === "roll" && settled && s.winner === null;
  const who = room.players[s.cur];
  const hint = s.winner !== null ? "" : s.msg || (!settled ? "" : myTurn
    ? (s.phase === "move" ? "Tippe auf eine leuchtende Figur oder auf das blinkende Zielfeld." : "Du bist dran – würfle!")
    : `${who.name} ist dran …`);

  return (
    <main>
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onLeave}>← Verlassen</button>
        <h1>Online · Raum {room.code}</h1>
        <div className="status" aria-live="polite">
          <span className={`dot p${s.seats[s.cur]}`} /><b>{who.name}</b> ist dran{who.connected ? "" : " (offline)"}
        </div>
      </header>

      <div className="layout">
        <section className="tray">
          <div className="dicebox"><Die3D value={s.die} spins={spins} innerRef={dieRef} /></div>
          <div className="controls">
            <button className="roll" disabled={!canRoll} onClick={() => socket.emit("roll")}>Würfeln</button>
            <p className="hint">{hint}</p>
          </div>
          <p className="hint">
            {room.players.map((p, i) => (
              <span key={i}><span className={`dot p${s.seats[i]}`} />{p.name}{i === me.index ? " (du)" : ""}{p.connected ? "" : " – offline"}<br /></span>
            ))}
          </p>
        </section>

        <section className="board" aria-label="Spielfeld" style={{ transform: `rotate(${((3 - seat + 4) % 4) * 90}deg)` }}>
          {FIELDS.map((f, i) => <div key={i} className={`cell ${f.cls}`} style={pos(f.r, f.c)} />)}
          {canMove && s.pieces[s.cur].map((prog, k) => {
            if (!movable(s, s.cur, k)) return null;
            const [r, c] = cellOf(s.seats[s.cur], prog < 0 ? 0 : prog + s.die, k);
            return <button key={`v${k}`} className={`preview p${s.seats[s.cur]}${hover === k ? " on" : ""}`} style={pos(r, c)}
              aria-label={`Figur ${k + 1} hierher ziehen`} onClick={() => { setHover(null); socket.emit("move", k); }}
              onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} />;
          })}
          {s.pieces.map((a, i) => a.map((prog, k) => {
            const [r, c] = cellOf(s.seats[i], prog, k);
            const can = canMove && s.cur === i && movable(s, i, k);
            return (
              <button key={`${i}-${k}`} className={`piece p${s.seats[i]}${can ? " can" : ""}`} style={pos(r, c)}
                disabled={!can} onClick={() => { setHover(null); socket.emit("move", k); }}
                onMouseEnter={() => can && setHover(k)} onMouseLeave={() => setHover(null)}
                onFocus={() => can && setHover(k)} onBlur={() => setHover(null)}
                aria-label={`${room.players[i].name} Figur ${k + 1}`} />
            );
          }))}
        </section>
      </div>

      {s.winner !== null && settled && (
        <div className="overlay"><div className="card">
          <h2>{s.names[s.winner]} gewinnt!</h2>
          {me.index === 0 && <div className="opts"><button className="wide on" onClick={() => socket.emit("start")}>Nochmal spielen</button></div>}
          {me.index !== 0 && <p>Warte auf den Host …</p>}
          <button className="ghost" onClick={onLeave}>Raum verlassen</button>
        </div></div>
      )}
    </main>
  );
}
