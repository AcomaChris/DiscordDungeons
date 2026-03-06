// --- InteractionManager ---
// Detects when the player is near interactable objects, shows prompts,
// and dispatches interactions when the E key is pressed. Also handles
// touch and step triggers for objects that use them.
//
// AGENT: Requires ObjectManager for spatial queries and a player
// entity for position. Call update() every frame from GameScene.

import eventBus from '../core/EventBus.js';
import { OBJECT_INTERACT, OBJECT_TOUCH, OBJECT_STEP } from '../core/Events.js';
import { InteractionPrompt } from './InteractionPrompt.js';
import { ContainerUI } from './ContainerUI.js';

// Default proximity radius for interact-triggered objects (pixels)
const DEFAULT_INTERACT_RADIUS = 32;

// Touch/step overlap radius (smaller — requires closer proximity)
const DEFAULT_TOUCH_RADIUS = 12;

export class InteractionManager {
  constructor(objectManager, scene) {
    this._objectManager = objectManager;
    this._scene = scene;
    this._prompt = new InteractionPrompt();
    this._prompt.create(scene);
    this._containerUI = new ContainerUI(scene);

    // Currently targeted object (closest interactable in range)
    this._target = null;

    // Debounce interact so holding E doesn't fire every frame
    this._interactCooldown = 0;

    // Track which objects the player is currently overlapping for touch/step
    this._touchingObjects = new Set();
    this._steppingObjects = new Set();
  }

  // Called every frame from GameScene.update()
  update(delta, playerX, playerY, inputSnapshot) {
    this._interactCooldown = Math.max(0, this._interactCooldown - delta);

    // --- Find interact targets ---
    const nearby = this._objectManager.getObjectsInRadius(
      playerX, playerY, DEFAULT_INTERACT_RADIUS,
    );

    // Find closest object with an interact trigger
    let newTarget = null;
    for (const obj of nearby) {
      const interactComp = obj.components.getInteractTrigger();
      if (interactComp) {
        newTarget = obj;
        break; // Already sorted by distance
      }
    }

    // Update prompt visibility
    if (newTarget !== this._target) {
      this._target = newTarget;
      if (!newTarget) {
        this._prompt.hide();
      }
    }

    // Position prompt above target (world coordinates — Phaser handles camera)
    if (this._target) {
      this._prompt.show(
        this._target.centerX,
        this._target.y,
        this._target.promptText || '[E]',
      );
    }

    // --- Dispatch interact on E key ---
    if (inputSnapshot.interact && this._target && this._interactCooldown <= 0) {
      if (import.meta.env.DEV) console.debug(`[Interact] ${this._target.id}`);
      this._target.onInteract({ x: playerX, y: playerY });
      eventBus.emit(OBJECT_INTERACT, {
        objectId: this._target.id,
        playerX,
        playerY,
      });

      // Show/hide container UI if the target has a container component
      const containerComp = this._target.components.get('container');
      if (containerComp) {
        if (containerComp.isOpen) {
          this._containerUI.show(this._target);
        } else {
          this._containerUI.hide();
        }
      }

      // Cooldown prevents rapid-fire from held key
      this._interactCooldown = 300;
    }

    // Auto-close container UI when player walks away
    if (this._containerUI.isVisible && this._containerUI.activeObject !== this._target) {
      const activeComp = this._containerUI.activeObject?.components.get('container');
      if (activeComp?.isOpen) activeComp.close();
      this._containerUI.hide();
    }

    // --- Touch and Step triggers ---
    this._updateTouchAndStep(playerX, playerY);
  }

  _updateTouchAndStep(playerX, playerY) {
    const overlapping = this._objectManager.getObjectsInRadius(
      playerX, playerY, DEFAULT_TOUCH_RADIUS,
    );

    const currentTouching = new Set();
    const currentStepping = new Set();

    for (const obj of overlapping) {
      for (const comp of obj.components) {
        if (comp.trigger === 'touch') {
          currentTouching.add(obj.id);
          // Fire touch only on enter (not already touching)
          if (!this._touchingObjects.has(obj.id)) {
            if (import.meta.env.DEV) console.debug(`[Touch] ${obj.id}`);
            obj.onTouch({ x: playerX, y: playerY });
            eventBus.emit(OBJECT_TOUCH, { objectId: obj.id, playerX, playerY });
          }
        }
        if (comp.trigger === 'step') {
          currentStepping.add(obj.id);
          if (!this._steppingObjects.has(obj.id)) {
            if (import.meta.env.DEV) console.debug(`[Step] ${obj.id}`);
            obj.onStep({ x: playerX, y: playerY });
            eventBus.emit(OBJECT_STEP, { objectId: obj.id, playerX, playerY });
          }
        }
      }
    }

    this._touchingObjects = currentTouching;
    this._steppingObjects = currentStepping;
  }

  get currentTarget() {
    return this._target;
  }

  destroy() {
    this._prompt.destroy();
    this._containerUI.destroy();
    this._target = null;
    this._touchingObjects.clear();
    this._steppingObjects.clear();
  }
}
