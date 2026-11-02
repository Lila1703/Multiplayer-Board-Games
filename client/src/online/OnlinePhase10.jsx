import { useState, useEffect } from "react";
import { PHASES, PHASE_NAMES, info, canHit, doneCards, runStarts, runOrder } from "../shared/phase10";
import "./Phase10.css";

const COL = ["red", "blue", "green", "yellow"];
const COL_DE = ["Rot", "Blau", "Grün", "Gelb"];
const label = (id) => { const c = info(id); return c.t === "w" ? "Joker" : c.t === "s" ? "Aussetzen" : `${COL_DE[c.c]} ${c.n}`; };
const sortKey = (id) => { const c = info(id); return c.t === "n" ? c.n * 10 + c.c : c.t === "w" ? 200 : 300; };
const meldLabel = (m) => m.kind === "set" ? `Gleiche Zahl ${m.num}` : m.kind === "run" ? `Folge ${m.lo}–${m.hi}` : `Farbe ${COL_DE[m.color]}`;

const TIPS = { w: "Joker: ersetzt jede beliebige Karte.", s: "Aussetzen: ein Mitspieler muss einmal aussetzen." };

function Card({ id, sel, small, back, as, done, onClick }) {
  const c = back ? null : info(id);
  const cls = "pcard" + (back ? " back" : c.t === "n" ? " " + COL[c.c] : c.t === "w" ? " wild" : " skip") + (sel ? " sel" : "") + (done ? " done" : "") + (small ? " small" : "");
  return (
    <button className={cls} disabled={!onClick} onClick={onClick} aria-label={back ? "Stapel" : label(id)} title={back ? undefined : done ? "Gehört zu einer fertigen Gruppe deiner Phase." : c.t === "w" && as ? `Joker als ${as}` : TIPS[c.t]}>
      {back ? "" : c.t === "n" ? c.n : c.t === "w" ? (as ? <>W<span className="as">{as}</span></> : "W") : "⊘"}
    </button>
  );
}

