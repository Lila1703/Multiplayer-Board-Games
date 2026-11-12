import { useState, useEffect } from "react";
import { COLORS, isCrown, isBlank, isNum, color, num, cardName, canPlay, leadColor, forbiddenBid } from "../shared/zauberstich";
import "./Zauberstich.css";

const COL = ["red", "blue", "green", "yellow"];
const SHAPE = ["●", "▲", "■", "◆"]; // zusätzlich zur Farbe, damit man die Farben auch ohne Farbsehen unterscheiden kann
const sortKey = (id) => (isCrown(id) ? 1000 : isBlank(id) ? -1 : color(id) * 20 + num(id));

// Zaubererhut als eigene kleine Grafik (spitzer Hut mit Krempe, Band und Sternen)
export function Hat({ size = "1em" }) {
  return (
    <svg className="hat" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M7 32 Q14 20 17.5 7 Q19 2.5 24 3.5 Q20.5 6.5 21.5 12 L33 32 Z" fill="#24124a" stroke="#ffd76a" strokeWidth="1" strokeLinejoin="round" />
      <path d="M9 28 Q20 31 31 28 L32.5 31.5 Q20 35 7.5 31.5 Z" fill="#ffd76a" />
      <ellipse cx="20" cy="33.5" rx="17" ry="3.6" fill="#24124a" stroke="#ffd76a" strokeWidth="1" />
      <path d="M19 15 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1 z" fill="#ffd76a" />
      <path d="M24.5 22 l.7 1.5 1.5.7 -1.5.7 -.7 1.5 -.7 -1.5 -1.5 -.7 1.5 -.7 z" fill="#ffd76a" />
      <circle cx="15" cy="24" r="1" fill="#ffd76a" />
    </svg>
  );
}

// tint: Zauberhut als Trumpfkarte in der gewählten Trumpffarbe anzeigen
function Card({ id, small, dim, win, tint, onClick }) {
  const cls = "wcard" + (isCrown(id) ? " hat-card" + (tint != null ? " tint " + COL[tint] : "") : isBlank(id) ? " blank" : " " + COL[color(id)])
    + (small ? " small" : "") + (dim ? " dim" : "") + (win ? " win" : "");
  return (
    <button className={cls} disabled={!onClick} onClick={onClick} aria-label={cardName(id) + (tint != null ? ` – Trumpf ${COLORS[tint]}` : "")} title={cardName(id) + (tint != null ? ` – Trumpf ${COLORS[tint]}` : "")}>
      {isNum(id) ? <><span className="shape tl" aria-hidden="true">{SHAPE[color(id)]}</span><span className="n">{num(id)}</span><span className="shape br" aria-hidden="true">{SHAPE[color(id)]}</span></>
        : isCrown(id) ? <span className="n"><Hat size="78%" /></span> : <span className="n">N</span>}
    </button>
  );
}

function TrumpBadge({ s }) {
  if (s.trump === null) return <span className="trump none">kein Trumpf</span>;
  return <span className={"trump " + COL[s.trump]}>{SHAPE[s.trump]} {COLORS[s.trump]}</span>;
}

