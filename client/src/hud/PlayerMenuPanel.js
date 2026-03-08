// --- PlayerMenuPanel ---
// Fullscreen overlay panel with tab navigation.
// First tab is Inventory; more tabs can be added later.

import { acquireInputFocus, releaseInputFocus } from '../core/InputContext.js';
import { InventoryTab } from './InventoryTab.js';
import { StatsTab } from './StatsTab.js';

export class PlayerMenuPanel {
  constructor(onClose) {
    this._onClose = onClose;
    this._backdrop = null;
    this._activeTab = null;
    this._tabContent = null;
  }

  open() {
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'dd-player-backdrop';
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) this.close();
    });

    const panel = document.createElement('div');
    panel.className = 'dd-player-panel';

    // --- Header with tabs + close ---
    const header = document.createElement('div');
    header.className = 'dd-player-header';

    const tabs = document.createElement('div');
    tabs.className = 'dd-player-tabs';

    const inventoryTab = document.createElement('button');
    inventoryTab.className = 'dd-player-tab active';
    inventoryTab.textContent = 'Inventory';
    inventoryTab.addEventListener('click', () => this._switchTab('inventory', inventoryTab));
    tabs.appendChild(inventoryTab);

    const statsTab = document.createElement('button');
    statsTab.className = 'dd-player-tab';
    statsTab.textContent = 'Stats';
    statsTab.addEventListener('click', () => this._switchTab('stats', statsTab));
    tabs.appendChild(statsTab);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'dd-player-close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => this.close());

    header.append(tabs, closeBtn);

    // --- Body ---
    this._tabContent = document.createElement('div');
    this._tabContent.className = 'dd-player-body';

    panel.append(header, this._tabContent);
    this._backdrop.appendChild(panel);
    document.body.appendChild(this._backdrop);

    acquireInputFocus();
    this._switchTab('inventory', inventoryTab);
  }

  _switchTab(tabName, tabBtn) {
    // Update active tab button
    const tabs = this._backdrop.querySelectorAll('.dd-player-tab');
    tabs.forEach(t => t.classList.remove('active'));
    tabBtn.classList.add('active');

    // Destroy current tab content
    if (this._activeTab && this._activeTab.destroy) {
      this._activeTab.destroy();
    }
    this._tabContent.innerHTML = '';

    // Create new tab
    if (tabName === 'inventory') {
      this._activeTab = new InventoryTab(this._tabContent);
    } else if (tabName === 'stats') {
      this._activeTab = new StatsTab(this._tabContent);
    }
  }

  close() {
    if (this._activeTab && this._activeTab.destroy) {
      this._activeTab.destroy();
      this._activeTab = null;
    }
    if (this._backdrop) {
      this._backdrop.remove();
      this._backdrop = null;
    }
    releaseInputFocus();
    if (this._onClose) this._onClose();
  }
}
