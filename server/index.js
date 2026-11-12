import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { Server } from "socket.io";
import { createGame, roll, afterWait, move, movable } from "../client/src/shared/ludo.js";
import { createKniffel, kRoll, kHold, kPick } from "../client/src/shared/kniffel.js";
import { createPhase10, act as p10act, viewP10 } from "../client/src/shared/phase10.js";
import { createSchwimmen, act as swAct, viewSchwimmen } from "../client/src/shared/schwimmen.js";
import { createZauberstich, act as srAct, collect as srCollect, viewZauberstich } from "../client/src/shared/zauberstich.js";
import { createSternbilder, act as sbAct, viewSternbilder } from "../client/src/shared/sternbilder.js";
import { createSudoku, act as suAct, viewSudoku } from "../client/src/shared/sudoku.js";
import { createMauMau, act as mmAct, viewMauMau } from "../client/src/shared/maumau.js";
import { createDurak, act as dkAct, viewDurak } from "../client/src/shared/durak.js";

const VIEWS = { phase10: viewP10, schwimmen: viewSchwimmen, zauberstich: viewZauberstich, sternbilder: viewSternbilder, sudoku: viewSudoku, maumau: viewMauMau, durak: viewDurak };
const GAMES = ["ludo", "kniffel", "phase10", "schwimmen", "zauberstich", "sternbilder", "sudoku", "maumau", "durak"];
const MAX_PLAYERS = { ludo: 4, kniffel: 10, phase10: 6, schwimmen: 8, zauberstich: 6, sternbilder: 5, sudoku: 8, maumau: 5, durak: 6 };
// Fernseher-Modus: Diese Spiele zeigen auf dem Fernseher nichts, was nicht ohnehin jeder am Handy sieht (muss zu noTv in catalog.js passen)
const NO_TV = ["ludo", "sudoku"];
// Host: der erste Spieler, der noch da ist – im Fernseher-Modus zusätzlich der Fernseher selbst.
// Ist der erste offline oder hat die laufende Partie verlassen, übernimmt der nächste – sonst käme niemand mehr zurück in die Lobby.
const hostIndex = (r) => {
  const i = r.players.findIndex((p) => !p.left && p.connected);
  return i >= 0 ? i : r.players.findIndex((p) => !p.left);
};
const isHost = (r, p) => !!p && (p === r.tv || (r.players.includes(p) && r.players.indexOf(p) === hostIndex(r)));
const empty = (r) => r.players.every((p) => !p.connected) && !r.tv?.connected;
const reap = (r) => { if (empty(r)) setTimeout(() => { if (empty(r)) rooms.delete(r.code); }, 3600000); };

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(dist));
app.use((req, res) => res.sendFile(path.join(dist, "index.html")));

const rooms = new Map();
const newCode = () => {
  let c;
  do { c = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join(""); }
  while (rooms.has(c));
  return c;
};
const push = (r) => {
  const base = { code: r.code, game: r.game, tv: !!r.tv, host: hostIndex(r), players: r.players.map((p) => ({ name: p.name, connected: !!p.connected })) };
  const view = VIEWS[r.game];
  // Jeder bekommt nur seine eigene Hand zu sehen, der Fernseher (Index -1) gar keine.
  // „you“ ist der eigene Platz – der verschiebt sich, wenn jemand vor einem den Raum verlässt.
  const state = (i) => (view && r.state ? view(r.state, i) : r.state);
  r.players.forEach((p, i) => p.sid && io.to(p.sid).emit("room", { ...base, you: i, state: state(i) }));
  if (r.tv?.sid) io.to(r.tv.sid).emit("room", { ...base, you: -1, state: state(-1) });
};
// Nimmt den Socket eines Spielers aus dem Raum (beim Kicken: der Socket gehört zu einer anderen Verbindung)
const detach = (r, p) => {
  const s = p.sid && io.sockets.sockets.get(p.sid);
  if (s) { s.leave(r.code); s.data.reset?.(); }
  p.sid = null; p.connected = false;
};

