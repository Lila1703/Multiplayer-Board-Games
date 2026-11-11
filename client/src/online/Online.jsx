import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import OnlineLudo from "./OnlineLudo";
import OnlineKniffel from "./OnlineKniffel";
import OnlinePhase10 from "./OnlinePhase10";
import OnlineSchwimmen from "./OnlineSchwimmen";
import OnlineZauberstich from "./OnlineZauberstich";
import OnlineSternbilder from "./OnlineSternbilder";

const GAME_NAMES = { ludo: "Mensch ärgere dich nicht", kniffel: "Kniffel", phase10: "Phase 10", schwimmen: "Schwimmen", zauberstich: "Zauberstich", sternbilder: "Sternbilder" };
const MAX_PLAYERS = { ludo: 4, kniffel: 4, phase10: 6, schwimmen: 8, zauberstich: 6, sternbilder: 5 };

const socket = io({ autoConnect: false });
const hashCode = () => (location.hash.startsWith("#join=") ? location.hash.slice(6).toUpperCase() : "");
// Teilen-Menü des Handys (WhatsApp usw.) – nur auf Touch-Geräten, am Desktop bleibt es bei „Link kopieren“
const canShare = typeof navigator.share === "function" && !!window.matchMedia?.("(pointer: coarse)").matches;
// Läuft gerade eine Partie? (Gegenstück zu isOver im Server)
const running = (r) => !!r?.state && !(r.game === "kniffel" ? r.state.over
  : ["phase10", "schwimmen", "zauberstich", "sternbilder"].includes(r.game) ? r.state.stage === "over" : r.state.winner !== null);

// Hält den Bildschirm wach, solange active gilt – sonst sperrt das Handy beim Warten auf die anderen, und man gilt als offline.
// Der Browser gibt die Sperre frei, sobald die Seite in den Hintergrund geht; beim Zurückkommen wird sie deshalb neu angefordert.
function useWakeLock(active) {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return; // nicht jeder Browser kann das, und nur über https
    let lock = null, gone = false;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then((l) => (gone ? l.release() : void (lock = l))).catch(() => {}); // z. B. im Stromsparmodus nicht erlaubt
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => { gone = true; document.removeEventListener("visibilitychange", request); lock?.release().catch(() => {}); };
  }, [active]);
}

