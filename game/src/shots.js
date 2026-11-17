// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed time, steered by an
// autopilot that follows the road grid (shortest route over intersections),
// so the frame is what a short game really looks like — and the same seed
// always gives the same frame.

import { COP_CAR } from './config.js';
import { makeCar, stepWorld } from './entities.js';
import { landmarks } from './city.js';
import { MISSIONS, updateMissions } from './missions.js';

const TICK = 1 / 30;

/** Shortest route over intersections (road line x road line), breadth-first. */
function findRoute(lines, fromX, fromY, toX, toY) {
  function closestLine(v) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < lines.length; i += 1) {
      const d = Math.abs(lines[i] - v);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
  const start = [closestLine(fromX), closestLine(fromY)];
  const goal = [closestLine(toX), closestLine(toY)];
  const key = (ix, iy) => ix + ',' + iy;
  const cameFrom = new Map();
  const queue = [start];
  cameFrom.set(key(start[0], start[1]), null);
  while (queue.length > 0) {
    const [ix, iy] = queue.shift();
    if (ix === goal[0] && iy === goal[1]) break;
    const neighbours = [[ix + 1, iy], [ix - 1, iy], [ix, iy + 1], [ix, iy - 1]];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= lines.length || ny >= lines.length) continue;
      if (cameFrom.has(key(nx, ny))) continue;
      cameFrom.set(key(nx, ny), [ix, iy]);
      queue.push([nx, ny]);
    }
  }
  const path = [];
  let node = goal;
  while (node) {
    path.unshift([lines[node[0]], lines[node[1]]]);
    node = cameFrom.get(key(node[0], node[1]));
  }
  path.push([toX, toY]);
  return path;
}

/** Fake input the autopilot steers with: gas and steering from a route. */
function makeDriver(world, car, route) {
  let mark = 0;
  function headingError() {
    const point = route[Math.min(mark, route.length - 1)];
    const dx = point[0] - car.x;
    const dy = point[1] - car.y;
    // Grab the waypoint early: the turning circle is about 150 px, so the
    // car must start its turn before the intersection, not inside it.
    if (Math.hypot(dx, dy) < 150 && mark < route.length - 1) mark += 1;
    // At the destination, stop chasing the point and just cruise on.
    if (mark >= route.length - 1 && Math.hypot(dx, dy) < 120) return 0;
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }
  return {
    mouse: { x: 0, y: 0, down: false, clicked: false },
    held() {
      return false;
    },
    axis(neg, pos) {
      if (pos === 'KeyW') {
        // Ease off for corners, reverse out when the target sits behind us.
        const err = Math.abs(headingError());
        if (err > 2.4) return -0.5;
        if (err > 0.9) return 0.3;
        if (err > 0.45) return 0.6;
        return 1;
      }
      if (pos === 'KeyD') {
        return Math.max(-1, Math.min(1, headingError() * 2.2));
      }
      return 0;
    },
    wasPressed() {
      return false;
    },
    endFrame() {},
  };
}

function seatPlayer(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const car of world.cars) {
    if (car.wreck || car.driver !== 'traffic') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (best) {
    best.driver = 'player';
    p.inCar = best.id;
    p.x = best.x;
    p.y = best.y;
    world.camera.x = best.x;
    world.camera.y = best.y;
  }
  return best;
}

function runFor(world, input, seconds, audio) {
  for (let i = 0; i < seconds / TICK; i += 1) {
    stepWorld(world, input, TICK, audio);
    updateMissions(world, TICK, audio);
  }
}

export function stageShot(name, world, audio) {
  const marks = landmarks();
  const lines = world.city.lines;
  if (name === 'drive' || name === 'chase' || name === 'mission') {
    world.mission.index = name === 'mission' ? 4 : 0;
    world.mission.stage = name === 'mission' ? 1 : 0;
    if (name === 'mission') {
      world.mission.text = MISSIONS[4].stages[1];
      world.mission.target = { x: marks.safehouse.x, y: marks.safehouse.y, label: 'Safehouse' };
      world.wanted = 4;
      // Start near the bank, already in a car.
      const car = seatPlayer(world);
      if (car) {
        car.x = marks.bank.x + 120;
        car.y = marks.bank.y + 40;
        car.angle = Math.PI / 2;
        world.player.x = car.x;
        world.player.y = car.y;
        world.camera.x = car.x;
        world.camera.y = car.y;
      }
      const route = findRoute(lines, world.player.x, world.player.y, marks.safehouse.x, marks.safehouse.y);
      runFor(world, makeDriver(world, car, route), 15, audio);
      return 'play';
    }
    const car = seatPlayer(world);
    if (name === 'chase') {
      world.wanted = 3;
      for (let i = 0; i < 3; i += 1) {
        const angle = (i / 3) * Math.PI * 2;
        const cop = makeCar(
          world.player.x + Math.cos(angle) * 420,
          world.player.y + Math.sin(angle) * 420,
          0,
          COP_CAR,
          'police',
        );
        world.cars.push(cop);
      }
      const route = findRoute(lines, world.player.x, world.player.y, marks.docks.x, marks.docks.y);
      runFor(world, makeDriver(world, car, route), 16, audio);
      return 'play';
    }
    const route = findRoute(lines, world.player.x, world.player.y, marks.docks.x, marks.docks.y);
    runFor(world, makeDriver(world, car, route), 30, audio);
    return 'play';
  }
  // The title over a living downtown, a few seconds in.
  world.camera.x = 1600;
  world.camera.y = 1000;
  const idle = {
    mouse: { x: 0, y: 0, down: false, clicked: false },
    held() { return false; },
    axis() { return 0; },
    wasPressed() { return false; },
    endFrame() {},
  };
  runFor(world, idle, 5, audio);
  return 'title';
}
