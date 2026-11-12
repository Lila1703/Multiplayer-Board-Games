import { useEffect, useState } from "react";
import { SUITS, SUIT_NAMES, suit } from "../shared/schwimmen";
import { playable, isJack } from "../shared/maumau";
import { Card } from "./OnlineSchwimmen"; // dieselben Karten wie bei Schwimmen (samt Schwimmen.css)
import "./MauMau.css";

const cards = (n) => `${n} ${n === 1 ? "Karte" : "Karten"}`;

export default function OnlineMauMau({ room, me, socket, onLeave }) {
  const s = room.state;
  const mine = me.index;
  const tv = !!me.tv; // Fernseher: zeigt nur den Tisch, keine Hand
  const over = s.stage === "over";
  const myTurn = !over && s.cur === mine;
  const [wishFor, setWishFor] = useState(null); // der Bube, für den gerade eine Farbe gewählt wird
  const [err, setErr] = useState("");
  useEffect(() => { setWishFor(null); setErr(""); }, [s.cur, s.top, s.stage]);

  const act = (a) => socket.emit("mm:act", a, (res) => setErr(res?.error || ""));
  const hand = [...(s.hand || [])].sort((a, b) => a - b); // nach Farbe, darin nach Wert
  const canPlay = myTurn && hand.some((id) => playable(s, id));
  const place = s.done.indexOf(mine); // -1 = spielt noch
  const who = room.players[s.cur];
  const hint = err || (over ? ""
    : place >= 0 ? `Du bist fertig (Platz ${place + 1}) – schau den anderen zu.`
    : !myTurn ? `${who.name} ist dran …`
    : s.pending ? (canPlay ? `Leg eine 7 oder zieh ${s.pending} Karten.` : `Du musst ${s.pending} Karten ziehen.`)
    : s.drew ? "Du hast gezogen: Leg eine passende Karte oder gib weiter."
    : canPlay ? "Tippe eine passende Karte an – oder zieh eine." : "Du kannst nicht legen: Zieh eine Karte.");
  const drawLabel = s.pending ? `${s.pending} Karten ziehen` : "Karte ziehen";
  const draw = myTurn && !s.drew ? () => act({ type: "draw" }) : undefined;
  const order = over ? [...s.done, s.loser] : [];

  return (
    <main className={"sw mm" + (tv ? " tv" : "")}>
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onLeave}>← Verlassen</button>
        <h1>Mau-Mau · {room.code}</h1>
        <div className="status" aria-live="polite"><b>{who.name}</b> ist dran{who.connected ? "" : " (offline)"}</div>
      </header>

      <section className="seats">
        {room.players.map((p, i) => {
          const pl = s.done.indexOf(i);
          return (
            <div key={i} className={"seat" + (i === s.cur && !over ? " active" : "") + (pl >= 0 ? " out" : "")}>
              <div className="seatname">{p.name}{i === mine ? " (du)" : ""}{p.connected ? "" : " – offline"}</div>
              <div className="tags">
                {pl >= 0 ? <span className="tag closed">fertig · Platz {pl + 1}</span> : <span className="tag">{cards(s.counts[i])}</span>}
                {pl < 0 && s.counts[i] === 1 && <span className="tag closed">Mau!</span>}
              </div>
            </div>
          );
        })}
      </section>

      <section className="panel felt">
        <h3>Mitte</h3>
        <div className="mm-piles">
          <button className="scard back" disabled={!draw} onClick={draw} aria-label={`Stapel mit ${cards(s.deck)}${draw ? ": " + drawLabel : ""}`}>
            <span aria-hidden="true">{s.deck}</span>
          </button>
          <Card id={s.top} />
          <div className="mm-info">
            {s.wish !== null && <div>Gewünscht: <span className={"mm-suit" + (s.wish >= 2 ? " red" : "")}>{SUITS[s.wish]} {SUIT_NAMES[s.wish]}</span></div>}
            {s.pending > 0 && <div>Offene 7: <b>{s.pending} Karten ziehen</b></div>}
          </div>
        </div>
        <p className="msg">{s.msg}</p>
      </section>

      {/* dock: Auf dem Handy kleben die eigenen Karten samt Knöpfen am unteren Bildschirmrand (index.css) */}
      {!tv && <section className="panel dock">
        <h3>Deine Karten {place < 0 && <span className="points">· {hand.length}</span>}</h3>
        {place < 0 && (
          // Fächer: Die Karten überlappen, sobald sie nicht mehr nebeneinander passen (--n = Zahl der Karten vor der letzten)
          <div className="mm-hand" style={{ "--n": Math.max(hand.length - 1, 1) }}>
            {hand.map((id) => {
              const ok = myTurn && playable(s, id);
              return (
                <Card key={id} id={id} className={"fan" + (ok ? " can" : myTurn ? " cant" : "") + (id === s.drawn ? " new" : "")}
                  onClick={ok ? () => (isJack(id) ? setWishFor(id) : act({ type: "play", card: id })) : undefined}>
                  <span className="fsuit" aria-hidden="true">{SUITS[suit(id)]}</span>
                </Card>
              );
            })}
          </div>
        )}
        {myTurn && (
          <div className="row">
            {s.drew
              ? <button onClick={() => act({ type: "pass" })}>Weiter ohne Legen</button>
              : <button className={canPlay ? "" : "go"} onClick={draw}>{drawLabel}</button>}
          </div>
        )}
        <p className="msg">{hint}</p>
      </section>}

      {!tv && <section className="panel rules">
        <h3>Regeln</h3>
        <p>Leg eine Karte mit derselben <b>Farbe</b> oder demselben <b>Wert</b> wie die oberste Karte. Kannst du nicht, zieh eine Karte: Passt jetzt etwas, darfst du noch legen.
          Die <b>7</b> lässt den Nächsten zwei Karten ziehen – außer er legt selbst eine 7, dann zieht der Übernächste vier. Wer Strafkarten zieht, legt in diesem Zug nichts.
          Die <b>8</b> lässt den Nächsten aussetzen. Der <b>Bube</b> passt auf alles außer auf einen Buben und nicht auf eine offene 7; wer ihn legt, wünscht sich eine Farbe.
          Wer alle Karten los ist, ist fertig. Wer als Letzter noch Karten hat, verliert.</p>
      </section>}

      {wishFor !== null && (
        <div className="overlay"><div className="card">
          <h2>Welche Farbe wünschst du dir?</h2>
          <div className="opts mm-wish">
            {SUITS.map((sym, c) => {
              const n = hand.filter((id) => id !== wishFor && suit(id) === c).length;
              return (
                <button key={c} className="wide" onClick={() => { act({ type: "play", card: wishFor, wish: c }); setWishFor(null); }}
                  aria-label={`${SUIT_NAMES[c]}, davon hast du ${cards(n)}`}>
                  <span className={"mm-suit" + (c >= 2 ? " red" : "")} aria-hidden="true">{sym}</span> {SUIT_NAMES[c]} <small aria-hidden="true">· {n}</small>
                </button>
              );
            })}
          </div>
          <p>Die Zahl zeigt, wie viele Karten der Farbe du noch hast.</p>
          <button className="ghost" style={{ margin: 0 }} onClick={() => setWishFor(null)}>Abbrechen</button>
        </div></div>
      )}

      {over && (
        <div className="overlay"><div className="card mm-result">
          <h2>🏆 {s.names[s.done[0]]} gewinnt!</h2>
          <p><b>{s.names[s.loser]}</b> bleibt auf {cards(s.counts[s.loser])} sitzen und verliert.</p>
          <div className="results">
            {order.map((i, k) => (
              <div key={i} className={"res" + (i === s.loser ? " lost" : "")}>
                <div className="res-head">
                  <b>{k + 1}. {s.names[i]}{i === mine ? " (du)" : ""}</b>
                  <span>{i === s.loser ? `${cards(s.counts[i])} übrig` : "fertig"}</span>
                </div>
              </div>
            ))}
          </div>
          {me.host
            ? <div className="opts"><button className="wide on" onClick={() => socket.emit("start")}>Nochmal spielen</button><button className="wide" onClick={() => socket.emit("lobby")}>Etwas anderes spielen</button></div>
            : <p>Warte auf den Host …</p>}
          <button className="ghost" onClick={onLeave}>Raum verlassen</button>
        </div></div>
      )}
    </main>
  );
}
