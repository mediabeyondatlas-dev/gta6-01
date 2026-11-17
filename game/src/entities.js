// The living city: the player on foot and in a car, traffic, pedestrians,
// police, bullets, pickups and the wanted system. One stepWorld() advances
// everything a single frame.

import { WORLD, HERO, RIDES, COP_CAR, HEAT, CROWD, SHORE } from './config.js';
import { buildingAt, isWater, nearestRoadPoint, landmarks } from './city.js';

let carSeq = 1;

export function makeCar(x, y, angle, model, driver) {
  return {
    id: carSeq++,
    x,
    y,
    angle,
    speed: 0,
    model,
    color: model.paint,
    hp: model.hp,
    driver,
    wreck: false,
    lane: null,
    laneDir: 1,
    turnCooldown: 0,
    smoke: 0,
    crashCooldown: 0,
    ramCooldown: 0,
  };
}

function roadSpawn(city, dice) {
  const vertical = dice.maybe(0.5);
  const line = city.lines[dice.whole(0, city.lines.length - 1)];
  const along = dice.between(140, WORLD.extent - 140);
  if (vertical) return { x: line + dice.between(-20, 20), y: along, vertical: true, line };
  return { x: along, y: line + dice.between(-20, 20), vertical: false, line };
}

export function createWorld(city, dice, seed) {
  const marks = landmarks();
  const cars = [];
  for (let i = 0; i < CROWD.cars; i += 1) {
    const spot = roadSpawn(city, dice);
    const model = dice.from(RIDES);
    const dir = dice.maybe(0.5) ? 1 : -1;
    const angle = spot.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeCar(spot.x, spot.y, angle, model, 'traffic');
    car.lane = { vertical: spot.vertical, line: spot.line };
    car.laneDir = dir;
    cars.push(car);
  }
  const peds = [];
  for (let i = 0; i < CROWD.walkers; i += 1) {
    const spot = roadSpawn(city, dice);
    peds.push({
      x: spot.x + dice.between(-70, 70),
      y: spot.y + dice.between(-70, 70),
      angle: dice.between(0, Math.PI * 2),
      speed: dice.between(28, 55),
      kind: 'civilian',
      state: 'walk',
      fleeX: 0,
      fleeY: 0,
      color: dice.from(['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22']),
    });
  }
  const pickups = [];
  for (let i = 0; i < 10; i += 1) {
    const spot = roadSpawn(city, dice);
    pickups.push({ x: spot.x + dice.between(-40, 40), y: spot.y + dice.between(-40, 40), kind: 'cash', amount: 120, taken: false });
  }
  pickups.push({ x: marks.hospital.x + 60, y: marks.hospital.y, kind: 'health', amount: 50, taken: false });
  pickups.push({ x: marks.hospital.x - 60, y: marks.hospital.y, kind: 'health', amount: 50, taken: false });

  return {
    seed,
    time: 0,
    city,
    dice,
    player: {
      x: 600,
      y: 2400,
      angle: -Math.PI / 2,
      health: HERO.health,
      money: 120,
      inCar: null,
      ammo: HERO.mag,
      reserve: HERO.spare,
      reloadTimer: 0,
      fireTimer: 0,
      dead: false,
      busted: false,
    },
    cars,
    peds,
    bullets: [],
    particles: [],
    pickups,
    wanted: 0,
    bustTimer: 0,
    stats: { carsStolen: 0, missionsDone: 0, cashFound: 0, shotsFired: 0 },
    mission: { index: 0, stage: 0, done: false, text: '', target: null, timer: 0 },
    camera: { x: 600, y: 2400 },
    events: [],
  };
}

function pushFromWalls(city, obj, radius) {
  const b = buildingAt(city, obj.x, obj.y, radius);
  if (!b) return;
  const left = obj.x - (b.x - radius);
  const right = b.x + b.w + radius - obj.x;
  const top = obj.y - (b.y - radius);
  const bottom = b.y + b.h + radius - obj.y;
  const least = Math.min(left, right, top, bottom);
  if (least === left) obj.x = b.x - radius;
  else if (least === right) obj.x = b.x + b.w + radius;
  else if (least === top) obj.y = b.y - radius;
  else obj.y = b.y + b.h + radius;
}

