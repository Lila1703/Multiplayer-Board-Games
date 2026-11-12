import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import OnlineLudo from "./OnlineLudo";
import OnlineKniffel from "./OnlineKniffel";
import OnlinePhase10 from "./OnlinePhase10";
import OnlineSchwimmen from "./OnlineSchwimmen";
import OnlineZauberstich from "./OnlineZauberstich";
import OnlineSternbilder from "./OnlineSternbilder";
import OnlineSudoku from "./OnlineSudoku";
import OnlineMauMau from "./OnlineMauMau";
import OnlineDurak from "./OnlineDurak";
import { LEVELS, LEVEL_NAMES } from "../shared/sudoku";
import GameArt from "../components/GameArt";
import GameTile from "../components/GameTile";
import { ONLINE_GAMES as GAMES } from "../games/catalog";
import QRCode from "qrcode";
import "./Tv.css";

const GAME_NAMES = Object.fromEntries(GAMES.map((g) => [g.id, g.name]));

const socket = io({ autoConnect: false });
const hashCode = () => (location.hash.startsWith("#join=") ? location.hash.slice(6).toUpperCase() : "");
// Gespeicherter Name. Der frühere Vorgabewert „Spieler“ zählt nicht als eigener Name – sonst heißen am Ende alle so.
const savedName = () => { const n = (localStorage.getItem("name") || "").trim(); return n === "Spieler" ? "" : n; };
// Teilen-Menü des Handys (WhatsApp usw.) – nur auf Touch-Geräten, am Desktop bleibt es bei „Link kopieren“
const canShare = typeof navigator.share === "function" && !!window.matchMedia?.("(pointer: coarse)").matches;
// Läuft gerade eine Partie?
const running = (r) => !!r?.state && !(r.game === "kniffel" ? r.state.over
  : ["phase10", "schwimmen", "zauberstich", "sternbilder", "sudoku", "maumau", "durak"].includes(r.game) ? r.state.stage === "over" : r.state.winner !== null);

// Fernseher-Modus: Die ganze Seite wird so vergrößert, dass sie sich wie ein Fenster von etwa 1200 × 720 verhält –
// so passt der Tisch auf jeden Fernseher und ist vom Sofa aus lesbar. Kleiner als normal wird nie.
function useTvZoom(active) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const fit = () => root.style.setProperty("--tvz", String(Math.max(1, Math.min(innerWidth / 1200, innerHeight / 720))));
    fit();
    root.classList.add("tv-mode");
    addEventListener("resize", fit);
    return () => { removeEventListener("resize", fit); root.classList.remove("tv-mode"); root.style.removeProperty("--tvz"); };
  }, [active]);
}

