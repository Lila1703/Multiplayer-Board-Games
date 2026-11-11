import { useState, useEffect } from "react";
import { SUITS, RANKS, LIVES, suit, rank, cardName, score, fmt, canRenew } from "../shared/schwimmen";
import "./Schwimmen.css";

function Card({ id, sel, small, onClick }) {
  const red = suit(id) >= 2;
  return (
    <button className={"scard" + (red ? " red" : "") + (sel ? " sel" : "") + (small ? " small" : "")}
      disabled={!onClick} onClick={onClick} aria-label={cardName(id)} aria-pressed={onClick ? !!sel : undefined}>
      {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={"corner " + c} aria-hidden="true">{RANKS[rank(id)]}</span>)}
      <span className="suit" aria-hidden="true">{SUITS[suit(id)]}</span>
    </button>
  );
}

// Leben: Herzen, danach schwimmt man (Animation), danach ist man untergegangen
export function Lives({ lives }) {
  if (lives < 0) return <span className="lives sunk" title="Untergegangen – raus"><span className="bubbles">🫧</span> untergegangen</span>;
  if (lives === 0) return (
    <span className="lives swim" title="Schwimmt – beim nächsten Verlust ist man raus">
      <span className="pool"><span className="swimmer">🏊</span><span className="waves">🌊🌊🌊🌊</span></span>
    </span>
  );
  return (
    <span className="lives" title={`${lives} von ${LIVES} Leben`}>
      {Array.from({ length: LIVES }, (_, i) => <span key={i} className={i < lives ? "" : "lost"}>{i < lives ? "❤️" : "🤍"}</span>)}
    </span>
  );
}