export default function OnlinePhase10({ room, me, socket, onLeave }) {
  const s = room.state;
  const mine = me.index;
  const running = s.stage === "draw" || s.stage === "play";
  const myTurn = s.cur === mine && running;
  const [sel, setSel] = useState([]);
  const [pending, setPending] = useState(null); // Aktion, die erst nach Rückfrage ausgeführt wird
  const [layChoice, setLayChoice] = useState(null); // Phase abgeben: wo liegen die Joker in den Folgen?
  const [hitChoice, setHitChoice] = useState(null); // Joker an eine Folge: vorne oder hinten?
  const [err, setErr] = useState("");
  const [drawn, setDrawn] = useState(null); // die in diesem Zug gezogene Karte

  // Auswahl an die aktuelle Hand anpassen
  useEffect(() => {
    setSel((x) => x.filter((id) => s.hand.includes(id)));
  }, [s.hand]);
  useEffect(() => { setSel([]); setErr(""); setPending(null); }, [s.handNo]);
  useEffect(() => {
    setDrawn(s.stage === "play" && s.cur === mine ? s.hand[s.hand.length - 1] : null);
  }, [s.stage, s.cur, s.handNo]);

  const act = (a, done) => socket.emit("p:act", a, (res) => {
    if (res?.error) setErr(res.error); else { setErr(""); done?.(); }
  });
  const free = [...s.hand].sort((a, b) => sortKey(a) - sortKey(b));
  const drawnCard = drawn !== null && free.includes(drawn) ? drawn : null;
  const rest = free.filter((id) => id !== drawnCard);
  const done = !s.laid[mine] && s.phases[mine] <= 10 ? doneCards(s.hand, s.phases[mine]) : { ids: new Set(), complete: false, groups: [] };
  useEffect(() => { setPending(null); setLayChoice(null); setHitChoice(null); }, [myTurn, s.stage]);
  const toggle = (id) => setSel((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));
  const one = sel.length === 1 ? sel[0] : null;
  const isSkip = one !== null && info(one).t === "s";
  const who = room.players[s.cur];
  // Folgen mit Jokern am Rand können verschieden liegen – dann fragen wir nach
  const layPhase = () => {
    const reqs = PHASES[s.phases[mine] - 1];
    const options = done.groups.map((g, i) => (reqs[i].k === "run" ? runStarts(reqs[i].n, g) : []));
    if (options.some((o) => o.length > 1)) setLayChoice({ options, picked: options.map((o) => o[o.length - 1] ?? null) });
    else act({ type: "lay", groups: done.groups });
  };
  const hit = (m, i) => {
    if (m.kind === "run" && info(one).t === "w" && m.lo > 1 && m.hi < 12) setHitChoice({ meld: i, m, card: one });
    else act({ type: "hit", meld: i, card: one });
  };
  // Wer seine fertige Phase nicht abgibt und stattdessen abwirft, wird vorher gefragt
  const tryDiscard = (a) => (myTurn && s.stage === "play" && !s.laid[mine] && done.complete ? setPending(a) : act(a));

  const hint = err || (myTurn
    ? s.stage === "draw" ? "Ziehe vom Stapel oder nimm die oberste Karte der Ablage."
      : s.laid[mine] ? "Karte wählen und auf eine Gruppe tippen, um sie anzulegen (auch bei Mitspielern). Zum Schluss eine Karte abwerfen oder alle Karten loswerden."
      : done.complete ? "Deine Phase ist komplett – klicke auf „Phase abgeben“."
      : "Wähle eine Karte zum Abwerfen."
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
        <h3>Deine Phase {Math.min(s.phases[mine], 10)}: {PHASE_NAMES[Math.min(s.phases[mine], 10) - 1]}</h3>
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
                      onClick={canTap ? () => hit(m, i) : undefined}>
                      <small>{meldLabel(m)}</small>
                      <div className="cards">{(m.kind === "run" ? m.cards : [...m.cards].sort((a, b) => sortKey(a) - sortKey(b))).map((id, k) => <Card key={id} id={id} small as={m.kind === "run" ? m.lo + k : undefined} />)}</div>
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
        {done.ids.size > 0 && (
          <p className="legend">
            Angehobene Karten gehören schon zu fertigen Gruppen deiner Phase – besser nicht abwerfen.
            {done.complete && <b> Deine Phase ist komplett, du kannst sie abgeben!</b>}
          </p>
        )}
        {drawnCard !== null && (
          <div className="drawn">
            <span>Neu gezogen:</span>
            <Card id={drawnCard} sel={sel.includes(drawnCard)} done={done.ids.has(drawnCard)} onClick={myTurn && s.stage === "play" ? () => toggle(drawnCard) : undefined} />
          </div>
        )}
        <div className="cards">{rest.map((id) => <Card key={id} id={id} sel={sel.includes(id)} done={done.ids.has(id)} onClick={myTurn && s.stage === "play" ? () => toggle(id) : undefined} />)}</div>

        {myTurn && s.stage === "play" && !s.laid[mine] && (
          <div className="row">
            <button className="go" disabled={!done.complete} onClick={layPhase}>Phase abgeben</button>
          </div>
        )}

        {myTurn && s.stage === "play" && (
          <div className="row">
            {!isSkip && <button disabled={one === null} onClick={() => tryDiscard({ type: "discard", card: one })}>Karte abwerfen</button>}
            {isSkip && room.players.map((p, i) => i !== mine && (
              <button key={i} onClick={() => tryDiscard({ type: "discard", card: one, target: i })}>Abwerfen – {p.name} setzt aus</button>))}
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
                  <b>{n}.</b> {PHASE_NAMES[i]}
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
            <p><b>Joker</b> ersetzt jede beliebige Karte (Zahl und Farbe). Jede Gruppe braucht aber mindestens eine Zahlenkarte. In einer Folge kannst du einen Joker gegen die passende Zahlenkarte austauschen und nimmst ihn auf die Hand. Strafpunkte: 25.</p>
          </div>
          <div className="special">
            <Card id={104} small />
            <p><b>Aussetzen</b>: Beim Abwerfen wählst du einen Mitspieler, der seinen nächsten Zug auslässt. Die Karte kann nicht in Gruppen gelegt und nicht von der Ablage genommen werden. Strafpunkte: 15.</p>
          </div>
        </section>
      </aside>
      </div>

      {pending && (
        <div className="overlay"><div className="card">
          <h2>Phase noch nicht abgegeben</h2>
          <p>Du könntest jetzt deine Phase abgeben. Willst du stattdessen wirklich nur eine Karte abwerfen?</p>
          <div className="opts">
            <button className="wide on" onClick={() => { setPending(null); layPhase(); }}>Phase abgeben</button>
            <button className="wide" onClick={() => { const a = pending; setPending(null); act(a); }}>Trotzdem abwerfen</button>
          </div>
          <button className="ghost" onClick={() => setPending(null)}>Zurück</button>
        </div></div>
      )}

      {layChoice && (
        <div className="overlay"><div className="card">
          <h2>Wo sollen die Joker liegen?</h2>
          <p>Deine Folge kann an verschiedenen Stellen beginnen. Wähle, wie du sie ablegen willst.</p>
          {layChoice.options.map((starts, gi) => starts.length > 1 && (
            <div className="choices" key={gi}>
              {starts.map((st) => (
                <button key={st} type="button" className={"choice" + (layChoice.picked[gi] === st ? " on" : "")}
                  onClick={() => setLayChoice({ ...layChoice, picked: layChoice.picked.map((p, k) => (k === gi ? st : p)) })}>
                  <small>Folge {st}–{st + done.groups[gi].length - 1}</small>
                  <span className="cards">{runOrder(done.groups[gi], st).map((id, k) => <Card key={id} id={id} small as={st + k} />)}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="opts">
            <button className="wide on" onClick={() => { const c = layChoice; setLayChoice(null); act({ type: "lay", groups: done.groups, starts: c.picked }); }}>Phase abgeben</button>
          </div>
          <button className="ghost" onClick={() => setLayChoice(null)}>Abbrechen</button>
        </div></div>
      )}

      {hitChoice && (
        <div className="overlay"><div className="card">
          <h2>Joker anlegen</h2>
          <p>An welches Ende der Folge {hitChoice.m.lo}–{hitChoice.m.hi} soll der Joker?</p>
          <div className="opts">
            <button className="wide" onClick={() => { const c = hitChoice; setHitChoice(null); act({ type: "hit", meld: c.meld, card: c.card, end: "lo" }); }}>Vorne als {hitChoice.m.lo - 1}</button>
            <button className="wide" onClick={() => { const c = hitChoice; setHitChoice(null); act({ type: "hit", meld: c.meld, card: c.card, end: "hi" }); }}>Hinten als {hitChoice.m.hi + 1}</button>
          </div>
          <button className="ghost" onClick={() => setHitChoice(null)}>Abbrechen</button>
        </div></div>
      )}

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
