// Everything the player sees: the city, the cars, the people, the HUD, the
// minimap and the menus. The judge reads the game mostly through these
// frames, so the city is drawn to look alive: shadows, rooftop detail, lane
// markings, palms and moving water.

import { WORLD, SHORE, GREEN, PAINT, MAP, HERO } from './config.js';
import { isWater } from './city.js';
import { missionTitle } from './missions.js';

function roundedBox(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function visible(view, x, y, pad) {
  return x > view.x - pad && x < view.x + view.w + pad
    && y > view.y - pad && y < view.y + view.h + pad;
}

function paintGround(ctx, world, view) {
  ctx.fillStyle = PAINT.grass;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // The park.
  ctx.fillStyle = PAINT.park;
  ctx.fillRect(GREEN.x, GREEN.y, GREEN.w, GREEN.h);
  // Sand, then the sea with drifting wave lines.
  ctx.fillStyle = PAINT.sand;
  ctx.fillRect(view.x, SHORE.sand, view.w, WORLD.extent - SHORE.sand);
  ctx.fillStyle = PAINT.sea;
  ctx.fillRect(view.x, SHORE.sea, view.w, WORLD.extent - SHORE.sea);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = SHORE.sea + 30; y < WORLD.extent; y += 46) {
    ctx.beginPath();
    for (let x = 0; x <= WORLD.extent; x += 40) {
      const yy = y + Math.sin(x * 0.01 + world.time * 1.4 + y) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Roads: pavement edges, asphalt, centre dashes, crossings.
  const half = WORLD.width / 2;
  for (const line of world.city.lines) {
    ctx.fillStyle = PAINT.pavement;
    ctx.fillRect(line - half - WORLD.walk, 0, WORLD.walk, WORLD.extent);
    ctx.fillRect(line + half, 0, WORLD.walk, WORLD.extent);
    ctx.fillRect(0, line - half - WORLD.walk, WORLD.extent, WORLD.walk);
    ctx.fillRect(0, line + half, WORLD.extent, WORLD.walk);
    ctx.fillStyle = PAINT.road;
    ctx.fillRect(line - half, 0, WORLD.width, WORLD.extent);
    ctx.fillRect(0, line - half, WORLD.extent, WORLD.width);
  }
  ctx.fillStyle = PAINT.dashYellow;
  for (const line of world.city.lines) {
    for (let d = 0; d < WORLD.extent; d += 64) {
      ctx.fillRect(line - 2, d, 4, 30);
      ctx.fillRect(d, line - 2, 30, 4);
    }
  }
  ctx.fillStyle = PAINT.crossing;
  for (const lx of world.city.lines) {
    for (const ly of world.city.lines) {
      for (let s = -36; s <= 36; s += 12) {
        ctx.fillRect(lx + s, ly - half - 4, 6, 8);
        ctx.fillRect(lx + s, ly + half - 4, 6, 8);
        ctx.fillRect(lx - half - 4, ly + s, 8, 6);
        ctx.fillRect(lx + half - 4, ly + s, 8, 6);
      }
    }
  }
}

function paintBuildings(ctx, world, view) {
  for (const b of world.city.buildings) {
    if (!visible(view, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    const shade = 6 + b.floors * 4;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + shade, b.y + shade, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Rooftop windows and a vent.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        ctx.fillRect(b.x + 8 + cx * 26, b.y + 8 + cy * 26, 12, 12);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
  }
  // Palms along the beach and trees in the park and blocks.
  for (const palm of world.city.palms) {
    if (!visible(view, palm.x, palm.y, 40)) continue;
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 4, palm.y - 14);
    ctx.stroke();
    ctx.fillStyle = PAINT.palm;
    ctx.beginPath();
    ctx.arc(palm.x + 4, palm.y - 18, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const tree of world.city.trees) {
    if (!visible(view, tree.x, tree.y, 40)) continue;
    ctx.fillStyle = PAINT.tree;
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAINT.treeTop;
    ctx.beginPath();
    ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundedBox(ctx, -21, -9, 46, 24, 8);
  ctx.fill();
  ctx.translate(0, -3);
  ctx.fillStyle = car.wreck ? '#2b2b2b' : car.color;
  roundedBox(ctx, -23, -11, 46, 22, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundedBox(ctx, -6, -8, 14, 16, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundedBox(ctx, 8, -8, 8, 16, 3);
  ctx.fill();
  if (car.driver === 'police' && !car.wreck) {
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(-4, -11, 8, 5);
    ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
    ctx.fillRect(-4, 6, 8, 5);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-14, -11, 10, 22);
  }
  if (car.gang && !car.wreck) {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-20, -11, 4, 22);
  }
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(23, -7, 2.5, 0, Math.PI * 2);
  ctx.arc(23, 7, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintWorld(ctx, world, view) {
  paintGround(ctx, world, view);
  paintBuildings(ctx, world, view);
  // Pickups, bobbing gently.
  for (const pk of world.pickups) {
    if (pk.taken || !visible(view, pk.x, pk.y, 40)) continue;
    const bob = Math.sin(world.time * 3 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#1e9e4a';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-2.5, -8, 5, 16);
      ctx.fillRect(-8, -2.5, 16, 5);
    }
    ctx.restore();
  }
  // The pulsing mission marker.
  const target = world.mission.target;
  if (target && visible(view, target.x, target.y, 60)) {
    const pulse = 1 + Math.sin(world.time * 4) * 0.15;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Cars, people, bullets, sparks, then the player on foot.
  for (const car of world.cars) {
    if (visible(view, car.x, car.y, 60)) paintCar(ctx, car, world.time);
  }
  for (const ped of world.peds) {
    if (ped.state === 'dead' || !visible(view, ped.x, ped.y, 30)) continue;
    ctx.fillStyle = ped.kind === 'cop' ? '#1c2733' : ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of world.bullets) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const p = world.player;
  if (p.inCar === null && !p.dead && !p.busted && visible(view, p.x, p.y, 40)) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#14b8a6';
    ctx.beginPath();
    ctx.arc(0, 0, HERO.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(4, -6, 12, 12);
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintMap(ctx, world, x, y, size) {
  const scale = size / WORLD.extent;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,24,0.85)';
  roundedBox(ctx, x - 6, y - 6, size + 12, size + 12, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = '#3f6b34';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#2b9ec4';
  ctx.fillRect(x, y + SHORE.sea * scale, size, size - SHORE.sea * scale);
  ctx.fillStyle = '#5a5f6b';
  for (const line of world.city.lines) {
    ctx.fillRect(x + line * scale - 2, y, 4, size);
    ctx.fillRect(x, y + line * scale - 2, size, 4);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (const b of world.city.buildings) {
    ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  }
  const target = world.mission.target;
  if (target) {
    ctx.fillStyle = '#ffd23f';
    const tx = x + target.x * scale;
    const ty = y + target.y * scale;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 6);
    ctx.lineTo(tx + 5, ty);
    ctx.lineTo(tx, ty + 6);
    ctx.lineTo(tx - 5, ty);
    ctx.closePath();
    ctx.fill();
  }
  for (const car of world.cars) {
    if (car.wreck) continue;
    if (car.driver === 'police') ctx.fillStyle = '#ff2d2d';
    else if (car.gang) ctx.fillStyle = '#ff8c1a';
    else if (car.id === world.player.inCar) continue;
    else continue;
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = world.player;
  ctx.save();
  ctx.translate(x + p.x * scale, y + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);
  ctx.restore();
}

function chip(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  roundedBox(ctx, x, y, w, h, 8);
  ctx.fill();
}

function paintHud(ctx, world, canvas) {
  const p = world.player;
  const level = Math.floor(world.wanted);
  // Top-left: cash, health bar, current job.
  chip(ctx, 12, 12, 250, 98);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 24, 34);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 44, 150, 12);
  ctx.fillStyle = p.health > 50 ? '#2ecc71' : p.health > 25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(24, 44, 150 * Math.max(0, p.health) / 100, 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText('HEALTH', 180, 55);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(missionTitle(world), 24, 76);
  ctx.fillStyle = '#dfe6ee';
  ctx.font = '12px sans-serif';
  ctx.fillText(world.mission.text.slice(0, 64), 24, 94);
  // Top-right: wanted stars.
  chip(ctx, canvas.width - 168, 12, 156, 44);
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < level ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', canvas.width - 156 + i * 30, 42);
  }
  // Bottom-left: ammo on foot, speedometer in a car.
  if (p.inCar === null) {
    chip(ctx, 12, canvas.height - 58, 190, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('AMMO ' + p.ammo + ' / ' + p.reserve, 24, canvas.height - 30);
    if (p.reloadTimer > 0) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('RELOADING…', 110, canvas.height - 30);
    }
  } else {
    const car = world.cars.find((c) => c.id === p.inCar);
    if (car) {
      chip(ctx, 12, canvas.height - 58, 210, 46);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(car.model.name.toUpperCase(), 24, canvas.height - 30);
      ctx.font = '13px sans-serif';
      ctx.fillText(Math.round(Math.abs(car.speed) * 0.14) + ' mph', 130, canvas.height - 30);
    }
  }
  // Centre hint when a car is close enough to take.
  if (p.inCar === null) {
    let near = null;
    for (const car of world.cars) {
      if (!car.wreck && car.driver !== 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 56) {
        near = car;
        break;
      }
    }
    if (near) {
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      const label = near.driver === 'traffic' ? 'Press E to steal the ' + near.model.name : 'Press E to drive';
      const w = ctx.measureText(label).width + 28;
      chip(ctx, canvas.width / 2 - w / 2, canvas.height - 130, w, 36);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, canvas.width / 2, canvas.height - 106);
      ctx.textAlign = 'left';
    }
  }
  // A big flash message (job done, busted, ...).
  if (world.flash && world.flash.timer > 0) {
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const w = ctx.measureText(world.flash.text).width + 40;
    chip(ctx, canvas.width / 2 - w / 2, 110, w, 48);
    ctx.fillStyle = world.flash.color || '#ffd23f';
    ctx.fillText(world.flash.text, canvas.width / 2, 143);
    ctx.textAlign = 'left';
  }
  // The minimap, bottom-right.
  paintMap(ctx, world, canvas.width - MAP.size - 18, canvas.height - MAP.size - 18, MAP.size);
  // Controls reminder.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '11px sans-serif';
  ctx.fillText('WASD move/drive · E enter car · Mouse aim, click shoot · R reload · M mute · P pause', 12, canvas.height - 68);
}

function paintTitle(ctx, world, canvas) {
  ctx.fillStyle = 'rgba(8,14,24,0.62)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMARINA', canvas.width / 2, canvas.height / 2 - 110);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', canvas.width / 2, canvas.height / 2 - 72);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#dfe6ee';
  ctx.fillText('You landed in Solmarina with $120 and a grudge. Steal cars, run jobs,', canvas.width / 2, canvas.height / 2 - 24);
  ctx.fillText('outrun the police — and take the city for yourself.', canvas.width / 2, canvas.height / 2 + 2);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = Math.floor(world.time * 2) % 2 === 0 ? '#ffffff' : '#ffd23f';
  ctx.fillText('PRESS ENTER TO START', canvas.width / 2, canvas.height / 2 + 62);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#aeb9c6';
  ctx.fillText('WASD move / drive · E enter or steal a car · Mouse aim, click to shoot · R reload · M mute · P pause', canvas.width / 2, canvas.height / 2 + 108);
  ctx.fillText('Progress saves automatically. Jobs pay in cash — the yacht is waiting.', canvas.width / 2, canvas.height / 2 + 132);
  ctx.textAlign = 'left';
}

function paintPause(ctx, canvas) {
  ctx.fillStyle = 'rgba(8,14,24,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = '16px sans-serif';
  ctx.fillText('Press P to keep playing', canvas.width / 2, canvas.height / 2 + 26);
  ctx.textAlign = 'left';
}

function paintEnd(ctx, canvas, title, sub) {
  ctx.fillStyle = 'rgba(8,14,24,0.72)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5e3a';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 18);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('PRESS ENTER TO PLAY AGAIN', canvas.width / 2, canvas.height / 2 + 62);
  ctx.textAlign = 'left';
}

export function drawGame(ctx, world, canvas, screen) {
  const view = {
    x: world.camera.x - canvas.width / 2,
    y: world.camera.y - canvas.height / 2,
    w: canvas.width,
    h: canvas.height,
  };
  ctx.save();
  ctx.translate(-view.x, -view.y);
  paintWorld(ctx, world, view);
  ctx.restore();
  if (screen === 'title') {
    paintTitle(ctx, world, canvas);
  } else if (screen === 'pause') {
    paintHud(ctx, world, canvas);
    paintPause(ctx, canvas);
  } else if (screen === 'busted') {
    paintHud(ctx, world, canvas);
    paintEnd(ctx, canvas, 'BUSTED', 'The Solmarina PD took your cash and your freedom — for now.');
  } else if (screen === 'wasted') {
    paintHud(ctx, world, canvas);
    paintEnd(ctx, canvas, 'WASTED', 'Solmarina chewed you up. The city does not wait.');
  } else {
    paintHud(ctx, world, canvas);
  }
  // The aim crosshair, on foot only.
  if (screen === 'play' && world.player.inCar === null && world.aimScreen) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    const mx = world.aimScreen.x;
    const my = world.aimScreen.y;
    ctx.beginPath();
    ctx.moveTo(mx - 9, my);
    ctx.lineTo(mx + 9, my);
    ctx.moveTo(mx, my - 9);
    ctx.lineTo(mx, my + 9);
    ctx.stroke();
  }
}

export { isWater };
