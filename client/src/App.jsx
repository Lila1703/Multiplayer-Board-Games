import { lazy, Suspense, useState } from "react";
import Kniffel from "./games/kniffel/Kniffel";
import Ludo from "./games/ludo/Ludo";
import Online from "./online/Online";
import GameTile from "./components/GameTile";
import { GAMES, ONLINE_GAMES } from "./games/catalog";
import "./App.css";

// Das Eroberungsspiel bringt eine große Weltkarte mit – sie wird erst geladen, wenn jemand das Spiel öffnet
const Eroberung = lazy(() => import("./games/eroberung/Eroberung"));

// Neues lokales Spiel hinzufügen: Komponente bauen und hier eintragen (Name, Kurztext und Motiv kommen aus games/catalog.js)
const LOCAL_GAMES = [
  { id: "ludo", min: 2, Component: Ludo },
  { id: "kniffel", min: 1, Component: Kniffel },
  { id: "eroberung", min: 2, Component: Eroberung },
].map((local) => {
  const g = GAMES.find((x) => x.id === local.id);
  return { ...g, ...local, players: `${local.min}–${g.max} Spieler` };
});

// „A, B oder C“
const list = (names) => (names.length > 1 ? names.slice(0, -1).join(", ") + " oder " + names.at(-1) : names[0]);

const MODES = [
  { id: "local", name: "Lokal spielen", players: "Alle an einem Gerät", desc: list(LOCAL_GAMES.map((g) => g.name)) + ", abwechselnd am selben Bildschirm." },
  { id: "online", name: "Online spielen", players: `2–${Math.max(...ONLINE_GAMES.map((g) => g.max))} Spieler, jeder am eigenen Gerät`, desc: list(ONLINE_GAMES.map((g) => g.name)) + " per Einladungslink." },
];

export default function App() {
  // view: null = Hauptmenü, "local" = Auswahl der lokalen Spiele, "online" = Online-Bereich
  const [view, setView] = useState(location.hash.startsWith("#join=") ? "online" : null);
  const [gameId, setGameId] = useState(null);

  if (view === "online") return <Online onBack={() => setView(null)} />;
  const game = LOCAL_GAMES.find((g) => g.id === gameId);
  if (view === "local" && game) return <Suspense fallback={<main><p className="hint">Lädt …</p></main>}><game.Component onBack={() => setGameId(null)} /></Suspense>;

  if (view === "local") {
    return (
      <main className="hub">
        <header>
          <button className="ghost" style={{ margin: 0 }} onClick={() => setView(null)}>← Hauptmenü</button>
          <h1>Lokal spielen</h1>
        </header>
        <h2 className="section-label">Spiel auswählen</h2>
        <div className="games">
          {LOCAL_GAMES.map((g) => <GameTile key={g.id} art={g.id} name={g.name} desc={g.desc} meta={g.players} onClick={() => setGameId(g.id)} />)}
        </div>
      </main>
    );
  }

  return (
    <main className="hub home">
      <div className="hub-head">
        <h1><img className="hub-logo" src="/syncard-logo.webp" width="640" height="523" alt="SynCard" /></h1>
        <p className="sub">Lokal an einem Gerät oder online mit Freunden.</p>
      </div>
      <h2 className="section-label">Wie wollt ihr spielen?</h2>
      <div className="games modes">
        {MODES.map((m) => <GameTile key={m.id} art={m.id} name={m.name} desc={m.desc} meta={m.players} onClick={() => setView(m.id)} />)}
      </div>
    </main>
  );
}
