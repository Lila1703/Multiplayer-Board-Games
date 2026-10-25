import { useState } from "react";

export default function PlayerSetup({ title, min = 1, max = 4, onStart, onBack }) {
  const [count, setCount] = useState(Math.max(min, 2));
  const [names, setNames] = useState(["Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"]);
  const counts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const start = (e) => {
    e.preventDefault();
    onStart(names.slice(0, count).map((n, i) => n.trim() || `Spieler ${i + 1}`));
  };
  return (
    <form onSubmit={start}>
      <h2>{title}</h2>
      <p>Wie viele Spieler?</p>
      <div className="opts">
        {counts.map((n) => (
          <button type="button" key={n} className={n === count ? "on" : ""} onClick={() => setCount(n)}>{n}</button>
        ))}
      </div>
      <div className="names">
        {names.slice(0, count).map((name, i) => (
          <input key={i} value={name} maxLength={16} aria-label={`Name von Spieler ${i + 1}`}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setNames(names.map((n, k) => (k === i ? e.target.value : n)))} />
        ))}
      </div>
      <div className="opts">
        <button type="submit" className="wide on">Spiel starten</button>
      </div>
      {onBack && <button type="button" className="ghost" onClick={onBack}>Zurück zur Auswahl</button>}
    </form>
  );
}