// QR-Code mit dem Einladungslink: Die Handys scannen ihn vom Fernseher ab
function Qr({ text }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111317", light: "#ffffff" } })
      .then((x) => alive && setSvg(x)).catch(() => {});
    return () => { alive = false; };
  }, [text]);
  return <div className="tvl-qr" role="img" aria-label="QR-Code mit dem Einladungslink" dangerouslySetInnerHTML={{ __html: svg }} />;
}

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
  const [name, setName] = useState(savedName);
  const [askName, setAskName] = useState(() => !savedName()); // Dialog „Wie heißt du?“, solange noch kein Name bekannt ist
  const [code, setCode] = useState(hashCode());
  const [scoring, setScoring] = useState(false); // Phase 10: mit Strafpunkten?
  const [noEven, setNoEven] = useState(true); // Zauberstich: Ansagen dürfen nicht aufgehen?
  const [memory, setMemory] = useState(false); // Sternbilder: Gedächtnis-Modus (Hinweise verschwinden wieder)?
  const [difficulty, setDifficulty] = useState("mittel"); // Sudoku Battle: leicht, mittel oder schwer
  // Fernseher-Modus: Dieses Gerät erstellt den Raum und zeigt nur den Tisch, gespielt wird an den Handys (die Wahl merkt sich das Gerät)
  const [tvMode, setTvMode] = useState(() => localStorage.getItem("tv") === "1");
  const chooseTv = (on) => { setTvMode(on); if (on) localStorage.setItem("tv", "1"); else localStorage.removeItem("tv"); };

  useEffect(() => {
    const rejoin = () => {
      const s = JSON.parse(localStorage.getItem("session") || "null");
      if (!s || (hashCode() && hashCode() !== s.code)) return;
      socket.emit("join", { code: s.code, token: s.token, name }, (res) => {
        if (!res.error) return setMe(res);
        localStorage.removeItem("session");
        if (res.kicked) { history.replaceState(null, "", location.pathname); setCode(""); setError(res.error); }
      });
    };
    // Ist die Partie inzwischen vorbei, hat sich eine offene Rückfrage „Spiel verlassen?“ erledigt.
    // Der eigene Platz kommt mit jedem Update mit – er verschiebt sich, wenn jemand weiter vorne den Raum verlässt.
    const onRoom = (r) => {
      setRoom(r);
      setMe((m) => (m && !m.tv && r.you !== undefined && r.you !== m.index ? { ...m, index: r.you } : m));
      if (!running(r)) setAsking(false);
    };
    const onKicked = () => {
      localStorage.removeItem("session");
      history.replaceState(null, "", location.pathname);
      setRoom(null); setMe(null); setCode(""); setAsking(false);
      setError("Der Host hat dich aus dem Raum entfernt.");
    };
    socket.on("connect", rejoin);
    socket.on("room", onRoom);
    socket.on("kicked", onKicked);
    socket.connect();
    return () => { socket.off("connect", rejoin); socket.off("room", onRoom); socket.off("kicked", onKicked); socket.disconnect(); };
  }, []);

  const enter = (event, payload) => {
    if (!payload.tv) localStorage.setItem("name", name);
    socket.emit(event, { ...payload, name }, (res) => {
      if (res.error) return setError(res.error);
      setError(""); setMe(res);
      localStorage.setItem("session", JSON.stringify({ code: res.code, token: res.token }));
      history.replaceState(null, "", `#join=${res.code}`);
    });
  };
  const leave = () => {
    if (me) socket.emit("leave"); // sonst bliebe man als „offline“ in der Spielerliste stehen
    localStorage.removeItem("session");
    history.replaceState(null, "", location.pathname);
    onBack();
  };
  // Mitten in einer Partie erst nachfragen: Wer geht, kann in diese Partie nicht wieder einsteigen.
  // Der Host kann stattdessen mit allen zurück in die Lobby und dort ein anderes Spiel wählen.
  const askLeave = () => (running(room) ? setAsking(true) : leave());
  // Der Fernseher bleibt auch in der Lobby an – dort hängt der QR-Code zum Beitreten
  useWakeLock(!!(room && me && (room.state || me.tv)));
  useTvZoom(!!me?.tv);
  // Host: der erste Spieler, der noch da ist (sagt der Server), im Fernseher-Modus auch der Fernseher selbst
  const host = !!me && (!!me.tv || (room?.host ?? 0) === me.index);
  const tvRoom = !!room?.tv;
  const tvBlocked = (g) => tvRoom && g.noTv;

  const link = room ? `${location.origin}${location.pathname}#join=${room.code}` : "";
  const share = () => navigator.share({ title: "SynCard", text: `Komm in meinen Raum ${room.code} – wir spielen ${GAME_NAMES[room.game] || GAME_NAMES.ludo}:`, url: link })
    .catch(() => {}); // Abbrechen des Teilen-Menüs ist kein Fehler

  if (room && me && room.state) {
    const View = { kniffel: OnlineKniffel, phase10: OnlinePhase10, schwimmen: OnlineSchwimmen, zauberstich: OnlineZauberstich, sternbilder: OnlineSternbilder,
      sudoku: OnlineSudoku, maumau: OnlineMauMau, durak: OnlineDurak }[room.game] || OnlineLudo;
    return (
      <>
        <View room={room} me={{ ...me, host }} socket={socket} onLeave={askLeave} />
        {asking && running(room) && (
          <div className="overlay"><div className="card">
            <h2>Spiel verlassen?</h2>
            {host ? (
              <>
                <p>Die Partie läuft noch. <b>Zurück zur Lobby</b> beendet sie für alle: Ihr bleibt zusammen im Raum und du kannst ein anderes Spiel wählen.</p>
                <p>Gehst du zum <b>Hauptmenü</b>, verlässt du den Raum und kannst in diese Partie nicht wieder einsteigen.</p>
                <div className="opts">
                  <button className="wide on" onClick={() => setAsking(false)}>Weiterspielen</button>
                  <button className="wide" onClick={() => { socket.emit("lobby"); setAsking(false); }}>Zurück zur Lobby</button>
                  <button className="wide" onClick={leave}>Zum Hauptmenü</button>
                </div>
              </>
            ) : (
              <>
                <p>Die Partie läuft noch. Wenn du gehst, kannst du in diese Partie nicht wieder einsteigen.</p>
                <div className="opts">
                  <button className="wide on" onClick={() => setAsking(false)}>Weiterspielen</button>
                  <button className="wide" onClick={leave}>Verlassen</button>
                </div>
              </>
            )}
          </div></div>
        )}
      </>
    );
  }

  // Startseite: Name eintragen, dann mit Code beitreten oder ein Spiel antippen (erstellt einen Raum)
  if (!room || !me) {
    return (
      <main className="hub">
        <header>
          <button className="ghost" style={{ margin: 0 }} onClick={leave}>← Hauptmenü</button>
          <h1>Online spielen</h1>
        </header>
        <h2 className="section-label">Fernseher-Modus</h2>
        <div className="tvswitch">
          <div className="opts">
            <button type="button" className={"wide" + (!tvMode ? " on" : "")} onClick={() => chooseTv(false)}>Ich spiele mit</button>
            <button type="button" className={"wide" + (tvMode ? " on" : "")} onClick={() => chooseTv(true)}>📺 Dieses Gerät ist der Fernseher</button>
          </div>
          <p>{tvMode
            ? "Dieses Gerät zeigt den Tisch groß auf dem Fernseher oder Beamer und spielt nicht mit. Alle anderen spielen am Handy und sehen dort ihre Karten."
            : "Ihr sitzt zusammen und habt einen Fernseher oder Beamer? Schließ einen Laptop an und wähle dort „Dieses Gerät ist der Fernseher“."}</p>
        </div>
        {!tvMode && (
          <>
            <h2 className="section-label">Dein Name</h2>
            <input className="field" value={name} maxLength={16} aria-label="Dein Name" onFocus={(e) => e.target.select()} onChange={(e) => setName(e.target.value)} />
            <h2 className="section-label">Mit Code beitreten</h2>
            <div className="joinrow">
              {/* Die Handytastatur soll den Code nicht „korrigieren“; Enter tritt bei */}
              <input className="field" value={code} maxLength={4} placeholder="Raumcode" aria-label="Raumcode"
                autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="go"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") enter("join", { code }); }} />
              <button type="button" onClick={() => enter("join", { code })}>Beitreten</button>
            </div>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <h2 className="section-label">{tvMode ? "Raum für den Fernseher erstellen" : "Oder neuen Raum erstellen"}</h2>
        <div className="games">
          {GAMES.map((g) => (
            <GameTile key={g.id} art={g.id} name={g.name} desc={g.desc} meta={tvMode && g.noTv ? "Nicht im Fernseher-Modus" : `2–${g.max} Spieler`} tag={g.tag}
              disabled={tvMode && g.noTv} onClick={() => enter("create", { game: g.id, tv: tvMode })} />
          ))}
        </div>
        {/* Auch der Fernseher fragt einmal nach einem Namen – er wird dort nirgends angezeigt, das ist nur einfacher */}
        {askName && (
          <div className="overlay">
            <form className="card" onSubmit={(e) => {
              e.preventDefault();
              const n = name.trim();
              if (!n) return;
              setName(n); localStorage.setItem("name", n); setAskName(false);
            }}>
              <h2>Wie heißt du?</h2>
              <p>Unter diesem Namen sehen dich deine Mitspieler.</p>
              <div className="names">
                <input autoFocus value={name} maxLength={16} placeholder="Dein Name" aria-label="Dein Name" enterKeyHint="done"
                  autoComplete="off" onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="opts"><button type="submit" className="wide on" disabled={!name.trim()}>Weiter</button></div>
              <button type="button" className="ghost" onClick={leave}>Zurück zum Hauptmenü</button>
            </form>
          </div>
        )}
      </main>
    );
  }

  // Spielauswahl, Optionen und Start für den Host (im Fernseher-Modus am Fernseher und am Handy des ersten Spielers)
  const controls = (
    <>
      <p>Spiel:</p>
      <div className="gamepick">
        {GAMES.map((g) => (
          <GameTile key={g.id} compact art={g.id} name={g.name} selected={room.game === g.id}
            disabled={room.players.length > g.max || tvBlocked(g)}
            title={tvBlocked(g) ? "Nicht im Fernseher-Modus" : room.players.length > g.max ? `Höchstens ${g.max} Spieler` : undefined}
            onClick={() => socket.emit("game", g.id)} />
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
      {room.game === "sudoku" && (
        <>
          <p>Alle lösen gleichzeitig dasselbe Sudoku. Jede falsche Zahl kostet eins von drei Leben und 10 Sekunden. Die beste Zeit gewinnt.</p>
          <p>Schwierigkeit:</p>
          <div className="opts">
            {Object.keys(LEVELS).map((l) => (
              <button key={l} type="button" className={"wide" + (difficulty === l ? " on" : "")} onClick={() => setDifficulty(l)}>{LEVEL_NAMES[l]}</button>
            ))}
          </div>
          <p>{LEVELS[difficulty]} von 81 Zahlen sind vorgegeben.</p>
        </>
      )}
      {room.game === "maumau" && (
        <p>Für 2–5 Spieler: 7 heißt zwei ziehen, 8 heißt aussetzen, der Bube wünscht eine Farbe. Wer alle Karten los ist, ist fertig – der Letzte mit Karten verliert.</p>
      )}
      {room.game === "durak" && (
        <p>Für 2–6 Spieler mit 36 Karten: Greif deinen Sitznachbarn an. Schlägt er alle Karten, kommen sie weg – sonst nimmt er sie auf. Auch sein anderer Nachbar darf Karten dazulegen, und mit einer Karte gleichen Werts kann der Verteidiger den Angriff weiterschieben. Wer als Letzter Karten hat, ist der Durak.</p>
      )}
      <div className="opts">
        <button className="wide on" disabled={room.players.length < 2} onClick={() => socket.emit("start", { scoring, noEven, memory, difficulty })}>
          {room.players.length < 2 ? "Warte auf Mitspieler …" : "Spiel starten"}
        </button>
      </div>
    </>
  );
  const players = (
    <p className="lobby-players">{room.players.map((p, i) => (
      <span key={i}>
        {p.name}{i === room.host ? (tvRoom ? " (Spielleiter)" : " (Host)") : ""}{i === me.index ? " (du)" : ""}{p.connected ? "" : " – offline"}
        {/* Der Host kann andere rauswerfen – etwa wen, der gegangen ist und nicht wiederkommt */}
        {host && i !== me.index && (
          <button type="button" className="kick" title={`${p.name} aus dem Raum entfernen`} aria-label={`${p.name} aus dem Raum entfernen`}
            onClick={() => socket.emit("kick", i)}>✕</button>
        )}
        <br />
      </span>
    ))}</p>
  );

  // Lobby auf dem Fernseher: groß, mit QR-Code zum Beitreten
  if (me.tv) {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    const n = room.players.length;
    return (
      <main className="tv-lobby">
        <section className="tvl-join panel">
          <Qr text={link} />
          <p>Mit dem Handy scannen oder öffnen:</p>
          <p className="tvl-link">{link.replace(/^https?:\/\//, "")}</p>
          <p>Raumcode</p>
          <p className="tvl-code">{room.code}</p>
          {local && <p className="error">Diese Seite läuft über „{location.hostname}“ – so erreichen die Handys sie nicht. Öffne am Fernseher die öffentliche Adresse (Render oder den Tunnel von start.bat).</p>}
        </section>
        <section className="tvl-room panel">
          <div className="lobby-head">
            <GameArt id={room.game} />
            <div>
              <h2>📺 Fernseher-Modus</h2>
              <p><b>{GAME_NAMES[room.game] || GAME_NAMES.ludo}</b> · Raum <b>{room.code}</b></p>
            </div>
          </div>
          <p>{n ? `${n} Spieler im Raum:` : "Noch niemand da – scannt den QR-Code!"}</p>
          {players}
          {controls}
          <div className="tvl-foot">
            {document.fullscreenEnabled && (
              <button type="button" className="ghost" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}>
                ⛶ Vollbild
              </button>
            )}
            <button type="button" className="ghost" onClick={leave}>Zurück zur Auswahl</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="overlay"><div className="card">
      <div className="lobby-head">
        <GameArt id={room.game} />
        <div>
          <h2>Online spielen</h2>
          <p><b>{GAME_NAMES[room.game] || GAME_NAMES.ludo}</b> · Raum <b>{room.code}</b></p>
        </div>
      </div>
      <p>Schick diesen Link an deine Mitspieler:</p>
      <div className="names">
        <input readOnly value={link} aria-label="Einladungslink" onFocus={(e) => e.target.select()} />
      </div>
      <div className="opts">
        {canShare && <button className="wide on" onClick={share}>Teilen</button>}
        <button className="wide" onClick={() => navigator.clipboard?.writeText(link)}>Link kopieren</button>
      </div>
      {tvRoom && <p>📺 <b>Fernseher-Modus:</b> Der Tisch ist auf dem Fernseher, deine Karten siehst du hier.</p>}
      {players}
      {host ? controls : <p>Warte, bis der Host das Spiel startet …</p>}
      <button className="ghost" onClick={leave}>Zurück zur Auswahl</button>
    </div></div>
  );
}
