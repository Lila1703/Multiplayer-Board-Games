import { useState } from "react";
import Kniffel from "./games/kniffel/Kniffel";
import Ludo from "./games/ludo/Ludo";
import Online from "./online/Online";
import "./App.css";

// Neues Spiel hinzufügen: Komponente bauen und hier eintragen
const GAMES = [
  { id: "online", name: "Online spielen", icon: "🌐", players: "2–4 Spieler, jeder am eigenen Gerät", desc: "Mensch ärgere dich nicht oder Kniffel per Einladungslink.", Component: Online },
  { id: "ludo", name: "Mensch ärgere dich nicht", icon: "♟️", players: "2–4 Spieler", desc: "Würfeln, ziehen, rauswerfen.", Component: Ludo },
  { id: "kniffel", name: "Kniffel", icon: "🎲", players: "1–4 Spieler", desc: "Würfeln, festhalten, punkten.", Component: Kniffel },
];

export default function App() {
  const [gameId, setGameId] = useState(location.hash.startsWith("#join=") ? "online" : null);
  const game = GAMES.find((g) => g.id === gameId);
  if (game) return <game.Component onBack={() => setGameId(null)} />;

  return (
    <main className="hub">
      <h1>Brettspiele</h1>
      <p className="sub">Wähle ein Spiel. Alle spielen abwechselnd an einem Gerät.</p>
      <div className="games">
        {GAMES.map((g) => (
          <button key={g.id} className="gamecard" onClick={() => setGameId(g.id)}>
            <span className="icon">{g.icon}</span>
            <h2>{g.name}</h2>
            <p>{g.desc}</p>
            <span className="meta">{g.players}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
