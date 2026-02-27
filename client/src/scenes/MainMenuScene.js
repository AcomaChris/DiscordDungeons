import Phaser from 'phaser';
import eventBus from '../core/EventBus.js';
import { SCENE_CHANGE } from '../core/Events.js';
import authManager from '../auth/AuthManager.js';
import { isDiscordActivity } from '../discord/activitySdk.js';
import '../styles/login-ui.css';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
    this._loginContainer = null;
  }

  create() {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.2, 'DiscordDungeons', {
        fontSize: '32px',
        color: '#00ccff',
      })
      .setOrigin(0.5);

    if (authManager.isAuthenticated) {
      // Activity mode: skip menu, jump straight into the game
      if (isDiscordActivity) {
        this._startGame();
        return;
      }
      this._showWelcomeBack(width, height);
    } else {
      this._showLoginOptions();
    }
  }

  // --- Already authenticated (restored from session or OAuth just completed) ---

  _showWelcomeBack(width, height) {
    const name = authManager.identity.playerName;

    this.add
      .text(width / 2, height * 0.4, `Welcome, ${name}!`, {
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.add
      .text(width / 2, height * 0.55, isTouch ? 'Tap to start' : 'Press ENTER to start', {
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const startGame = () => this._startGame();
    this.input.keyboard.on('keydown-ENTER', startGame);
    this.input.on('pointerdown', startGame);
  }

  // --- Login options (Discord or Guest) ---

  _showLoginOptions() {
    this._loginContainer = document.createElement('div');
    this._loginContainer.id = 'login-ui';

    const discordBtn = document.createElement('button');
    discordBtn.textContent = 'Login with Discord';
    discordBtn.addEventListener('click', () => authManager.startDiscordLogin());

    const guestBtn = document.createElement('button');
    guestBtn.textContent = 'Play as Guest';
    guestBtn.addEventListener('click', () => this._showGuestInput());

    this._loginContainer.append(discordBtn, guestBtn);
    document.body.appendChild(this._loginContainer);
  }

  _showGuestInput() {
    this._loginContainer.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'guest-panel';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter your name';
    input.maxLength = 20;

    const goBtn = document.createElement('button');
    goBtn.textContent = 'Start Playing';
    goBtn.addEventListener('click', () => {
      const name = input.value.trim() || 'Guest';
      authManager.setGuestIdentity(name);
      this._cleanupLoginUI();
      this._startGame();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') goBtn.click();
      // Stop Phaser from capturing these keystrokes
      e.stopPropagation();
    });

    panel.append(input, goBtn);
    this._loginContainer.appendChild(panel);
    input.focus();
  }

  // --- Helpers ---

  _startGame() {
    this._cleanupLoginUI();
    eventBus.emit(SCENE_CHANGE, { from: 'MainMenuScene', to: 'GameScene' });
    this.scene.start('GameScene');
  }

  _cleanupLoginUI() {
    if (this._loginContainer) {
      this._loginContainer.remove();
      this._loginContainer = null;
    }
  }

  shutdown() {
    this._cleanupLoginUI();
  }
}
