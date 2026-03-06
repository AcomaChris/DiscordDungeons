import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MAP_TRANSITION_REQUEST } from '../../client/src/core/Events.js';

describe('MapTransitionManager', () => {
  let MapTransitionManager, eventBus;

  beforeEach(async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    eventBus = ebMod.default;
    eventBus.reset();

    const mod = await import('../../client/src/map/MapTransitionManager.js');
    MapTransitionManager = mod.MapTransitionManager;
  });

  function createMockScene() {
    return {
      _mapId: 'test',
      input: { keyboard: { enabled: true } },
      cameras: {
        main: {
          fade: vi.fn((_duration, _r, _g, _b, _force, callback) => {
            // Simulate immediate completion
            callback(null, 1);
          }),
        },
      },
      objectManager: { all: [] },
      scene: { restart: vi.fn() },
    };
  }

  it('calls camera.fade on transition request', () => {
    const scene = createMockScene();
    const mgr = new MapTransitionManager(scene);

    eventBus.emit(MAP_TRANSITION_REQUEST, { targetMap: 'test2', spawnTarget: 'entrance' });

    expect(scene.cameras.main.fade).toHaveBeenCalledWith(
      500, 0, 0, 0, false, expect.any(Function),
    );

    mgr.destroy();
  });

  it('restarts scene with mapId and spawnTarget', () => {
    const scene = createMockScene();
    const mgr = new MapTransitionManager(scene);

    eventBus.emit(MAP_TRANSITION_REQUEST, { targetMap: 'test2', spawnTarget: 'entrance' });

    expect(scene.scene.restart).toHaveBeenCalledWith({
      mapId: 'test2',
      spawnTarget: 'entrance',
    });

    mgr.destroy();
  });

  it('disables keyboard input during transition', () => {
    const scene = createMockScene();
    // Don't complete fade immediately so we can check input state
    scene.cameras.main.fade = vi.fn();
    const mgr = new MapTransitionManager(scene);

    eventBus.emit(MAP_TRANSITION_REQUEST, { targetMap: 'test2' });

    expect(scene.input.keyboard.enabled).toBe(false);

    mgr.destroy();
  });

  it('locked flag prevents double-transition', () => {
    const scene = createMockScene();
    const mgr = new MapTransitionManager(scene);

    eventBus.emit(MAP_TRANSITION_REQUEST, { targetMap: 'test2' });
    eventBus.emit(MAP_TRANSITION_REQUEST, { targetMap: 'test3' });

    // Only one fade + restart
    expect(scene.cameras.main.fade).toHaveBeenCalledTimes(1);
    expect(scene.scene.restart).toHaveBeenCalledTimes(1);
    expect(scene.scene.restart).toHaveBeenCalledWith(expect.objectContaining({ mapId: 'test2' }));

    mgr.destroy();
  });

  it('ignores request with null targetMap', () => {
    const scene = createMockScene();
    const mgr = new MapTransitionManager(scene);

    eventBus.emit(MAP_TRANSITION_REQUEST, { targetMap: null });

    expect(scene.cameras.main.fade).not.toHaveBeenCalled();

    mgr.destroy();
  });

  it('destroy unsubscribes from EventBus', () => {
    const scene = createMockScene();
    const mgr = new MapTransitionManager(scene);
    mgr.destroy();

    eventBus.emit(MAP_TRANSITION_REQUEST, { targetMap: 'test2' });

    expect(scene.cameras.main.fade).not.toHaveBeenCalled();
  });
});