export default function OnlineZauberstich({ room, me, socket, onLeave }) {
  const s = room.state;
  const mine = me.index;
  const tv = !!me.tv; // Fernseher: zeigt nur den Tisch, keine Hand
  const [err, setErr] = useState("");
  useEffect(() => setErr(""), [s.cur, s.stage, s.round]);
  const act = (a) => socket.emit("w:act", a, (res) => setErr(res?.error || ""));
  const myTurn = s.cur === mine && ["trump", "bid", "play"].includes(s.stage);
  const who = room.players[s.cur];
  const hand = [...(s.hand || [])].sort((a, b) => sortKey(a) - sortKey(b));
  const bidSum = s.bids.reduce((a, b) => a + (b ?? 0), 0);
  const led = leadColor(s.trick);
  const forbidden = forbiddenBid(s);
  const starterIdx = (s.dealer + 1) % s.names.length, starter = s.names[starterIdx]; // spielt nach dem Ansagen den ersten Stich aus

  let hint = err;
  if (!hint) {
    if (s.stage === "trump") hint = myTurn ? "Ein Zauberhut wurde aufgedeckt – wähle die Trumpffarbe." : `${who.name} wählt Trumpf …`;
    else if (s.stage === "bid") hint = (myTurn ? "Wie viele Stiche machst du in dieser Runde?" : `${who.name} sagt an …`) + (starterIdx === mine ? " Du fängst an." : ` ${starter} fängt an.`);
    else if (s.stage === "play") hint = myTurn ? (led !== null ? `Du musst ${COLORS[led]} bedienen, wenn du kannst (Zauberhut und Niete gehen immer).` : "Spiel eine Karte aus.") : `${who.name} ist dran …`;
    else if (s.stage === "show") hint = s.msg;
  }

  return (
    <main className={"sr" + (tv ? " tv" : "")}>
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onLeave}>← Verlassen</button>
        <h1>Zauberstich · {room.code}</h1>
        <div className="status" aria-live="polite">Runde <b>{s.round}</b> von {s.rounds} ·{s.noEven && <span className="lg-only"> Ansagen gehen nicht auf ·</span>} Trumpf: <TrumpBadge s={s} /></div>
      </header>

      <div className="sr-layout"><div className="sr-main">
        <section className="sheet"><div className="scroll"><table>
          <thead><tr><th>Spieler</th><th>Ansage</th><th>Stiche</th><th>Punkte</th><th>Karten</th></tr></thead>
          <tbody>{room.players.map((p, i) => (
            <tr key={i} className={i === s.cur && ["trump", "bid", "play"].includes(s.stage) ? "active-col" : ""}>
              <td>{p.name}{i === mine ? " (du)" : ""}{i === s.dealer ? " · gibt" : ""}{p.connected ? "" : " – offline"}</td>
              <td>{s.bids[i] ?? "–"}</td>
              <td className={s.bids[i] !== null && s.tricks[i] > s.bids[i] ? "over" : ""}>{s.tricks[i]}</td>
              <td>{s.scores[i]}</td>
              <td>{s.sizes[i]}</td>
            </tr>))}
          </tbody>
        </table></div></section>

        <section className="panel felt">
          <h3>Stich {s.stage === "bid" || s.stage === "trump" ? "" : `· ${s.tricks.reduce((a, b) => a + b, 0) + 1} von ${s.round}`}</h3>
          <div className="felt-row">
          <div className="trumpbox">
            {s.trumpCard !== null ? <Card id={s.trumpCard} small tint={isCrown(s.trumpCard) ? s.trump : null} />
              : <span className="nocard" aria-hidden="true">–</span>}
            <small>{s.trumpCard === null ? "Letzte Runde: kein Trumpf"
              : isBlank(s.trumpCard) ? "Niete: kein Trumpf"
              : !isCrown(s.trumpCard) ? `Trumpf: ${COLORS[s.trump]}`
              : s.trump === null ? "Zauberhut: Geber wählt …"
              : `Zauberhut: ${COLORS[s.trump]} gewählt`}</small>
          </div>
          <div className="trick">
            {s.trick.map((t) => (
              <div className="played" key={t.card}>
                <Card id={t.card} win={s.stage === "show" && t.p === s.winnerOfTrick} />
                <small>{s.names[t.p]}</small>
              </div>
            ))}
            {s.trick.length === 0 && (
              <div className="empty">
                <span>{s.stage === "play" ? `${who.name} spielt aus.` : s.stage === "bid" ? `Angesagt: ${bidSum} von ${s.round} Stichen` : ""}</span>
              </div>
            )}
          </div>
          </div>
          <p className="msg">{s.stage === "show" ? "" : s.msg}</p>
          {tv && <p className="msg">{hint}</p>}
        </section>

        {!tv && <section className="panel">
          <h3>Deine Karten</h3>
          <div className="hand">
            {hand.map((id) => {
              const ok = myTurn && s.stage === "play" && canPlay(s.hand, s.trick, id);
              return <Card key={id} id={id} dim={myTurn && s.stage === "play" && !ok} onClick={ok ? () => act({ type: "play", card: id }) : undefined} />;
            })}
          </div>
          {myTurn && s.stage === "bid" && (
            <div className="row">
              {Array.from({ length: s.round + 1 }, (_, n) => <button key={n} className="bid" disabled={n === forbidden} title={n === forbidden ? "Die Ansagen dürfen nicht aufgehen" : undefined} onClick={() => act({ type: "bid", n })}>{n}</button>)}
              <span className="note">Bisher angesagt: {bidSum} von {s.round}{forbidden !== null && <> · Die Ansagen dürfen nicht aufgehen, deshalb ist {forbidden} nicht erlaubt.</>}</span>
            </div>
          )}
          {myTurn && s.stage === "trump" && (
            <div className="row">
              {COLORS.map((c, i) => <button key={c} className={"pick " + COL[i]} onClick={() => act({ type: "trump", color: i })}>{SHAPE[i]} {c}</button>)}
            </div>
          )}
          <p className="msg">{hint}</p>
        </section>}
      </div>

      <aside className="sr-side">
        <section className="panel">
          <h3>Punkteblock</h3>
          {s.history.length === 0 ? <p className="note">Noch keine Runde gewertet.</p> : (
            <div className="scroll"><table className="block">
              <thead><tr><th>#</th>{s.names.map((n, i) => <th key={i} title={n}>{n.slice(0, 6)}</th>)}</tr></thead>
              <tbody>
                {s.history.map((h, r) => (
                  <tr key={r}><td>{r + 1}</td>{h.pts.map((p, i) => <td key={i} className={p > 0 ? "plus" : "minus"}>{p > 0 ? "+" : ""}{p}</td>)}</tr>
                ))}
                <tr className="sum"><td>Σ</td>{s.scores.map((x, i) => <td key={i}>{x}</td>)}</tr>
              </tbody>
            </table></div>
          )}
        </section>
        {!tv && <section className="panel rules">
          <h3>Regeln</h3>
          <p>In Runde 1 hat jeder 1 Karte, in Runde 2 zwei usw. Die nächste Karte vom Stapel bestimmt den <b>Trumpf</b> (bei einem Zauberhut wählt der Geber, bei einer Niete gibt es keinen).
            Vor dem Spielen sagt jeder an, wie viele Stiche er macht. Die ausgespielte Farbe muss bedient werden.
            {s.noEven ? " Die Ansagen dürfen nicht aufgehen: Wer zuletzt ansagt, darf nicht so ansagen, dass die Summe genau der Stichzahl entspricht." : " Die Ansagen sind frei."}</p>
          <p><b><Hat /> Zauberhut</b> gewinnt immer (der erste gespielte). <b>Niete</b> verliert immer. Beide darf man jederzeit spielen.</p>
          <p>Ansage genau getroffen: <b>20 + 10 pro Stich</b>. Daneben: <b>−10 pro Stich</b> Abweichung.</p>
        </section>}
      </aside></div>

      {(s.stage === "between" || s.stage === "over") && (
        <div className="overlay"><div className="card">
          <h2>{s.stage === "over" ? `🏆 ${s.winners.map((i) => s.names[i]).join(" & ")} ${s.winners.length > 1 ? "gewinnen" : "gewinnt"}!` : `Runde ${s.round} vorbei`}</h2>
          <div className="sr-results">
            {s.names.map((n, i) => ({ n, i })).sort((a, b) => (s.stage === "over" ? s.scores[b.i] - s.scores[a.i] : 0)).map(({ n, i }) => (
              <div key={i} className={"res " + (s.result.pts[i] > 0 ? "hit" : "miss")}>
                <b>{n}</b>
                <span>{s.result.tricks[i]} / {s.result.bids[i]} Stiche</span>
                <span className="pts">{s.result.pts[i] > 0 ? "+" : ""}{s.result.pts[i]}</span>
                <span className="total">{s.scores[i]}</span>
              </div>
            ))}
          </div>
          {s.stage === "between" && (tv ? <p>Die nächste Runde startet ihr am Handy.</p>
            : <div className="opts"><button className="wide on" onClick={() => act({ type: "next" })}>Runde {s.round + 1} starten</button></div>)}
          {s.stage === "over" && (me.host
            ? <div className="opts"><button className="wide on" onClick={() => socket.emit("start")}>Nochmal spielen</button><button className="wide" onClick={() => socket.emit("lobby")}>Etwas anderes spielen</button></div>
            : <p>Warte auf den Host …</p>)}
          <button className="ghost" onClick={onLeave}>Raum verlassen</button>
        </div></div>
      )}
    </main>
  );
}
