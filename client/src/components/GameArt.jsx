// Gezeichnete Motive für die Kacheln der Spiel- und Modusauswahl.
// Alles reines SVG im Format 160×100 (keine Bilddateien), der Farbverlauf dahinter kommt per CSS.
const RED = "#d1493a", BLUE = "#3f7fd0", GREEN = "#3da35d", YELLOW = "#e2b73a";
const WHITE = "#f6f7f9", INK = "#1d2026", GOLD = "#f0b445";

const PIPS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

// Würfel, (x, y) ist die Mitte
function Die({ x, y, size = 24, n = 6, rot = 0 }) {
  const h = size / 2;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-h} y={-h + size * 0.09} width={size} height={size} rx={size * 0.2} fill="rgba(0,0,0,.3)" />
      <rect x={-h} y={-h} width={size} height={size} rx={size * 0.2} fill={WHITE} />
      {PIPS[n].map(([px, py], i) => <circle key={i} cx={px * size * 0.27} cy={py * size * 0.27} r={size * 0.09} fill={INK} />)}
    </g>
  );
}

// Spielfigur, (x, y) ist der Fuß
function Pawn({ x, y, c, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0.3" rx="8.2" ry="2.2" fill="rgba(0,0,0,.4)" />
      <path d="M-7.5 0 C-7.5 -5 -2.6 -8 -2.6 -13 L2.6 -13 C2.6 -8 7.5 -5 7.5 0 Z" fill={c} />
      <circle cx="0" cy="-16.5" r="5.4" fill={c} />
      <circle cx="-1.7" cy="-18.3" r="1.6" fill="rgba(255,255,255,.5)" />
    </g>
  );
}

// Kopf und Schultern eines Spielers
function Person({ x, y, c, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-12" r="8" fill={c} />
      <path d="M-14 14 Q-14 -1 0 -1 Q14 -1 14 14 Z" fill={c} />
    </g>
  );
}

function Phone({ x, y, rot = 0, c }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-12.5" y="-21" width="25" height="42" rx="4.5" fill="#12151a" stroke="#e9ebef" strokeWidth="1.6" />
      <Person x={0} y={3} c={c} s={0.55} />
    </g>
  );
}

const starPoints = (r, inner = 0.45) => Array.from({ length: 10 }, (_, i) => {
  const a = (Math.PI / 5) * i - Math.PI / 2, d = i % 2 ? r * inner : r;
  return `${(Math.cos(a) * d).toFixed(2)},${(Math.sin(a) * d).toFixed(2)}`;
}).join(" ");

function Star({ x, y, r, c, glow }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {glow && <circle r={r * 1.5} fill={c} opacity="0.13" />}
      <polygon points={starPoints(r)} fill={c} />
    </g>
  );
}

// Vierzackiges Funkeln
function Spark({ x, y, r, c = WHITE }) {
  return <path transform={`translate(${x} ${y})`} fill={c} d={`M0 ${-r} Q0 0 ${r} 0 Q0 0 0 ${r} Q0 0 ${-r} 0 Q0 0 0 ${-r} Z`} />;
}

const HEART = "M0 4.2 C-7.4 -1 -4 -6.8 0 -2.6 C4 -6.8 7.4 -1 0 4.2 Z";

// Spielkarte in Herz, (x, y) ist die Mitte
function PlayingCard({ x, y, rot, rank }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-15" y="-21" width="30" height="42" rx="4" fill="#fff" stroke="rgba(0,0,0,.18)" strokeWidth="0.8" />
      <text x="-11.5" y="-9" fontSize={rank.length > 1 ? 10 : 11.5} fontWeight="800" letterSpacing={rank.length > 1 ? -0.8 : 0} fill="#c62f26">{rank}</text>
      <path d={HEART} transform="translate(1.5 6) scale(1.5)" fill="#c62f26" />
    </g>
  );
}

const FIELD = "#f3e8d0";

