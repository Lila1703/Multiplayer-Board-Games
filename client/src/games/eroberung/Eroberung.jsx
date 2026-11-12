import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import PlayerSetup from "../../components/PlayerSetup";
import Die3D from "../../components/Die3D";
import { W, H, SEA } from "../../shared/eroberungMap";
import {
  createEroberung, act, TERRITORIES, REGIONS, REGION_MEMBERS, ADJ, NEUTRAL, SYMBOLS, JOKER, STEP,
  reinforcements, territoriesOf, regionsOf, bestSet, setValue, reachable, missionText, cardSymbol, cardTerritory,
} from "../../shared/eroberung";
import "./Eroberung.css";

// Spielerfarben in der Reihenfolge von COLORS, dazu Grau für die neutralen Armeen
export const PLAYER_COLORS = ["#d1493a", "#3f7fd0", "#3da35d", "#e2b73a", "#9b5fd0", "#e07b2c"];
const NEUTRAL_COLOR = "#8a8f98";
const colorOf = (o) => (o === NEUTRAL ? NEUTRAL_COLOR : PLAYER_COLORS[o]);
const T = TERRITORIES;
const BY_ID = Object.fromEntries(T.map((t, i) => [t.id, i]));
const PHASES = [["reinforce", "Verstärken"], ["attack", "Angreifen"], ["fortify", "Verschieben"]];
const armies = (n) => `${n} ${n === 1 ? "Armee" : "Armeen"}`;

export default function Eroberung({ onBack }) {
  const [g, setG] = useState(null);
  const [names, setNames] = useState(null);
  if (!g) {
    return (
      <div className="overlay"><div className="card">
        <PlayerSetup title="Eroberungsspiel" min={2} max={6} colors={PLAYER_COLORS} onBack={onBack}
          onStart={(n) => { setNames(n); setG({ ...createEroberung(n), created: Date.now() }); }} />
        <p className="er-setup-note">Zu zweit spielen neutrale graue Armeen mit. Jeder bekommt einen geheimen Auftrag.</p>
      </div></div>
    );
  }
  return <Game key={g.created} g={g} setG={setG} onBack={onBack} onNew={() => setG({ ...createEroberung(names), created: Date.now() })} onSetup={() => setG(null)} />;
}

