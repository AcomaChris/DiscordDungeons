// --- ObjectCreationWizard ---
// 4-step modal for creating new object definitions:
// Step 0: Select tiles on the tileset canvas
// Step 1: Basic info (name, ID, category, surface, tags)
// Step 2: Collision setup (add/edit colliders with preview)
// Step 3: Review and create

import {
  OBJECT_CATEGORIES,
  COLLISION_SHAPES,
  COLLISION_TYPES,
  OBJECT_DEFAULTS,
} from '../map/object-def-schema.js';
import { TILE_SURFACES } from '../map/tile-metadata-schema.js';

const TILE_SIZE = 16;
const STEP_LABELS = ['Tiles', 'Info', 'Collision', 'Review'];

export class ObjectCreationWizard {
  constructor(canvasComponent) {
    this.canvasComponent = canvasComponent;

    this._step = 0;
    this._tileSelection = null;
    this._basicInfo = { id: '', name: '', category: 'decoration', description: '', surface: 'stone', tags: [] };
    this._colliders = [];
    this._existingIds = new Set();
    this._drawingCollider = null; // { targetIndex, startX?, startY?, currentX?, currentY?, dragging? }

    // Callbacks
    this.onComplete = null;
    this.onCancel = null;

    // DOM
    this._overlay = null;
    this._dialog = null;
    this._contentEl = null;
    this._stepsEl = null;
    this._prevBtn = null;
    this._nextBtn = null;

    // Floating panel for step 0 (tile selection)
    this._floatingPanel = null;
  }

  setExistingIds(ids) {
    this._existingIds = new Set(ids);
  }

  open() {
    this._step = 0;
    this._tileSelection = null;
    this._basicInfo = { id: '', name: '', category: 'decoration', description: '', surface: 'stone', tags: [] };
    this._colliders = [];
    this._drawingCollider = null;
    this._show();
  }

  close() {
    this.canvasComponent.exitWizardMode();
    this._removeOverlay();
    this._removeFloatingPanel();
  }

  // --- Show/hide ---

  _show() {
    this._renderStep();
  }

  _removeOverlay() {
    if (this._overlay && this._overlay.parentElement) {
      this._overlay.remove();
    }
    this._overlay = null;
  }

  _removeFloatingPanel() {
    if (this._floatingPanel && this._floatingPanel.parentElement) {
      this._floatingPanel.remove();
    }
    this._floatingPanel = null;
  }

  // --- Step rendering ---

  _renderStep() {
    if (this._step === 0) {
      this._renderTileStep();
    } else {
      this._renderModalStep();
    }
  }

  // --- Step 0: Tile Selection (floating panel, not modal) ---

  _renderTileStep() {
    this._removeOverlay();
    this._removeFloatingPanel();

    // Enter wizard mode on canvas
    this.canvasComponent.enterWizardMode();

    // Save existing callback and intercept
    this._origWizardSelect = this.canvasComponent.onWizardSelect;
    this.canvasComponent.onWizardSelect = (info) => this._onTilesSelected(info);

    // Floating instruction panel at top of canvas
    const panel = document.createElement('div');
    panel.className = 'wizard-floating-panel';

    const title = document.createElement('div');
    title.className = 'wizard-floating-title';
    title.textContent = 'New Object — Step 1: Select Tiles';
    panel.appendChild(title);

    const instructions = document.createElement('div');
    instructions.className = 'wizard-floating-instructions';
    instructions.textContent = 'Click and drag on the tileset to select the tiles for your object.';
    panel.appendChild(instructions);

    // Preview area (shown after selection)
    this._tilePreviewEl = document.createElement('div');
    this._tilePreviewEl.className = 'wizard-floating-preview';
    panel.appendChild(this._tilePreviewEl);

    // Buttons
    const btns = document.createElement('div');
    btns.className = 'wizard-floating-btns';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.close());
    btns.appendChild(cancelBtn);

    this._tileNextBtn = document.createElement('button');
    this._tileNextBtn.className = 'btn btn-primary';
    this._tileNextBtn.textContent = 'Next';
    this._tileNextBtn.disabled = !this._tileSelection;
    this._tileNextBtn.addEventListener('click', () => {
      if (!this._tileSelection) return;
      this.canvasComponent.exitWizardMode();
      this.canvasComponent.onWizardSelect = this._origWizardSelect;
      this._step = 1;
      this._renderStep();
    });
    btns.appendChild(this._tileNextBtn);

