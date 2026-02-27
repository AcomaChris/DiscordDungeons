import Phaser from 'phaser';
import eventBus from '../core/EventBus.js';
import { SCENE_CHANGE } from '../core/Events.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    const { width, height } = this.scale;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.add
      .text(width / 2, height / 2 - 60, 'DiscordDungeons', {
        fontSize: '32px',
        color: '#00ccff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, isTouch ? 'Tap to start' : 'Press ENTER to start', {
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const startGame = () => {
      eventBus.emit(SCENE_CHANGE, { from: 'MainMenuScene', to: 'GameScene' });
      this.scene.start('GameScene');
    };

    this.input.keyboard.on('keydown-ENTER', startGame);
    this.input.on('pointerdown', startGame);
  }
}