const ART = {
  // Laufbahn mit Feldern, ein Startfeld-Viereck, vier Figuren, ein Würfel
  ludo: {
    bg: "linear-gradient(140deg, #8f3127, #4a1810)",
    el: (
      <>
        {[12, 29, 46, 63, 80, 97, 114, 131, 148].map((x) => <circle key={x} cx={x} cy="72" r="6.5" fill={FIELD} />)}
        {[21, 38, 55, 89].map((y) => <circle key={y} cx="80" cy={y} r="6.5" fill={FIELD} />)}
        {[[18, 16], [34, 16], [18, 32], [34, 32]].map(([x, y]) => <circle key={x + "-" + y} cx={x} cy={y} r="5.5" fill={FIELD} stroke={RED} strokeWidth="2.4" />)}
        <Pawn x={29} y={75} c={RED} s={1.2} />
        <Pawn x={63} y={75} c={GREEN} s={1.2} />
        <Pawn x={80} y={41} c={YELLOW} s={1.2} />
        <Pawn x={114} y={75} c={BLUE} s={1.2} />
        <Die x={126} y={28} size={26} n={6} rot={12} />
      </>
    ),
  },
  // Fünf gleiche Würfel = Kniffel
  kniffel: {
    bg: "linear-gradient(140deg, #c88a1f, #7d4c0c)",
    el: (
      <>
        <Die x={58} y={31} size={30} rot={-8} />
        <Die x={102} y={30} size={30} rot={10} />
        <Die x={34} y={68} size={30} rot={7} />
        <Die x={80} y={70} size={30} rot={-5} />
        <Die x={126} y={67} size={30} rot={9} />
      </>
    ),
  },
  // Fächer aus Zahlenkarten: eine Folge in den vier Kartenfarben
  phase10: {
    bg: "linear-gradient(140deg, #1f7f86, #0e3c44)",
    el: [[RED, "7", -18], [BLUE, "8", -6], [GREEN, "9", 6], [YELLOW, "10", 18]].map(([c, n, a]) => (
      <g key={n} transform={`rotate(${a} 80 155)`}>
        <rect x="60" y="18" width="40" height="58" rx="5.5" fill={c} stroke="#fff" strokeWidth="1.8" />
        <text x="65" y="32" fontSize="11.5" fontWeight="800" fill={c === YELLOW ? "#2a1f1a" : "#fff"}>{n}</text>
        {n === "10" && <text x="81" y="58" fontSize="21" fontWeight="800" textAnchor="middle" fill="#2a1f1a">{n}</text>}
      </g>
    )),
  },
  // Ass, König und Zehn in Herz (= 31) treiben auf dem Wasser
  schwimmen: {
    bg: "linear-gradient(160deg, #217049, #123a29)",
    el: (
      <>
        <PlayingCard x={48} y={50} rot={-12} rank="A" />
        <PlayingCard x={80} y={46} rot={2} rank="K" />
        <PlayingCard x={112} y={50} rot={13} rank="10" />
        <path d="M-10 72 q10 -7 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V100 H-10 Z" fill="#3f8fcf" />
        <path d="M-20 82 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V100 H-20 Z" fill="#245f96" />
      </>
    ),
  },
  // Zauberhut, Zauberstab und Trumpfkarte
  zauberstich: {
    bg: "linear-gradient(140deg, #5d2f92, #2a1448)",
    el: (
      <>
        <g transform="translate(124 52) rotate(14)">
          <rect x="-15" y="-21" width="30" height="42" rx="4" fill="#fff" />
          <polygon points={starPoints(9)} fill="#7b5be0" />
        </g>
        <ellipse cx="74" cy="72" rx="38" ry="9" fill="#5a3fb8" />
        <path d="M46 70 Q60 40 76 17 Q84 8 97 20 Q88 19 85 27 Q95 50 102 70 Q74 80 46 70 Z" fill="#7b5be0" />
        <path d="M49.5 63 Q74 72 98.5 63 L102 70 Q74 80 46 70 Z" fill={GOLD} />
        <Star x={72} y={42} r={4.5} c={GOLD} />
        <Star x={85} y={54} r={3} c={GOLD} />
        <path d="M16 88 L35 47" stroke="#160c28" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M32.5 52.5 L35 47" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
        <Spark x={39} y={36} r={9} c={GOLD} />
        <Spark x={20} y={24} r={4.5} />
        <Spark x={142} y={18} r={5} />
        <Spark x={116} y={12} r={3} c={GOLD} />
      </>
    ),
  },
  // Sternbild aus den fünf Kartenfarben am Nachthimmel (oben links bleibt Platz für das Schild „kooperativ“)
  sternbilder: {
    bg: "linear-gradient(160deg, #1a2856, #090e22)",
    el: (
      <>
        {[[10, 14, 0.9], [40, 12, 0.6], [68, 20, 0.8], [96, 8, 0.6], [150, 12, 0.9], [144, 84, 0.7], [118, 90, 0.5], [58, 88, 0.8],
          [14, 90, 0.6], [30, 50, 0.5], [70, 80, 0.5], [128, 44, 0.6], [100, 66, 0.5], [8, 50, 0.5]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity="0.6" />
        ))}
        <path d="M22 68 L50 44 L84 58 L112 28 L138 60 M84 58 L98 86" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="98" cy="86" r="2.6" fill="#fff" />
        <Star x={22} y={68} r={9} c={RED} glow />
        <Star x={50} y={44} r={9} c={YELLOW} glow />
        <Star x={84} y={58} r={9} c="#e9ecf2" glow />
        <Star x={112} y={28} r={9} c={BLUE} glow />
        <Star x={138} y={60} r={9} c={GREEN} glow />
      </>
    ),
  },
  // Halb ausgefülltes Sudoku-Blatt (eine Zahl frisch eingetragen) und die Stoppuhr, die mitläuft
  sudoku: {
    bg: "linear-gradient(140deg, #9a3a66, #40142b)",
    el: (
      <>
        <g transform="rotate(-5 60 50)">
          <rect x="24" y="17" width="72" height="72" rx="6" fill="rgba(0,0,0,.3)" />
          <rect x="24" y="14" width="72" height="72" rx="6" fill={WHITE} />
          <rect x="48" y="38" width="24" height="24" fill="#f8dfa0" />
          <path d="M48 16 V84 M72 16 V84 M26 38 H94 M26 62 H94" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          {[[0, 0, "5"], [2, 0, "3"], [1, 1, "7"], [0, 2, "9"], [2, 1, "1"], [1, 2, "4"]].map(([cx, cy, d]) => (
            <text key={d} x={36 + cx * 24} y={32.5 + cy * 24} fontSize="18" fontWeight="800" textAnchor="middle" fill={d === "7" ? "#b0531a" : INK}>{d}</text>
          ))}
        </g>
        <g transform="translate(126 56)">
          <rect x="-4" y="-27" width="8" height="7" rx="2" fill={WHITE} />
          <path d="M13 -17 L17 -21" stroke={WHITE} strokeWidth="3.4" strokeLinecap="round" />
          <circle r="20" fill="#12151a" stroke={WHITE} strokeWidth="3" />
          {[0, 90, 180, 270].map((a) => <path key={a} transform={`rotate(${a})`} d="M0 -15 V-12" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />)}
          <path d="M0 0 L8 -9" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
          <circle r="2.6" fill={GOLD} />
        </g>
      </>
    ),
  },
  // Verdeckter Stapel, darauf eine Sieben und der Bube – und einer ruft „Mau!“
  maumau: {
    bg: "linear-gradient(140deg, #2c6c9c, #112c44)",
    el: (
      <>
        <g transform="translate(42 54) rotate(-12)">
          <rect x="-15" y="-21" width="30" height="42" rx="4" fill="#b8342b" stroke="#fff" strokeWidth="2" />
          <rect x="-10" y="-16" width="20" height="32" rx="2" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.4" />
          <path d="M0 -8 L6 0 L0 8 L-6 0 Z" fill="rgba(255,255,255,.55)" />
        </g>
        <PlayingCard x={76} y={52} rot={2} rank="7" />
        <PlayingCard x={106} y={58} rot={15} rank="B" />
        <g transform="translate(124 21)">
          <path d="M-27 -13 H27 Q31 -13 31 -9 V7 Q31 11 27 11 H-8 L-17 20 L-15 11 H-27 Q-31 11 -31 7 V-9 Q-31 -13 -27 -13 Z" fill={GOLD} />
          <text x="0" y="4.5" fontSize="15" fontWeight="800" textAnchor="middle" fill="#2a1f1a">Mau!</text>
        </g>
      </>
    ),
  },
  // Eine Neun wird vom Ass geschlagen, daneben die Narrenkappe für den Durak („Dummkopf“)
  durak: {
    bg: "linear-gradient(140deg, #6a7a2c, #2a3312)",
    el: (
      <>
        <PlayingCard x={40} y={46} rot={-10} rank="9" />
        <PlayingCard x={60} y={56} rot={8} rank="A" />
        <g transform="translate(116 58)">
          <path d="M-17 13 Q-36 -4 -31 -22 Q-15 -12 -5 13 Z" fill={RED} />
          <path d="M17 13 Q36 -4 31 -22 Q15 -12 5 13 Z" fill={BLUE} />
          <path d="M-11 13 Q-8 -18 0 -33 Q8 -18 11 13 Z" fill={YELLOW} />
          <rect x="-21" y="10" width="42" height="9" rx="4.5" fill={WHITE} />
          {[[-31, -23], [0, -34], [31, -23]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4.5" fill={GOLD} stroke="#2a1f1a" strokeWidth="1" />)}
        </g>
      </>
    ),
  },
  // Zwei Landmassen, eine rote Fahne greift über einen Angriffspfeil die blaue an, daneben zwei Würfel
  eroberung: {
    bg: "linear-gradient(150deg, #1f4f73, #0e2438)",
    el: (
      <>
        <path d="M8 30 Q18 14 40 18 Q58 12 66 26 Q74 40 60 50 Q52 66 34 62 Q14 64 10 50 Q2 40 8 30 Z" fill={RED} opacity="0.9" />
        <path d="M92 40 Q104 24 126 28 Q150 26 154 46 Q158 66 138 74 Q120 88 102 78 Q86 70 88 56 Q86 46 92 40 Z" fill={BLUE} opacity="0.9" />
        <path d="M38 84 Q48 76 60 82 Q66 92 54 96 Q40 98 38 84 Z" fill={GREEN} opacity="0.85" />
        <path d="M56 40 Q80 22 104 42" fill="none" stroke={WHITE} strokeWidth="3" strokeLinecap="round" strokeDasharray="5 4" />
        <path d="M99 33 L107 45 L94 46 Z" fill={WHITE} />
        <g transform="translate(36 40)">
          <path d="M0 0 V-22" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M1 -22 L16 -17 L1 -12 Z" fill={WHITE} />
        </g>
        <g transform="translate(124 58)">
          <path d="M0 0 V-22" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M1 -22 L16 -17 L1 -12 Z" fill={GOLD} />
        </g>
        <Die x={100} y={84} size={19} n={6} rot={-10} />
        <Die x={124} y={88} size={19} n={5} rot={12} />
      </>
    ),
  },
  // Alle zusammen vor einem Fernseher (von hinten gesehen)
  local: {
    bg: "linear-gradient(140deg, #5a4c2c, #262117)",
    el: (
      <>
        <rect x="75.5" y="64" width="9" height="9" fill="#e9ebef" />
        <rect x="60" y="71" width="40" height="3.6" rx="1.8" fill="#e9ebef" />
        <rect x="29" y="7" width="102" height="59" rx="5" fill="#12151a" stroke="#e9ebef" strokeWidth="1.8" />
        <rect x="34" y="12" width="92" height="49" rx="2.5" fill="#2b3038" />
        <Die x={62} y={36} size={25} n={5} rot={-8} />
        <Pawn x={99} y={52} c={GOLD} s={1.35} />
        <Person x={23} y={91} c={RED} s={1.1} />
        <Person x={61} y={93} c={BLUE} s={1.1} />
        <Person x={99} y={93} c={YELLOW} s={1.1} />
        <Person x={137} y={91} c={GREEN} s={1.1} />
      </>
    ),
  },
  // Jeder am eigenen Gerät, miteinander verbunden
  online: {
    bg: "linear-gradient(140deg, #2f4d73, #141d2c)",
    el: (
      <>
        <path d="M42 36 Q54 16 66 30 M94 30 Q106 16 118 36 M46 76 Q80 98 114 76" fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.1 6" />
        <Phone x={30} y={58} rot={-8} c={RED} />
        <Phone x={80} y={44} c={YELLOW} />
        <Phone x={130} y={58} rot={8} c={GREEN} />
      </>
    ),
  },
};

export default function GameArt({ id }) {
  const art = ART[id] || ART.ludo;
  return (
    <span className="art" style={{ background: art.bg }} aria-hidden="true">
      <svg viewBox="0 0 160 100" focusable="false">{art.el}</svg>
    </span>
  );
}
