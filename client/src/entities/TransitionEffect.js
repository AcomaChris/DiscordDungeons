// --- TransitionEffect ---
// Visual effects for player departure/arrival on map transitions.
// Uses Phaser graphics + tweens for a circle scale/fade animation.

const DURATION = 300; // ms
const RADIUS = 12;
const COLOR = 0xffffff;

export function playDepartureEffect(scene, x, y) {
  const gfx = scene.add.circle(x, y, RADIUS, COLOR, 0.6);
  gfx.setDepth(9999);

  scene.tweens.add({
    targets: gfx,
    scaleX: 2.5,
    scaleY: 2.5,
    alpha: 0,
    duration: DURATION,
    ease: 'Quad.easeOut',
    onComplete: () => gfx.destroy(),
  });
}

export function playArrivalEffect(scene, x, y) {
  const gfx = scene.add.circle(x, y, RADIUS * 2, COLOR, 0);
  gfx.setDepth(9999);

  scene.tweens.add({
    targets: gfx,
    scaleX: 0.5,
    scaleY: 0.5,
    alpha: 0.6,
    duration: DURATION,
    ease: 'Quad.easeIn',
    onComplete: () => {
      scene.tweens.add({
        targets: gfx,
        alpha: 0,
        duration: 150,
        onComplete: () => gfx.destroy(),
      });
    },
  });
}
