import React, { useEffect, useMemo, useState } from "react";

const BASE_AREA = 8;
const BIG_GRID = 16;
const DEFAULT_REPEATS = 3;
const STEPS_PER_AREA_VISIT = 32;

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function idFor(x, y) {
  return `${x}-${y}`;
}

function areaDefinitions() {
  return [
    { id: "TL", name: "Top-left", x0: 0, y0: 0 },
    { id: "TR", name: "Top-right", x0: BIG_GRID - BASE_AREA, y0: 0 },
    { id: "BL", name: "Bottom-left", x0: 0, y0: BIG_GRID - BASE_AREA },
    { id: "BR", name: "Bottom-right", x0: BIG_GRID - BASE_AREA, y0: BIG_GRID - BASE_AREA },
  ];
}

function inArea(x, y, area) {
  return x >= area.x0 && x < area.x0 + BASE_AREA && y >= area.y0 && y < area.y0 + BASE_AREA;
}

function findAreaForCell(x, y) {
  return areaDefinitions().find((a) => inArea(x, y, a)) || null;
}

function makeWorld(repeats) {
  const cells = [];

  for (let y = 0; y < BIG_GRID; y++) {
    for (let x = 0; x < BIG_GRID; x++) {
      const path = y === 0 || x === BIG_GRID - 1 ? 1 : 0;
      const shrub = ((x >= 2 && x <= 5 && y >= 3 && y <= 10) || (x >= 10 && y >= 9)) ? 1 : 0;
      const flower = ((x >= 8 && x <= 13 && y >= 1 && y <= 5) || (x <= 3 && y >= 10)) ? 1 : 0;
      const wet = ((x === 6 || x === 7 || x === 8 || x === 9) && y >= 10) ? 1 : 0;
      const edge = x === 0 || y === 0 || x === BIG_GRID - 1 || y === BIG_GRID - 1 ? 1 : 0;
      const insideSurveyCorner = !!findAreaForCell(x, y);

      const psi = logistic(
        -1.7 +
          0.35 * edge +
          1.0 * shrub +
          0.7 * flower -
          1.2 * wet -
          0.45 * path +
          0.2 * insideSurveyCorner
      );
      const occupied = Math.random() < psi;
      const p = logistic(-0.9 + 0.8 * flower + 0.35 * path - 0.75 * shrub - 0.85 * wet);

      cells.push({
        id: idFor(x, y),
        x,
        y,
        path,
        shrub,
        flower,
        wet,
        psi,
        occupied,
        p,
        history: Array(repeats).fill(null),
      });
    }
  }

  return cells;
}

function isSelectedAreaCell(cell, selectedAreaIds) {
  const area = findAreaForCell(cell.x, cell.y);
  return !!area && selectedAreaIds.includes(area.id);
}

function estimatePsi(cells, selectedAreaIds) {
  const out = {};
  const selectedCells = cells.filter((c) => isSelectedAreaCell(c, selectedAreaIds));
  const sampledEvents = selectedCells.reduce(
    (a, c) => a + c.history.filter((v) => v !== null).length,
    0
  );
  const detectedEvents = selectedCells.reduce(
    (a, c) => a + c.history.filter((v) => v === 1).length,
    0
  );
  const globalRate = sampledEvents ? detectedEvents / sampledEvents : 0.1;

  cells.forEach((c) => {
    const ownSampled = c.history.filter((v) => v !== null).length;
    const ownDet = c.history.filter((v) => v === 1).length;
    const bonus = ownDet > 0 ? 0.35 : 0;
    const penalty = ownSampled > 0 && ownDet === 0 ? ownSampled * 0.07 : 0;
    out[c.id] = clamp(globalRate * 1.6 + bonus - penalty, 0.03, 0.97);
  });

  return out;
}

function repeatEstimate(cells, selectedAreaIds) {
  const surveyed = cells.filter(
    (c) => isSelectedAreaCell(c, selectedAreaIds) && c.history.some((v) => v !== null)
  );
  if (!surveyed.length) return 0;

  const anyDet = surveyed.filter((c) => c.history.some((v) => v === 1)).length;
  const detEvents = surveyed.reduce((a, c) => a + c.history.filter((v) => v === 1).length, 0);
  const totalVisits = surveyed.reduce((a, c) => a + c.history.filter((v) => v !== null).length, 0);

  const naive = anyDet / surveyed.length;
  const pHat = totalVisits ? clamp(detEvents / totalVisits, 0.05, 0.99) : 0.25;
  return clamp(naive / pHat, 0, 1);
}