io.on("connection", (socket) => {
  let room = null, me = null;
  socket.data.reset = () => { room = null; me = null; };
  // Der Fernseher schaut nur zu: Spielzüge von ihm werden verworfen (Lobby-Befehle darf er als Host schicken)
  socket.use((packet, next) => {
    if (me && room && me === room.tv && !["create", "join", "start", "lobby", "game", "kick", "leave"].includes(packet[0])) {
      const ack = packet[packet.length - 1];
      if (typeof ack === "function") ack({ error: "Der Fernseher spielt nicht mit." });
      return;
    }
    next();
  });

  function join(r, name, token, ack) {
    // Der Fernseher meldet sich mit seinem Token wieder an
    if (token && r.tv?.token === token) {
      r.tv.connected = true; r.tv.sid = socket.id;
      room = r; me = r.tv; socket.join(r.code);
      ack({ code: r.code, token, index: -1, tv: true });
      return push(r);
    }
    if (token && r.kicked?.has(token)) return ack({ error: "Der Host hat dich aus dem Raum entfernt.", kicked: true });
    let p = token && r.players.find((x) => x.token === token);
    if (!p) {
      if (r.state) return ack({ error: "Das Spiel läuft schon." });
      if (r.players.length >= MAX_PLAYERS[r.game]) return ack({ error: "Der Raum ist voll." });
      p = { token: randomBytes(8).toString("hex"), name: (name || "").trim().slice(0, 16) || `Spieler ${r.players.length + 1}` };
      r.players.push(p);
    }
    p.connected = true; p.sid = socket.id; p.left = false;
    room = r; me = p; socket.join(r.code);
    ack({ code: r.code, token: p.token, index: r.players.indexOf(p) });
    push(r);
  }

  socket.on("create", ({ name, game, tv }, ack) => {
    const r = { code: newCode(), game: GAMES.includes(game) ? game : "ludo", players: [], state: null, tv: null };
    rooms.set(r.code, r);
    if (!tv) return join(r, name, null, ack);
    // Fernseher-Modus: Wer den Raum erstellt, spielt nicht mit, sondern zeigt den Tisch
    if (NO_TV.includes(r.game)) r.game = GAMES.find((g) => !NO_TV.includes(g));
    r.tv = { token: randomBytes(8).toString("hex"), sid: socket.id, connected: true };
    room = r; me = r.tv; socket.join(r.code);
    ack({ code: r.code, token: r.tv.token, index: -1, tv: true });
    push(r);
  });
  socket.on("join", ({ code, name, token }, ack) => {
    const r = rooms.get(String(code || "").toUpperCase());
    if (!r) return ack({ error: "Raum nicht gefunden." });
    join(r, name, token, ack);
  });
  socket.on("start", (opts) => {
    if (!room || !isHost(room, me) || room.players.length < 2) return;
    if (opts && typeof opts === "object") room.opts = { scoring: !!opts.scoring, noEven: opts.noEven !== false, memory: !!opts.memory,
      difficulty: ["leicht", "mittel", "schwer"].includes(opts.difficulty) ? opts.difficulty : "mittel" }; // beim "Nochmal spielen" bleibt die letzte Wahl
    const names = room.players.map((p) => p.name);
    room.state = room.game === "kniffel" ? createKniffel(names) : room.game === "phase10" ? createPhase10(names, room.opts)
      : room.game === "schwimmen" ? createSchwimmen(names)
      : room.game === "zauberstich" ? createZauberstich(names, room.opts)
      : room.game === "sternbilder" ? createSternbilder(names, room.opts)
      : room.game === "sudoku" ? createSudoku(names, room.opts, Date.now())
      : room.game === "maumau" ? createMauMau(names)
      : room.game === "durak" ? createDurak(names) : createGame(names);
    push(room);
  });
  // Alle zurück in die Lobby desselben Raums, dort wählt der Host das nächste Spiel.
  // Geht nach Spielende und auch mittendrin – dann bricht der Host die laufende Partie für alle ab.
  socket.on("lobby", () => {
    if (!room || !isHost(room, me)) return;
    // Wer die Partie über „Verlassen“ aufgegeben hat, ist in der Lobby nicht mehr dabei
    room.state = null; room.players = room.players.filter((p) => !p.left); push(room);
  });
  // Der Host wirft in der Lobby jemanden raus, z. B. wen, der gegangen ist und nicht wiederkommt
  socket.on("kick", (i) => {
    const r = room, p = Number.isInteger(i) && r?.players[i];
    if (!p || !isHost(r, me) || r.state || p === me) return;
    (r.kicked ||= new Set()).add(p.token); // sein Handy soll sich nicht von selbst wieder anmelden
    if (p.sid) io.to(p.sid).emit("kicked");
    detach(r, p);
    r.players.splice(i, 1);
    push(r); reap(r);
  });
  // Bewusst gegangen (Zurück / Verlassen): In der Lobby ist man sofort raus, in einer laufenden Partie beim nächsten „Zurück zur Lobby“
  socket.on("leave", () => {
    const r = room, p = me;
    if (!r || !p) return;
    detach(r, p);
    if (p !== r.tv) {
      if (r.state) p.left = true;
      else r.players.splice(r.players.indexOf(p), 1);
    }
    push(r); reap(r);
  });
  socket.on("game", (game) => {
    if (!room || !isHost(room, me) || room.state || !GAMES.includes(game) || room.players.length > MAX_PLAYERS[game]) return;
    if (room.tv && NO_TV.includes(game)) return;
    room.game = game; room.opts = undefined; push(room);
  });
  socket.on("roll", () => {
    const r = room, s = r?.state;
    if (!s || r.players[s.cur] !== me || s.phase !== "roll" || s.winner !== null) return;
    r.state = roll(s);
    push(r);
    if (r.state.phase === "wait") {
      const st = r.state;
      setTimeout(() => { if (r.state === st) { r.state = afterWait(st); push(r); } }, 1800);
    }
  });
  socket.on("move", (k) => {
    const r = room, s = r?.state;
    if (!s || r.players[s.cur] !== me || s.phase !== "move" || !movable(s, s.cur, k)) return;
    r.state = move(s, k);
    push(r);
  });
  // --- Kniffel ---
  const kTurn = () => (room?.game === "kniffel" && room.state && !room.state.over && room.players[room.state.cur] === me ? room.state : null);
  socket.on("k:roll", () => {
    const s = kTurn();
    if (!s || s.rolls === 0) return;
    room.state = kRoll(s); push(room);
  });
  socket.on("k:hold", (i) => {
    const s = kTurn();
    const n = s && Number.isInteger(i) && i >= 0 && i < 5 ? kHold(s, i) : null;
    if (n) { room.state = n; push(room); }
  });
  socket.on("k:pick", (cat) => {
    const s = kTurn();
    const n = s ? kPick(s, String(cat)) : null;
    if (n) { room.state = n; push(room); }
  });
  socket.on("p:act", (a, ack) => {
    const r = room;
    if (r?.game !== "phase10" || !r.state || !a) return ack?.({ error: "Kein Phase-10-Spiel." });
    const res = p10act(r.state, r.players.indexOf(me), a);
    if (res.error) return ack?.({ error: res.error });
    r.state = res.state; push(r); ack?.({});
  });
  socket.on("s:act", (a, ack) => {
    const r = room;
    if (r?.game !== "schwimmen" || !r.state || !a) return ack?.({ error: "Kein Schwimmen-Spiel." });
    const res = swAct(r.state, r.players.indexOf(me), a);
    if (res.error) return ack?.({ error: res.error });
    r.state = res.state; push(r); ack?.({});
  });
  socket.on("w:act", (a, ack) => {
    const r = room;
    if (r?.game !== "zauberstich" || !r.state || !a) return ack?.({ error: "Kein Zauberstich-Spiel." });
    const res = srAct(r.state, r.players.indexOf(me), a);
    if (res.error) return ack?.({ error: res.error });
    r.state = res.state; push(r); ack?.({});
    // Voller Stich bleibt kurz liegen, damit alle ihn sehen
    if (r.state.stage === "show") {
      const st = r.state;
      setTimeout(() => { if (r.state === st) { r.state = srCollect(st); push(r); } }, 1800);
    }
  });
  socket.on("sb:act", (a, ack) => {
    const r = room;
    if (r?.game !== "sternbilder" || !r.state || !a) return ack?.({ error: "Kein Sternbilder-Spiel." });
    const res = sbAct(r.state, r.players.indexOf(me), a);
    if (res.error) return ack?.({ error: res.error });
    r.state = res.state; push(r); ack?.({});
  });
  // Sudoku Battle: alle spielen gleichzeitig, die Zeit misst der Server
  socket.on("su:act", (a, ack) => {
    const r = room;
    if (r?.game !== "sudoku" || !r.state || !a) return ack?.({ error: "Kein Sudoku-Spiel." });
    const res = suAct(r.state, r.players.indexOf(me), a, Date.now());
    if (res.error) return ack?.({ error: res.error });
    r.state = res.state; push(r); ack?.({ wrong: !!res.wrong });
  });
  socket.on("mm:act", (a, ack) => {
    const r = room;
    if (r?.game !== "maumau" || !r.state || !a) return ack?.({ error: "Kein Mau-Mau-Spiel." });
    const res = mmAct(r.state, r.players.indexOf(me), a);
    if (res.error) return ack?.({ error: res.error });
    r.state = res.state; push(r); ack?.({});
  });
  socket.on("dk:act", (a, ack) => {
    const r = room;
    if (r?.game !== "durak" || !r.state || !a) return ack?.({ error: "Kein Durak-Spiel." });
    const res = dkAct(r.state, r.players.indexOf(me), a);
    if (res.error) return ack?.({ error: res.error });
    r.state = res.state; push(r); ack?.({});
  });
  socket.on("disconnect", () => {
    const r = room;
    if (!r || !me || me.sid !== socket.id) return;
    me.connected = false;
    push(r); reap(r);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`Server läuft auf http://localhost:${PORT}`));
