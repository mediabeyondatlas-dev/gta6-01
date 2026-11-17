// Solmarina balance sheet. Every number the game tunes on lives in this one
// file, so rebalancing never means hunting through the simulation. Values are
// in world pixels and seconds; speeds are pixels per second.

export const WORLD = {
  extent: 3200,
  spacing: 400,
  width: 96,
  walk: 26,
};

export const SHORE = { sand: 2920, sea: 3080 };
export const GREEN = { x: 1400, y: 1400, w: 400, h: 400 };
export const CENTER = { x: 1200, y: 800, w: 800, h: 400 };

export const HERO = {
  radius: 13,
  walk: 235,
  run: 345,
  health: 100,
  punch: 12,
  gunDamage: 34,
  gunRange: 420,
  mag: 12,
  spare: 48,
  reload: 1.1,
  fireGap: 0.22,
};

export const RIDES = [
  { name: 'Brisa', paint: '#d95f4b', top: 560, pull: 420, turn: 3.4, hp: 100 },
  { name: 'Toro', paint: '#4b7fd9', top: 620, pull: 470, turn: 3.8, hp: 110 },
  { name: 'Cometa', paint: '#e0a83c', top: 500, pull: 380, turn: 3.0, hp: 170 },
  { name: 'Faro', paint: '#3cb371', top: 700, pull: 540, turn: 4.2, hp: 90 },
  { name: 'Nube', paint: '#c9c9c9', top: 660, pull: 500, turn: 4.0, hp: 100 },
  { name: 'Zorro', paint: '#9b59b6', top: 590, pull: 440, turn: 3.6, hp: 120 },
];

export const COP_CAR = { name: 'Halcon', paint: '#1c2733', top: 680, pull: 560, turn: 4.4, hp: 150 };

export const HEAT = {
  // How many cop units (cars plus foot cops) each wanted level fields, and
  // how fast heat fades when no cop can see the player.
  squad: [0, 2, 4, 6, 8, 10],
  cool: 0.045,
  bust: 2.2,
};

export const CROWD = { cars: 26, walkers: 42 };
export const CASH = { mission: 350, pickup: 120, parcel: 250 };

export const PAINT = {
  grass: '#79a95b',
  park: '#5f8f4c',
  sand: '#e6cf9a',
  sea: '#2b9ec4',
  deep: '#1d7ea6',
  road: '#3b404b',
  roadEdge: '#2b2f38',
  dashYellow: '#e8c84a',
  dashWhite: '#d8d8d8',
  pavement: '#b3ac9c',
  crossing: '#cfc9b8',
  roofs: ['#c96f4a', '#d9a05b', '#8fa8bf', '#b06a7a', '#7a9a7a', '#a89a6a', '#9a7ab0', '#5b7a8a', '#b5533c'],
  glass: '#7fb2d9',
  tree: '#4e7d3a',
  treeTop: '#6a9a4e',
  palm: '#3f7d46',
};

export const MAP = {
  size: 172,
  zoom: 0.052,
};
