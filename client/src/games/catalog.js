// Alle Spiele an einer Stelle: Name, Kurztext und Höchstzahl der Spieler.
// max muss zu MAX_PLAYERS in server/index.js passen. Das Motiv zur id liegt in components/GameArt.jsx.
// localOnly: gibt es nur an einem Gerät (fehlt in der Online-Auswahl).
// noTv: nicht im Fernseher-Modus, weil der Fernseher nichts zeigen würde, was nicht ohnehin jeder am Handy sieht (muss zu NO_TV in server/index.js passen).
export const GAMES = [
  { id: "ludo", name: "Mensch ärgere dich nicht", desc: "Würfeln, ziehen, rauswerfen.", max: 4, noTv: true },
  { id: "kniffel", name: "Kniffel", desc: "Würfeln, festhalten, punkten.", max: 10 },
  { id: "phase10", name: "Phase 10", desc: "Phasen sammeln und auslegen.", max: 6 },
  { id: "schwimmen", name: "Schwimmen", desc: "Tauschen und 31 erreichen.", max: 8 },
  { id: "zauberstich", name: "Zauberstich", desc: "Stiche ansagen und genau treffen.", max: 6 },
  { id: "sternbilder", name: "Sternbilder", desc: "Gemeinsam legen, nur mit Hinweisen.", max: 5, tag: "kooperativ" },
  { id: "sudoku", name: "Sudoku Battle", desc: "Dasselbe Sudoku für alle – wer ist schneller?", max: 8, noTv: true },
  { id: "maumau", name: "Mau-Mau", desc: "Karten loswerden, der Bube wünscht.", max: 5 },
  { id: "durak", name: "Durak", desc: "Angreifen, abwehren – oder aufnehmen.", max: 6 },
  { id: "eroberung", name: "Eroberungsspiel", desc: "Armeen verteilen, Regionen erobern, geheimen Auftrag erfüllen.", max: 6, localOnly: true },
];
export const ONLINE_GAMES = GAMES.filter((g) => !g.localOnly);
