import React, { useEffect, useMemo, useState } from "react";

const GRID = 8;
const DEFAULT_DAYS = 10;
const SEARCHES_PER_DAY = 6;
const DEFAULT_DETECTION_MODE = "medium";
const DEFAULT_HIDING_MODE = "medium";
const MAX_CHOCOLATE_DAYS = 14;

const DETECTION_SETTINGS = {
  easy: {
    label: "Easy to spot eggs",
    interceptShift: 1.1,
  },
  medium: {
    label: "Medium detection",
    interceptShift: 0,
  },
  hard: {
    label: "Hard to spot eggs",
    interceptShift: -1.1,
  },
};

const HIDING_SETTINGS = {
  low: {
    label: "Few hidden eggs",
    interceptShift: -0.7,
  },
  medium: {
    label: "Moderate hidden eggs",
    interceptShift: 0,
  },
  high: {
    label: "Many hidden eggs",
    interceptShift: 0.7,
  },
};

function logistic(x) {
  return 1 / (1 + Math.exp(-x));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function baseHabitat(x, y) {
  const trees =
    ((x >= 1 && x <= 2 && y >= 1 && y <= 3) ||
      (x >= 5 && x <= 6 && y >= 4 && y <= 6))
      ? 1
      : 0;

  const flowers =
    ((x >= 4 && x <= 6 && y >= 1 && y <= 2) ||
      (x >= 1 && x <= 2 && y >= 5 && y <= 6))
      ? 1
      : 0;

  const pond = (x === 3 || x === 4) && y >= 5 ? 1 : 0;
  const path = y === 0 || x === 7 ? 1 : 0;
  const lawn = trees || flowers || pond || path ? 0 : 1;

  return { trees, flowers, pond, path, lawn };
}

function computeHideChance(cell, hidingMode) {
  const hidingShift = HIDING_SETTINGS[hidingMode]?.interceptShift ?? 0;
  return logistic(
    -1.2 +
      hidingShift +
      0.95 * cell.flowers +
      0.35 * cell.lawn -
      1.0 * cell.pond -
      0.35 * cell.path +
      0.2 * cell.trees
  );
}

function computeDetectChance(cell, detectionMode) {
  const detectionShift =
    DETECTION_SETTINGS[detectionMode]?.interceptShift ?? 0;

  return logistic(
    -1.35 +
      detectionShift +
      1.0 * cell.flowers +
      0.15 * cell.lawn -
      1.0 * cell.trees -
      0.9 * cell.pond +
      0.2 * cell.path
  );
}

function makeGarden(days, detectionMode, hidingMode) {
  const cells = [];

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const habitat = baseHabitat(x, y);
      const cell = {
        id: `${x}-${y}`,
        x,
        y,
        ...habitat,
      };

      const hideChance = computeHideChance(cell, hidingMode);
      const detectChance = computeDetectChance(cell, detectionMode);
      const hasEgg = Math.random() < hideChance;

      cells.push({
        ...cell,
        hideChance,
        detectChance,
        hasEgg,
        history: Array(days).fill(null),
      });
    }
  }

  return cells;
}

function resizeHistory(cells, newDays) {
  return cells.map((cell) => {
    const oldHistory = cell.history || [];
    const resized =
      newDays >= oldHistory.length
        ? [...oldHistory, ...Array(newDays - oldHistory.length).fill(null)]
        : oldHistory.slice(0, newDays);

    return {
      ...cell,
      history: resized,
    };
  });
}

function updateDetectionOnly(cells, detectionMode) {
  return cells.map((cell) => ({
    ...cell,
    detectChance: computeDetectChance(cell, detectionMode),
  }));
}

function regenerateEggsKeepLayout(cells, days, detectionMode, hidingMode) {
  return cells.map((cell) => {
    const hideChance = computeHideChance(cell, hidingMode);
    const detectChance = computeDetectChance(cell, detectionMode);
    const hasEgg = Math.random() < hideChance;

    return {
      ...cell,
      hideChance,
      detectChance,
      hasEgg,
      history: Array(days).fill(null),
    };
  });
}