function Game({ g, setG, onBack, onNew, onSetup }) {
  const [sel, setSel] = useState(null); // gewähltes eigenes Gebiet (Angriff / Verschieben)
  const [target, setTarget] = useState(null); // Ziel des Angriffs bzw. des Verschiebens
  const [per, setPer] = useState(1); // Armeen pro Antippen beim Verstärken (0 = alle)
  const [dice, setDice] = useState(3);
  const [extra, setExtra] = useState(0); // Nachrücken bzw. Verschieben: Zahl der Armeen
  const [secret, setSecret] = useState(0); // 0 = zu, 1 = „schauen alle weg?“, 2 = Auftrag offen
  const [regionsView, setRegionsView] = useState(false);
  const [err, setErr] = useState("");
  const p = g.cur, over = g.phase === "over";

  useEffect(() => { setSel(null); setTarget(null); setSecret(0); }, [p, g.phase === "fortify"]);
  useEffect(() => { setErr(""); }, [g]);
  // Nach dem Erobern standardmäßig alle Armeen nachziehen, die nicht gebraucht werden
  useEffect(() => { if (g.phase === "occupy") setExtra(g.armies[g.occupy.from] - 1); }, [g.phase, g.occupy]);

  const run = (a) => {
    const r = act(g, p, a);
    if (r.error) { setErr(r.error); return null; }
    setG(r.state);
    return r.state;
  };

  // Welche Gebiete darf man gerade antippen?
  const mine = (i) => g.owner[i] === p;
  const canFrom = (i) => mine(i) && g.armies[i] > 1 && (g.phase === "attack" ? ADJ[i].some((b) => g.owner[b] !== p) : reachable(g, i).size > 0);
  const reach = useMemo(() => (g.phase === "fortify" && sel !== null ? reachable(g, sel) : new Set()), [g, sel]);
  const isTarget = (i) => sel !== null && (g.phase === "attack" ? g.owner[i] !== p && ADJ[sel].includes(i) : g.phase === "fortify" && reach.has(i));
  const tappable = (i) => {
    if (over || g.phase === "occupy") return false;
    if (g.phase === "setup" || g.phase === "reinforce") return mine(i);
    return canFrom(i) || isTarget(i);
  };

  function tap(i) {
    if (!tappable(i)) return;
    if (g.phase === "setup") return run({ type: "place", t: i, n: 1 });
    if (g.phase === "reinforce") return run({ type: "place", t: i, n: per || g.pool });
    if (i === sel) { setSel(null); setTarget(null); return; }
    if (isTarget(i)) {
      setTarget(i);
      if (g.phase === "attack") setDice(Math.min(3, g.armies[sel] - 1));
      if (g.phase === "fortify") setExtra(g.armies[sel] - 1);
      return;
    }
    setSel(i); setTarget(null);
  }

  function attack(blitz) {
    const s = run({ type: "attack", from: sel, to: target, dice, blitz });
    if (!s) return;
    if (s.owner[target] === p) { setSel(null); setTarget(null); } // erobert
    else if (s.armies[sel] < 2) { setSel(null); setTarget(null); }
    else setDice((d) => Math.min(d, s.armies[sel] - 1));
  }

  // --- Anzeige ---
  const set = !over && bestSet(g, p);
  const nextSet = setValue(g.trades);
  const name = g.names[p];
  const hint = err || (over ? g.msg
    : g.phase === "setup" ? `${name}: Setz ${armies(Math.min(STEP - g.step, g.setupLeft[p]))} in deine Gebiete (insgesamt noch ${g.setupLeft[p]}).`
    : g.phase === "reinforce" ? (g.cards[p].length >= 5 ? "Du hast 5 Karten: Tausch zuerst ein Set ein."
      : g.pool ? `Tippe eigene Gebiete an, um ${armies(g.pool)} einzusetzen.`
      : "Alles eingesetzt. Du kannst noch ein Set tauschen oder angreifen.")
    : g.phase === "attack" ? (sel === null ? "Wähle ein eigenes Gebiet mit mindestens 2 Armeen, aus dem du angreifen willst."
      : target === null ? `Angriff aus ${T[sel].name}: Tippe ein rot markiertes Nachbargebiet an.`
      : `${T[sel].name} → ${T[target].name}`)
    : g.phase === "occupy" ? `Erobert! Wie viele Armeen ziehen zusätzlich nach ${T[g.occupy.to].name}?`
    : g.phase === "fortify" ? (sel === null ? "Einmal verschieben: Wähle ein Gebiet, aus dem Armeen abziehen sollen – oder beende den Zug."
      : target === null ? "Tippe ein markiertes eigenes Gebiet an, das über deine Gebiete verbunden ist."
      : `${T[sel].name} → ${T[target].name}`)
    : "");

  return (
    <main className="er">
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onBack}>← Spielauswahl</button>
        <h1>Eroberungsspiel</h1>
        <div className="status" aria-live="polite">
          <span className="er-dot" style={{ background: colorOf(p) }} /><b>{name}</b> ist dran
          {g.phase === "setup" ? " · Aufstellung" : ` · Runde ${Math.ceil(g.turn / g.names.length)}`}
        </div>
      </header>

      <MapView g={g} sel={sel} target={target} tappable={tappable} isTarget={isTarget} onTap={tap} regionsView={regionsView} />
      <div className="er-mapbar">
        <button className={"er-chip" + (regionsView ? " on" : "")} onClick={() => setRegionsView((v) => !v)} aria-pressed={regionsView}>Regionen zeigen</button>
        <span className="er-legend">gestrichelt = Seeweg</span>
      </div>

      {/* dock: Auf dem Handy klebt die Bedienung am unteren Rand (index.css) */}
      <section className="panel dock er-dock">
        {g.phase !== "setup" && !over && (
          <ol className="er-steps">
            {PHASES.map(([k, label]) => (
              <li key={k} className={g.phase === k || (k === "attack" && g.phase === "occupy") ? "on" : ""}>{label}</li>
            ))}
          </ol>
        )}

        {g.phase === "setup" && (
          <div className="er-row">
            <span className="er-big">{g.setupLeft[p]}</span><span className="er-note">Startarmeen übrig</span>
            <button className="er-btn" onClick={() => run({ type: "autoplace" })}>Rest zufällig verteilen</button>
          </div>
        )}

        {g.phase === "reinforce" && (
          <div className="er-row">
            <span className="er-big">{g.pool}</span><span className="er-note">{g.pool === 1 ? "Armee" : "Armeen"} einsetzen</span>
            {g.pool > 1 && (
              <span className="er-seg" role="group" aria-label="Armeen pro Antippen">
                {[1, 3, 0].map((k) => <button key={k} className={per === k ? "on" : ""} onClick={() => setPer(k)}>{k || "alle"}</button>)}
              </span>
            )}
            {set && <button className="er-btn go" onClick={() => run({ type: "trade" })}>Set tauschen +{nextSet}</button>}
            {!g.pool && <button className="er-btn go" onClick={() => run({ type: "toAttack" })}>Weiter zum Angriff</button>}
          </div>
        )}

        {g.phase === "attack" && (
          <div className="er-row">
            {target !== null && (
              <>
                <span className="er-seg" role="group" aria-label="Würfel">
                  {[1, 2, 3].map((k) => <button key={k} disabled={k > g.armies[sel] - 1} className={dice === k ? "on" : ""} onClick={() => setDice(k)}>{k}🎲</button>)}
                </span>
                <button className="er-btn go" onClick={() => attack(false)}>Würfeln</button>
                <button className="er-btn" onClick={() => attack(true)}>Bis zum Ende</button>
              </>
            )}
            <button className="er-btn" onClick={() => run({ type: "endAttack" })}>Angriff beenden</button>
          </div>
        )}

        {g.phase === "occupy" && (
          <div className="er-row">
            <Stepper value={extra} max={g.armies[g.occupy.from] - 1} onChange={setExtra} />
            <span className="er-note">+ {g.occupy.moved} schon eingezogen</span>
            <button className="er-btn go" onClick={() => run({ type: "occupy", n: extra })}>Nachrücken</button>
          </div>
        )}

        {g.phase === "fortify" && (
          <div className="er-row">
            {target !== null && (
              <>
                <Stepper value={extra} min={1} max={g.armies[sel] - 1} onChange={setExtra} />
                <button className="er-btn go" onClick={() => run({ type: "fortify", from: sel, to: target, n: extra })}>Verschieben & Zug beenden</button>
              </>
            )}
            <button className={"er-btn" + (target === null ? " go" : "")} onClick={() => run({ type: "endTurn" })}>Zug beenden</button>
          </div>
        )}

        {(g.phase === "attack" || g.phase === "occupy") && g.roll && <Dice roll={g.roll} id={g.rollId} att={colorOf(p)} def={colorOf(g.roll.defOwner)} />}

        <p className={"er-hint" + (err ? " err" : "")}>{hint}</p>
        {!over && (
          <button className="er-secret" onClick={() => setSecret(1)}>
            🔒 Auftrag &amp; Karten von {name} <span>· {g.cards[p].length} {g.cards[p].length === 1 ? "Karte" : "Karten"}</span>
          </button>
        )}
      </section>

      <p className="er-msg">{g.msg}</p>

      <div className="er-info">
        <section className="panel er-players">
          <h3>Spieler</h3>
          {g.names.map((n, i) => {
            const rs = regionsOf(g, i);
            return (
              <div key={i} className={"er-player" + (i === p && !over ? " cur" : "") + (g.alive[i] ? "" : " out")}>
                <span className="er-dot" style={{ background: colorOf(i) }} />
                <b>{n}</b>
                {g.alive[i] ? (
                  <span className="er-stats">
                    {territoriesOf(g, i)} Gebiete · {g.owner.reduce((s, o, t) => s + (o === i ? g.armies[t] : 0), 0)} Armeen · {g.cards[i].length} 🂠
                    {g.phase !== "setup" && <> · +{reinforcements(g, i)}/Zug</>}
                    {rs.length > 0 && <> · {rs.map((r) => REGIONS[r].name).join(", ")}</>}
                  </span>
                ) : <span className="er-stats">ausgeschaltet</span>}
              </div>
            );
          })}
          {g.owner.includes(NEUTRAL) && (
            <div className="er-player"><span className="er-dot" style={{ background: NEUTRAL_COLOR }} /><b>Neutral</b>
              <span className="er-stats">{territoriesOf(g, NEUTRAL)} Gebiete · greift nie an</span></div>
          )}
        </section>
        <section className="panel er-regions">
          <h3>Regionen</h3>
          {Object.entries(REGIONS).map(([r, R]) => {
            const owners = REGION_MEMBERS[r].map((i) => g.owner[i]);
            const holder = owners.every((o) => o === owners[0]) && owners[0] !== NEUTRAL ? owners[0] : null;
            return (
              <div key={r} className="er-region">
                <span className="er-swatch" style={{ background: R.color }} />
                <span>{R.name}</span>
                <span className="er-stats">{REGION_MEMBERS[r].length} Gebiete · <b>+{R.bonus}</b></span>
                {holder !== null && <span className="er-holder" style={{ background: colorOf(holder) }}>{g.names[holder]}</span>}
              </div>
            );
          })}
        </section>
      </div>

      <section className="panel er-rules">
        <h3>Regeln</h3>
        <p>Zu Beginn jedes Zuges bekommst du Armeen: ein Drittel deiner Gebiete (mindestens 3) und den <b>Bonus</b> jeder Region, die dir ganz gehört.
          Dann <b>greifst du an</b>: aus einem Gebiet mit mindestens 2 Armeen in ein fremdes Nachbargebiet (gestrichelte Linien sind Seewege). Du würfelst mit bis zu 3, der Verteidiger mit bis zu 2 Würfeln.
          Die höchsten Würfel werden paarweise verglichen, bei Gleichstand gewinnt der Verteidiger. Zum Schluss darfst du <b>einmal verschieben</b>.
          Wer in einem Zug mindestens ein Gebiet erobert, bekommt eine <b>Karte</b>. Drei gleiche oder drei verschiedene Symbole (Joker passen immer) bringen 4, 6, 8, 10, 12, 15 und dann je 5 Armeen mehr; ab 5 Karten musst du tauschen.
          Gewonnen hat, wer zuerst seinen <b>geheimen Auftrag</b> erfüllt – oder alle anderen ausschaltet.</p>
      </section>

      {secret > 0 && !over && (
        <div className="overlay"><div className="card er-secret-card">
          {secret === 1 ? (
            <>
              <h2>Nur für {name}</h2>
              <p>Die anderen schauen bitte weg.</p>
              <div className="opts">
                <button className="wide on" onClick={() => setSecret(2)}>Auftrag zeigen</button>
                <button className="wide" onClick={() => setSecret(0)}>Abbrechen</button>
              </div>
            </>
          ) : (
            <>
              <h2>Dein Auftrag</h2>
              <p className="er-mission">{missionText(g.missions[p], g.names)}</p>
              <h3 className="er-sub">Deine Karten</h3>
              {g.cards[p].length ? (
                <div className="er-cards">
                  {g.cards[p].map((c) => <CardView key={c} c={c} own={cardTerritory(c) !== null && g.owner[c] === p} />)}
                </div>
              ) : <p>Noch keine Karten. Erobere in einem Zug mindestens ein Gebiet, dann bekommst du eine.</p>}
              <p>Nächstes Set: <b>{nextSet} Armeen</b>.{set ? " Du hast ein Set." : ""}</p>
              <div className="opts"><button className="wide on" onClick={() => setSecret(0)}>Verstecken</button></div>
            </>
          )}
        </div></div>
      )}

      {over && (
        <div className="overlay"><div className="card er-over">
          <h2>🏆 {g.names[g.winner]} gewinnt!</h2>
          <p>{g.how === "all" ? "Alle anderen sind ausgeschaltet." : `Auftrag erfüllt: ${missionText(g.missions[g.winner], g.names)}`}</p>
          <div className="er-missions">
            {g.names.map((n, i) => (
              <div key={i} className={"er-player" + (i === g.winner ? " cur" : "")}>
                <span className="er-dot" style={{ background: colorOf(i) }} /><b>{n}</b>
                <span className="er-stats">{missionText(g.missions[i], g.names)}</span>
              </div>
            ))}
          </div>
          <div className="opts">
            <button className="wide on" onClick={onNew}>Nochmal spielen</button>
            <button className="wide" onClick={onSetup}>Andere Spieler</button>
          </div>
          <button className="ghost" onClick={onBack}>Zur Spielauswahl</button>
        </div></div>
      )}
    </main>
  );
}

