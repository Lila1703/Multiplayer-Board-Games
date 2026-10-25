import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { Server } from "socket.io";
import { createGame, roll, afterWait, move, movable } from "../client/src/shared/ludo.js";
import { createKniffel, kRoll, kHold, kPick } from "../client/src/shared/kniffel.js";

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
const push = (r) => io.to(r.code).emit("room", {
  code: r.code, game: r.game, state: r.state, players: r.players.map((p) => ({ name: p.name, connected: p.connected })),
});

io.on("connection", (socket) => {
  let room = null, me = null;

  function join(r, name, token, ack) {
    let p = token && r.players.find((x) => x.token === token);
    if (!p) {
      if (r.state) return ack({ error: "Das Spiel läuft schon." });
      if (r.players.length >= 4) return ack({ error: "Der Raum ist voll." });
      p = { token: randomBytes(8).toString("hex"), name: (name || "").trim().slice(0, 16) || `Spieler ${r.players.length + 1}` };
      r.players.push(p);
    }
    p.connected = true; p.sid = socket.id;
    room = r; me = p; socket.join(r.code);
    ack({ code: r.code, token: p.token, index: r.players.indexOf(p) });
    push(r);
  }

  socket.on("create", ({ name, game }, ack) => {
    const r = { code: newCode(), game: game === "kniffel" ? "kniffel" : "ludo", players: [], state: null };
    rooms.set(r.code, r);
    join(r, name, null, ack);
  });
  socket.on("join", ({ code, name, token }, ack) => {
    const r = rooms.get(String(code || "").toUpperCase());
    if (!r) return ack({ error: "Raum nicht gefunden." });
    join(r, name, token, ack);
  });
  socket.on("start", () => {
    if (!room || room.players[0] !== me || room.players.length < 2) return;
    const names = room.players.map((p) => p.name);
    room.state = room.game === "kniffel" ? createKniffel(names) : createGame(names);
    push(room);
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
  socket.on("disconnect", () => {
    const r = room;
    if (!r || me.sid !== socket.id) return;
    me.connected = false;
    push(r);
    if (r.players.every((p) => !p.connected))
      setTimeout(() => { if (r.players.every((p) => !p.connected)) rooms.delete(r.code); }, 3600000);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`Server läuft auf http://localhost:${PORT}`));
