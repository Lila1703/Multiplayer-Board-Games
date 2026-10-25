export const CATS = [
  { id: "1", name: "Einser", up: true }, { id: "2", name: "Zweier", up: true },
  { id: "3", name: "Dreier", up: true }, { id: "4", name: "Vierer", up: true },
  { id: "5", name: "Fünfer", up: true }, { id: "6", name: "Sechser", up: true },
  { id: "tk", name: "Dreierpasch" }, { id: "vk", name: "Viererpasch" },
  { id: "fh", name: "Full House" }, { id: "ks", name: "Kleine Straße" },
  { id: "gs", name: "Große Straße" }, { id: "kn", name: "Kniffel" },
  { id: "ch", name: "Chance" },
];

export function score(cat, dice) {
  const cnt = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach((v) => cnt[v]++);
  const sum = dice.reduce((a, b) => a + b, 0);
  const max = Math.max(...cnt.slice(1));
  const has = (a) => a.every((v) => cnt[v] > 0);
  switch (cat) {
    case "tk": return max >= 3 ? sum : 0;
    case "vk": return max >= 4 ? sum : 0;
    case "fh": return cnt.includes(3) && cnt.includes(2) ? 25 : 0;
    case "ks": return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
    case "gs": return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
    case "kn": return max === 5 ? 50 : 0;
    case "ch": return sum;
    default: return cnt[+cat] * +cat;
  }
}

export const upperSum = (p) =>
  CATS.filter((c) => c.up).reduce((a, c) => a + (p.scores[c.id] || 0), 0);
export const bonus = (p) => (upperSum(p) >= 63 ? 35 : 0);
export const total = (p) =>
  Object.values(p.scores).reduce((a, b) => a + b, 0) + bonus(p);
