// Alle Spiele an einer Stelle: Name, Kurztext und Höchstzahl der Spieler.
// max muss zu MAX_PLAYERS in server/index.js passen. Das Motiv zur id liegt in components/GameArt.jsx.
export const GAMES = [
  { id: "ludo", name: "Mensch ärgere dich nicht", desc: "Würfeln, ziehen, rauswerfen.", max: 4 },
  { id: "kniffel", name: "Kniffel", desc: "Würfeln, festhalten, punkten.", max: 10 },
  { id: "phase10", name: "Phase 10", desc: "Phasen sammeln und auslegen.", max: 6 },
  { id: "schwimmen", name: "Schwimmen", desc: "Tauschen und 31 erreichen.", max: 8 },
  { id: "zauberstich", name: "Zauberstich", desc: "Stiche ansagen und genau treffen.", max: 6 },
  { id: "sternbilder", name: "Sternbilder", desc: "Gemeinsam legen, nur mit Hinweisen.", max: 5, tag: "kooperativ" },
];