function getStartCell(selectedAreaIds) {
  const area = areaDefinitions().find((a) => selectedAreaIds.includes(a.id)) || areaDefinitions()[0];
  return { x: area.x0, y: area.y0 };
}

function buttonStyle(active) {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.2)",
    background: active ? "#a855f7" : "#334155",
    color: "white",
    cursor: "pointer",
  };
}

export default function App() {
  const [selectedAreaIds, setSelectedAreaIds] = useState(["TL"]);
  const [repeats, setRepeats] = useState(DEFAULT_REPEATS);
  const [cells, setCells] = useState(() => makeWorld(DEFAULT_REPEATS));
  const [player, setPlayer] = useState(() => getStartCell(["TL"]));
  const [visit, setVisit] = useState(0);
  const [steps, setSteps] = useState(STEPS_PER_AREA_VISIT);
  const [showModel, setShowModel] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [message, setMessage] = useState(
    "Choose 1–4 survey areas, set repeat surveys, and walk the bunny through each selected 8×8 survey block."
  );

  const est = useMemo(() => estimatePsi(cells, selectedAreaIds), [cells, selectedAreaIds]);
  const totalVisits = selectedAreaIds.length * repeats;
  const currentAreaIndex = Math.min(selectedAreaIds.length - 1, Math.floor(visit / repeats));
  const currentRepeatInArea = (visit % repeats) + 1;
  const activeAreaId = selectedAreaIds[currentAreaIndex] || selectedAreaIds[0];
  const activeArea =
    areaDefinitions().find((a) => a.id === activeAreaId) || areaDefinitions()[0];

  function rebuild(nextAreas = selectedAreaIds, nextRepeats = repeats) {
    const fresh = makeWorld(nextRepeats);
    const start = getStartCell(nextAreas);
    setCells(fresh);
    setPlayer(start);
    setVisit(0);
    setSteps(STEPS_PER_AREA_VISIT);
    setReveal(false);
    setShowModel(false);
    setMessage(
      "New landscape generated. Survey the active 8×8 block, then advance to the next repeat or next selected area."
    );
  }

  function toggleArea(id) {
    setSelectedAreaIds((prev) => {
      let next;
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        next = prev.filter((x) => x !== id);
      } else {
        if (prev.length >= 4) return prev;
        next = [...prev, id];
      }
      rebuild(next, repeats);
      return next;
    });
  }

  function updateRepeats(nextRepeats) {
    const safe = clamp(Number(nextRepeats) || 1, 1, 6);
    setRepeats(safe);
    rebuild(selectedAreaIds, safe);
  }

  function reset() {
    rebuild(selectedAreaIds, repeats);
  }

  function canEnterCell(x, y) {
    return inArea(x, y, activeArea);
  }

  function survey(x, y) {
    if (steps <= 0) {
      setMessage("No steps left for this area-visit. Click Next survey round.");
      return;
    }
    if (!canEnterCell(x, y)) {
      setMessage("You can only move inside the currently active 8×8 survey area.");
      return;
    }

    setPlayer({ x, y });

    setCells((prev) =>
      prev.map((c) => {
        if (c.x !== x || c.y !== y) return c;
        if (c.history[visit] !== null) return c;

        const detected = c.occupied && Math.random() < c.p;
        const h = [...c.history];
        h[visit] = detected ? 1 : 0;
        return { ...c, history: h };
      })
    );

    setSteps((s) => s - 1);
  }

  function move(dx, dy) {
    const nx = clamp(player.x + dx, activeArea.x0, activeArea.x0 + BASE_AREA - 1);
    const ny = clamp(player.y + dy, activeArea.y0, activeArea.y0 + BASE_AREA - 1);
    survey(nx, ny);
  }

  function nextSurveyRound() {
    if (visit >= totalVisits - 1) {
      setReveal(true);
      setMessage(
        "All selected area-surveys completed. Compare naive, repeat-adjusted, and true occupancy inside the selected areas."
      );
      return;
    }

    const nextVisit = visit + 1;
    const nextAreaIndex = Math.floor(nextVisit / repeats);
    const nextAreaId = selectedAreaIds[nextAreaIndex];
    const nextArea =
      areaDefinitions().find((a) => a.id === nextAreaId) || activeArea;

    setVisit(nextVisit);
    setPlayer({ x: nextArea.x0, y: nextArea.y0 });
    setSteps(STEPS_PER_AREA_VISIT);
    setMessage(`Moved to ${nextArea.name}, repeat ${(nextVisit % repeats) + 1} of ${repeats}.`);
  }

  useEffect(() => {
    function keyHandler(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === "ArrowUp") move(0, -1);
      if (e.key === "ArrowDown") move(0, 1);
      if (e.key === "ArrowLeft") move(-1, 0);
      if (e.key === "ArrowRight") move(1, 0);
      if (e.key.toLowerCase() === "m") setShowModel((v) => !v);
      if (e.key.toLowerCase() === "n") nextSurveyRound();
    }
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  });

  const selectedCells = cells.filter((c) => isSelectedAreaCell(c, selectedAreaIds));
  const sampled = selectedCells.filter((c) => c.history.some((v) => v !== null));
  const detected = selectedCells.filter((c) => c.history.some((v) => v === 1));
  const naive = sampled.length ? detected.length / sampled.length : 0;
  const rep = repeatEstimate(cells, selectedAreaIds);
  const trueOcc = selectedCells.filter((c) => c.occupied).length / Math.max(1, selectedCells.length);

  return (
    <div
      style={{
        padding: 20,
        color: "white",
        background: "#0f172a",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>🐰 Occupancy Arcade</h1>
      <p style={{ maxWidth: 900 }}>{message}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ marginBottom: 6 }}>Survey areas (1–4 corners)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {areaDefinitions().map((area) => (
              <button
                key={area.id}
                onClick={() => toggleArea(area.id)}
                style={buttonStyle(selectedAreaIds.includes(area.id))}
              >
                {area.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 6 }}>Repeat surveys per selected area</div>
          <input
            type="number"
            min="1"
            max="6"
            value={repeats}
            onChange={(e) => updateRepeats(e.target.value)}
            style={{ padding: 8, borderRadius: 8, width: 80 }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
        <span>Landscape: {BIG_GRID}×{BIG_GRID}</span>
        <span>Selected areas: {selectedAreaIds.length}</span>
        <span>Total survey rounds: {totalVisits}</span>
        <span>Active area: {activeArea.name}</span>
        <span>Repeat in area: {currentRepeatInArea}/{repeats}</span>
        <span>Steps left: {steps}</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${BIG_GRID}, 1fr)`,
          gap: 4,
          maxWidth: 1100,
        }}
      >
        {cells.map((c) => {
          const area = findAreaForCell(c.x, c.y);
          const inSelectedArea = isSelectedAreaCell(c, selectedAreaIds);
          const inActiveArea = activeArea && inArea(c.x, c.y, activeArea);
          let bg = inSelectedArea ? "#14532d" : "#1e293b";
          let outline = "1px solid rgba(255,255,255,0.06)";

          if (showModel && inSelectedArea) {
            const e = est[c.id];
            bg = e > 0.7 ? "#9333ea" : e > 0.4 ? "#2563eb" : "#334155";
          }
          if (c.history.some((v) => v === 1) && inSelectedArea) bg = "#fde047";
          if (reveal && c.occupied && inSelectedArea) bg = "#22c55e";
          if (area && selectedAreaIds.includes(area.id)) outline = "1px solid rgba(255,255,255,0.18)";
          if (inActiveArea) outline = "2px solid white";
          if (player.x === c.x && player.y === c.y) bg = "#ffffff";

          return (
            <div
              key={c.id}
              style={{
                height: 28,
                background: bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: player.x === c.x && player.y === c.y ? "black" : "white",
                borderRadius: 4,
                border: outline,
                fontSize: 14,
              }}
              title={`${c.x + 1}, ${c.y + 1}${area ? ` | ${area.name}` : " | outside survey areas"}`}
            >
              {player.x === c.x && player.y === c.y ? "🐰" : c.history.some((v) => v === 1) && inSelectedArea ? "🥚" : ""}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => move(0, -1)} style={buttonStyle(false)}>↑</button>
        <button onClick={() => move(0, 1)} style={buttonStyle(false)}>↓</button>
        <button onClick={() => move(-1, 0)} style={buttonStyle(false)}>←</button>
        <button onClick={() => move(1, 0)} style={buttonStyle(false)}>→</button>
        <button onClick={nextSurveyRound} style={buttonStyle(false)}>Next survey round</button>
        <button onClick={reset} style={buttonStyle(false)}>New game</button>
        <button onClick={() => setShowModel((v) => !v)} style={buttonStyle(showModel)}>Toggle model</button>
      </div>

      <div style={{ marginTop: 14 }}>
        <p>Naive occupancy in selected areas: {naive.toFixed(2)}</p>
        <p>Repeat-adjusted estimate: {rep.toFixed(2)}</p>
        <p>True occupancy in selected areas: {reveal ? trueOcc.toFixed(2) : "hidden"}</p>
      </div>
    </div>
  );
}
