import Phaser from 'phaser';
import eventBus from '../core/EventBus.js';
import { SCENE_CHANGE } from '../core/Events.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 60, 'DiscordDungeons', {
        fontSize: '32px',
        color: '#00ccff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, 'Press ENTER to start', {
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.input.keyboard.on('keydown-ENTER', () => {
      eventBus.emit(SCENE_CHANGE, { from: 'MainMenuScene', to: 'GameScene' });
      this.scene.start('GameScene');
    });
  }
}