function habitatName(cell) {
  if (cell.trees) return "Trees";
  if (cell.flowers) return "Flowers";
  if (cell.pond) return "Pond edge";
  if (cell.path) return "Path";
  return "Lawn";
}

function buttonStyle(active = false, isMobile = false) {
  return {
    padding: isMobile ? "8px 10px" : "9px 13px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    background: active ? "#a855f7" : "#334155",
    color: "white",
    cursor: "pointer",
    fontSize: isMobile ? 14 : 16,
    minHeight: 40,
  };
}

function barStyle(value, color) {
  return {
    width: `${Math.max(2, value * 100)}%`,
    height: 16,
    borderRadius: 999,
    background: color,
    transition: "width 250ms ease",
  };
}

function chocolateBarStyle(value) {
  return {
    width: `${Math.max(2, value * 100)}%`,
    height: 18,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, #7c2d12 0%, #92400e 35%, #b45309 70%, #f59e0b 100%)",
    transition: "width 250ms ease",
  };
}

export default function App() {
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [detectionMode, setDetectionMode] = useState(DEFAULT_DETECTION_MODE);
  const [hidingMode, setHidingMode] = useState(DEFAULT_HIDING_MODE);
  const [cells, setCells] = useState(() =>
    makeGarden(DEFAULT_DAYS, DEFAULT_DETECTION_MODE, DEFAULT_HIDING_MODE)
  );
  const [dayIndex, setDayIndex] = useState(0);
  const [searchesLeft, setSearchesLeft] = useState(SEARCHES_PER_DAY);
  const [viewMode, setViewMode] = useState("search");
  const [message, setMessage] = useState(
    "Click a garden patch to scan a 3×3 area for Easter eggs. Eggs can be hidden but still go undetected."
  );
  const [showIntro, setShowIntro] = useState(true);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 900;
  const isVerySmall = windowWidth < 520;
  const cellHeight = isVerySmall ? 38 : isMobile ? 50 : 68;
  const cellFontSize = isVerySmall ? 16 : isMobile ? 20 : 24;
  const gridGap = isVerySmall ? 4 : 6;

  function startFreshGame(nextCells, nextDays, nextDetectionMode, nextHidingMode, nextMessage) {
    setCells(nextCells);
    setDays(nextDays);
    setDetectionMode(nextDetectionMode);
    setHidingMode(nextHidingMode);
    setDayIndex(0);
    setSearchesLeft(SEARCHES_PER_DAY);
    setViewMode("search");
    setMessage(nextMessage);
  }

  function handleDaysChange(nextDaysRaw) {
    const safeDays = clamp(Number(nextDaysRaw) || 1, 1, 14);
    const resizedCells = resizeHistory(cells, safeDays);
    const newDayIndex = Math.min(dayIndex, safeDays - 1);

    setCells(resizedCells);
    setDays(safeDays);
    setDayIndex(newDayIndex);
    setSearchesLeft(SEARCHES_PER_DAY);
    setViewMode("search");
    setMessage(
      "Search days updated. The garden stayed the same, so the true egg-hiding rate did not change."
    );
  }

  function handleDetectionChange(nextDetectionMode) {
    const updatedCells = updateDetectionOnly(cells, nextDetectionMode);
    startFreshGame(
      updatedCells.map((cell) => ({
        ...cell,
        history: Array(days).fill(null),
      })),
      days,
      nextDetectionMode,
      hidingMode,
      "Detection setting updated. Eggs stayed in the same places, but they may now be easier or harder to spot."
    );
  }

  function handleHidingChange(nextHidingMode) {
    const newCells = regenerateEggsKeepLayout(
      cells,
      days,
      detectionMode,
      nextHidingMode
    );

    startFreshGame(
      newCells,
      days,
      detectionMode,
      nextHidingMode,
      "Egg hiding level updated. A new garden was generated with a new fixed egg-hiding rate."
    );
  }

  function resetGame() {
    const newCells = makeGarden(days, detectionMode, hidingMode);
    startFreshGame(
      newCells,
      days,
      detectionMode,
      hidingMode,
      "New garden generated. Try different egg-hiding levels, detection settings, and search days to see how your estimate changes."
    );
  }

  const trueEggRate = useMemo(() => {
    return cells.filter((c) => c.hasEgg).length / cells.length;
  }, [cells]);

  const meanDetectChance = useMemo(() => {
    return cells.reduce((sum, c) => sum + c.detectChance, 0) / cells.length;
  }, [cells]);

  const naiveByDay = useMemo(() => {
    const rows = [];
    for (let k = 1; k <= days; k++) {
      const detectedByK = cells.filter((c) =>
        c.history.slice(0, k).some((v) => v === 1)
      ).length;

      rows.push({
        days: k,
        naive: detectedByK / cells.length,
      });
    }
    return rows;
  }, [cells, days]);

  const foundEggs = useMemo(() => {
    return cells.filter((c) => c.history.some((v) => v === 1)).length;
  }, [cells]);

  const missedEggCount = useMemo(() => {
    return cells.filter(
      (c) => c.hasEgg && !c.history.some((v) => v === 1)
    ).length;
  }, [cells]);

  const daysUsed = viewMode === "truth" ? days : dayIndex + 1;

  const currentNaiveEstimate = useMemo(() => {
    const index = viewMode === "truth" ? days - 1 : dayIndex - 1;
    if (index < 0 || !naiveByDay[index]) return 0;
    return naiveByDay[index].naive;
  }, [naiveByDay, dayIndex, days, viewMode]);

  const chocolateLeft = useMemo(() => {
    const used = clamp(daysUsed / MAX_CHOCOLATE_DAYS, 0, 1);
    return 1 - used;
  }, [daysUsed]);

  function searchArea(cellId) {
    if (searchesLeft <= 0) {
      setMessage("No scans left today. Click Next day.");
      return;
    }

    const [cx, cy] = cellId.split("-").map(Number);
    const targetIds = new Set(
      cells
        .filter((c) => Math.abs(c.x - cx) <= 1 && Math.abs(c.y - cy) <= 1)
        .map((c) => c.id)
    );

    let foundNow = 0;
    let missedNow = 0;
    let emptyNow = 0;
    let alreadyToday = 0;

    setCells((prev) =>
      prev.map((c) => {
        if (!targetIds.has(c.id)) return c;

        if (c.history[dayIndex] !== null) {
          alreadyToday += 1;
          return c;
        }

        const detected = c.hasEgg && Math.random() < c.detectChance;
        const h = [...c.history];
        h[dayIndex] = detected ? 1 : 0;

        if (detected) foundNow += 1;
        else if (c.hasEgg) missedNow += 1;
        else emptyNow += 1;

        return { ...c, history: h };
      })
    );

    const nextSearchesLeft = searchesLeft - 1;
    setSearchesLeft(nextSearchesLeft);

    const areaLabel = `around row ${cy + 1}, col ${cx + 1}`;

    if (foundNow > 0) {
      setMessage(
        `Scan ${areaLabel}: found ${foundNow} egg${foundNow > 1 ? "s" : ""}. Missed ${missedNow} hidden egg patch${missedNow === 1 ? "" : "es"}.`
      );
      return;
    }

    if (missedNow > 0) {
      setMessage(
        `Scan ${areaLabel}: no eggs found, but you likely missed ${missedNow} hidden egg patch${missedNow === 1 ? "" : "es"} because detection was imperfect.`
      );
      return;
    }

    if (alreadyToday > 0 && emptyNow === 0) {
      setMessage("You already scanned most of that area today. Each cell can only be surveyed once per day, so try another part of the garden or click Next day.");
      return;
    }

    if (nextSearchesLeft === 0) {
      setMessage(`Scan ${areaLabel}: no eggs found there this time. You have used all scans for today.`);
      return;
    }

    setMessage(`Scan ${areaLabel}: no eggs found there this time.`);
  }

  function nextDay() {
    if (dayIndex >= days - 1) {
      setViewMode("truth");
      const finalNaive = naiveByDay[days - 1]?.naive ?? 0;
      const finalFoundEggs = cells.filter((c) =>
        c.history.some((v) => v === 1)
      ).length;
      const finalChocolateLeft = 1 - clamp(days / MAX_CHOCOLATE_DAYS, 0, 1);

      setMessage(
        `Game over. You found ${finalFoundEggs} egg${finalFoundEggs === 1 ? "" : "s"}. True egg-hiding rate was ${(trueEggRate * 100).toFixed(
          0
        )}%, but your estimate based on eggs found after ${days} days was ${(finalNaive * 100).toFixed(
          0
        )}%. You missed ${missedEggCount} hidden egg cell${missedEggCount === 1 ? "" : "s"}, and only ${(finalChocolateLeft * 100).toFixed(
          0
        )}% of your Easter chocolate time was left.`
      );
      return;
    }

    setDayIndex((d) => d + 1);
    setSearchesLeft(SEARCHES_PER_DAY);
    setMessage(
      `Day ${dayIndex + 2}: search again. Eggs do not move, but repeat search days can reveal eggs you missed earlier. More search days improve estimates, but leave less time for Easter chocolate.`
    );
  }

  function cellStyle(cell) {
    const searchedToday = cell.history[dayIndex] !== null;
    const searchedEver = cell.history.some((v) => v !== null);
    const detectedEver = cell.history.some((v) => v === 1);

    let bg = "#14532d";
    let border = "1px solid rgba(255,255,255,0.14)";
    let color = detectedEver ? "black" : "white";

    if (cell.path) bg = "#6b4f1d";
    if (cell.trees) bg = "#166534";
    if (cell.flowers) bg = "#c026d3";
    if (cell.pond) bg = "#0f766e";
    if (cell.lawn) bg = "#15803d";

    if (viewMode === "search") {
      if (searchedEver) bg = "#0f766e";
      if (searchedToday) bg = "#14b8a6";
      if (detectedEver) bg = "#fde047";
    }

    if (viewMode === "truth") {
      if (cell.hasEgg && detectedEver) {
        bg = "#fde047";
        color = "black";
        border = "2px solid rgba(0,0,0,0.35)";
      } else if (cell.hasEgg && !detectedEver) {
        bg = "#ef4444";
        color = "white";
        border = "2px solid rgba(255,255,255,0.45)";
      } else {
        if (cell.path) bg = "#6b4f1d";
        else if (cell.trees) bg = "#166534";
        else if (cell.flowers) bg = "#c026d3";
        else if (cell.pond) bg = "#0f766e";
        else bg = "#15803d";
      }
    }

    return {
      height: cellHeight,
      background: bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      borderRadius: isVerySmall ? 6 : 8,
      border,
      fontSize: cellFontSize,
      cursor: "pointer",
      userSelect: "none",
      transition: "all 120ms ease",
      touchAction: "manipulation",
    };
  }

  return (
    <div
      style={{
        padding: isMobile ? 12 : 24,
        color: "white",
        background: "#0f172a",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {showIntro && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 999,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              maxHeight: "85vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 18,
              padding: isMobile ? 18 : 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
              boxSizing: "border-box",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 12,
                fontSize: isMobile ? 24 : 30,
                lineHeight: 1.15,
              }}
            >
              🐰 Welcome to the Easter Egg Garden Search
            </h2>

            <div
              style={{
                fontSize: isMobile ? 15 : 17,
                lineHeight: 1.5,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              <p style={{ marginTop: 0 }}>
                You are hunting for Easter eggs hidden across a garden. The catch:
                even when eggs are there, you will not always spot them.
              </p>
              <p>
                Your job is to decide how much searching is worth it. More search
                days usually improve your estimate of how many eggs are hidden, but
                each extra day leaves less time to enjoy your Easter chocolate.
              </p>

              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <strong>What you can explore</strong>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong>Search days:</strong> choose how many days you are willing to keep searching.
                </div>
                <div style={{ marginBottom: 4 }}>
                  <strong>Egg hiding level:</strong> change how many eggs are hidden in the garden. This makes a new garden.
                </div>
                <div>
                  <strong>Detection setting:</strong> change how easy or hard eggs are to spot once they are there, without moving the eggs.
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <strong>Important gameplay note</strong>
                </div>
                <div>
                  Each cell can only be surveyed once per day. If you click overlapping areas on the same day, any cells already checked will not be surveyed again until the next day.
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <strong>Legend</strong>
                </div>
                <div>🟨 Yellow = egg found</div>
                <div>🟥 Red = egg hidden but missed</div>
                <div>🟦 Turquoise = searched</div>
              </div>

              <p style={{ marginTop: 14, marginBottom: 0 }}>
                See whether more searching really pays off — or whether smarter
                modelling would be better than simply spending more effort.
              </p>
            </div>

            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setShowIntro(false)}
                style={{
                  ...buttonStyle(true, isMobile),
                  minWidth: 140,
                }}
              >
                Start hunting
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: isVerySmall ? 28 : isMobile ? 34 : 42,
            margin: "0 0 8px 0",
            lineHeight: 1.1,
          }}
        >
          🐰 Easter Egg Garden Search
        </h1>

        <p
          style={{
            maxWidth: 980,
            fontSize: isVerySmall ? 14 : isMobile ? 16 : 20,
            marginTop: 0,
            marginBottom: 18,
            lineHeight: 1.35,
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: isMobile ? 12 : 16,
            marginBottom: 18,
            alignItems: "end",
            fontSize: isMobile ? 14 : 18,
          }}
        >
          <div>
            <div style={{ marginBottom: 6 }}>Search days</div>
            <input
              type="number"
              min="1"
              max="14"
              value={days}
              onChange={(e) => handleDaysChange(e.target.value)}
              style={{
                padding: 8,
                borderRadius: 8,
                width: 80,
                fontSize: isMobile ? 14 : 16,
              }}
            />
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>Egg hiding level</div>
            <select
              value={hidingMode}
              onChange={(e) => handleHidingChange(e.target.value)}
              style={{
                padding: 8,
                borderRadius: 8,
                minWidth: isMobile ? 150 : 180,
                fontSize: isMobile ? 14 : 16,
              }}
            >
              {Object.entries(HIDING_SETTINGS).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>Detection setting</div>
            <select
              value={detectionMode}
              onChange={(e) => handleDetectionChange(e.target.value)}
              style={{
                padding: 8,
                borderRadius: 8,
                minWidth: isMobile ? 150 : 180,
                fontSize: isMobile ? 14 : 16,
              }}
            >
              {Object.entries(DETECTION_SETTINGS).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 6 }}>Display mode</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setViewMode("search")}
                style={buttonStyle(viewMode === "search", isMobile)}
              >
                Search
              </button>
              <button
                onClick={() => setViewMode("truth")}
                style={buttonStyle(viewMode === "truth", isMobile)}
              >
                Truth
              </button>
            </div>
          </div>

          <div style={{ paddingBottom: 8 }}>
            <strong>Day:</strong> {dayIndex + 1} / {days}
          </div>

          <div style={{ paddingBottom: 8 }}>
            <strong>Scans left:</strong> {searchesLeft}
          </div>

          <div style={{ paddingBottom: 8 }}>
            <strong>Eggs found:</strong> {foundEggs}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : "minmax(520px, 760px) minmax(280px, 360px)",
            gap: isMobile ? 20 : 28,
            alignItems: "start",
          }}
        >
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${GRID}, 1fr)`,
                gap: gridGap,
                width: "100%",
                maxWidth: isMobile ? "100%" : 760,
                marginBottom: 14,
              }}
            >
              {cells.map((cell) => {
                const detectedEver = cell.history.some((v) => v === 1);
                const missedEver =
                  cell.hasEgg && !detectedEver && viewMode === "truth";

                const icon =
                  detectedEver ? "🥚" :
                  missedEver ? "❌" :
                  cell.trees ? "🌳" :
                  cell.flowers ? "🌼" :
                  cell.pond ? "💧" :
                  cell.path ? "🪵" :
                  "";

                const detectLabel =
                  cell.detectChance < 0.25 ? "hard to detect" :
                  cell.detectChance < 0.5 ? "moderate detection" :
                  "easy to detect";

                return (
                  <div
                    key={cell.id}
                    style={cellStyle(cell)}
                    onClick={() => searchArea(cell.id)}
                    title={`${habitatName(cell)} | egg hiding chance=${cell.hideChance.toFixed(
                      2
                    )} | detection chance=${cell.detectChance.toFixed(
                      2
                    )} (${detectLabel})`}
                  >
                    {icon}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: isMobile ? 12 : 18,
              }}
            >
              <button onClick={nextDay} style={buttonStyle(false, isMobile)}>
                Next day
              </button>
              <button onClick={resetGame} style={buttonStyle(false, isMobile)}>
                New game
              </button>
              <button onClick={() => setShowIntro(true)} style={buttonStyle(false, isMobile)}>
                How to play
              </button>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              maxWidth: isMobile ? "100%" : 380,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: isMobile ? 22 : 24 }}>
              Garden summary
            </h3>

            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6, fontSize: isMobile ? 15 : 16 }}>
                True egg-hiding rate in the garden: {trueEggRate.toFixed(2)}
              </div>
              <div
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  padding: 3,
                  boxSizing: "border-box",
                }}
              >
                <div style={barStyle(trueEggRate, "#22c55e")} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6, fontSize: isMobile ? 15 : 16 }}>
                Estimate based on eggs found so far: {currentNaiveEstimate.toFixed(2)}
              </div>
              <div
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  padding: 3,
                  boxSizing: "border-box",
                }}
              >
                <div style={barStyle(currentNaiveEstimate, "#f97316")} />
              </div>
            </div>

            <div style={{ marginBottom: 16, fontSize: isMobile ? 15 : 16 }}>
              Mean detection chance used in the simulation: {meanDetectChance.toFixed(2)}
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ marginBottom: 6, fontSize: isMobile ? 15 : 16 }}>
                Easter chocolate time left: {(chocolateLeft * 100).toFixed(0)}%
              </div>
              <div
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  padding: 3,
                  boxSizing: "border-box",
                }}
              >
                <div style={chocolateBarStyle(chocolateLeft)} />
              </div>
              <div
                style={{
                  fontSize: isMobile ? 13 : 14,
                  marginTop: 6,
                  color: "rgba(255,255,255,0.78)",
                  lineHeight: 1.35,
                }}
              >
                More search days leave less time to enjoy your Easter chocolate.
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: isMobile ? 12 : 14,
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                color: "#f8fafc",
                fontSize: isMobile ? 14 : 15,
                lineHeight: 1.4,
              }}
            >
              <strong>Interpretation:</strong> the estimate based on eggs found is the proportion of cells where you have found at least one egg so far.
              When detection chance is below 1, this estimate is biased low. More search days improve the estimate, but
              they also leave less chocolate time.
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            maxWidth: 980,
            color: "rgba(255,255,255,0.85)",
            fontSize: isVerySmall ? 13 : isMobile ? 14 : 15,
            lineHeight: 1.45,
          }}
        >
          <p style={{ margin: "6px 0" }}>
            <strong>How to play:</strong> click any patch to scan the surrounding 3×3 area.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Egg hiding level:</strong> this changes how many eggs are hidden in the garden.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Detection setting:</strong> this changes how easy eggs are to find, but does not change where eggs are hidden.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Search rule:</strong> each cell can only be surveyed once per day, so overlapping scans on the same day do not re-check the same cell.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Search view:</strong> turquoise patches were scanned, yellow patches had eggs detected.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Truth view:</strong> yellow = egg hidden and found, red = egg hidden but missed.
          </p>
          <p style={{ margin: "6px 0" }}>
            <strong>Teaching point:</strong> repeated search days make the estimate move closer to the true egg-hiding rate, but they cost time.
          </p>
        </div>

        <div
          style={{
            marginTop: 30,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            textAlign: "center",
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          Created by Southern Clarity NZ
        </div>
      </div>
    </div>
  );
}