export default function Online({ onBack }) {
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [asking, setAsking] = useState(false); // Rückfrage „Spiel verlassen?“ ist offen
  const [error, setError] = useState("");
  const [name, setName] = useState(localStorage.getItem("name") || "Spieler");
  const [code, setCode] = useState(hashCode());
  const [scoring, setScoring] = useState(false); // Phase 10: mit Strafpunkten?
  const [noEven, setNoEven] = useState(true); // Zauberstich: Ansagen dürfen nicht aufgehen?
  const [memory, setMemory] = useState(false); // Sternbilder: Gedächtnis-Modus (Hinweise verschwinden wieder)?

  useEffect(() => {
    const rejoin = () => {
      const s = JSON.parse(localStorage.getItem("session") || "null");
      if (!s || (hashCode() && hashCode() !== s.code)) return;
      socket.emit("join", { code: s.code, token: s.token, name }, (res) => {
        if (res.error) localStorage.removeItem("session"); else setMe(res);
      });
    };
    // Ist die Partie inzwischen vorbei, hat sich eine offene Rückfrage „Spiel verlassen?“ erledigt
    const onRoom = (r) => { setRoom(r); if (!running(r)) setAsking(false); };
    socket.on("connect", rejoin);
    socket.on("room", onRoom);
    socket.connect();
    return () => { socket.off("connect", rejoin); socket.off("room", onRoom); socket.disconnect(); };
  }, []);

  const enter = (event, payload) => {
    localStorage.setItem("name", name);
    socket.emit(event, { ...payload, name }, (res) => {
      if (res.error) return setError(res.error);
      setError(""); setMe(res);
      localStorage.setItem("session", JSON.stringify({ code: res.code, token: res.token }));
      history.replaceState(null, "", `#join=${res.code}`);
    });
  };
  const leave = () => {
    localStorage.removeItem("session");
    history.replaceState(null, "", location.pathname);
    onBack();
  };
  // Mitten in einer Partie erst nachfragen: Wer geht, kann in diese Partie nicht wieder einsteigen
  const askLeave = () => (running(room) ? setAsking(true) : leave());
  useWakeLock(!!(room && me && room.state));

  const link = room ? `${location.origin}${location.pathname}#join=${room.code}` : "";
  const share = () => navigator.share({ title: "SynCard", text: `Komm in meinen Raum ${room.code} – wir spielen ${GAME_NAMES[room.game] || GAME_NAMES.ludo}:`, url: link })
    .catch(() => {}); // Abbrechen des Teilen-Menüs ist kein Fehler

  if (room && me && room.state) {
    const View = { kniffel: OnlineKniffel, phase10: OnlinePhase10, schwimmen: OnlineSchwimmen, zauberstich: OnlineZauberstich, sternbilder: OnlineSternbilder }[room.game] || OnlineLudo;
    return (
      <>
        <View room={room} me={me} socket={socket} onLeave={askLeave} />
        {asking && running(room) && (
          <div className="overlay"><div className="card">
            <h2>Spiel verlassen?</h2>
            <p>Die Partie läuft noch. Wenn du gehst, kannst du in diese Partie nicht wieder einsteigen.</p>
            <div className="opts">
              <button className="wide on" onClick={() => setAsking(false)}>Weiterspielen</button>
              <button className="wide" onClick={leave}>Verlassen</button>
            </div>
          </div></div>
        )}
      </>
    );
  }

  return (
    <div className="overlay"><div className="card">
      <h2>Online spielen</h2>
      {!room || !me ? (
        <>
          <p>Wähle ein Spiel und erstelle einen Raum:</p>
          <div className="names">
            <input value={name} maxLength={16} aria-label="Dein Name" onFocus={(e) => e.target.select()} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="opts">
            <button className="wide on" onClick={() => enter("create", { game: "ludo" })}>Mensch ärgere dich nicht</button>
            <button className="wide on" onClick={() => enter("create", { game: "kniffel" })}>Kniffel</button>
            <button className="wide on" onClick={() => enter("create", { game: "phase10" })}>Phase 10</button>
            <button className="wide on" onClick={() => enter("create", { game: "schwimmen" })}>Schwimmen</button>
            <button className="wide on" onClick={() => enter("create", { game: "zauberstich" })}>Zauberstich</button>
            <button className="wide on" onClick={() => enter("create", { game: "sternbilder" })}>Sternbilder (kooperativ)</button>
          </div>
          <p>oder mit Code beitreten</p>
          <div className="names">
            {/* Die Handytastatur soll den Code nicht „korrigieren“; Enter tritt bei */}
            <input value={code} maxLength={4} placeholder="Raumcode" aria-label="Raumcode"
              autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="go"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") enter("join", { code }); }} />
          </div>
          <div className="opts"><button className="wide" onClick={() => enter("join", { code })}>Beitreten</button></div>
          {error && <p role="alert"><b>{error}</b></p>}
        </>
      ) : (
        <>
          <p><b>{GAME_NAMES[room.game] || GAME_NAMES.ludo}</b> · Raum <b>{room.code}</b><br />Schick diesen Link an deine Mitspieler:</p>
          <div className="names">
            <input readOnly value={link} aria-label="Einladungslink" onFocus={(e) => e.target.select()} />
          </div>
          <div className="opts">
            {canShare && <button className="wide on" onClick={share}>Teilen</button>}
            <button className="wide" onClick={() => navigator.clipboard?.writeText(link)}>Link kopieren</button>
          </div>
          <p>{room.players.map((p, i) => (
            <span key={i}>{p.name}{i === 0 ? " (Host)" : ""}{i === me.index ? " (du)" : ""}{p.connected ? "" : " – offline"}<br /></span>
          ))}</p>
          {me.index === 0 ? (
            <>
              <p>Spiel:</p>
              <div className="opts">
                {Object.entries(GAME_NAMES).map(([id, label]) => (
                  <button key={id} type="button" className={"wide" + (room.game === id ? " on" : "")}
                    disabled={room.players.length > MAX_PLAYERS[id]} title={room.players.length > MAX_PLAYERS[id] ? `Höchstens ${MAX_PLAYERS[id]} Spieler` : undefined}
                    onClick={() => socket.emit("game", id)}>{label}</button>
                ))}
              </div>
              {room.game === "phase10" && (
                <>
                  <p>Spielmodus:</p>
                  <div className="opts">
                    <button type="button" className={"wide" + (!scoring ? " on" : "")} onClick={() => setScoring(false)}>Ohne Strafpunkte</button>
                    <button type="button" className={"wide" + (scoring ? " on" : "")} onClick={() => setScoring(true)}>Mit Strafpunkten</button>
                  </div>
                  <p>{scoring
                    ? "Nach jeder Runde gibt es Strafpunkte für die Karten auf der Hand. Wer Phase 10 schafft, gewinnt (bei Gleichstand: weniger Punkte)."
                    : "Keine Punkte: Jeder rückt weiter, sobald er seine Phase geschafft hat. Wer zuerst Phase 10 schafft, gewinnt."}</p>
                </>
              )}
              {room.game === "zauberstich" && (
                <>
                  <p>Ansagen:</p>
                  <div className="opts">
                    <button type="button" className={"wide" + (noEven ? " on" : "")} onClick={() => setNoEven(true)}>Dürfen nicht aufgehen</button>
                    <button type="button" className={"wide" + (!noEven ? " on" : "")} onClick={() => setNoEven(false)}>Frei</button>
                  </div>
                  <p>{noEven
                    ? "Wer zuletzt ansagt, darf nicht so ansagen, dass die Summe aller Ansagen genau der Stichzahl der Runde entspricht – mindestens einer liegt also immer daneben."
                    : "Jeder darf frei ansagen, auch der Letzte."}</p>
                </>
              )}
              {room.game === "sternbilder" && (
                <>
                  <p>Kooperativ für 2–5 Spieler: Ihr seht alle Karten außer euren eigenen und legt gemeinsam fünf Sternbilder von 1 bis 5 aus – nur mit Hinweisen.</p>
                  <p>Hinweise:</p>
                  <div className="opts">
                    <button type="button" className={"wide" + (!memory ? " on" : "")} onClick={() => setMemory(false)}>Bleiben sichtbar</button>
                    <button type="button" className={"wide" + (memory ? " on" : "")} onClick={() => setMemory(true)}>Gedächtnis-Modus (schwer)</button>
                  </div>
                  <p>{memory
                    ? "Wie am Tisch: Ein Hinweis ist nur zu sehen, bis der Empfänger das nächste Mal am Zug war. Danach muss sich jeder selbst merken, was er weiß – oder sich mit der Reihenfolge seiner Karten helfen."
                    : "Was dir über deine Karten verraten wurde, bleibt auf den Karten stehen."}</p>
                </>
              )}
              <div className="opts">
                <button className="wide on" disabled={room.players.length < 2} onClick={() => socket.emit("start", { scoring, noEven, memory })}>
                  {room.players.length < 2 ? "Warte auf Mitspieler …" : "Spiel starten"}
                </button>
              </div>
            </>
          ) : <p>Warte, bis der Host das Spiel startet …</p>}
        </>
      )}
      <button className="ghost" onClick={leave}>Zurück zur Auswahl</button>
    </div></div>
  );
}
