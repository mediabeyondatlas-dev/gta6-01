// Solmarina's map: an 8-by-8 road grid, blocks of buildings, a green park in
// the middle, a palm beach and docks along the south shore. The layout is
// generated from the seed, so the map is the same every run and screenshots
// always show the same streets.

import { WORLD, SHORE, GREEN, CENTER, PAINT } from './config.js';

function gridLines() {
  const lines = [];
  for (let i = 0; i < 8; i += 1) lines.push(200 + i * WORLD.spacing);
  return lines;
}

export function buildCity(dice) {
  const lines = gridLines();
  const buildings = [];
  const palms = [];
  const trees = [];

  for (let gx = 0; gx < 7; gx += 1) {
    for (let gy = 0; gy < 7; gy += 1) {
      const bx0 = lines[gx] + WORLD.width / 2 + WORLD.walk;
      const by0 = lines[gy] + WORLD.width / 2 + WORLD.walk;
      const bx1 = lines[gx + 1] - WORLD.width / 2 - WORLD.walk;
      const by1 = lines[gy + 1] - WORLD.width / 2 - WORLD.walk;
      const bw = bx1 - bx0;
      const bh = by1 - by0;

      // The park block stays green: trees only, no buildings.
      if (bx0 >= GREEN.x && by0 >= GREEN.y && bx1 <= GREEN.x + GREEN.w && by1 <= GREEN.y + GREEN.h) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: bx0 + dice.between(20, bw - 20), y: by0 + dice.between(20, bh - 20), r: dice.between(10, 18) });
        }
        continue;
      }
      // The beach strip gets palms instead of buildings.
      if (by0 > SHORE.sand - 260) {
        for (let t = 0; t < 5; t += 1) {
          palms.push({ x: bx0 + dice.between(20, bw - 20), y: by0 + dice.between(20, bh - 20) });
        }
        continue;
      }
      const downtown = bx0 >= CENTER.x - 200 && by0 >= CENTER.y - 200
        && bx1 <= CENTER.x + CENTER.w + 200 && by1 <= CENTER.y + CENTER.h + 200;
      const amount = downtown ? dice.whole(2, 3) : dice.whole(1, 3);
      for (let b = 0; b < amount; b += 1) {
        const w = dice.between(bw * 0.3, bw * 0.52);
        const h = dice.between(bh * 0.3, bh * 0.52);
        buildings.push({
          x: bx0 + dice.between(8, Math.max(9, bw - w - 8)),
          y: by0 + dice.between(8, Math.max(9, bh - h - 8)),
          w,
          h,
          color: dice.from(PAINT.roofs),
          floors: downtown ? dice.whole(2, 4) : dice.whole(1, 2),
          panes: dice.whole(2, 5),
        });
      }
      for (let t = 0; t < dice.whole(1, 3); t += 1) {
        trees.push({ x: bx0 + dice.between(16, bw - 16), y: by0 + dice.between(16, bh - 16), r: dice.between(9, 15) });
      }
    }
  }

  // A row of palms along the beachfront.
  for (let x = 120; x < WORLD.extent - 120; x += 130) {
    palms.push({ x: x + dice.between(-20, 20), y: SHORE.sand + dice.between(14, 60) });
  }

  return { lines, buildings, palms, trees };
}

export function isOnRoad(city, x, y) {
  const half = WORLD.width / 2;
  for (const line of city.lines) {
    if (Math.abs(x - line) <= half || Math.abs(y - line) <= half) return true;
  }
  return false;
}

export function isWater(x, y) {
  return y >= SHORE.sea;
}

export function buildingAt(city, x, y, pad) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

/** The closest point on a road centreline, for traffic that lost its way. */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const line of city.lines) {
    const tries = [{ x: line, y }, { x, y: line }];
    for (const c of tries) {
      const d = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
  }
  return best;
}

/** Fixed story places: safehouse, docks, motel, bank, yacht, hospital. */
export function landmarks() {
  return {
    safehouse: { x: 600, y: 2600, label: 'Safehouse' },
    docks: { x: 2900, y: 2600, label: 'Docks' },
    motel: { x: 1000, y: 1000, label: 'Motel' },
    bank: { x: 1600, y: 1000, label: 'Solmarina Bank' },
    yacht: { x: 2600, y: 2980, label: 'Yacht' },
    hospital: { x: 600, y: 600, label: 'Hospital' },
  };
}
