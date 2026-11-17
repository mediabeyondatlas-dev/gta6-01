// Keyboard and mouse state for Solmarina. The game reads held keys every
// frame, and the just-pressed edges for one-shot actions (enter a car,
// reload, pause). Edges clear at the end of each frame so they fire once.

export function makeInput() {
  const heldKeys = new Set();
  const freshKeys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function keyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) freshKeys.add(event.code);
    heldKeys.add(event.code);
  }

  function keyUp(event) {
    heldKeys.delete(event.code);
  }

  function mouseMove(event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }

  function mouseDown(event) {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }

  function mouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('mousemove', mouseMove);
  window.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);

  return {
    mouse,
    held(code) {
      return heldKeys.has(code);
    },
    axis(neg, pos) {
      return (heldKeys.has(pos) ? 1 : 0) - (heldKeys.has(neg) ? 1 : 0);
    },
    wasPressed(code) {
      return freshKeys.has(code);
    },
    /** Call at the end of each frame so edges fire once. */
    endFrame() {
      freshKeys.clear();
      mouse.clicked = false;
    },
  };
}