function keepInside(obj, margin) {
  obj.x = Math.max(margin, Math.min(WORLD.extent - margin, obj.x));
  obj.y = Math.max(margin, Math.min(WORLD.extent - margin, obj.y));
}

function addHeat(world, amount) {
  world.wanted = Math.min(5, world.wanted + amount);
}

/** Damage a car; the player's own car takes half, so chases stay survivable. */
function hurtCar(world, car, amount) {
  const mine = world.player.inCar === car.id;
  car.hp -= mine ? amount * 0.5 : amount;
}

function burst(world, x, y, big) {
  const amount = big ? 26 : 12;
  for (let i = 0; i < amount; i += 1) {
    const a = world.dice.between(0, Math.PI * 2);
    const s = world.dice.between(40, big ? 320 : 160);
    world.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: world.dice.between(0.3, 0.9),
      maxLife: 0.9,
      color: world.dice.from(['#ff9f1c', '#ff5e3a', '#ffd23f', '#5a5a5a']),
      size: world.dice.between(3, 8),
    });
  }
}

export function fireBullet(world, fromX, fromY, angle, from) {
  world.bullets.push({
    x: fromX + Math.cos(angle) * 22,
    y: fromY + Math.sin(angle) * 22,
    vx: Math.cos(angle) * 950,
    vy: Math.sin(angle) * 950,
    life: 0.55,
    from,
  });
}

function stepOnFoot(world, input, dt, audio) {
  const p = world.player;
  const sprint = input.held('ShiftLeft') || input.held('ShiftRight');
  const pace = sprint ? HERO.run : HERO.walk;
  const mx = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
  const my = input.axis('KeyW', 'KeyS') + input.axis('ArrowUp', 'ArrowDown');
  const len = Math.hypot(mx, my);
  if (len > 0) {
    p.x += (mx / len) * pace * dt;
    p.y += (my / len) * pace * dt;
    p.angle = Math.atan2(my, mx);
  }
  pushFromWalls(world.city, p, HERO.radius);
  keepInside(p, 20);
  if (isWater(p.x, p.y)) p.y = SHORE.sea - 24;
  // Aim follows the mouse; a click fires the pistol.
  const aim = world.aimAngle ?? p.angle;
  p.angle = aim;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0 && p.reserve > 0) {
      const take = Math.min(HERO.mag, p.reserve);
      p.ammo = take;
      p.reserve -= take;
    }
  }
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (input.wasPressed('KeyR') && p.ammo < HERO.mag && p.reserve > 0 && p.reloadTimer <= 0) {
    p.reloadTimer = HERO.reload;
  }
  if (input.mouse.down && p.fireTimer <= 0 && p.reloadTimer <= 0 && p.ammo > 0) {
    p.ammo -= 1;
    p.fireTimer = HERO.fireGap;
    fireBullet(world, p.x, p.y, aim, 'player');
    audio.gunshot();
    world.stats.shotsFired += 1;
    addHeat(world, 0.25);
  }
  // Cash and health lying on the street.
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) >= 30) continue;
    pk.taken = true;
    if (pk.kind === 'cash') {
      p.money += pk.amount;
      world.stats.cashFound += 1;
      audio.pickup();
    } else {
      p.health = Math.min(HERO.health, p.health + pk.amount);
      audio.pickup();
    }
  }
}

