// Deterministic dice for Solmarina: an sfc32 stream seeded per game, so the
// city, the traffic and every screenshot are identical for the same seed,
// while a fresh game still feels different. Nothing here touches Math.random,
// which would break that promise.

export function seededRandom(seed) {
  let a = seed >>> 0;
  let b = (seed ^ 0x9e3779b9) >>> 0;
  let c = (seed * 2654435761) >>> 0;
  let counter = 1;

  function unit() {
    const t = (a + b + counter) >>> 0;
    counter = (counter + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) >>> 0;
    return (t >>> 0) / 4294967296;
  }

  return {
    unit,
    between(low, high) {
      return low + unit() * (high - low);
    },
    whole(low, high) {
      return low + Math.floor(unit() * (high - low + 1));
    },
    from(list) {
      return list[Math.floor(unit() * list.length)];
    },
    maybe(probability) {
      return unit() < probability;
    },
  };
}
