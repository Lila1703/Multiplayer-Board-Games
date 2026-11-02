import { useState, useEffect } from "react";
import { PHASES, groupLabel, info, canHit } from "../shared/phase10";
import "./Phase10.css";

const COL = ["red", "blue", "green", "yellow"];
const COL_DE = ["Rot", "Blau", "Grün", "Gelb"];
const label = (id) => { const c = info(id); return c.t === "w" ? "Joker" : c.t === "s" ? "Aussetzen" : `${COL_DE[c.c]} ${c.n}`; };
const sortKey = (id) => { const c = info(id); return c.t === "n" ? c.n * 10 + c.c : c.t === "w" ? 200 : 300; };
const meldLabel = (m) => m.kind === "set" ? `Gleiche Zahl ${m.num}` : m.kind === "run" ? `Folge ${m.lo}–${m.hi}` : `Farbe ${COL_DE[m.color]}`;

const TIPS = { w: "Joker: ersetzt jede beliebige Karte.", s: "Aussetzen: ein Mitspieler muss einmal aussetzen." };

function Card({ id, sel, small, back, onClick }) {
  const c = back ? null : info(id);
  const cls = "pcard" + (back ? " back" : c.t === "n" ? " " + COL[c.c] : c.t === "w" ? " wild" : " skip") + (sel ? " sel" : "") + (small ? " small" : "");
  return (
    <button className={cls} disabled={!onClick} onClick={onClick} aria-label={back ? "Stapel" : label(id)} title={back ? undefined : TIPS[c.t]}>
      {back ? "" : c.t === "n" ? c.n : c.t === "w" ? "W" : "⊘"}
    </button>
  );
}