function stepInCar(world, input, dt, audio) {
  const p = world.player;
  const car = world.cars.find((c) => c.id === p.inCar);
  if (!car) {
    p.inCar = null;
    return;
  }
  const gas = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
  const wheel = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
  const brake = input.held('Space');
  car.speed += gas * car.model.pull * dt;
  if (brake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  car.speed *= Math.max(0, 1 - 0.55 * dt);
  if (Math.abs(car.speed) > car.model.top) car.speed = Math.sign(car.speed) * car.model.top;
  // Tight arcade steering: the turn rate grows with speed, but the turning
  // circle stays small enough to take a street corner at speed.
  car.angle += wheel * car.model.turn * 0.0028 * car.speed * dt * (car.speed < 0 ? -1 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  pushFromWalls(world.city, car, 20);
  car.crashCooldown = Math.max(0, (car.crashCooldown || 0) - dt);
  if (car.x !== before.x || car.y !== before.y) {
    if (Math.abs(car.speed) > 200 && car.crashCooldown <= 0) {
      audio.crash();
      hurtCar(world, car, 12);
      car.crashCooldown = 0.7;
      car.speed *= 0.5;
    } else {
      car.speed *= 0.9;
    }
  }
  keepInside(car, 24);
  if (isWater(car.x, car.y)) {
    car.y = SHORE.sea - 26;
    car.speed *= 0.4;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (car.hp <= 0 && !car.wreck) {
    car.wreck = true;
    car.speed = 0;
    burst(world, car.x, car.y, true);
    audio.crash();
    p.inCar = null;
    p.x = car.x + 40;
    p.y = car.y;
    addHeat(world, 0.5);
  }
  audio.engine(Math.min(1, Math.abs(car.speed) / car.model.top), true);
}

function closestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.cars) {
    if (car.wreck) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function tryCar(world, input) {
  const p = world.player;
  if (!input.wasPressed('KeyE')) return;
  if (p.inCar !== null) {
    const carId = p.inCar;
    p.inCar = null;
    const car = world.cars.find((c) => c.id === carId);
    if (car) {
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    }
    return;
  }
  const car = closestCar(world, p.x, p.y, 52);
  if (!car) return;
  if (car.driver === 'traffic') {
    car.driver = 'player';
    p.inCar = car.id;
    world.stats.carsStolen += 1;
    addHeat(world, 1);
    world.events.push({ type: 'stole-car', x: car.x, y: car.y });
    // The driver bails out and runs off on foot.
    world.peds.push({
      x: car.x + 30,
      y: car.y + 10,
      angle: 0,
      speed: 90,
      kind: 'civilian',
      state: 'flee',
      fleeX: car.x + 300,
      fleeY: car.y + 300,
      color: '#e67e22',
    });
  } else {
    car.driver = 'player';
    p.inCar = car.id;
  }
}

function trafficCar(world, car, dt) {
  if (car.wreck || car.driver !== 'traffic') return;
  const lines = world.city.lines;
  if (!car.lane) {
    const near = nearestRoadPoint(world.city, car.x, car.y);
    car.lane = { vertical: Math.abs(near.x - car.x) < Math.abs(near.y - car.y), line: near.x };
  }
  // Cruise along the lane; slow down for the car ahead.
  const cruise = 145;
  car.speed += (cruise - car.speed) * Math.min(1, 1.2 * dt);
  const ahead = 46;
  const fx = car.x + Math.cos(car.angle) * ahead;
  const fy = car.y + Math.sin(car.angle) * ahead;
  for (const other of world.cars) {
    if (other === car || other.wreck) continue;
    if (Math.hypot(other.x - fx, other.y - fy) < 34) {
      car.speed = Math.max(0, car.speed - 320 * dt);
    }
  }
  car.turnCooldown -= dt;
  const atCrossing = car.lane.vertical
    ? lines.some((l) => Math.abs(car.y - l) < 26)
    : lines.some((l) => Math.abs(car.x - l) < 26);
  if (atCrossing && car.turnCooldown <= 0 && world.dice.maybe(0.025)) {
    car.lane.vertical = !car.lane.vertical;
    car.lane.line = car.lane.vertical ? car.x : car.y;
    car.laneDir = world.dice.maybe(0.5) ? 1 : -1;
    car.turnCooldown = 2;
  }
  // Steer back toward the middle of the lane.
  const want = car.lane.vertical
    ? (car.laneDir > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (car.laneDir > 0 ? 0 : Math.PI);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  pushFromWalls(world.city, car, 20);
  keepInside(car, 24);
}

function policeCar(world, car, dt) {
  if (car.wreck) return;
  const p = world.player;
  // Each cop aims at its own spot around the player (spread by id), so the
  // squad surrounds the player instead of piling onto one point.
  const dx0 = p.x - car.x;
  const dy0 = p.y - car.y;
  const dist0 = Math.hypot(dx0, dy0) || 1;
  const spread = ((car.id % 3) - 1) * 110;
  const tx = p.x + (-dy0 / dist0) * spread;
  const ty = p.y + (dx0 / dist0) * spread;
  const dx = tx - car.x;
  const dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const chase = dist > 120 ? car.model.top * 0.92 : 260;
  car.speed += (chase - car.speed) * Math.min(1, 1.6 * dt);
  // Cops stay on the roads: they drive along a road line and only turn at
  // crossings, picking the turn that closes in. Steering straight at the
  // player would cut across buildings and pile the squad onto rooftops.
  if (!car.lane) {
    const near = nearestRoadPoint(world.city, car.x, car.y);
    const vertical = Math.abs(near.x - car.x) < Math.abs(near.y - car.y);
    car.lane = { vertical, line: vertical ? near.x : near.y };
    car.laneDir = vertical ? (p.y > car.y ? 1 : -1) : (p.x > car.x ? 1 : -1);
    car.angle = vertical ? (car.laneDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.laneDir > 0 ? 0 : Math.PI);
  }
  const lines = world.city.lines;
  const atCrossing = lines.some((l) => Math.abs(car.y - l) < 26) || lines.some((l) => Math.abs(car.x - l) < 26);
  car.turnCooldown -= dt;
  if (atCrossing && car.turnCooldown <= 0) {
    let bestAngle = car.angle;
    let bestD = Infinity;
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const nx = car.x + Math.cos(a) * 200;
      const ny = car.y + Math.sin(a) * 200;
      const d = Math.hypot(nx - tx, ny - ty);
      if (d < bestD) {
        bestD = d;
        bestAngle = a;
      }
    }
    if (bestAngle !== car.angle && world.dice.maybe(0.75)) {
      car.angle = bestAngle;
      car.lane.vertical = bestAngle === Math.PI / 2 || bestAngle === -Math.PI / 2;
      car.laneDir = bestAngle === 0 || bestAngle === Math.PI / 2 ? 1 : -1;
      car.lane.line = car.lane.vertical ? car.x : car.y;
      car.turnCooldown = 1.2;
    }
  }
  // Hold the road between crossings; only steer straight at the player when
  // close enough to ram — and not while recovering from a ram, so the cop
  // drives on instead of gluing itself to the player's car.
  const laneAngle = car.lane.vertical
    ? (car.laneDir > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (car.laneDir > 0 ? 0 : Math.PI);
  const aimAt = dist < 170 && (car.ramCooldown || 0) <= 0 ? Math.atan2(dy, dx) : laneAngle;
  let diff = aimAt - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff * 2));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  pushFromWalls(world.city, car, 20);
  keepInside(car, 24);
  // Ram the player up close: a nudge with a cooldown. The ram hurts the cop
  // car too and knocks it back, so a chase wears both cars down slowly
  // instead of shredding the player's car in seconds.
  if (dist < 46) {
    const pCar = world.cars.find((c) => c.id === world.player.inCar);
    if (pCar && !pCar.wreck) {
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
      if (car.ramCooldown <= 0) {
        car.ramCooldown = 1.2;
        hurtCar(world, pCar, 5);
        car.hp -= 3;
        car.speed *= 0.55;
        if (Math.abs(car.speed) > 120) pCar.speed *= 0.96;
      }
    } else if (world.player.inCar === null) {
      world.bustTimer += dt;
    }
  }
}

function walker(world, ped, dt) {
  if (ped.state === 'dead') return;
  const p = world.player;
  const danger = world.bullets.length > 0
    || (p.inCar !== null && Math.abs((world.cars.find((c) => c.id === p.inCar) || { speed: 0 }).speed) > 260);
  if (ped.state !== 'flee' && danger && Math.hypot(ped.x - p.x, ped.y - p.y) < 320) {
    ped.state = 'flee';
    ped.fleeX = ped.x + (ped.x - p.x);
    ped.fleeY = ped.y + (ped.y - p.y);
  }
  if (ped.state === 'flee') {
    const dx = ped.fleeX - ped.x;
    const dy = ped.fleeY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 20) {
      ped.state = 'walk';
    } else {
      ped.angle = Math.atan2(dy, dx);
      ped.x += Math.cos(ped.angle) * 150 * dt;
      ped.y += Math.sin(ped.angle) * 150 * dt;
    }
  } else {
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (world.dice.maybe(0.004)) ped.angle = world.dice.between(0, Math.PI * 2);
    if (Math.hypot(ped.x - p.x, ped.y - p.y) > 1400) {
      const near = nearestRoadPoint(world.city, p.x, p.y);
      ped.x = near.x + world.dice.between(-300, 300);
      ped.y = near.y + world.dice.between(-300, 300);
    }
  }
  pushFromWalls(world.city, ped, 12);
  keepInside(ped, 16);
}

function stepBullets(world, dt, audio) {
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (buildingAt(world.city, b.x, b.y, 0)) {
      b.life = 0;
      world.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, maxLife: 0.25, color: '#ffd23f', size: 4 });
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
  // What a bullet hits: cars first, then people, then the player (cop fire).
  for (const b of world.bullets) {
    if (b.life <= 0) continue;
    let hit = false;
    for (const car of world.cars) {
      if (car.wreck) continue;
      if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
        hurtCar(world, car, HERO.gunDamage);
        b.life = 0;
        hit = true;
        if (b.from === 'player') addHeat(world, 0.3);
        if (car.hp <= 0 && !car.wreck) {
          car.wreck = true;
          car.speed = 0;
          burst(world, car.x, car.y, true);
          audio.crash();
          if (car.driver === 'police') addHeat(world, 0.6);
        }
        break;
      }
    }
    if (hit) continue;
    for (const ped of world.peds) {
      if (ped.state === 'dead') continue;
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
        ped.state = 'dead';
        b.life = 0;
        if (b.from === 'player') {
          addHeat(world, 0.6);
          world.events.push({ type: 'ped-hit', x: ped.x, y: ped.y });
        }
        break;
      }
    }
    if (hit) continue;
    const p = world.player;
    if (b.from === 'cop' && p.inCar === null && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
      p.health -= 7;
      b.life = 0;
    }
  }
}

