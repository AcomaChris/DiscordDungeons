// --- StatsTab ---
// Renders stat allocation UI inside the Player menu panel.
// Subscribes to STATS_CHANGED for live updates when points are spent.

import eventBus from '../core/EventBus.js';
import { STATS_CHANGED } from '../core/Events.js';
import { STAT_DEFS, STAT_IDS, STAT_MAX, DEX_UNLOCKS } from '../stats/StatDefs.js';
import statsManager from '../stats/StatsManager.js';

export class StatsTab {
  constructor(containerEl) {
    this._container = containerEl;
    this._onStatsChanged = () => this._render();
    eventBus.on(STATS_CHANGED, this._onStatsChanged);
    this._render();
  }

  destroy() {
    eventBus.off(STATS_CHANGED, this._onStatsChanged);
  }

  // --- Helpers ---

  _getUnlockDescription(statId, level) {
    if (statId === 'dexterity' && DEX_UNLOCKS[level]) {
      return DEX_UNLOCKS[level].description;
    }
    return 'Coming soon';
  }

  // --- Render ---

  _render() {
    this._container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'dd-stats';

    // Available points header
    const pointsEl = document.createElement('div');
    pointsEl.className = 'dd-stat-points';
    pointsEl.textContent = `Stat Points: ${statsManager.getPoints()}`;
    wrap.appendChild(pointsEl);

    // One row per stat
    for (const statId of STAT_IDS) {
      wrap.appendChild(this._buildStatRow(statId));
    }

    this._container.appendChild(wrap);
  }

  _buildStatRow(statId) {
    const def = STAT_DEFS[statId];
    const currentLevel = statsManager.getStat(statId);
    const hasPoints = statsManager.getPoints() > 0;

    // Wrapper for the row + any info/confirm panel that appears below
    const rowWrap = document.createElement('div');

    const row = document.createElement('div');
    row.className = 'dd-stat-row';

    // Label
    const label = document.createElement('div');
    label.className = 'dd-stat-label';
    label.textContent = def.label;
    row.appendChild(label);

    // Squares
    const squares = document.createElement('div');
    squares.className = 'dd-stat-squares';

    for (let i = 1; i <= STAT_MAX; i++) {
      const sq = document.createElement('div');
      sq.className = 'dd-stat-square';
      sq.style.setProperty('--stat-color', def.color);

      if (i <= currentLevel) {
        // Filled — already allocated
        sq.classList.add('filled');
        sq.style.backgroundColor = def.color;
        sq.addEventListener('click', () => {
          this._showInfo(rowWrap, statId, i);
        });
      } else if (i === currentLevel + 1) {
        // Next available level
        sq.style.borderColor = def.color + '88';
        if (hasPoints) {
          sq.classList.add('available');
          sq.addEventListener('click', () => {
            this._showConfirm(rowWrap, statId, i);
          });
        } else {
          sq.classList.add('locked');
        }
      } else {
        // Locked — beyond next level
        sq.classList.add('locked');
      }

      squares.appendChild(sq);
    }

    row.appendChild(squares);
    rowWrap.appendChild(row);
    return rowWrap;
  }

  // --- Info Panel (clicking a filled square) ---

  _showInfo(rowWrap, statId, level) {
    this._clearSubPanel(rowWrap);

    const info = document.createElement('div');
    info.className = 'dd-stat-info';
    info.dataset.subPanel = '1';
    info.textContent = `Level ${level}: ${this._getUnlockDescription(statId, level)}`;
    rowWrap.appendChild(info);
  }

  // --- Confirm Panel (clicking the next available square) ---

  _showConfirm(rowWrap, statId, level) {
    this._clearSubPanel(rowWrap);

    const def = STAT_DEFS[statId];
    const panel = document.createElement('div');
    panel.className = 'dd-stat-confirm';
    panel.dataset.subPanel = '1';

    const text = document.createElement('span');
    text.textContent = `Upgrade ${def.label} to ${level}? Unlocks: ${this._getUnlockDescription(statId, level)}`;
    panel.appendChild(text);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'confirm';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.addEventListener('click', () => {
      statsManager.upgrade(statId);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      this._clearSubPanel(rowWrap);
    });

    panel.append(confirmBtn, cancelBtn);
    rowWrap.appendChild(panel);
  }

  _clearSubPanel(rowWrap) {
    const existing = rowWrap.querySelector('[data-sub-panel]');
    if (existing) existing.remove();
  }
}