export default function OnlineSchwimmen({ room, me, socket, onLeave }) {
  const s = room.state;
  const mine = me.index;
  const playing = s.stage === "play";
  const myTurn = playing && s.cur === mine;
  const [sel, setSel] = useState(null); // { from: "hand" | "middle", id }
  const [err, setErr] = useState("");
  useEffect(() => { setSel(null); setErr(""); }, [s.cur, s.roundNo, s.stage]);

  const act = (a) => socket.emit("s:act", a, (res) => setErr(res?.error || ""));
  const pick = (from, id) => {
    if (!sel || sel.from === from) return setSel(sel?.id === id ? null : { from, id });
    act({ type: "swap", hand: from === "hand" ? id : sel.id, middle: from === "middle" ? id : sel.id });
  };
  const who = room.players[s.cur];
  const out = s.lives[mine] < 0;
  const hint = err || (myTurn
    ? sel ? `Jetzt eine Karte ${sel.from === "hand" ? "aus der Mitte" : "aus deiner Hand"} antippen, um zu tauschen.`
      : "Tippe eine Karte deiner Hand und eine aus der Mitte an, um sie zu tauschen – oder wähle unten."
    : playing ? `${who.name} ist dran …` : "");

  return (
    <main className="sw">
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onLeave}>← Verlassen</button>
        <h1>Schwimmen · {room.code}</h1>
        <div className="status" aria-live="polite"><b>{who.name}</b> ist dran{who.connected ? "" : " (offline)"} · Runde {s.roundNo}</div>
      </header>

      <section className="seats">
        {room.players.map((p, i) => (
          <div key={i} className={"seat" + (i === s.cur && playing ? " active" : "") + (s.lives[i] < 0 ? " out" : "")}>
            <div className="seatname">
              {p.name}{i === mine ? " (du)" : ""}{p.connected ? "" : " – offline"}
            </div>
            <Lives lives={s.lives[i]} />
            <div className="tags">
              {i === s.dealer && <span className="tag">gibt</span>}
              {i === s.closer && <span className="tag closed">🔒 hat zugemacht</span>}
            </div>
          </div>
        ))}
      </section>

      <section className="panel felt">
        <h3>Mitte</h3>
        <div className="row-cards">
          {s.middle.map((id) => <Card key={id} id={id} sel={sel?.id === id} onClick={myTurn ? () => pick("middle", id) : undefined} />)}
        </div>
        <p className="msg">{s.msg}</p>
      </section>

      {/* dock: Auf dem Handy kleben die eigenen Karten samt Knöpfen am unteren Bildschirmrand (index.css) */}
      <section className="panel dock">
        <h3>Deine Karten {!out && <span className="points">· {fmt(score(s.hand))} Punkte</span>}</h3>
        {out ? <p className="muted">Du bist untergegangen 🫧 – schau den anderen beim Schwimmen zu.</p> : (
          <div className="row-cards">
            {s.hand.map((id) => <Card key={id} id={id} sel={sel?.id === id} onClick={myTurn ? () => pick("hand", id) : undefined} />)}
          </div>
        )}
        {myTurn && (
          <div className="row">
            {canRenew(s.middle) && <button className="go" onClick={() => act({ type: "renew" })}>7, 8, 9 weg – neue Karten</button>}
            <button onClick={() => act({ type: "swapAll" })}>Alle drei tauschen</button>
            <button onClick={() => act({ type: "pass" })}>Schieben</button>
            <button className="go" disabled={s.closer !== null} onClick={() => act({ type: "close" })}>Zumachen</button>
          </div>
        )}
        <p className="msg">{hint}</p>
      </section>

      <section className="panel rules">
        <h3>Regeln</h3>
        <p>Gezählt wird die höchste Summe <b>einer Farbe</b>: Ass 11, Bild und Zehn 10, sonst der Zahlenwert. Drei gleiche Werte zählen 30,5, drei Asse (<b>Feuer</b>) 33.
          Wer dran ist, tauscht eine Karte mit der Mitte, tauscht alle drei, schiebt oder macht zu. Nach dem Zumachen ist jeder noch einmal dran. Liegen 7, 8 und 9 in der Mitte, darf man sie gegen drei neue Karten tauschen lassen und ist dann weiter dran. Haben alle hintereinander geschoben, kommen automatisch neue Karten in die Mitte.
          Wer 31 oder Feuer hat, deckt sofort auf. Wer am wenigsten hat, verliert ein Leben (bei Gleichstand alle) – bei Feuer verlieren alle anderen.
          Nach {LIVES} Leben <b>schwimmt</b> man, beim nächsten Verlust geht man unter. Wer zuletzt übrig ist, gewinnt.</p>
      </section>

      {!playing && s.result && (
        <div className="overlay"><div className="card sw-result">
          <h2>{s.stage === "over" ? `🏆 ${s.names[s.winner]} gewinnt!`
            : s.result.feuer ? `🔥 Feuer bei ${s.names[s.result.instant]}!`
            : s.result.instant !== null ? `${s.names[s.result.instant]} hat 31!`
            : "Runde vorbei"}</h2>
          {s.result.closer !== null && s.result.instant === null && <p>{s.names[s.result.closer]} hat zugemacht.</p>}
          <div className="results">
            {s.names.map((n, i) => s.result.pts[i] !== null && (
              <div key={i} className={"res" + (s.result.losers.includes(i) ? " lost" : "")}>
                <div className="res-head">
                  <b>{n}</b><span>{fmt(s.result.pts[i])} Punkte</span>
                </div>
                <div className="row-cards">{s.hands[i].map((id) => <Card key={id} id={id} small />)}</div>
                <div className="res-foot">
                  <Lives lives={s.lives[i]} />
                  <span>{!s.result.losers.includes(i) ? ""
                    : s.lives[i] < 0 ? "geht unter!"
                    : s.lives[i] === 0 ? "schwimmt jetzt!"
                    : "verliert ein Leben"}</span>
                </div>
              </div>
            ))}
          </div>
          {s.result.rescued && <p>Alle wären gleichzeitig untergegangen – deshalb geht keiner unter.</p>}
          {s.stage === "between" && <div className="opts"><button className="wide on" onClick={() => act({ type: "next" })}>Nächste Runde</button></div>}
          {s.stage === "over" && (me.index === 0
            ? <div className="opts"><button className="wide on" onClick={() => socket.emit("start")}>Nochmal spielen</button><button className="wide" onClick={() => socket.emit("lobby")}>Etwas anderes spielen</button></div>
            : <p>Warte auf den Host …</p>)}
          <button className="ghost" onClick={onLeave}>Raum verlassen</button>
        </div></div>
      )}
    </main>
  );
}