function stepHeat(world, dt, audio) {
  const p = world.player;
  const level = Math.floor(world.wanted);
  const copCars = world.cars.filter((c) => c.driver === 'police' && !c.wreck).length;
  const want = HEAT.squad[level];
  if (copCars < want && world.wanted > 0.2) {
    const angle = world.dice.between(0, Math.PI * 2);
    const near = nearestRoadPoint(world.city, p.x + Math.cos(angle) * 760, p.y + Math.sin(angle) * 760);
    world.cars.push(makeCar(near.x, near.y, 0, COP_CAR, 'police'));
  }
  // Foot cops join from wanted level 2 up.
  const footCops = world.peds.filter((pd) => pd.kind === 'cop' && pd.state !== 'dead').length;
  if (level >= 2 && footCops < level - 1) {
    const angle = world.dice.between(0, Math.PI * 2);
    world.peds.push({
      x: p.x + Math.cos(angle) * 420,
      y: p.y + Math.sin(angle) * 420,
      angle: 0,
      speed: 200,
      kind: 'cop',
      state: 'chase',
      fleeX: 0,
      fleeY: 0,
      color: '#1c2733',
    });
  }
  // Heat fades when no cop is anywhere near.
  const nearestCop = Math.min(
    ...world.cars.filter((c) => c.driver === 'police' && !c.wreck).map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
    9999,
  );
  if (nearestCop > 520 && level > 0) {
    world.wanted = Math.max(0, world.wanted - HEAT.cool * dt);
  }
  // A foot cop shoots at the player on foot, and busts them up close.
  for (const ped of world.peds) {
    if (ped.kind !== 'cop' || ped.state === 'dead') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (p.inCar === null && d < 380 && d > 40) {
      ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      ped.shootTimer = (ped.shootTimer || 0) - dt;
      if (ped.shootTimer <= 0) {
        ped.shootTimer = 1.4;
        fireBullet(world, ped.x, ped.y, ped.angle, 'cop');
        audio.gunshot();
      }
    } else if (p.inCar === null && d <= 40) {
      world.bustTimer += dt;
    }
  }
  if (world.bustTimer > 0 && (p.inCar !== null || Math.min(nearestCop, 9999) > 60)) {
    world.bustTimer = Math.max(0, world.bustTimer - dt * 0.5);
  }
  if (world.bustTimer >= HEAT.bust) p.busted = true;
  // The siren wails while a cop is near.
  audio.siren(nearestCop < 700, dt);
  if (p.health <= 0) p.dead = true;
}

