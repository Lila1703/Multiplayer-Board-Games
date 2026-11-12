import { useEffect, useState } from "react";
import { SUITS, SUIT_NAMES } from "../shared/schwimmen";
import { RANKS, MAX_ATTACK, suit, rank, cardName, beats, attackers, openCards, canThrow, canShift, shiftTo } from "../shared/durak";
import "./Schwimmen.css"; // Flächen, Sitze, Knöpfe und Karten (.sw, .seat, .scard)
import "./MauMau.css"; // verdeckter Stapel und Fächer der eigenen Hand (.scard.back, .mm-hand, .fan)
import "./Durak.css";

const cards = (n) => `${n} ${n === 1 ? "Karte" : "Karten"}`;

// Karte des 36er-Blatts, sieht aus wie die Karten bei Schwimmen. Trumpfkarten sind leicht golden getönt.
function DCard({ id, trump, sel, className = "", onClick, children }) {
  const isTrump = suit(id) === trump;
  return (
    <button className={"scard" + (suit(id) >= 2 ? " red" : "") + (isTrump ? " dk-trump" : "") + (sel ? " sel" : "") + (className && " " + className)}
      disabled={!onClick} onClick={onClick} aria-label={cardName(id) + (isTrump ? " (Trumpf)" : "")} aria-pressed={onClick ? !!sel : undefined}>
      {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={"corner " + c} aria-hidden="true">{RANKS[rank(id)]}</span>)}
      <span className="suit" aria-hidden="true">{SUITS[suit(id)]}</span>
      {children}
    </button>
  );
}

// Angriffskarten, die geschlagenen mit der Abwehrkarte halb darüber
function Table({ table, trump, target, onPick, last }) {
  return (
    <div className={"dk-table" + (last ? " last" : "")}>
      {table.map((p) => (
        <div key={p.a} className="dk-pair">
          <DCard id={p.a} trump={trump} sel={p.a === target} onClick={onPick && p.d === null ? () => onPick(p.a) : undefined}>
            {p.d !== null && <span className="dk-asuit" aria-hidden="true">{SUITS[suit(p.a)]}</span>}
          </DCard>
          {p.d !== null && <DCard id={p.d} trump={trump} className="dk-def" />}
        </div>
      ))}
    </div>
  );
}

