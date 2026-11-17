// Solmarina's story: six jobs that take a nobody with $120 and a grudge
// from a stolen car to the ruler of the city. Each job is a small state
// machine; the update function moves it along and pays out when it closes.

import { landmarks } from './city.js';
import { makeCar } from './entities.js';

const SPOTS = landmarks();

export const MISSIONS = [
  {
    title: 'First Wheels',
    briefing: 'You just got to Solmarina with $120 and a grudge. Steal a car and drive it down to the Docks.',
    stages: ['Steal a car (press E near one)', 'Drive to the Docks'],
  },
  {
    title: 'The Package',
    briefing: 'Marco at the Motel has a package for you. Pick it up and carry it to the Safehouse. Quietly.',
    stages: ['Pick up the package at the Motel', 'Deliver it to the Safehouse'],
  },
  {
    title: 'Hot Pursuit',
    briefing: 'The crew wants to know you can handle heat. Push your wanted level to 3 stars, then shake the cops.',
    stages: ['Push your wanted level to 3 stars', 'Lose the cops — get back to 0 stars'],
  },
  {
    title: 'Payback',
    briefing: 'The Tiburones torched Marco\u2019s garage. Three of their cars cruise the city. Wreck all three.',
    stages: ['Wreck the Tiburon cars (0/3)'],
  },
  {
    title: 'The Heist',
    briefing: 'Solmarina Bank, noon rush. Grab the cash and run it to the Safehouse. The whole city will be on you.',
    stages: ['Reach the Bank and grab the cash', 'Escape to the Safehouse'],
  },
  {
    title: 'King of Solmarina',
    briefing: 'One last drive. The yacht is waiting at the marina. Get there and Solmarina is yours.',
    stages: ['Drive to the Yacht'],
  },
];

const PAYOUTS = [350, 450, 600, 700, 900, 1200];

const GANG_MODEL = { name: 'Tiburon', paint: '#8e1f2f', top: 540, pull: 420, turn: 3.6, hp: 130 };

function closestDrivable(world) {
  let best = null;
  let bestD = Infinity;
  for (const car of world.cars) {
    if (car.wreck || car.driver === 'police') continue;
    const d = Math.hypot(car.x - world.player.x, car.y - world.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function bringGang(world) {
  const spots = [
    { x: 1000, y: 1800 },
    { x: 2200, y: 1000 },
    { x: 1800, y: 2200 },
  ];
  for (let i = 0; i < spots.length; i += 1) {
    const car = makeCar(spots[i].x, spots[i].y, 0, GANG_MODEL, 'traffic');
    car.speed = 120;
    car.gang = true;
    world.cars.push(car);
  }
}

function gangLeft(world) {
  return world.cars.filter((c) => c.gang && !c.wreck).length;
}

function finishJob(world, audio) {
  const idx = world.mission.index;
  world.player.money += PAYOUTS[idx];
  world.stats.missionsDone += 1;
  audio.missionDone();
  world.mission.index += 1;
  world.mission.stage = 0;
  world.mission.timer = 0;
  if (world.mission.index === 3) bringGang(world);
  if (world.mission.index < MISSIONS.length) {
    world.mission.text = MISSIONS[world.mission.index].title + ': ' + MISSIONS[world.mission.index].briefing;
  }
}

function runJob(world, dt, audio) {
  const m = world.mission;
  const p = world.player;
  const idx = m.index;
  if (idx >= MISSIONS.length) {
    m.text = 'You rule Solmarina. Free roam — the city is yours.';
    m.target = null;
    return;
  }
  const near = (point, radius) => Math.hypot(p.x - point.x, p.y - point.y) < radius;

  if (idx === 0) {
    if (m.stage === 0) {
      m.text = MISSIONS[0].stages[0];
      const car = closestDrivable(world);
      m.target = car ? { x: car.x, y: car.y, label: 'Car' } : null;
      if (p.inCar !== null) m.stage = 1;
    } else {
      m.text = MISSIONS[0].stages[1];
      m.target = { x: SPOTS.docks.x, y: SPOTS.docks.y, label: 'Docks' };
      if (near(SPOTS.docks, 90)) finishJob(world, audio);
    }
  } else if (idx === 1) {
    if (m.stage === 0) {
      m.text = MISSIONS[1].stages[0];
      m.target = { x: SPOTS.motel.x, y: SPOTS.motel.y, label: 'Motel' };
      if (near(SPOTS.motel, 80)) {
        m.stage = 1;
        audio.pickup();
      }
    } else {
      m.text = MISSIONS[1].stages[1];
      m.target = { x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, label: 'Safehouse' };
      if (near(SPOTS.safehouse, 90)) finishJob(world, audio);
    }
  } else if (idx === 2) {
    if (m.stage === 0) {
      m.text = MISSIONS[2].stages[0];
      m.target = null;
      if (world.wanted >= 3) m.stage = 1;
    } else {
      m.text = MISSIONS[2].stages[1];
      m.target = null;
      if (world.wanted < 0.5) finishJob(world, audio);
    }
  } else if (idx === 3) {
    if (m.stage === 0) {
      m.text = 'Wreck the Tiburon cars (' + (3 - gangLeft(world)) + '/3)';
      const alive = world.cars.find((c) => c.gang && !c.wreck);
      m.target = alive ? { x: alive.x, y: alive.y, label: 'Tiburon' } : null;
      // Ramming a Tiburon at speed hurts it too.
      const pCar = world.cars.find((c) => c.id === p.inCar);
      if (pCar && Math.abs(pCar.speed) > 300) {
        for (const g of world.cars) {
          if (!g.gang || g.wreck) continue;
          if (Math.hypot(g.x - pCar.x, g.y - pCar.y) < 48) {
            g.hp -= 30 * dt;
            if (g.hp <= 0) {
              g.wreck = true;
              g.speed = 0;
            }
          }
        }
      }
      if (gangLeft(world) === 0) finishJob(world, audio);
    }
  } else if (idx === 4) {
    if (m.stage === 0) {
      m.text = MISSIONS[4].stages[0];
      m.target = { x: SPOTS.bank.x, y: SPOTS.bank.y, label: 'Bank' };
      if (near(SPOTS.bank, 80)) {
        m.stage = 1;
        m.timer = 0;
        p.money += 800;
        world.wanted = Math.max(world.wanted, 4);
        audio.pickup();
      }
    } else {
      m.text = MISSIONS[4].stages[1];
      m.target = { x: SPOTS.safehouse.x, y: SPOTS.safehouse.y, label: 'Safehouse' };
      if (near(SPOTS.safehouse, 90)) finishJob(world, audio);
    }
  } else if (idx === 5) {
    m.text = MISSIONS[5].stages[0];
    m.target = { x: SPOTS.yacht.x, y: SPOTS.yacht.y, label: 'Yacht' };
    if (near(SPOTS.yacht, 90)) finishJob(world, audio);
  }
}

export function updateMissions(world, dt, audio) {
  if (world.mission.index >= MISSIONS.length) {
    world.mission.text = 'You rule Solmarina. Free roam — the city is yours.';
    world.mission.target = null;
    return;
  }
  runJob(world, dt, audio);
}

export function missionTitle(world) {
  if (world.mission.index >= MISSIONS.length) return 'King of Solmarina';
  return MISSIONS[world.mission.index].title;
}