export default function OnlinePhase10({ room, me, socket, onLeave }) {
  const s = room.state;
  const mine = me.index;
  const running = s.stage === "draw" || s.stage === "play";
  const myTurn = s.cur === mine && running;
  const [sel, setSel] = useState([]);
  const [groups, setGroups] = useState([]);
  const [err, setErr] = useState("");
  const [drawn, setDrawn] = useState(null); // die in diesem Zug gezogene Karte

  // Auswahl und vorbereitete Gruppen an die aktuelle Hand anpassen
  useEffect(() => {
    setSel((x) => x.filter((id) => s.hand.includes(id)));
    setGroups((g) => g.map((gr) => gr.filter((id) => s.hand.includes(id))));
  }, [s.hand]);
  useEffect(() => { setGroups([]); setSel([]); setErr(""); }, [s.handNo]);
  useEffect(() => {
    setDrawn(s.stage === "play" && s.cur === mine ? s.hand[s.hand.length - 1] : null);
  }, [s.stage, s.cur, s.handNo]);

  const act = (a, done) => socket.emit("p:act", a, (res) => {
    if (res?.error) setErr(res.error); else { setErr(""); done?.(); }
  });
  const req = PHASES[Math.min(s.phases[mine], 10) - 1];
  const staged = groups.flat();
  const free = s.hand.filter((id) => !staged.includes(id)).sort((a, b) => sortKey(a) - sortKey(b));
  const drawnCard = drawn !== null && free.includes(drawn) ? drawn : null;
  const rest = free.filter((id) => id !== drawnCard);
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));
  const assign = (i) => {
    setGroups((g) => { const n = g.map((gr) => gr.filter((id) => !sel.includes(id))); n[i] = [...(n[i] || []), ...sel]; return n; });
    setSel([]);
  };
  const one = sel.length === 1 ? sel[0] : null;
  const isSkip = one !== null && info(one).t === "s";
  const who = room.players[s.cur];
  const stagedReady = !s.laid[mine] && req && groups.length === req.length && req.every((_, i) => groups[i]?.length);

  const hint = err || (myTurn
    ? s.stage === "draw" ? "Ziehe vom Stapel oder nimm die oberste Karte der Ablage."
      : s.laid[mine] ? "Karte wählen und auf eine Gruppe tippen (auch bei Mitspielern) – oder mehrere Karten als weitere Gruppe ablegen. Zum Schluss eine Karte abwerfen."
      : "Wähle Karten und ordne sie den Gruppen deiner Phase zu – oder wirf eine Karte ab."
    : running ? `${who.name} ist dran …` : "");

  return (
    <main className="p10">
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onLeave}>← Verlassen</button>
        <h1>Phase 10 · {room.code}</h1>
        <div className="status" aria-live="polite"><b>{who.name}</b> ist dran{who.connected ? "" : " (offline)"} · Runde {s.handNo} · {s.scoring ? "mit" : "ohne"} Strafpunkte</div>
      </header>

      <div className="p10-layout"><div className="p10-main">
      <section className="sheet"><div className="scroll"><table>
        <thead><tr><th>Spieler</th><th>Phase</th>{s.scoring && <th>Punkte</th>}<th>Karten</th><th>Abgelegt</th></tr></thead>
        <tbody>{room.players.map((p, i) => (
          <tr key={i} className={i === s.cur && running ? "active-col" : ""}>
            <td>{p.name}{i === mine ? " (du)" : ""}{p.connected ? "" : " – offline"}</td>
            <td>{s.phases[i] > 10 ? "✓" : s.phases[i]}</td>{s.scoring && <td>{s.scores[i]}</td>}<td>{s.sizes[i]}</td><td>{s.laid[i] ? "✓" : ""}</td>
          </tr>))}
        </tbody>
      </table></div></section>

      <section className="panel">
        <h3>Deine Phase {Math.min(s.phases[mine], 10)}: {req.map(groupLabel).join(" + ")}</h3>
        <div className="piles">
          <Card back onClick={myTurn && s.stage === "draw" ? () => act({ type: "draw", from: "deck" }) : undefined} />
          <Card id={s.discard} onClick={myTurn && s.stage === "draw" ? () => act({ type: "draw", from: "discard" }) : undefined} />
          <span>Stapel ({s.deck}) · Ablage</span>
        </div>
        <p className="msg">{s.msg}</p>
      </section>

      <section className="panel table">
        <h3>Tisch – abgelegte Gruppen (für alle sichtbar)</h3>
        {room.players.map((p, pi) => {
          const theirs = s.melds.map((m, i) => ({ m, i })).filter(({ m }) => m.owner === pi);
          return (
            <div className="seat" key={pi}>
              <div className="seatname">{p.name}{pi === mine ? " (du)" : ""}</div>
              {theirs.length === 0 && <span className="empty">noch nichts abgelegt</span>}
              <div className="melds">
                {theirs.map(({ m, i }) => {
                  const canTap = myTurn && s.stage === "play" && s.laid[mine] && one !== null && !isSkip;
                  const Tag = canTap ? "button" : "div";
                  const fits = canTap && canHit(m, one);
                  return (
                    <Tag key={i} className={"meld" + (canTap ? " tap" : "") + (fits ? " fit" : "")}
                      onClick={canTap ? () => act({ type: "hit", meld: i, card: one }) : undefined}>
                      <small>{meldLabel(m)}</small>
                      <div className="cards">{[...m.cards].sort((a, b) => sortKey(a) - sortKey(b)).map((id) => <Card key={id} id={id} small />)}</div>
                    </Tag>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="panel">
        <h3>Deine Hand</h3>
        {drawnCard !== null && (
          <div className="drawn">
            <span>Neu gezogen:</span>
            <Card id={drawnCard} sel={sel.includes(drawnCard)} onClick={myTurn && s.stage === "play" ? () => toggle(drawnCard) : undefined} />
          </div>
        )}
        <div className="cards">{rest.map((id) => <Card key={id} id={id} sel={sel.includes(id)} onClick={myTurn && s.stage === "play" ? () => toggle(id) : undefined} />)}</div>

        {myTurn && s.stage === "play" && !s.laid[mine] && (
          <>
            {req.map((r, i) => (
              <div className="row" key={i}>
                <button disabled={!sel.length} onClick={() => assign(i)}>Auswahl → {groupLabel(r)}</button>
                <span className="cards">{(groups[i] || []).map((id) => (
                  <Card key={id} id={id} small onClick={() => setGroups((g) => g.map((gr, k) => (k === i ? gr.filter((x) => x !== id) : gr)))} />))}</span>
              </div>
            ))}
            <div className="row"><button className="go" disabled={!stagedReady} onClick={() => act({ type: "lay", groups }, () => setGroups([]))}>Phase ablegen</button></div>
          </>
        )}

        {myTurn && s.stage === "play" && s.laid[mine] && (
          <div className="row">
            {[...new Set(req.map((r) => r.k))].filter((k) => k === "set" || k === "run").map((k) => (
              <button key={k} disabled={sel.length < (k === "set" ? 3 : 4)}
                onClick={() => act({ type: "extra", kind: k, ids: sel }, () => setSel([]))}>
                Auswahl als weitere {k === "set" ? "Gruppe gleicher Zahl (ab 3)" : "Folge (ab 4)"} ablegen
              </button>))}
          </div>
        )}

        {myTurn && s.stage === "play" && (
          <div className="row">
            {!isSkip && <button disabled={one === null} onClick={() => act({ type: "discard", card: one })}>Karte abwerfen</button>}
            {isSkip && room.players.map((p, i) => i !== mine && (
              <button key={i} onClick={() => act({ type: "discard", card: one, target: i })}>Abwerfen – {p.name} setzt aus</button>))}
          </div>
        )}
        <p className="msg">{hint}</p>
      </section>

      </div>

      <aside className="p10-side">
        <section className="panel">
          <h3>Alle Phasen</h3>
          <ol className="phases">
            {PHASES.map((ph, i) => {
              const n = i + 1;
              const here = room.players.filter((_, k) => s.phases[k] === n).map((p) => p.name);
              return (
                <li key={n} className={n === s.phases[mine] ? "now" : n < s.phases[mine] ? "done" : ""}>
                  <b>{n}.</b> {ph.map(groupLabel).join(" + ")}
                  {here.length > 0 && <small>{here.join(", ")}</small>}
                </li>
              );
            })}
          </ol>
        </section>
        <section className="panel">
          <h3>Sonderkarten</h3>
          <div className="special">
            <Card id={96} small />
            <p><b>Joker</b> ersetzt jede beliebige Karte (Zahl und Farbe). Jede Gruppe braucht aber mindestens eine Zahlenkarte. Strafpunkte: 25.</p>
          </div>
          <div className="special">
            <Card id={104} small />
            <p><b>Aussetzen</b>: Beim Abwerfen wählst du einen Mitspieler, der seinen nächsten Zug auslässt. Die Karte kann nicht in Gruppen gelegt und nicht von der Ablage genommen werden. Strafpunkte: 15.</p>
          </div>
        </section>
      </aside>
      </div>

      {!running && (
        <div className="overlay"><div className="card">
          <h2>{s.stage === "over" ? `${s.names[s.winner]} gewinnt!` : s.out === null ? "Alle haben ihre Phase geschafft!" : `${s.names[s.out]} ist fertig!`}</h2>
          <p>{s.names.map((n, i) => (
            <span key={i}>{n}: {s.scoring ? `+${s.points[i]} (gesamt ${s.scores[i]}) – ` : ""}{s.laid[i] ? "Phase geschafft" : "Phase nicht geschafft"} – {s.phases[i] > 10 ? "alle Phasen durch" : s.laid[i] ? `weiter mit Phase ${s.phases[i]}` : `bleibt bei Phase ${s.phases[i]}`}<br /></span>))}</p>
          {s.stage === "between" && <div className="opts"><button className="wide on" onClick={() => act({ type: "next" })}>Nächste Runde</button></div>}
          {s.stage === "over" && (me.index === 0
            ? <div className="opts"><button className="wide on" onClick={() => socket.emit("start")}>Nochmal spielen</button></div>
            : <p>Warte auf den Host …</p>)}
          <button className="ghost" onClick={onLeave}>Raum verlassen</button>
        </div></div>
      )}
    </main>
  );
}