export default function OnlineDurak({ room, me, socket, onLeave }) {
  const s = room.state;
  const mine = me.index;
  const tv = !!me.tv; // Fernseher: zeigt nur den Tisch, keine Hand
  const over = s.stage === "over";
  const [pick, setPick] = useState(null); // die offene Karte, die der Verteidiger als Nächstes schlagen will
  const [ask, setAsk] = useState(null); // Karte, mit der man schlagen oder schieben könnte: erst nachfragen
  const [err, setErr] = useState("");
  useEffect(() => { setErr(""); setAsk(null); }, [s]);

  const act = (a) => socket.emit("dk:act", a, (res) => setErr(res?.error || ""));
  const atts = attackers(s), open = openCards(s);
  const defending = !over && open.length > 0 && !s.taking; // der Verteidiger muss schlagen oder aufnehmen
  const closing = !over && s.table.length > 0 && !defending; // alles geschlagen oder es wird aufgenommen: Angreifer legen nach oder sagen „Fertig“
  // Auf wen alle gerade warten
  const awaited = over ? [] : !s.table.length ? [s.att] : defending ? [s.def] : atts.filter((i) => !s.passed.includes(i) && s.counts[i] > 0);
  const place = s.done.indexOf(mine); // -1 = spielt noch
  const iDefend = !over && mine === s.def, iAttack = !over && atts.includes(mine);
  const target = open.includes(pick) ? pick : open[0];
  const shifts = (id) => iDefend && defending && canShift(s, id); // mit dieser Karte könnte ich weiterschieben
  const ok = (id) => (iDefend ? defending && (beats(s.trump, id, target) || canShift(s, id))
    : iAttack && (s.table.length > 0 || mine === s.att) && canThrow(s, id));
  // Trümpfe stehen rechts, davor die übrigen Karten nach Wert
  const order = (id) => (suit(id) === s.trump ? 100 : 0) + rank(id) * 4 + suit(id);
  const hand = [...(s.hand || [])].sort((a, b) => order(a) - order(b));
  const canAny = hand.some(ok);
  const myMove = canAny || (iDefend && defending);
  const tap = (id) => {
    if (!iDefend) return act({ type: "attack", card: id });
    if (!shifts(id)) return act({ type: "defend", card: id, target });
    // Geht beides, wird nachgefragt
    return beats(s.trump, id, target) ? setAsk(id) : act({ type: "shift", card: id });
  };
  const canFinish = iAttack && closing && canAny && !s.passed.includes(mine);
  const A = s.names[s.att], D = s.names[s.def];
  const next = s.names[shiftTo(s)]; // wer nach dem Schieben angegriffen würde
  const shiftHint = hand.some(shifts) ? ` Mit einer Karte mit Pfeil (→) schiebst du den Angriff weiter an ${next}.` : "";

  const hint = err || (over ? ""
    : place >= 0 ? `Du bist fertig (Platz ${place + 1}) – schau den anderen zu.`
    : iDefend ? (
      !s.table.length ? `${A} greift dich an …`
      : s.taking ? "Du nimmst auf – die Angreifer dürfen noch Karten dazulegen."
      : !open.length ? "Alles geschlagen – mal sehen, ob noch jemand etwas dazulegt."
      : !canAny && open.length === 1 ? `Du kannst ${cardName(target)} nicht schlagen: Nimm auf.`
      : open.length > 1 ? `Tippe oben die Karte an, die du schlagen willst (gewählt: ${cardName(target)}), dann eine deiner Karten – oder nimm alles auf.${shiftHint}`
      : `Schlag ${cardName(target)} mit einer höheren Karte derselben Farbe oder mit Trumpf – oder nimm auf.${shiftHint}`)
    : iAttack ? (
      !s.table.length ? (mine === s.att ? `Du greifst ${D} an: Tippe eine Karte an.` : `${A} legt die erste Karte, danach darfst du Karten dazulegen.`)
      : !canAny ? (defending ? `Du kannst nichts dazulegen. ${D} ist dran …` : "Du kannst nichts dazulegen.")
      : s.passed.includes(mine) ? "Du hast „Fertig“ gesagt."
      : s.taking ? `${D} nimmt auf: Leg Karten mit gleichem Wert dazu oder sag „Fertig“.`
      : defending ? "Du darfst Karten dazulegen, deren Wert schon auf dem Tisch liegt."
      : "Alles geschlagen: Leg eine Karte mit gleichem Wert nach oder sag „Fertig“.")
    : `${A} greift ${D} an …`);

  return (
    <main className={"sw dk" + (tv ? " tv" : "")}>
      <header>
        <button className="ghost" style={{ margin: 0 }} onClick={onLeave}>← Verlassen</button>
        <h1>Durak · {room.code}</h1>
        <div className="status" aria-live="polite">
          {over ? "Partie vorbei" : <><b>{A}</b> greift <b>{D}</b> an{s.taking ? ` · ${D} nimmt auf` : ""}</>}
        </div>
      </header>

      <section className="seats">
        {room.players.map((p, i) => {
          const pl = s.done.indexOf(i);
          return (
            <div key={i} className={"seat" + (awaited.includes(i) ? " active" : "") + (pl >= 0 ? " out" : "") + (i === mine ? " me" : "")}>
              <div className="seatname">{p.name}{i === mine && <span className="lg-only"> (du)</span>}{p.connected ? "" : " – offline"}</div>
              {/* Am Handy steht alles in einer Zeile: Die Wörter fallen weg (lg-only), es bleiben Kartenzahl und Symbol */}
              <div className="tags">
                {pl >= 0 ? <span className="tag closed">fertig<span className="lg-only"> · Platz {pl + 1}</span></span>
                  : <span className="tag dk-count" title={cards(s.counts[i])}>{s.counts[i]}<span className="lg-only"> {s.counts[i] === 1 ? "Karte" : "Karten"}</span></span>}
                {!over && i === s.def && <span className="tag closed" title="wird angegriffen">🛡️<span className="lg-only"> {s.taking ? "nimmt auf" : "verteidigt"}</span></span>}
                {!over && pl < 0 && atts.includes(i) && <span className="tag" title="greift an">⚔️<span className="lg-only"> {i === s.att ? "greift an" : "greift mit an"}</span></span>}
              </div>
            </div>
          );
        })}
      </section>

      <section className="panel felt">
        <h3>Tisch</h3>
        <div className="dk-top">
          {s.deck > 1 && (
            <button className="scard small back" disabled aria-label={`Stapel mit ${cards(s.deck)}`}><span aria-hidden="true">{s.deck}</span></button>
          )}
          {s.deck > 0 && <DCard id={s.trumpCard} trump={s.trump} className="small" />}
          <div className="dk-info">
            <span>Trumpf: <span className={"mm-suit" + (s.trump >= 2 ? " red" : "")}>{SUITS[s.trump]} {SUIT_NAMES[s.trump]}</span></span>
            <span>Stapel: <b>{s.deck}</b>{s.deck > 0 && <span className="lg-only"> – die Trumpfkarte {cardName(s.trumpCard)} wird als Letzte gezogen</span>}</span>
            {s.discard > 0 && <span>Weggelegt: <b>{s.discard}</b></span>}
          </div>
        </div>
        {s.table.length > 0
          ? <Table table={s.table} trump={s.trump} target={iDefend && defending ? target : undefined} onPick={iDefend && defending && open.length > 1 ? setPick : undefined} />
          : s.last ? (
            <>
              <Table table={s.last.table} trump={s.trump} last />
              <p className="dk-note">{s.last.took ? `${s.names[s.last.def]} hat diese Karten aufgenommen.` : "Abgewehrt – diese Karten sind weg."}</p>
            </>
          ) : <div className="dk-table"><p className="dk-note">Noch liegt nichts auf dem Tisch.</p></div>}
        <p className="msg">{s.msg}</p>
      </section>

      {/* dock: Auf dem Handy kleben die eigenen Karten samt Knöpfen am unteren Bildschirmrand (index.css) */}
      {!tv && <section className="panel dock">
        <h3>Deine Karten {place < 0 && <span className="points">· {hand.length}</span>}</h3>
        {place < 0 && (
          // Fächer wie bei Mau-Mau: Die Karten überlappen, sobald sie nicht mehr nebeneinander passen
          <div className="mm-hand" style={{ "--n": Math.max(hand.length - 1, 1) }}>
            {hand.map((id) => (
              <DCard key={id} id={id} trump={s.trump} className={"fan" + (ok(id) ? " can" : myMove ? " cant" : "")} onClick={ok(id) ? () => tap(id) : undefined}>
                <span className="fsuit" aria-hidden="true">{SUITS[suit(id)]}</span>
                {shifts(id) && <span className="dk-shift" title="Damit kannst du weiterschieben" aria-hidden="true">→</span>}
              </DCard>
            ))}
          </div>
        )}
        {(iDefend && defending || canFinish) && (
          <div className="row">
            {iDefend && defending && <button className={canAny ? "" : "go"} onClick={() => act({ type: "take" })}>{open.length + (s.table.length - open.length) * 2 === 1 ? "Karte aufnehmen" : "Alles aufnehmen"}</button>}
            {canFinish && <button className="go" onClick={() => act({ type: "done" })}>Fertig</button>}
          </div>
        )}
        <p className="msg">{hint}</p>
      </section>}

      {!tv && <section className="panel rules">
        <h3>Regeln</h3>
        <p>Der <b>Angreifer</b> legt seinem Sitznachbarn eine Karte hin. Der <b>Verteidiger</b> schlägt sie mit einer höheren Karte derselben Farbe oder mit einem <b>Trumpf</b> (ein Trumpf wird nur von einem höheren Trumpf geschlagen).
          Beide Sitznachbarn des Verteidigers dürfen Karten dazulegen, deren Wert schon auf dem Tisch liegt – höchstens {MAX_ATTACK} Angriffskarten und nie mehr, als der Verteidiger Karten hat.
          <b> Schieben:</b> Solange noch nichts geschlagen ist, darf der Verteidiger eine Karte mit demselben Wert dazulegen. Dann muss sein nächster Nachbar alles abwehren (wenn der genug Karten hat), und wer geschoben hat, greift mit an.
          Schlägt der Verteidiger alles, kommen die Karten weg und er greift als Nächster an. Kann oder will er nicht, <b>nimmt er alle Karten auf</b> und wird übersprungen.
          Danach zieht jeder auf sechs Karten nach, die Angreifer zuerst. Ist der Stapel leer, scheidet aus, wer keine Karten mehr hat. Wer als Letzter Karten hat, ist der <b>Durak</b>.</p>
      </section>}

      {ask !== null && iDefend && defending && s.hand.includes(ask) && (
        <div className="overlay"><div className="card">
          <h2>{cardName(ask)}: schlagen oder schieben?</h2>
          <div className="opts">
            <button className="wide" onClick={() => { act({ type: "defend", card: ask, target }); setAsk(null); }}>{cardName(target)} schlagen</button>
            <button className="wide" onClick={() => { act({ type: "shift", card: ask }); setAsk(null); }}>Weiterschieben an {next}</button>
          </div>
          <p>Schiebst du weiter, muss {next} alle Karten auf dem Tisch abwehren, und du greifst mit an.</p>
          <button className="ghost" style={{ margin: 0 }} onClick={() => setAsk(null)}>Abbrechen</button>
        </div></div>
      )}

      {over && (
        <div className="overlay"><div className="card mm-result">
          <h2>{s.loser === null ? "Unentschieden!" : `🃏 ${s.names[s.loser]} ist der Durak!`}</h2>
          <p>{s.loser === null ? "Die letzten beiden sind gleichzeitig fertig geworden – niemand ist der Durak."
            : <><b>{s.names[s.loser]}</b> bleibt auf {cards(s.counts[s.loser])} sitzen.</>}</p>
          <div className="results">
            {[...s.done, ...(s.loser === null ? [] : [s.loser])].map((i, k) => (
              <div key={i} className={"res" + (i === s.loser ? " lost" : "")}>
                <div className="res-head">
                  <b>{k + 1}. {s.names[i]}{i === mine ? " (du)" : ""}</b>
                  <span>{i === s.loser ? "Durak" : "fertig"}</span>
                </div>
              </div>
            ))}
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
