import { useEffect, useRef, useState } from "react";
import { LIVES, PENALTY, LEVEL_NAMES, row, col, sees } from "../shared/sudoku";
import "./Sudoku.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const fmtTime = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

function Hearts({ lives }) {
  return (
    <span className="su-hearts" role="img" aria-label={`${lives} von ${LIVES} Leben`}>
      {Array.from({ length: LIVES }, (_, i) => <span key={i} className={i < lives ? "" : "lost"} aria-hidden="true">♥</span>)}
    </span>
  );
}

// Laufende Serverzeit: Der Server schickt mit jedem Stand seine Uhrzeit mit, dazwischen zählt der Browser selbst weiter
function useServerClock(serverNow) {
  const offset = useRef(0);
  const [t, setT] = useState(serverNow);
  useEffect(() => { offset.current = serverNow - Date.now(); }, [serverNow]);
  useEffect(() => {
    const id = setInterval(() => setT(Date.now() + offset.current), 250);
    return () => clearInterval(id);
  }, []);
  return t;
}

// Notizen (kleine Kandidatenzahlen) bleiben im Browser: pro Feld eine Bitmaske, Bit n = Ziffer n
const loadNotes = (key) => {
  try {
    const n = JSON.parse(sessionStorage.getItem(key) || "null");
    if (Array.isArray(n) && n.length === 81) return n;
  } catch { /* kein Speicher (z. B. privates Fenster): dann eben ohne */ }
  return new Array(81).fill(0);
};