    panel.appendChild(btns);

    // Insert floating panel into canvas panel
    const canvasPanel = this.canvasComponent.canvas.parentElement;
    if (canvasPanel) {
      canvasPanel.style.position = 'relative';
      canvasPanel.appendChild(panel);
    }

    this._floatingPanel = panel;

    if (this._tileSelection) {
      this._updateTilePreview();
    }
  }

  _onTilesSelected(info) {
    this._tileSelection = info;
    // Auto-generate ID from position
    if (!this._basicInfo.id) {
      this._basicInfo.id = `obj_${info.originCol}_${info.originRow}`;
    }
    this._updateTilePreview();
    if (this._tileNextBtn) this._tileNextBtn.disabled = false;
  }

  _updateTilePreview() {
    if (!this._tilePreviewEl || !this._tileSelection) return;
    this._tilePreviewEl.innerHTML = '';

    const { cols, rows, tiles } = this._tileSelection;
    const scale = 3;

    const canvas = document.createElement('canvas');
    canvas.width = cols * TILE_SIZE * scale;
    canvas.height = rows * TILE_SIZE * scale;
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let r = 0; r < tiles.length; r++) {
      for (let c = 0; c < tiles[r].length; c++) {
        const tileCanvas = this.canvasComponent.getTileImageData(tiles[r][c]);
        if (tileCanvas) {
          ctx.drawImage(tileCanvas, c * TILE_SIZE * scale, r * TILE_SIZE * scale, TILE_SIZE * scale, TILE_SIZE * scale);
        }
      }
    }

    const label = document.createElement('div');
    label.style.fontSize = '0.8rem';
    label.style.color = '#c0c0e0';
    label.textContent = `Selected: ${cols}\u00d7${rows} (${cols * rows} tiles)`;

    this._tilePreviewEl.append(canvas, label);
  }

  // --- Steps 1-3: Modal dialog ---

  _renderModalStep() {
    this._removeFloatingPanel();

    if (!this._overlay) {
      this._buildModal();
      document.body.appendChild(this._overlay);
    }

    this._updateStepIndicators();
    this._contentEl.innerHTML = '';

    switch (this._step) {
      case 1: this._renderBasicStep(); break;
      case 2: this._renderCollisionStep(); break;
      case 3: this._renderReviewStep(); break;
    }

    this._updateNavButtons();
  }

  _buildModal() {
    // Overlay
    this._overlay = document.createElement('div');
    this._overlay.className = 'wizard-overlay';

    // Dialog
    this._dialog = document.createElement('div');
    this._dialog.className = 'wizard-dialog';

    // Header
    const header = document.createElement('div');
    header.className = 'wizard-header';
    const h3 = document.createElement('h3');
    h3.textContent = 'New Object';
    header.appendChild(h3);
    this._dialog.appendChild(header);

    // Step indicators
    this._stepsEl = document.createElement('div');
    this._stepsEl.className = 'wizard-steps';
    for (let i = 0; i < STEP_LABELS.length; i++) {
      const step = document.createElement('div');
      step.className = 'wizard-step-indicator';
      step.textContent = `${i + 1}. ${STEP_LABELS[i]}`;
      this._stepsEl.appendChild(step);
    }
    this._dialog.appendChild(this._stepsEl);

    // Content area
    this._contentEl = document.createElement('div');
    this._contentEl.className = 'wizard-content';
    this._dialog.appendChild(this._contentEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'wizard-footer';

    const leftBtns = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.close());
    leftBtns.appendChild(cancelBtn);
    footer.appendChild(leftBtns);

    const rightBtns = document.createElement('div');
    rightBtns.style.display = 'flex';
    rightBtns.style.gap = '8px';

    this._prevBtn = document.createElement('button');
    this._prevBtn.className = 'btn';
    this._prevBtn.textContent = 'Back';
    this._prevBtn.addEventListener('click', () => {
      if (this._step > 0) {
        this._step--;
        this._renderStep();
      }
    });
    rightBtns.appendChild(this._prevBtn);

    this._nextBtn = document.createElement('button');
    this._nextBtn.className = 'btn btn-primary';
    this._nextBtn.addEventListener('click', () => this._onNextClick());
    rightBtns.appendChild(this._nextBtn);

    footer.appendChild(rightBtns);
    this._dialog.appendChild(footer);
    this._overlay.appendChild(this._dialog);
  }

  _updateStepIndicators() {
    const steps = this._stepsEl.querySelectorAll('.wizard-step-indicator');
    steps.forEach((el, i) => {
      el.classList.toggle('active', i === this._step);
      el.classList.toggle('completed', i < this._step);
    });
  }

  _updateNavButtons() {
    if (this._prevBtn) {
      this._prevBtn.style.display = this._step > 1 ? '' : 'none';
    }
    if (this._nextBtn) {
      if (this._step === 3) {
        this._nextBtn.textContent = 'Create';
      } else {
        this._nextBtn.textContent = 'Next';
      }
    }
  }

  _onNextClick() {
    if (this._step === 1) {
      // Validate basic info
      const id = this._basicInfo.id.trim().replace(/\s+/g, '_');
      if (!id) {
        alert('ID is required.');
        return;
      }
      if (this._existingIds.has(id)) {
        alert(`Object "${id}" already exists.`);
        return;
      }
      if (!this._basicInfo.name.trim()) {
        alert('Name is required.');
        return;
      }
      this._basicInfo.id = id;
    }

    if (this._step < 3) {
      this._step++;
      this._renderStep();
    } else {
      this._complete();
    }
  }

  // --- Step 1: Basic Info ---

  _renderBasicStep() {
    const c = this._contentEl;

    // Name
    c.appendChild(this._makeField('Name', 'text', this._basicInfo.name, (val) => {
      this._basicInfo.name = val;
      // Auto-slug ID from name if user hasn't manually edited it
      const slugged = val.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (slugged) this._basicInfo.id = slugged;
      const idInput = c.querySelector('[data-field="id"]');
      if (idInput) idInput.value = this._basicInfo.id;
    }));

    // ID
    const idField = this._makeField('ID', 'text', this._basicInfo.id, (val) => {
      this._basicInfo.id = val.trim().replace(/\s+/g, '_');
    });
    idField.querySelector('input').dataset.field = 'id';
    c.appendChild(idField);

    // Category
    c.appendChild(this._makeSelectField('Category', OBJECT_CATEGORIES, this._basicInfo.category, (val) => {
      this._basicInfo.category = val;
    }));

    // Surface
    c.appendChild(this._makeSelectField('Surface', TILE_SURFACES, this._basicInfo.surface, (val) => {
      this._basicInfo.surface = val;
    }));

    // Description
    c.appendChild(this._makeTextarea('Description', this._basicInfo.description, (val) => {
      this._basicInfo.description = val;
    }));

    // Tags
    c.appendChild(this._makeTagsField('Tags', this._basicInfo.tags, (tags) => {
      this._basicInfo.tags = tags;
    }));
  }

  // --- Step 2: Collision ---

  _renderCollisionStep() {
    const c = this._contentEl;
    c.innerHTML = '';

    // Object preview with colliders (supports draw mode)
    const previewWrapper = this._renderCollisionPreview();
    c.appendChild(previewWrapper);

    // Preset buttons
    const presets = document.createElement('div');
    presets.style.display = 'flex';
    presets.style.gap = '6px';
    presets.style.marginBottom = '8px';

    const { cols, rows } = this._tileSelection;
    const pw = cols * TILE_SIZE;
    const ph = rows * TILE_SIZE;

    const presetDefs = [
      { label: 'Full', x: 0, y: 0, width: pw, height: ph },
      { label: 'Bottom Half', x: 0, y: Math.round(ph / 2), width: pw, height: Math.round(ph / 2) },
      { label: 'Center', x: Math.round(pw * 0.25), y: Math.round(ph * 0.25), width: Math.round(pw * 0.5), height: Math.round(ph * 0.5) },
    ];
    for (const preset of presetDefs) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = preset.label;
      btn.style.fontSize = '0.7rem';
      btn.addEventListener('click', () => {
        this._colliders.push({
          id: `collider_${this._colliders.length}`,
          shape: 'rect',
          type: 'solid',
          x: preset.x,
          y: preset.y,
          width: preset.width,
          height: preset.height,
          elevation: 0,
          stretchable: false,
        });
        this._renderCollisionStep();
      });
      presets.appendChild(btn);
    }
    c.appendChild(presets);

    // Add collider / Draw collider buttons
    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.gap = '6px';
    actionRow.style.marginBottom = '8px';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.textContent = '+ Add Collider';
    addBtn.addEventListener('click', () => {
      this._colliders.push({
        id: `collider_${this._colliders.length}`,
        shape: 'rect',
        type: 'solid',
        x: 0,
        y: 0,
        width: pw,
        height: ph,
        elevation: 0,
        stretchable: false,
      });
      this._renderCollisionStep();
    });
    actionRow.appendChild(addBtn);

    const drawBtn = document.createElement('button');
    drawBtn.className = this._drawingCollider ? 'btn btn-danger' : 'btn';
    drawBtn.textContent = this._drawingCollider ? 'Cancel Draw' : 'Draw Collider';
    drawBtn.addEventListener('click', () => {
      if (this._drawingCollider) {
        this._drawingCollider = null;
        this._renderCollisionStep();
      } else {
        this._drawingCollider = { targetIndex: -1 };
        this._renderCollisionStep();
      }
    });
    actionRow.appendChild(drawBtn);

    c.appendChild(actionRow);

    // Collider cards
    for (let i = 0; i < this._colliders.length; i++) {
      c.appendChild(this._makeColliderCard(i));
    }

    if (this._colliders.length === 0) {
      const hint = document.createElement('div');
      hint.style.color = '#7a7aaa';
      hint.style.fontSize = '0.8rem';
      hint.style.fontStyle = 'italic';
      hint.style.marginTop = '8px';
      hint.textContent = 'No colliders. You can add them now or later in the property panel.';
      c.appendChild(hint);
    }
  }

  _renderCollisionPreview() {
    if (!this._tileSelection) return document.createElement('div');

    const { cols, rows } = this._tileSelection;
    const scale = 4;
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '12px';
    wrapper.style.position = 'relative';

    const canvas = document.createElement('canvas');
    canvas.width = cols * TILE_SIZE * scale;
    canvas.height = rows * TILE_SIZE * scale;
    canvas.style.imageRendering = 'pixelated';
    canvas.style.border = this._drawingCollider ? '1px solid #00ccff' : '1px solid #2a2a4a';
    canvas.style.maxWidth = '100%';
    canvas.style.cursor = this._drawingCollider ? 'crosshair' : 'default';

    // Store references for in-place redraw
    this._collisionCanvas = canvas;
    this._collisionScale = scale;

    this._redrawCollisionCanvas();

    // --- Draw mode mouse handlers ---
    canvas.addEventListener('mousedown', (e) => {
      if (!this._drawingCollider) return;
      const rect = canvas.getBoundingClientRect();
      const displayScale = canvas.width / rect.width;
      const px = (e.clientX - rect.left) * displayScale / scale;
      const py = (e.clientY - rect.top) * displayScale / scale;
      this._drawingCollider.startX = Math.round(px);
      this._drawingCollider.startY = Math.round(py);
      this._drawingCollider.currentX = this._drawingCollider.startX;
      this._drawingCollider.currentY = this._drawingCollider.startY;
      this._drawingCollider.dragging = true;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this._drawingCollider?.dragging) return;
      const rect = canvas.getBoundingClientRect();
      const displayScale = canvas.width / rect.width;
      const px = (e.clientX - rect.left) * displayScale / scale;
      const py = (e.clientY - rect.top) * displayScale / scale;
      this._drawingCollider.currentX = Math.round(px);
      this._drawingCollider.currentY = Math.round(py);
      this._redrawCollisionCanvas();
    });

    canvas.addEventListener('mouseup', () => {
      if (!this._drawingCollider?.dragging) return;
      const { startX, startY, currentX, currentY, targetIndex } = this._drawingCollider;
      const x = Math.max(0, Math.min(startX, currentX));
      const y = Math.max(0, Math.min(startY, currentY));
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);

      // Ignore tiny drags (likely accidental clicks)
      if (w < 2 && h < 2) {
        this._drawingCollider.dragging = false;
        return;
      }

      // Clamp to object bounds
      const maxW = cols * TILE_SIZE;
      const maxH = rows * TILE_SIZE;
      const cx = Math.min(x, maxW);
      const cy = Math.min(y, maxH);
      const cw = Math.min(w, maxW - cx);
      const ch = Math.min(h, maxH - cy);

      if (targetIndex >= 0 && targetIndex < this._colliders.length) {
        // Redraw existing collider bounds
        this._colliders[targetIndex].x = cx;
        this._colliders[targetIndex].y = cy;
        this._colliders[targetIndex].width = cw;
        this._colliders[targetIndex].height = ch;
      } else {
        // Create new collider
        this._colliders.push({
          id: `collider_${this._colliders.length}`,
          shape: 'rect',
          type: 'solid',
          x: cx, y: cy, width: cw, height: ch,
          elevation: 0,
          stretchable: false,
        });
      }

      this._drawingCollider = null;
      this._renderCollisionStep();
    });

    // Draw mode hint
    if (this._drawingCollider) {
      const hint = document.createElement('div');
      hint.style.fontSize = '0.75rem';
      hint.style.color = '#00ccff';
      hint.style.marginTop = '4px';
      hint.textContent = this._drawingCollider.targetIndex >= 0
        ? `Draw to redefine collider bounds (collider_${this._drawingCollider.targetIndex})`
        : 'Click and drag on the preview to draw a collision rectangle';
      wrapper.appendChild(hint);
    }

    wrapper.insertBefore(canvas, wrapper.firstChild);
    return wrapper;
  }

  _redrawCollisionCanvas() {
    const canvas = this._collisionCanvas;
    if (!canvas || !this._tileSelection) return;

    const { tiles } = this._tileSelection;
    const scale = this._collisionScale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw tiles
    for (let r = 0; r < tiles.length; r++) {
      for (let c = 0; c < tiles[r].length; c++) {
        const tileCanvas = this.canvasComponent.getTileImageData(tiles[r][c]);
        if (tileCanvas) {
          ctx.drawImage(tileCanvas, c * TILE_SIZE * scale, r * TILE_SIZE * scale, TILE_SIZE * scale, TILE_SIZE * scale);
        }
      }
    }

    // Draw existing colliders
    for (const collider of this._colliders) {
      ctx.strokeStyle = collider.type === 'solid' ? '#ff4444' : '#44ff44';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(collider.x * scale, collider.y * scale, collider.width * scale, collider.height * scale);
      ctx.setLineDash([]);

      // Semi-transparent fill
      ctx.fillStyle = collider.type === 'solid' ? 'rgba(255, 68, 68, 0.15)' : 'rgba(68, 255, 68, 0.15)';
      ctx.fillRect(collider.x * scale, collider.y * scale, collider.width * scale, collider.height * scale);

      // Label
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(collider.id, collider.x * scale + 2, collider.y * scale - 3);
    }

    // Draw in-progress drag rectangle
    if (this._drawingCollider?.dragging) {
      const { startX, startY, currentX, currentY } = this._drawingCollider;
      const dx = Math.min(startX, currentX) * scale;
      const dy = Math.min(startY, currentY) * scale;
      const dw = Math.abs(currentX - startX) * scale;
      const dh = Math.abs(currentY - startY) * scale;

      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(dx, dy, dw, dh);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0, 204, 255, 0.2)';
      ctx.fillRect(dx, dy, dw, dh);

      // Dimensions label
      const w = Math.abs(currentX - startX);
      const h = Math.abs(currentY - startY);
      if (w > 4 || h > 4) {
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#00ccff';
        ctx.fillText(`${w}×${h}`, dx + 2, dy - 3 > 10 ? dy - 3 : dy + 12);
      }
    }
  }

  _makeColliderCard(index) {
    const c = this._colliders[index];
    const card = document.createElement('div');
    card.className = 'item-card';

    // Header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'item-card-header';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = c.id || `Collider ${index}`;
    cardHeader.appendChild(title);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      this._colliders.splice(index, 1);
      this._renderCollisionStep();
    });
    cardHeader.appendChild(removeBtn);
    card.appendChild(cardHeader);

    // Fields
    card.appendChild(this._makeField('ID', 'text', c.id, (val) => {
      c.id = val;
      this._renderCollisionStep();
    }));

    const row1 = document.createElement('div');
    row1.className = 'inline-fields';
    row1.appendChild(this._makeSelectField('Shape', COLLISION_SHAPES, c.shape, (val) => {
      c.shape = val;
    }));
    row1.appendChild(this._makeSelectField('Type', COLLISION_TYPES, c.type, (val) => {
      c.type = val;
      this._renderCollisionStep();
    }));
    card.appendChild(row1);

    // Bounds row with Draw button
    const boundsHeader = document.createElement('div');
    boundsHeader.style.display = 'flex';
    boundsHeader.style.justifyContent = 'space-between';
    boundsHeader.style.alignItems = 'center';
    boundsHeader.style.marginBottom = '4px';

    const boundsLabel = document.createElement('label');
    boundsLabel.textContent = 'Bounds';
    boundsLabel.style.fontSize = '0.75rem';
    boundsLabel.style.color = '#7a7aaa';
    boundsLabel.style.textTransform = 'uppercase';
    boundsLabel.style.letterSpacing = '0.03em';
    boundsHeader.appendChild(boundsLabel);

    const drawBoundsBtn = document.createElement('button');
    const isDrawingThis = this._drawingCollider?.targetIndex === index;
    drawBoundsBtn.className = isDrawingThis ? 'btn btn-danger' : 'btn';
    drawBoundsBtn.textContent = isDrawingThis ? 'Cancel' : 'Draw';
    drawBoundsBtn.style.fontSize = '0.65rem';
    drawBoundsBtn.style.padding = '1px 6px';
    drawBoundsBtn.addEventListener('click', () => {
      if (isDrawingThis) {
        this._drawingCollider = null;
      } else {
        this._drawingCollider = { targetIndex: index };
      }
      this._renderCollisionStep();
    });
    boundsHeader.appendChild(drawBoundsBtn);
    card.appendChild(boundsHeader);

    const row2 = document.createElement('div');
    row2.className = 'inline-fields';
    row2.appendChild(this._makeNumberField('X', c.x, (val) => {
      c.x = val;
      this._renderCollisionStep();
    }));
    row2.appendChild(this._makeNumberField('Y', c.y, (val) => {
      c.y = val;
      this._renderCollisionStep();
    }));
    card.appendChild(row2);

    const row3 = document.createElement('div');
    row3.className = 'inline-fields';
    row3.appendChild(this._makeNumberField('Width', c.width, (val) => {
      c.width = val;
      this._renderCollisionStep();
    }, 1));
    row3.appendChild(this._makeNumberField('Height', c.height, (val) => {
      c.height = val;
      this._renderCollisionStep();
    }, 1));
    card.appendChild(row3);

    const row4 = document.createElement('div');
    row4.className = 'inline-fields';
    row4.appendChild(this._makeNumberField('Elevation', c.elevation, (val) => {
      c.elevation = val;
    }, 0));
    row4.appendChild(this._makeCheckboxField('Stretchable', c.stretchable, (val) => {
      c.stretchable = val;
    }));
    card.appendChild(row4);

    return card;
  }

  // --- Step 3: Review ---

  _renderReviewStep() {
    const c = this._contentEl;

    // Object preview
    if (this._tileSelection) {
      const { cols, rows, tiles } = this._tileSelection;
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = cols * TILE_SIZE * scale;
      canvas.height = rows * TILE_SIZE * scale;
      canvas.style.imageRendering = 'pixelated';
      canvas.style.border = '1px solid #2a2a4a';
      canvas.style.marginBottom = '12px';
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      for (let r = 0; r < tiles.length; r++) {
        for (let cc = 0; cc < tiles[r].length; cc++) {
          const tileCanvas = this.canvasComponent.getTileImageData(tiles[r][cc]);
          if (tileCanvas) {
            ctx.drawImage(tileCanvas, cc * TILE_SIZE * scale, r * TILE_SIZE * scale, TILE_SIZE * scale, TILE_SIZE * scale);
          }
        }
      }
      c.appendChild(canvas);
    }

    // Summary table
    const table = document.createElement('div');
    table.className = 'wizard-review';

    const rows = [
      ['ID', this._basicInfo.id],
      ['Name', this._basicInfo.name],
      ['Category', this._basicInfo.category],
      ['Surface', this._basicInfo.surface],
      ['Size', this._tileSelection ? `${this._tileSelection.cols}\u00d7${this._tileSelection.rows}` : '-'],
      ['Tags', this._basicInfo.tags.length > 0 ? this._basicInfo.tags.join(', ') : 'none'],
      ['Colliders', `${this._colliders.length}`],
    ];

    if (this._basicInfo.description) {
      rows.splice(2, 0, ['Description', this._basicInfo.description]);
    }

    for (const [label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'wizard-review-row';

      const lbl = document.createElement('span');
      lbl.className = 'wizard-review-label';
      lbl.textContent = label;

      const val = document.createElement('span');
      val.className = 'wizard-review-value';
      val.textContent = value;

      row.append(lbl, val);
      table.appendChild(row);
    }

    c.appendChild(table);

    // ID collision warning
    if (this._existingIds.has(this._basicInfo.id)) {
      const warn = document.createElement('div');
      warn.className = 'validation-errors';
      warn.textContent = `An object with ID "${this._basicInfo.id}" already exists. Go back and change the ID.`;
      c.appendChild(warn);
    }
  }

  // --- Complete ---

  _complete() {
    const id = this._basicInfo.id.trim().replace(/\s+/g, '_');
    if (this._existingIds.has(id)) {
      alert(`Object "${id}" already exists.`);
      return;
    }

    const def = {
      ...structuredClone(OBJECT_DEFAULTS),
      id,
      name: this._basicInfo.name.trim(),
      category: this._basicInfo.category,
      surface: this._basicInfo.surface,
      tags: [...this._basicInfo.tags],
      grid: {
        cols: this._tileSelection.cols,
        rows: this._tileSelection.rows,
        tiles: this._tileSelection.tiles,
      },
      colliders: structuredClone(this._colliders),
    };

    if (this._basicInfo.description.trim()) {
      def.description = this._basicInfo.description.trim();
    }

    if (this.onComplete) this.onComplete(def);
    this.close();
  }

  // --- DOM builders ---

  _makeField(label, type, value, onChange) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    if (onChange) {
      input.addEventListener('input', () => onChange(input.value));
    }
    group.appendChild(input);
    return group;
  }

  _makeSelectField(label, options, value, onChange) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    const select = document.createElement('select');
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    }
    select.value = value;
    if (onChange) {
      select.addEventListener('change', () => onChange(select.value));
    }
    group.appendChild(select);
    return group;
  }

  _makeNumberField(label, value, onChange, min, max, step) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    if (onChange) {
      input.addEventListener('change', () => onChange(parseFloat(input.value) || 0));
    }
    group.appendChild(input);
    return group;
  }

  _makeTextarea(label, value, onChange) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    const textarea = document.createElement('textarea');
    textarea.rows = 2;
    textarea.value = value;
    if (onChange) {
      textarea.addEventListener('input', () => onChange(textarea.value));
    }
    group.appendChild(textarea);
    return group;
  }

  _makeCheckboxField(label, checked, onChange) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const row = document.createElement('div');
    row.className = 'checkbox-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    const span = document.createElement('span');
    span.textContent = label;
    if (onChange) {
      input.addEventListener('change', () => onChange(input.checked));
    }
    row.append(input, span);
    group.appendChild(row);
    return group;
  }

  _makeTagsField(label, tags, onChange) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);

    const container = document.createElement('div');
    container.className = 'tags-container';
    for (const tag of tags) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${tag}<span class="tag-remove">\u00d7</span>`;
      chip.querySelector('.tag-remove').addEventListener('click', () => {
        const updated = tags.filter((t) => t !== tag);
        this._basicInfo.tags = updated;
        onChange(updated);
        // Re-render just the tags section
        group.replaceWith(this._makeTagsField(label, updated, onChange));
      });
      container.appendChild(chip);
    }
    group.appendChild(container);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add tag...';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = input.value.trim();
        if (val && !tags.includes(val)) {
          const updated = [...tags, val];
          this._basicInfo.tags = updated;
          onChange(updated);
          group.replaceWith(this._makeTagsField(label, updated, onChange));
        }
        input.value = '';
      }
    });
    group.appendChild(input);
    return group;
  }
}
