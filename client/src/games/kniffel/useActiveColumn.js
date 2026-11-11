import { useRef, useEffect } from "react";

// Bei vielen Spielern ist die Tabelle breiter als ihr Kasten. Dann wird die Spalte des Spielers am Zug in die Mitte
// des noch frei scrollenden Bereichs geschoben – nur seitlich, die Seite selbst bleibt, wo sie ist.
// Stehen bleiben links die Kategorie-Spalte und online die eigene Spalte (.own). Rückgabe: ref für den scrollenden Kasten (.scroll).
export function useActiveColumn(cur, count) {
  const ref = useRef(null);
  useEffect(() => {
    const box = ref.current, th = box?.querySelector("th.active");
    if (!th || box.scrollWidth <= box.clientWidth) return;
    const pinned = [...box.querySelectorAll("th:first-child, th.own")];
    const fixed = pinned.reduce((w, el) => w + el.offsetWidth, 0);
    const w = th.offsetWidth;
    const left = pinned.includes(th) ? 0 : th.offsetLeft - fixed - (box.clientWidth - fixed - w) / 2;
    // auf ganze Spalten runden (am Handy sind alle gleich breit), damit links keine halbe Spalte hervorschaut
    box.scrollTo({ left: Math.round(left / w) * w, behavior: "smooth" });
  }, [cur, count]);
  return ref;
}
