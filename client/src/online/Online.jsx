import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import OnlineLudo from "./OnlineLudo";
import OnlineKniffel from "./OnlineKniffel";
import OnlinePhase10 from "./OnlinePhase10";

const GAME_NAMES = { ludo: "Mensch ärgere dich nicht", kniffel: "Kniffel", phase10: "Phase 10" };

const socket = io({ autoConnect: false });
const hashCode = () => (location.hash.startsWith("#join=") ? location.hash.slice(6).toUpperCase() : "");

export default function Online({ onBack }) {
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState(localStorage.getItem("name") || "Spieler");
  const [code, setCode] = useState(hashCode());
  const [scoring, setScoring] = useState(false); // Phase 10: mit Strafpunkten?

  useEffect(() => {
    const rejoin = () => {
      const s = JSON.parse(localStorage.getItem("session") || "null");
      if (!s || (hashCode() && hashCode() !== s.code)) return;
      socket.emit("join", { code: s.code, token: s.token, name }, (res) => {
        if (res.error) localStorage.removeItem("session"); else setMe(res);
      });
    };
    socket.on("connect", rejoin);
    socket.on("room", setRoom);
    socket.connect();
    return () => { socket.off("connect", rejoin); socket.off("room", setRoom); socket.disconnect(); };
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

  const link = room ? `${location.origin}${location.pathname}#join=${room.code}` : "";

  if (room && me && room.state) {
    const View = { kniffel: OnlineKniffel, phase10: OnlinePhase10 }[room.game] || OnlineLudo;
    return <View room={room} me={me} socket={socket} onLeave={leave} />;
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
          </div>
          <p>oder mit Code beitreten</p>
          <div className="names">
            <input value={code} maxLength={4} placeholder="Raumcode" aria-label="Raumcode"
              onChange={(e) => setCode(e.target.value.toUpperCase())} />
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
          <div className="opts"><button className="wide" onClick={() => navigator.clipboard?.writeText(link)}>Link kopieren</button></div>
          <p>{room.players.map((p, i) => (
            <span key={i}>{p.name}{i === 0 ? " (Host)" : ""}{i === me.index ? " (du)" : ""}{p.connected ? "" : " – offline"}<br /></span>
          ))}</p>
          {me.index === 0 ? (
            <>
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
              <div className="opts">
                <button className="wide on" disabled={room.players.length < 2} onClick={() => socket.emit("start", { scoring })}>
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
