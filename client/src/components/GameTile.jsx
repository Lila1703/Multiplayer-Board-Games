import GameArt from "./GameArt";

// Bildkachel für die Spiel- und Modusauswahl: oben das Motiv, darunter Name, Kurztext und Spielerzahl.
// tag = kleines Schild auf dem Bild (z. B. „kooperativ“).
// compact = kleine Kachel nur mit Bild und Name (Spielwechsel in der Lobby); selected macht die Kachel zum Umschalter.
export default function GameTile({ art, name, desc, meta, tag, selected, compact, ...rest }) {
  return (
    <button type="button" className={"gamecard" + (compact ? " compact" : "") + (selected ? " on" : "")} aria-pressed={selected} {...rest}>
      <GameArt id={art} />
      {tag && !compact && <span className="tag">{tag}</span>}
      <span className="body">
        <span className="name">{name}</span>
        {desc && <span className="desc">{desc}</span>}
        {meta && <span className="meta">{meta}</span>}
      </span>
    </button>
  );
}