function Board({ room, me, socket, onLeave }) {
  const s = room.state;
  const mine = me.index;
  const my = s.players[mine];
  const over = s.stage === "over";
  const playing = !over && my.doneAt === null && my.outAt === null;
  const notesKey = `sudoku-notes-${room.code}-${s.startedAt}`;
  const [sel, setSel] = useState(null);
  const [noteMode, setNoteMode] = useState(false);
  const [notes, setNotes] = useState(() => loadNotes(notesKey));
  const [msg, setMsg] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const clock = useServerClock(s.now);
  const grid = useRef(null);

  useEffect(() => {
    try { sessionStorage.setItem(notesKey, JSON.stringify(notes)); } catch { /* siehe loadNotes */ }
  }, [notes, notesKey]);

  const open = sel !== null && !s.grid[sel]; // das gewählte Feld ist noch zu füllen
  const input = (d) => {
    if (!playing || !open) return;
    const cell = sel;
    if (noteMode) return setNotes((n) => n.map((m, i) => (i === cell ? m ^ (1 << d) : m)));
    socket.emit("su:act", { type: "set", cell, digit: d }, (res) => {
      if (res?.error) return setMsg(res.error);
      if (res?.wrong) {
        setMsg("Falsch! Ein Leben weniger und 10 Sekunden Strafe.");
        navigator.vibrate?.(120);
      } else {
        setMsg("");
        // Die Zahl steht jetzt fest: Notizen im Feld und dieselbe Ziffer in Zeile, Spalte und Block weg
        setNotes((n) => n.map((m, i) => (i === cell ? 0 : sees(i, cell) ? m & ~(1 << d) : m)));
      }
    });
  };
  const erase = () => {
    if (!playing || !open) return;
    const cell = sel;
    setNotes((n) => n.map((m, i) => (i === cell ? 0 : m)));
    if (s.wrong[cell]) socket.emit("su:act", { type: "clear", cell });
    setMsg("");
  };

  // Tastatur am PC: Ziffern tragen ein, Pfeile bewegen die Auswahl, Entf löscht, N schaltet die Notizen um
  useEffect(() => {
    const onKey = (e) => {
      if (!playing || e.ctrlKey || e.metaKey || e.altKey || e.target.tagName === "INPUT") return;
      const move = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (move) {
        e.preventDefault();
        const to = sel === null ? 40 : sel + move;
        // nicht über den Rand hinaus und nicht in die nächste Zeile rutschen; der Tastaturfokus wandert mit
        if (sel === null || (to >= 0 && to <= 80 && (Math.abs(move) === 9 || row(to) === row(sel)))) {
          setSel(to);
          grid.current?.children[to]?.focus();
        }
      } else if (e.key >= "1" && e.key <= "9") input(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
      else if (e.key === "n" || e.key === "N") setNoteMode((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const timeOf = (p) => (p.doneAt ?? p.outAt ?? (over ? s.endedAt : clock)) - s.startedAt + p.errors * PENALTY;
  const selDigit = sel === null ? 0 : s.grid[sel] || s.wrong[sel];
  const winner = over && s.ranking[0].time !== null ? s.ranking[0] : null;
  const hint = sel === null ? "Tippe ein leeres Feld an und dann eine Zahl."
    : noteMode ? "Notizen sind an: Zahlen werden klein eingetragen und nicht geprüft."
    : !open ? "Dieses Feld ist schon ausgefüllt." : "";

  return (
    <main className="su">
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onLeave}>← Verlassen</button>
        <h1>Sudoku Battle · {room.code}</h1>
        <div className="status" aria-live="off">
          {LEVEL_NAMES[s.level]} · Zeit <b>{fmtTime(timeOf(my))}</b>
          {my.errors > 0 && ` (mit ${my.errors * PENALTY / 1000} s Strafe)`} · <Hearts lives={my.lives} />
        </div>
      </header>

      <div className="su-layout">
        <section className="su-rivals" aria-label="Spieler">
          {room.players.map((p, i) => {
            const st = s.players[i];
            return (
              <div key={i} className={"su-rival" + (i === mine ? " me" : "") + (st.outAt !== null ? " out" : st.doneAt !== null ? " done" : "")}>
                <div className="su-rival-head">
                  <span className="su-name">{p.name}{i === mine ? " (du)" : ""}{p.connected ? "" : " – offline"}</span>
                  <Hearts lives={st.lives} />
                  <span className="su-count">
                    {st.doneAt !== null ? `✔ ${fmtTime(timeOf(st))}` : st.outAt !== null ? "raus" : `${st.filled}/${s.total}`}
                  </span>
                </div>
                <div className="su-bar"><span style={{ width: `${(100 * st.filled) / s.total}%` }} /></div>
              </div>
            );
          })}
        </section>

        <div className="su-grid" role="group" aria-label="Sudoku" ref={grid}>
          {s.puzzle.map((given, i) => {
            const d = s.grid[i], w = s.wrong[i];
            const cls = "su-cell" + (given ? " given" : d ? " ok" : w ? " bad" : "")
              + (i === sel ? " sel" : sel !== null && sees(i, sel) ? " peer" : "")
              + (selDigit && i !== sel && (d === selDigit || w === selDigit) ? " same" : "")
              + (col(i) % 3 === 2 && col(i) < 8 ? " br" : "") + (row(i) % 3 === 2 && row(i) < 8 ? " bb" : "");
            return (
              <button key={i} className={cls} onClick={() => setSel(i)} aria-pressed={i === sel}
                aria-label={`Zeile ${row(i) + 1}, Spalte ${col(i) + 1}: ${d || (w ? `${w}, falsch` : "leer")}`}>
                {d || w || (notes[i] ? (
                  <span className="su-notes" aria-hidden="true">{DIGITS.map((n) => <span key={n}>{notes[i] & (1 << n) ? n : ""}</span>)}</span>
                ) : "")}
              </button>
            );
          })}
        </div>

        {/* dock: Auf dem Handy klebt das Ziffernfeld am unteren Bildschirmrand (index.css) */}
        <section className="panel dock su-pad">
          {playing ? (
            <>
              <div className="su-digits">
                {DIGITS.map((d) => {
                  const left = 9 - s.grid.filter((x) => x === d).length;
                  return (
                    <button key={d} disabled={!left} onClick={() => input(d)} aria-label={`${d} eintragen, noch ${left} offen`}>
                      {d}<small aria-hidden="true">{left || "✓"}</small>
                    </button>
                  );
                })}
              </div>
              <div className="su-tools">
                <button onClick={erase}>⌫ Löschen</button>
                <button className={noteMode ? "on" : ""} aria-pressed={noteMode} onClick={() => setNoteMode(!noteMode)}>✏️ Notizen {noteMode ? "an" : "aus"}</button>
              </div>
              <p className="msg" aria-live="polite">{msg || hint}</p>
            </>
          ) : (
            <p className="su-done">
              {my.outAt !== null
                ? <><b>Keine Leben mehr – du bist raus.</b> Schau zu, wie weit die anderen kommen.</>
                : <><b>Geschafft in {fmtTime(timeOf(my))}!</b> {over ? "" : "Die anderen spielen noch zu Ende."}</>}
            </p>
          )}
        </section>

        <section className="panel su-rules">
          <h3>Regeln</h3>
          <p>Alle lösen dasselbe Sudoku: In jeder Zeile, jeder Spalte und jedem Block steht jede Zahl von 1 bis 9 genau einmal.
            Eine falsche Zahl wird rot markiert, kostet <b>ein Leben</b> und <b>10 Sekunden</b>. Nach {LIVES} Fehlern bist du raus.
            Es gewinnt die beste Zeit inklusive Strafen. Notizen werden nicht geprüft und kosten nichts.</p>
          {me.host && !over && (
            <div className="su-end">
              {confirmEnd ? (
                <>
                  <span>Partie für alle beenden und jetzt auswerten?</span>
                  <button className="ghost" style={{ margin: 0 }} onClick={() => { socket.emit("su:act", { type: "finish" }); setConfirmEnd(false); }}>Ja, auswerten</button>
                  <button className="ghost" style={{ margin: 0 }} onClick={() => setConfirmEnd(false)}>Abbrechen</button>
                </>
              ) : <button className="ghost" style={{ margin: 0 }} onClick={() => setConfirmEnd(true)}>Partie jetzt auswerten</button>}
            </div>
          )}
        </section>
      </div>

      {over && (
        <div className="overlay"><div className="card su-result">
          <h2>{winner ? `🏆 ${s.names[winner.i]} gewinnt!` : "Niemand hat das Sudoku gelöst"}</h2>
          <p>Schwierigkeit: {LEVEL_NAMES[s.level]}</p>
          <ol className="su-rank">
            {s.ranking.map((r, k) => (
              <li key={r.i} className={r.i === mine ? "me" : ""}>
                <span className="su-place">{k + 1}.</span>
                <span className="su-who">
                  <b>{s.names[r.i]}</b>
                  <small>{r.time !== null
                    ? (r.errors ? `${r.errors} Fehler, ${r.errors * PENALTY / 1000} s Strafe` : "fehlerfrei")
                    : `${r.out ? "ausgeschieden" : "nicht fertig"} · ${r.filled} von ${s.total} Feldern`}</small>
                </span>
                <span className="su-time">{r.time !== null ? fmtTime(r.time) : "–"}</span>
              </li>
            ))}
          </ol>
          {me.host
            ? <div className="opts"><button className="wide on" onClick={() => socket.emit("start")}>Nochmal spielen</button><button className="wide" onClick={() => socket.emit("lobby")}>Etwas anderes spielen</button></div>
            : <p>Warte auf den Host …</p>}
          <button className="ghost" onClick={onLeave}>Raum verlassen</button>
        </div></div>
      )}
    </main>
  );
}

// Jede neue Partie bekommt ein frisches Brett (Auswahl, Notizen und Meldungen der alten Partie verschwinden)
export default function OnlineSudoku(props) {
  return <Board key={props.room.state.startedAt} {...props} />;
}
