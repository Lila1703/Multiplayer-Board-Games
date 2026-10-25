// Spielzustand für Online-Kniffel – wird vom Server UND vom Browser benutzt.
import { CATS, score } from "../games/kniffel/scoring.js";

const rnd = () => 1 + Math.floor(Math.random() * 6);
const NO = () => [false, false, false, false, false];

export const createKniffel = (names) => ({
  names, scores: names.map(() => ({})), cur: 0, dice: [1, 1, 1, 1, 1],
  held: NO(), rolledMask: NO(), rolls: 3, rolled: false, rollId: 0, over: false,
});

export const kRoll = (s) => ({
  ...s, dice: s.dice.map((v, i) => (s.held[i] ? v : rnd())),
  rolledMask: s.held.map((h) => !h), rolls: s.rolls - 1, rolled: true, rollId: s.rollId + 1,
});

export const kHold = (s, i) =>
  !s.rolled || s.rolls === 0 ? null : { ...s, held: s.held.map((h, k) => (k === i ? !h : h)) };

export function kPick(s, cat) {
  if (!s.rolled || !CATS.some((c) => c.id === cat) || cat in s.scores[s.cur]) return null;
  const scores = s.scores.map((p, i) => (i === s.cur ? { ...p, [cat]: score(cat, s.dice) } : p));
  const over = scores.every((p) => Object.keys(p).length === CATS.length);
  return { ...s, scores, over, cur: over ? s.cur : (s.cur + 1) % s.names.length,
    held: NO(), rolledMask: NO(), rolls: 3, rolled: false };
}