// Die Weltkarte. Auf schmalen Bildschirmen ist sie vergrößert und lässt sich verschieben.
function MapView({ g, sel, target, tappable, isTarget, onTap, regionsView }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(1000);
  // Auf dem Handy (hochkant wie quer) ist die ganze Welt zu klein zum Antippen: dort vergrößert starten
  const [zoom, setZoom] = useState(() => (window.innerWidth < 700 || window.innerHeight < 480 ? 2.6 : 1));
  useLayoutEffect(() => {
    const el = wrap.current;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Beim Vergrößern auf Europa/Afrika schauen (Mitte der Karte)
  useLayoutEffect(() => {
    const el = wrap.current;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) * 0.5;
    el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.35;
  }, [zoom]);
  const ppu = (width * zoom) / W; // Bildschirmpunkte pro Kartenpunkt
  const r = Math.min(11, Math.max(5, 12 / ppu)); // Armee-Zähler: auf dem Bildschirm etwa 12 px Radius
  const pos = (id) => T[BY_ID[id]];

  return (
    <div className="er-mapbox">
      <div className="er-map" ref={wrap}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: `${zoom * 100}%` }} role="group" aria-label="Weltkarte">
          <rect width={W} height={H} className="er-sea" />
          {SEA.map(([a, b, wrapEdge]) => {
            const [A, B] = [pos(a), pos(b)];
            if (wrapEdge) {
              const [L, R] = A.x < B.x ? [A, B] : [B, A], y = (L.y + R.y) / 2;
              return <path key={a + b} className="er-seaway" d={`M${L.x},${L.y}L0,${y}M${R.x},${R.y}L${W},${y}`} />;
            }
            return <line key={a + b} className="er-seaway" x1={A.x} y1={A.y} x2={B.x} y2={B.y} />;
          })}
          {T.map((t, i) => (
            <path key={t.id} d={t.d} className={"er-land" + (tappable(i) ? " can" : "") + (i === sel ? " sel" : "") + (isTarget(i) ? " tgt" : "") + (i === target ? " chosen" : "")}
              style={{ fill: regionsView ? REGIONS[t.region].color : colorOf(g.owner[i]) }} onClick={() => onTap(i)} />
          ))}
          {Object.entries(REGIONS).map(([k, R]) => <path key={k} d={R.d} className="er-region-line" />)}
          {T.map((t, i) => {
            const o = g.owner[i];
            return (
              <g key={t.id} className={"er-count" + (tappable(i) ? " can" : "") + (i === sel ? " sel" : "") + (isTarget(i) ? " tgt" : "") + (i === target ? " chosen" : "")}
                transform={`translate(${t.x} ${t.y})`} onClick={() => onTap(i)} role="button" tabIndex={tappable(i) ? 0 : -1}
                aria-label={`${t.name}: ${armies(g.armies[i])}, ${o === NEUTRAL ? "neutral" : g.names[o]}`}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(i); } }}>
                <circle r={r * 1.5} className="er-hit" />
                <circle r={r} style={{ fill: colorOf(o) }} />
                <text y={r * 0.38} style={{ fontSize: r * 1.05 }}>{g.armies[i]}</text>
                {ppu > 1.6 && <text className="er-name" y={r + 9}>{t.name}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="er-zoom" role="group" aria-label="Kartengröße">
        {[[1, "Ganze Welt"], [2.6, "Nah"], [4, "Ganz nah"]].map(([z, label]) => (
          <button key={z} className={zoom === z ? "on" : ""} onClick={() => setZoom(z)}>{label}</button>
        ))}
      </div>
    </div>
  );
}

function Stepper({ value, min = 0, max, onChange }) {
  const v = Math.max(min, Math.min(max, value));
  return (
    <span className="er-stepper">
      <button onClick={() => onChange(Math.max(min, v - 1))} disabled={v <= min} aria-label="weniger">−</button>
      <b aria-live="polite">{v}</b>
      <button onClick={() => onChange(Math.min(max, v + 1))} disabled={v >= max} aria-label="mehr">+</button>
      <button className="er-all" onClick={() => onChange(max)} disabled={v >= max}>alle</button>
    </span>
  );
}

// Zuletzt gewürfelt: links der Angreifer, rechts der Verteidiger
function Dice({ roll, id, att, def }) {
  return (
    <div className="er-dice" aria-label={`Angriff ${roll.att.join(", ")} gegen ${roll.def.join(", ")}`}>
      <span className="er-dset" style={{ "--die": att, "--die-shade": att, "--pip": "#fff" }}>
        {roll.att.map((v, k) => <Die3D key={k} value={v} spins={id} size={30} />)}
      </span>
      <span className="er-vs">gegen</span>
      <span className="er-dset" style={{ "--die": def, "--die-shade": def, "--pip": "#fff" }}>
        {roll.def.map((v, k) => <Die3D key={k} value={v} spins={id} size={30} />)}
      </span>
      <span className="er-loss">−{roll.lossA} / −{roll.lossD}</span>
    </div>
  );
}

const SYMBOL_ICON = ["🛡️", "🐎", "💣", "⭐"];
function CardView({ c, own }) {
  const s = cardSymbol(c), t = cardTerritory(c);
  return (
    <div className={"er-card" + (own ? " own" : "")}>
      <span className="er-card-sym" aria-hidden="true">{SYMBOL_ICON[s]}</span>
      <b>{s === JOKER ? "Joker" : SYMBOLS[s]}</b>
      <span>{t === null ? "passt zu allem" : T[t].name}</span>
      {own && <small>dein Gebiet: +2</small>}
    </div>
  );
}
