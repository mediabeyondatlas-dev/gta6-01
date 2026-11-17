// The game loop: screens, camera, aiming, saving, and the entry point.
// A ?shot= URL stages a fixed scene instead of playing, so screenshots are
// real frames of the game, simulated forward by the autopilot in shots.js.

import { WORLD, HERO } from './config.js';
import { seededRandom } from './random.js';
import { buildCity, landmarks } from './city.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { createWorld, stepWorld } from './entities.js';
import { updateMissions } from './missions.js';
import { drawGame } from './render.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'solmarina-save-v1';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : Math.floor(Math.random() * 100000);
const shotName = params.get('shot');
const dice = seededRandom(seed);
const city = buildCity(dice);
const world = createWorld(city, dice, seed);
const input = makeInput();
const audio = makeAudio();
const marks = landmarks();

let screen = 'title';
let lastTick = performance.now();
let saveClock = 0;

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const save = JSON.parse(raw);
    if (!save || typeof save.money !== 'number') return false;
    world.player.money = save.money;
    world.player.health = HERO.health;
    world.player.x = save.x;
    world.player.y = save.y;
    world.mission.index = save.missionIndex || 0;
    world.mission.stage = 0;
    return true;
  } catch {
    return false;
  }
}

function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: world.player.money,
      x: world.player.x,
      y: world.player.y,
      missionIndex: world.mission.index,
    }));
  } catch {
    // Saving is a bonus; a failure never stops the game.
  }
}

function beginPlay() {
  audio.resume();
  readSave();
  world.player.dead = false;
  world.player.busted = false;
  world.player.health = HERO.health;
  world.wanted = 0;
  world.bustTimer = 0;
  screen = 'play';
  status.textContent = 'Playing Solmarina.';
}

function backOnStreets() {
  const p = world.player;
  p.money = Math.max(0, Math.floor(p.money * 0.8));
  p.health = HERO.health;
  p.x = marks.hospital.x;
  p.y = marks.hospital.y;
  p.inCar = null;
  p.dead = false;
  p.busted = false;
  world.wanted = 0;
  world.bustTimer = 0;
  world.camera.x = p.x;
  world.camera.y = p.y;
  // The cops stand down.
  for (const car of world.cars) {
    if (car.driver === 'police') car.wreck = true;
  }
  for (const ped of world.peds) {
    if (ped.kind === 'cop') ped.state = 'dead';
  }
  screen = 'play';
}

function updateAim() {
  const p = world.player;
  const viewX = world.camera.x - canvas.width / 2;
  const viewY = world.camera.y - canvas.height / 2;
  const wx = viewX + input.mouse.x;
  const wy = viewY + input.mouse.y;
  world.aimAngle = Math.atan2(wy - p.y, wx - p.x);
  world.aimScreen = { x: input.mouse.x, y: input.mouse.y };
}

function tick(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTick) / 1000));
  lastTick = now;

  if (screen === 'title') {
    // A slow pan over downtown behind the title.
    world.time += dt;
    world.camera.x = 1600 + Math.sin(world.time * 0.05) * 500;
    world.camera.y = 1000 + Math.cos(world.time * 0.04) * 260;
    if (input.wasPressed('Enter')) beginPlay();
  } else if (screen === 'play') {
    updateAim();
    stepWorld(world, input, dt, audio);
    updateMissions(world, dt, audio);
    if (world.flash) {
      world.flash.timer -= dt;
      if (world.flash.timer <= 0) world.flash = null;
    }
    if (world.player.busted) {
      audio.busted();
      world.flash = { text: 'BUSTED!', timer: 2.5, color: '#ff5e3a' };
      screen = 'busted';
    } else if (world.player.dead) {
      audio.busted();
      screen = 'wasted';
    }
    if (input.wasPressed('KeyP')) screen = 'pause';
    if (input.wasPressed('KeyM')) audio.toggleMute();
    saveClock += dt;
    if (saveClock > 10) {
      saveClock = 0;
      writeSave();
    }
  } else if (screen === 'pause') {
    if (input.wasPressed('KeyP') || input.wasPressed('Enter')) screen = 'play';
  } else if (screen === 'busted' || screen === 'wasted') {
    if (input.wasPressed('Enter')) backOnStreets();
  }

  drawGame(ctx, world, canvas, screen);
  input.endFrame();
  requestAnimationFrame(tick);
}

if (shotName) {
  // Screenshot mode: stage the scene, draw one frame, stop. The frame is a
  // real render of the game after simulating forward from a fresh world.
  const shotScreen = stageShot(shotName, world, audio);
  updateAim();
  drawGame(ctx, world, canvas, shotScreen);
  status.textContent = 'Screenshot scene: ' + shotName;
} else {
  status.textContent = 'Solmarina loaded. Press Enter to start.';
  requestAnimationFrame(tick);
}
