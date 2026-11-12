import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { COLORS, color, num, copies, cardName, MAX_HINTS, MAX_CLOUDS, hintHits, score, finalScore, rating } from "../shared/sternbilder";
import "./Sternbilder.css";

const COL = ["red", "blue", "green", "yellow", "white"];
const SHAPE = ["●", "▲", "■", "◆", "★"]; // zusätzlich zur Farbe, damit man die Farben auch ohne Farbsehen unterscheiden kann
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; // wer keine Bewegung möchte, bekommt keine

// Karten gleiten an ihren neuen Platz, wenn sich die Reihenfolge ändert, und neue Karten werden eingeblendet.
// Dazu merkt sich der Hook nach jedem Zeichnen, wo jede Karte (data-u) lag, und spielt den Weg vom alten zum neuen Platz ab.
// skip = Karte, die gerade mit dem Finger gezogen wird (die folgt dem Finger und wird nicht animiert).
function useFlip(ref, skip) {
  const seen = useRef(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const b = box.getBoundingClientRect();
    const next = new Map();
    for (const el of box.children) {
      const u = el.dataset.u;
      if (u === undefined) continue;
      const p = { x: el.offsetLeft, y: el.offsetTop };
      next.set(u, p);
      if (!seen.current || u === String(skip) || calm() || !el.animate) continue;
      const old = seen.current.get(u);
      if (!old) {
        el.animate([{ transform: "translateY(-20px) scale(0.8)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 340, easing: EASE });
      } else if (old.x !== p.x || old.y !== p.y) {
        // Läuft noch eine Bewegung, geht es von dort weiter, wo die Karte gerade ist – sonst würde sie springen
        let rx = 0, ry = 0;
        const running = el.getAnimations?.() ?? [];
        if (running.length) {
          const r = el.getBoundingClientRect();
          rx = r.left - (b.left + box.clientLeft + p.x); ry = r.top - (b.top + box.clientTop + p.y);
          running.forEach((a) => a.cancel());
        }
        el.animate([{ transform: `translate(${old.x - p.x + rx}px, ${old.y - p.y + ry}px)` }, { transform: "none" }], { duration: 300, easing: EASE });
      }
    }
    seen.current = next;
  });
}

// Offene Karte (id bekannt) oder verdeckte eigene Karte (nur das Wissen aus Hinweisen). hot = frischer Hinweis,
// shown = der Besitzer hat diese Karte gerade ausgewählt (sie steht bei allen ein Stück höher)
function Card({ k, id, small, sel, hot, shown, onClick }) {
  const known = id ?? k?.id;
  const c = known != null ? color(known) : k?.c, n = known != null ? num(known) : k?.n;
  const cls = "stcard" + (c != null ? " " + COL[c] : " unknown") + (known == null ? " hidden" : "") + (small ? " small" : "")
    + (sel ? " sel" : "") + (hot ? " hot" : "") + (shown ? " shown" : "");
  const name = (known != null ? cardName(known) : `Deine Karte: ${c != null ? COLORS[c] : "Farbe ?"}, ${n ?? "Zahl ?"}`) + (shown ? " – gerade ausgewählt" : "");
  return (
    <button className={cls} disabled={!onClick} onClick={onClick} aria-label={name} title={name} aria-pressed={sel || undefined}>
      {c != null && <span className="shape tl" aria-hidden="true">{SHAPE[c]}</span>}
      <span className="n">{n ?? "?"}</span>
      {c != null && <span className="shape br" aria-hidden="true">{SHAPE[c]}</span>}
    </button>
  );
}

// Was der Besitzer über seine Karte weiß (für die Anzeige unter fremden Karten)
function Know({ k, memory }) {
  return (
    <span className="know" title={memory ? "Diesen Hinweis sieht der Besitzer gerade noch" : "Das weiß der Besitzer über diese Karte"}>
      <span className={k.c != null ? "on " + COL[k.c] : ""}>{k.c != null ? SHAPE[k.c] : "·"}</span>
      <span className={k.n != null ? "on" : ""}>{k.n ?? "·"}</span>
    </span>
  );
}

// Hand eines Mitspielers: offen, in der Reihenfolge, in die er sie sortiert hat. pick = die Karte, die er gerade ausgewählt hat.
// Auf dem Fernseher sind die Karten verdeckt und zeigen nur, was der Besitzer weiß – das steht dann schon auf der Karte (know = false).
function OtherHand({ cards, memory, pick, know = true }) {
  const box = useRef(null);
  useFlip(box);
  return (
    <div className="cards" ref={box}>
      {cards.map((k) => (
        <div className="slotwrap" key={k.u} data-u={k.u}>
          <Card k={k} hot={k.hot > 0} shown={pick === k.u} />
          {know && (!memory || k.hot > 0) && <Know k={k} memory={memory} />}
        </div>
      ))}
    </div>
  );
}

// Eigene Hand: verdeckt. Antippen wählt eine Karte, Ziehen sortiert um (die anderen Karten rücken dabei sofort zur Seite).
// onReorder(reihenfolge, fertig): während des Ziehens fertig = false, beim Loslassen true.
function MyHand({ cards, sel, sortable, onTap, onReorder }) {
  const box = useRef(null);
  const drag = useRef(null);
  const live = useRef({});
  const [dragU, setDragU] = useState(null);
  useFlip(box, dragU);

  // Gezogene Karte unter dem Finger halten – auch wenn sie in der Reihe schon auf einen anderen Platz gerückt ist
  const place = () => {
    const d = drag.current, b = box.current;
    if (!d?.moved || !b) return;
    const r = b.getBoundingClientRect();
    const x = d.x - d.gx - r.left - b.clientLeft - d.el.offsetLeft, y = d.y - d.gy - r.top - b.clientTop - d.el.offsetTop;
    d.el.style.transform = `translate(${x}px, ${y}px) rotate(3deg) scale(1.06)`;
  };
  useLayoutEffect(() => {
    live.current = { order: cards.map((k) => k.u), onTap, onReorder };
    place();
  });
  useEffect(() => () => drag.current?.stop(), []);

  const down = (e, u) => {
    if (e.button !== 0 || drag.current) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const start = live.current.order;
    const d = { u, el, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, gx: e.clientX - r.left, gy: e.clientY - r.top,
      w: r.width, h: r.height, order: start, moved: false };
    const move = (ev) => {
      if (ev.pointerId !== d.id) return;
      d.x = ev.clientX; d.y = ev.clientY;
      if (!d.moved) {
        if (Math.hypot(d.x - d.sx, d.y - d.sy) < 6) return; // kleines Wackeln zählt noch als Antippen
        d.moved = true; setDragU(u);
      }
      place();
      // Alle Plätze sind gleich groß: Die Karte kommt auf den Platz, dessen Mitte ihrer Mitte am nächsten ist
      const b = box.current, br = b.getBoundingClientRect();
      const cx = d.x - d.gx + d.w / 2 - br.left - b.clientLeft, cy = d.y - d.gy + d.h / 2 - br.top - b.clientTop;
      let best = 0, bestDist = Infinity;
      [...b.children].forEach((slot, i) => {
        const dist = Math.hypot(slot.offsetLeft + slot.offsetWidth / 2 - cx, slot.offsetTop + d.h / 2 - cy);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      if (best !== d.order.indexOf(u)) {
        const next = d.order.filter((x) => x !== u);
        next.splice(best, 0, u);
        d.order = next;
        live.current.onReorder(next, false);
      }
    };
    const up = (ev) => {
      if (ev.pointerId !== d.id) return;
      d.stop(); drag.current = null;
      if (!d.moved) { if (ev.type === "pointerup") live.current.onTap(u); return; }
      // Losgelassen: Karte gleitet von dort auf ihren Platz
      const from = el.style.transform;
      el.style.transform = "";
      if (!calm() && el.animate) {
        el.style.zIndex = 5;
        el.animate([{ transform: from }, { transform: "none" }], { duration: 240, easing: EASE }).onfinish = () => { el.style.zIndex = ""; };
      }
      setDragU(null);
      if (d.order.join() !== start.join()) live.current.onReorder(d.order, true);
    };
    d.stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    try { el.setPointerCapture(e.pointerId); } catch { /* ohne geht es auch, dann endet das Ziehen am Fensterrand */ }
    drag.current = d;
  };

  return (
    <div className={"cards mine" + (sortable ? " sortable" : "")} ref={box}>
      {cards.map((k) => (
        <div className={"slotwrap" + (dragU === k.u ? " dragging" : "")} key={k.u} data-u={k.u} onPointerDown={sortable ? (e) => down(e, k.u) : undefined}>
          {/* Maus und Finger laufen über onPointerDown (Antippen oder Ziehen), onClick ist nur noch für die Tastatur da */}
          <Card k={k} sel={sel === k.u} hot={k.hot > 0} onClick={sortable ? (e) => { if (e.detail === 0) onTap(k.u); } : undefined} />
          {(k.notC.length > 0 || k.notN.length > 0) && k.id == null && (
            <span className="not" title="Das ist diese Karte sicher nicht">
              {k.c == null && k.notC.map((c) => <span key={"c" + c} className={COL[c]}>{SHAPE[c]}</span>)}
              {k.n == null && k.notN.map((v) => <span key={"n" + v}>{v}</span>)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Tokens({ hints, clouds }) {
  return (
    <div className="tokens">
      <span className="tok-group" aria-label={`${hints} von ${MAX_HINTS} Hinweisen`} title="Hinweise">
        {Array.from({ length: MAX_HINTS }, (_, i) => <span key={i} className={"tok hint" + (i < hints ? " on" : "")} aria-hidden="true">✦</span>)}
      </span>
      <span className="tok-group" aria-label={`${clouds} von ${MAX_CLOUDS} Wolken`} title="Wolken – bei drei ist die Nacht verloren">
        {Array.from({ length: MAX_CLOUDS }, (_, i) => <span key={i} className={"tok cloud" + (i < clouds ? " on" : "")} aria-hidden="true">☁</span>)}
      </span>
    </div>
  );
}

const NONE = []; // Hand des Fernsehers (immer dasselbe Array)

export default function OnlineSternbilder({ room, me, socket, onLeave }) {
  const s = room.state;
  const mine = me.index;
  const tv = !!me.tv; // Fernseher: zeigt alle Hände verdeckt (nur mit den Hinweisen), sonst sähe jeder seine eigenen Karten
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(s.picks?.[mine] ?? null); // gewählte eigene Karte (Zieh-Nummer) – die sehen auch die Mitspieler
  const [target, setTarget] = useState(null); // Mitspieler für einen Hinweis
  const [local, setLocal] = useState(null); // eigene Reihenfolge, solange gezogen wird bzw. bis der Server sie bestätigt hat
  useEffect(() => setErr(""), [s.turn, s.stage]);
  const act = (a) => socket.emit("sb:act", a, (res) => setErr(res?.error || ""));
  const playing = s.stage === "play";
  const myTurn = s.cur === mine && playing;
  const who = room.players[s.cur];
  const n = s.names.length;
  // Mitspieler in Zugreihenfolge ab mir – auf dem Fernseher alle
  const others = tv ? s.names.map((_, i) => i) : Array.from({ length: n - 1 }, (_, i) => (mine + 1 + i) % n);
  const tgt = target ?? others[0];

  // Eigene Karten: Die gerade selbst gezogene Reihenfolge gilt sofort, der Server zieht nach
  const dealt = s.hands[mine] || NONE;
  const myCards = local && local.length === dealt.length && local.every((u) => dealt.some((k) => k.u === u))
    ? local.map((u) => dealt.find((k) => k.u === u)) : dealt;
  const selIdx = playing ? myCards.findIndex((k) => k.u === sel) : -1;
  const reorder = (order, done) => {
    setLocal(order);
    if (done) socket.emit("sb:act", { type: "sort", order }, (res) => {
      if (res?.error) setErr(res.error);
      setLocal((cur) => (cur === order ? null : cur));
    });
  };
  // Antippen wählt eine Karte aus (nochmal antippen hebt es auf). Das geht sofort und wird den anderen gemeldet.
  const tap = (u) => {
    const next = selIdx >= 0 && sel === u ? null : u;
    setSel(next);
    socket.emit("sb:act", { type: "pick", u: next }, (res) => { if (res?.error) setErr(res.error); });
  };
  const shift = (dir) => {
    const order = myCards.map((k) => k.u);
    [order[selIdx], order[selIdx + dir]] = [order[selIdx + dir], order[selIdx]];
    reorder(order, true);
  };
  const freshHint = s.memory && playing && myCards.some((k) => k.hot > 0);

  // Abwurfstapel nach Farbe und Zahl gruppiert; ein Wert ist "tot", wenn alle Exemplare weg sind und er noch fehlt
  const discarded = COLORS.map((_, c) => s.discard.filter((id) => color(id) === c).sort((a, b) => num(a) - num(b)));
  const gone = (c, v) => discarded[c].filter((id) => num(id) === v).length;
  const maxReach = COLORS.map((_, c) => { let v = s.piles[c]; while (v < 5 && gone(c, v + 1) < copies(v + 1)) v++; return v; });

  let hint = err;
  if (!hint && playing) {
    if (myTurn) hint = selIdx >= 0 ? "Karte ausspielen, abwerfen oder verschieben?" : "Du bist dran: Gib einen Hinweis – oder wähle eine deiner Karten zum Ausspielen bzw. Abwerfen.";
    else hint = `${who.name} ist dran …`;
  }

  const total = finalScore(s);

  return (
    <main className={"sb" + (tv ? " tv" : "")}>
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onLeave}>← Verlassen</button>
        <h1>Sternbilder · {room.code}</h1>
        <div className="status" aria-live="polite">
          Stapel: <b>{s.deckCount}</b> · Punkte: <b>{score(s)}</b>
          {s.memory && <> · <span className="mode" title="Hinweise bleiben nur sichtbar, bis der Empfänger am Zug war">Gedächtnis-Modus</span></>}
          {s.finalLeft !== null && playing && <> · <span className="final">Letzte Runde: noch {s.finalLeft} {s.finalLeft === 1 ? "Zug" : "Züge"}</span></>}
        </div>
      </header>

      <div className="sb-layout"><div className="sb-main">
        <section className="panel sky">
          <div className="sky-head"><h3>Der Himmel</h3><Tokens hints={s.hints} clouds={s.clouds} /></div>
          <div className="piles">
            {COLORS.map((c, i) => (
              <div className={"pile " + COL[i]} key={c} title={maxReach[i] < 5 ? `${c}: höchstens noch bis ${maxReach[i]} erreichbar` : c}>
                {s.piles[i] > 0 ? <Card key={s.piles[i]} id={i * 10 + [0, 3, 5, 7, 9][s.piles[i] - 1]} /> : <span className="slot" aria-hidden="true">{SHAPE[i]}</span>}
                <small>{c} {s.piles[i]}/5{maxReach[i] < 5 && <span className="dead"> · max {maxReach[i]}</span>}</small>
              </div>
            ))}
          </div>
          <p className="msg">{s.log[0] || "Viel Glück – ihr spielt alle zusammen!"}</p>
        </section>

        <section className="panel">
          <h3>{tv ? "Spieler – jeder sieht am Handy die Karten der anderen" : "Mitspieler"}</h3>
          <div className="hands">
            {others.map((p) => (
              <div key={p} className={"ohand" + (p === s.cur ? " active" : "") + (myTurn && tgt === p ? " target" : "") + (myTurn ? " pickable" : "")}
                onClick={myTurn ? () => setTarget(p) : undefined}>
                <div className="oname">{room.players[p].name}{room.players[p].connected ? "" : " – offline"}{p === s.cur ? " · ist dran" : ""}</div>
                <OtherHand cards={s.hands[p]} memory={s.memory && playing} pick={playing ? s.picks?.[p] : null} know={!tv} />
              </div>
            ))}
          </div>
          {myTurn && (
            <div className="hintbox">
              <p className="note">Hinweis an <b>{room.players[tgt].name}</b>{others.length > 1 ? " (oben einen anderen Spieler antippen zum Wechseln)" : ""} – {s.hints} {s.hints === 1 ? "Hinweis" : "Hinweise"} übrig:</p>
              <div className="row">
                {COLORS.map((c, i) => {
                  const hits = hintHits(s.hands[tgt], { color: i }).length;
                  return <button key={c} className={"pick " + COL[i]} disabled={!s.hints || !hits} onClick={() => act({ type: "hint", to: tgt, color: i })}
                    title={hits ? `${hits} Karte(n)` : "trifft keine Karte"}>{SHAPE[i]} {c}</button>;
                })}
              </div>
              <div className="row">
                {[1, 2, 3, 4, 5].map((v) => {
                  const hits = hintHits(s.hands[tgt], { num: v }).length;
                  return <button key={v} className="numb" disabled={!s.hints || !hits} onClick={() => act({ type: "hint", to: tgt, num: v })}
                    title={hits ? `${hits} Karte(n)` : "trifft keine Karte"}>{v}</button>;
                })}
              </div>
            </div>
          )}
        </section>

        {/* dock: Auf dem Handy kleben die eigenen Karten am unteren Bildschirmrand (index.css) */}
        {!tv && <section className="panel sb-mine dock">
          <h3>Deine Karten{!playing ? " (aufgedeckt)" : s.memory ? " – Hinweise musst du dir merken" : " – du siehst nur, was dir verraten wurde"}</h3>
          <MyHand cards={myCards} sel={selIdx >= 0 ? sel : null} sortable={playing} onTap={tap} onReorder={reorder} />
          {freshHint && <p className="fresh">✦ Frischer Hinweis – präg ihn dir ein oder sortiere deine Karten um. Nach deinem nächsten Zug ist er nicht mehr zu sehen.</p>}
          {selIdx >= 0 && (
            <div className="row">
              <button className="numb" disabled={selIdx === 0} aria-label="Karte nach links schieben" title="Nach links schieben" onClick={() => shift(-1)}>◀</button>
              <button className="numb" disabled={selIdx === myCards.length - 1} aria-label="Karte nach rechts schieben" title="Nach rechts schieben" onClick={() => shift(1)}>▶</button>
              {myTurn && <>
                <button className="act play" onClick={() => act({ type: "play", u: sel })}>Ausspielen</button>
                <button className="act" disabled={s.hints === MAX_HINTS} title={s.hints === MAX_HINTS ? "Erst wenn ein Hinweis verbraucht ist" : undefined}
                  onClick={() => act({ type: "discard", u: sel })}>Abwerfen<span className="lg-only"> (+1 Hinweis)</span></button>
              </>}
            </div>
          )}
          {playing && <p className="note sort-note">Karten ziehen zum Sortieren (oder antippen und ◀ ▶) – deine Mitspieler sehen die Reihenfolge. Eine angetippte Karte steht auch bei ihnen ein Stück höher: So kannst du zeigen, welche du meinst.</p>}
          <p className="msg">{hint}</p>
        </section>}
      </div>

      <aside className="sb-side">
        <section className="panel">
          <h3>Abgeworfen</h3>
          {s.discard.length === 0 ? <p className="note">Noch nichts.</p> : (
            <div className="discard">
              {discarded.map((ids, c) => ids.length > 0 && (
                <div key={c} className="drow">{ids.map((id) => <Card key={id} id={id} small />)}</div>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <h3>Verlauf{s.memory && playing ? " (nur die letzte Runde)" : ""}</h3>
          {s.log.length === 0 ? <p className="note">Noch keine Züge.</p> : (
            <ol className="log">{s.log.map((t, i) => <li key={s.turn - i}>{t}</li>)}</ol>
          )}
        </section>
        {!tv && <section className="panel rules">
          <h3>Regeln</h3>
          <p>Ihr spielt <b>gemeinsam</b>. Jeder sieht die Karten aller anderen – nur die eigenen nicht.
            Ziel: alle fünf Sternbilder der Reihe nach von <b>1 bis 5</b> auslegen.</p>
          <p>Wer dran ist, macht genau eins:</p>
          <p><b>Hinweis geben</b> (kostet ✦): einem Mitspieler alle seine Karten einer Farbe <i>oder</i> einer Zahl zeigen.</p>
          <p><b>Abwerfen</b>: eine eigene Karte ablegen, dafür kommt ein ✦ zurück.</p>
          <p><b>Ausspielen</b>: Passt die Karte, wächst das Sternbild. Passt sie nicht, zieht eine <b>Wolke ☁</b> auf – bei drei ist die Nacht verloren (0 Punkte).</p>
          <p>Ein fertiges Sternbild bringt ✦ zurück. Ist der Stapel leer, hat jeder noch einen Zug. Punkte = Summe der obersten Karten (max. 25).</p>
          <p>Pro Farbe gibt es 3× die 1, je 2× die 2–4 und nur 1× die 5.</p>
          <p><b>Sortieren und zeigen</b>: Deine Karten darfst du jederzeit umsortieren, auch wenn du nicht dran bist. Neue Karten kommen links dazu. Tippst du eine Karte an, sehen alle, welche du meinst.</p>
          {s.memory && <p><b>Gedächtnis-Modus</b>: Ein Hinweis bleibt nur sichtbar, bis du das nächste Mal am Zug warst. Danach musst du ihn dir merken – oder dir mit der Reihenfolge deiner Karten helfen.</p>}
        </section>}
      </aside></div>

      {s.stage === "over" && (
        <div className="overlay"><div className="card">
          <h2>{s.end === "clouds" ? "☁ Die Wolken haben gesiegt" : s.end === "perfect" ? "✦ Alle Sternbilder leuchten!" : "Die Nacht ist vorbei"}</h2>
          <p className="big-score"><b>{total}</b> / 25 Punkte</p>
          <p>{s.end === "clouds" ? `Drei Fehlversuche – der Himmel ist verdeckt. (Ausgelegt waren ${score(s)} Sterne.)` : rating(total)}</p>
          <div className="piles small">
            {COLORS.map((c, i) => <div key={c} className={"pile " + COL[i]}><b>{s.piles[i]}</b><small>{c}</small></div>)}
          </div>
          {me.host
            ? <div className="opts"><button className="wide on" onClick={() => socket.emit("start")}>Nochmal spielen</button><button className="wide" onClick={() => socket.emit("lobby")}>Etwas anderes spielen</button></div>
            : <p>Warte auf den Host …</p>}
          <button className="ghost" onClick={onLeave}>Raum verlassen</button>
        </div></div>
      )}
    </main>
  );
}