function stepSparks(world, dt) {
  for (const pt of world.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
    pt.life -= dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
  // Damaged cars trail smoke.
  for (const car of world.cars) {
    if (car.wreck || car.hp > 55) continue;
    car.smoke -= dt;
    if (car.smoke <= 0) {
      car.smoke = 0.12;
      world.particles.push({ x: car.x, y: car.y, vx: 0, vy: -24, life: 0.7, maxLife: 0.7, color: '#666666', size: 6 });
    }
  }
}

function shoveCars(world) {
  const alive = world.cars.filter((c) => !c.wreck);
  for (let i = 0; i < alive.length; i += 1) {
    for (let j = i + 1; j < alive.length; j += 1) {
      const a = alive[i];
      const b = alive[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        const aMine = a.id === world.player.inCar;
        const bMine = b.id === world.player.inCar;
        if (aMine || bMine) {
          // The player's car is heavy: it shoves the other car aside and
          // keeps its own speed, so a sandwich of cops cannot pin it in
          // place while it tries to drive away.
          const mine = aMine ? a : b;
          const other = aMine ? b : a;
          mine.x += nx * push * 0.5 * (aMine ? -1 : 1);
          mine.y += ny * push * 0.5 * (aMine ? -1 : 1);
          other.x += nx * push * 1.5 * (aMine ? 1 : -1);
          other.y += ny * push * 1.5 * (aMine ? 1 : -1);
          other.speed = mine.speed * 0.6;
        } else {
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const swap = a.speed;
          a.speed = b.speed * 0.6;
          b.speed = swap * 0.6;
        }
      }
    }
  }
}

export function stepWorld(world, input, dt, audio) {
  world.time += dt;
  world.events = [];
  const p = world.player;
  if (p.dead || p.busted) return;
  tryCar(world, input);
  if (p.inCar !== null) stepInCar(world, input, dt, audio);
  else stepOnFoot(world, input, dt, audio);
  for (const car of world.cars) {
    if (car.driver === 'traffic') trafficCar(world, car, dt);
    else if (car.driver === 'police') policeCar(world, car, dt);
  }
  for (const ped of world.peds) walker(world, ped, dt);
  stepBullets(world, dt, audio);
  stepHeat(world, dt, audio);
  stepSparks(world, dt);
  shoveCars(world);
  // The player's car running someone over is a crime, and slows the car.
  const pCar = world.cars.find((c) => c.id === p.inCar);
  if (pCar && Math.abs(pCar.speed) > 140) {
    for (const ped of world.peds) {
      if (ped.state === 'dead') continue;
      if (Math.hypot(ped.x - pCar.x, ped.y - pCar.y) < 30) {
        ped.state = 'dead';
        addHeat(world, 0.6);
        world.events.push({ type: 'ped-hit', x: ped.x, y: ped.y });
        pCar.speed *= 0.82;
        audio.crash();
      }
    }
  }
  // The camera chases the player, smoothly.
  world.camera.x += (p.x - world.camera.x) * Math.min(1, 5 * dt);
  world.camera.y += (p.y - world.camera.y) * Math.min(1, 5 * dt);
}
