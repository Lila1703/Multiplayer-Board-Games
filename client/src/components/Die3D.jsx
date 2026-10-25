import "./Die3D.css";

// Drehung (x, y), die jeden Wert nach vorne bringt
const FACE_ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export default function Die3D({ value, spins = 0, innerRef, size = 72 }) {
  const [x, y] = FACE_ROT[value];
  const n = spins * 360;
  return (
    <div ref={innerRef} className="d3" style={{ "--s": `${size}px` }} role="img" aria-label={`Würfel zeigt ${value}`}>
      <div className="d3-cube" style={{ transform: `rotateX(${x + n}deg) rotateY(${y + n}deg)` }}>
        {[1, 2, 3, 4, 5, 6].map((f) => (
          <div key={f} className={`d3-face d3-f${f}`}>
            {Array.from({ length: 9 }, (_, k) => (
              <span key={k} className={"d3-pip" + (PIPS[f].includes(k) ? " on" : "")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
