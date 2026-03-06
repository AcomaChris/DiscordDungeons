# DiscordDungeons — Dev Log

Running log of development sessions. Updated each session to preserve context across machines and agents.

---

## 2026-03-05 — Phase 4 Stage 3: Lua Scripting with Wasmoon (v0.31.0)

- **Wasmoon over Fengari**: Chose Wasmoon (Lua 5.4 via WebAssembly, actively maintained) over fengari-web (unmaintained since 2018). ~500KB bundle addition but real Lua 5.4 support.
- **LuaEngine** (`client/src/scripting/LuaEngine.js`): Singleton wrapper around Wasmoon — async WASM init, doString, global injection, graceful error handling. One engine shared per scene.
- **LuaBindings** (`client/src/scripting/LuaBindings.js`): Game API injected into Lua — `self` (object state/emit), `world` (spatial queries), `timer` (delayed callbacks), `log`. Context-specific `self` set before each handler call.
- **ScriptComponent** (`client/src/scripting/ScriptComponent.js`): Component subclass with Lua lifecycle handlers (`on_init`, `on_interact`, `on_update`, `on_event`, `on_touch`, `on_step`). Scripts wrapped in unique function scopes for namespace isolation. Self-registers with ComponentRegistry.
- **Key gotcha**: Wasmoon maps JS `null` → Lua truthy userdata, but JS `undefined` → Lua `nil`. All "not found" returns must use `undefined`.
- **Script component def** added to ComponentDefs.js. Test map has a scripted object that counts interactions via Lua.
- 865 tests across 63 files, all passing. 36 new tests (LuaEngine: 14, LuaBindings: 11, ScriptComponent: 11).

---

## 2026-03-03 — Map Editor: Complete Toolset + Export/Import (v0.26.2)

**Commits:** 1cea19d → 98a9ae1 (9 commits)

- **Layer panel** (`LayerPanel.js`): Grouped by Floor/Structures/System, visibility toggles, opacity sliders, active layer selection, number key shortcuts (1-7). Special rendering for Collision (red X overlay) and Elevation (numbered blue tiles).
- **Full toolset**: Rectangle fill (drag-to-fill), flood fill (BFS with 10k safety limit), line tool (Bresenham), select/copy/paste/cut (rubber-band + Ctrl+C/V/X), multi-tile stamp brush. All tools produce undoable commands.
- **Object system**: ObjectPalette (searchable list with canvas thumbnails), ObjectTool (place/select/drag/delete), PropertyPanel (editable object properties). Auto-switches to object tool when palette item selected.
- **Export/Import**: Tiled 1.10 JSON export (bounding-box trimmed sparse layers → dense arrays, tileset refs, object groups). Import parses Tiled JSON back + auto-loads referenced tilesets. Ctrl+S shortcut. 19 unit tests with round-trip verification.
- **Polish**: Undo/Redo toolbar buttons, New Map with confirmation, Auto Collision button (scans tile metadata for `collision:'solid'` and populates Collision layer).
- **E2E tests**: 8 Playwright tests for map editor — page load, tool switching, keyboard shortcuts, floating panels, grid toggle, layer panel structure.
- 713 unit tests + 8 map editor e2e tests. All passing.

---

## 2026-03-03 — Animation-Aware Tileset Auto-Setup (v0.25.0)

- **TMX animation parser** (`scripts/parse-tmx-animations.js`): Parses 4 TMX files, extracts per-tileset animation data (142 entries on Animation_windows_doors, ~900 character animations). Detects bank structure (4 banks of 10 cols), identifies frame-only tiles, deduplicates across TMX files. Outputs 25 `.animations.json` files.
- **Batch auto-setup** (`scripts/auto-setup-objects.js`): Generates `.objects.json` for all 6 tilesets in one pass. Animation-aware: restricts pixel analysis to bank 0, excludes frame tiles, builds animation metadata with frame mappings. Preserves existing objects. Result: 682 total objects (528 new), 12 animated.
- **Animation in object defs**: Added `animation` field to schema with `startFrame` + frame array. Full validation in `validateObjectDef()` — frame consistency, tile key matching across frames, duration checks.
- **Frame scrubber in editor**: Animated objects show slider + prev/next buttons to preview animation frames. "Starting Frame" input persists to definition. Preview canvas swaps base tile indices for frame tile indices.
- **Bank-aware Auto-Detect**: `analyzeTileset()` accepts optional animation data — filters to bank 0 columns, excludes frame tiles, force-connects animation families. Tags groups with confidence level (high=animation-backed, medium=pixel-only).
- **Confidence badges**: Object list shows colored dots (green=high, yellow=medium) and animation indicator with frame count.

---

## 2026-03-03 — Tile Editor: Object Boundary Editing Tools (v0.22.0)

**Commits:** 8e0acf4

- **Merge tool**: Ctrl+click multi-select on canvas, property panel shows "Merge Objects" when 2+ selected. Combines all tiles into the primary object's grid, deletes consumed objects. Purple banner shows selection count.
- **Resize handles**: 8 drag handles (corners + edge midpoints) around selected object bounding box. Dragging grows/shrinks by adding/removing adjacent tileset tiles. Dashed preview rect during drag. Reuses existing `_onTileReassign` handler.
- **Split tool**: Toggle in property panel Grid section. Hover shows pink dashed split line inside object. Default vertical split, hold Alt for horizontal. Creates two objects — original keeps gridA, new `{id}_split` gets gridB with cloned properties but cleared colliders/nodes.
- All three tools complement Auto-Detect: detect first, then merge incorrect splits, resize boundaries, split over-grouped objects.

---

## 2026-03-02 — Tile Editor: Streamlined Object Annotation (v0.21.0)

**Commits:** 0f3aea1, c120307, 766adad, 6cf0cae

- **Browser-side pixel analysis** (`TilesetAnalyzer.js`): Ported `groupTiles.js` functions to browser Canvas API — tile transparency, edge distance, adjacency graph, BFS grouping. Added HSL color profiling and category classification heuristics (green → nature, brown/small → furniture, grey → structure, etc.). 27 unit tests.
- **Auto-enrichment** (`AutoEnricher.js`): Ported `enrich-object-defs.js` to browser — WFC edge inference from tags/category, stretchable parts detection, interaction node generation (sit, item_placement, interact). 26 unit tests.
- **Auto-Detect button**: Analyzes tileset pixels → groups adjacent opaque tiles → creates object defs with classified categories → applies collision presets per category → runs enrichAll for edges/parts/nodes. Summary toast reports results.
- **Dim Assigned toggle**: Darkens tiles already in objects so unassigned opaque tiles visually pop.
- **Category Painter**: "Paint Categories" replaces the property panel with a category palette; click/drag on canvas to assign categories to objects. Stronger color fills in paint mode. Mutual exclusion with other batch editors.
- **Connection Editor**: "Connections" button opens next/prev navigator for WFC edge sockets. Four dropdowns + "Auto-fill from tags" button. Colored edge indicator strips on the canvas.
- **Batch Collision Editor**: "Collision" button opens next/prev navigator with Full/Bottom Half/None presets. "Apply to all [category]" bulk-applies with proportional scaling.
- All tools are mutually exclusive toggles — entering one exits any other. Clean exit on mode switch.

---

## 2026-03-02 — Bartender NPC Agent (v0.19.0)

**Commits:** 086f7ba, 61e0504, 42758b5

- **NPC entity** (`NPC.js`): AI-driven bartender "Greta" spawns in the tavern. Shares Player's rendering pipeline (physics sprite, shadow, Z-axis jump, Y-sorted depth) but with immovable body — players bounce off instead of pushing.
- **Speech bubbles** (`SpeechBubble.js`): Floating text above NPC head with auto-fade. Background rectangle auto-sized to text bounds, repositions each frame.
- **A* pathfinding** (`Pathfinder.js`): Grid-based search on the collision layer, 4-directional. Pure functions, no Phaser dependency.
- **Path following** (`PathFollower.js`): Converts tile waypoints to frame-by-frame velocity with automatic facing updates and arrival detection.
- **AI brain** (`NPCBrain.js`): State machine (init → idle → thinking → acting → idle) driven by Behavior Engine API. Triggers: idle timer (8-15s), player proximity changes. Actions: move_to, speak, jump, idle — each with completion/failure callbacks.
- **Perceptions** (`Perceptions.js`): Text-based world description for LLM — NPC position, player location/distance/direction, previous action outcomes, map size.
- **59 new tests**: NPC entity (21), speech bubble (10), pathfinder (12), path-follower (13), perceptions (12), brain state machine (16). Total: 431 tests.
- Console testing: `window.__NPC__.jump()`, `window.__NPC__.moveTo(5, 8)`, `window.__NPC__.speechBubble.show('Hello!')`.

---

## 2026-03-02 — Issue #11: Collider & Group Fixes

**Commits:** (v0.18.1)

- **P0 — Null-aware colliders** (#11): `generateColliders()` now uses `computeTileBounds()` for tight-fit bounding boxes around actual non-null tiles instead of the full group bbox. Sparse groups (< 60% fill rate) decompose into horizontal row-run colliders via `decomposeToRowRuns()`.
- **P1 — Group size limits** (#11): BFS grouping in `groupTiles.js` now enforces `MAX_GROUP_DIM=6` and `MIN_FILL_RATE=0.6`. Tiles that would create oversized or sparse groups are left unvisited to seed their own groups.
- **Pure `buildGroups()` export**: Extracted BFS logic into a testable pure function with no `@napi-rs/canvas` dependency.
- **28 new tests**: `collider-generation.test.js` (16 tests) and `group-tiles.test.js` (12 tests). CLI guard added to `bootstrap-object-defs.js` to prevent `process.exit` when imported by tests.
- **BE CORS fix**: Added `/api/be/*` proxy on WS server so browser doesn't call external API directly. Refactored client to route through proxy by default.

---

## 2026-03-02 — Behavior Engine Test Panel

**Commits:** (v0.18.0)

- **Behavior Engine panel**: New cog menu item that opens a modal for testing the Artificial Agency platform API. Sequential workflow: create session → create agent (tavern keeper "Greta") → send messages → see AI responses in a scrollable log.
- **BehaviorEngineClient.js**: Thin REST client wrapping session/agent/action endpoints with auth headers and API versioning.
- **Build-time credential injection**: `.env` variables (`BEHAVIOR_ENGINE_API_KEY`, `BEHAVIOR_ENGINE_PROJECT_ID`) injected via Vite `define`, pre-populate the UI fields. Persisted to localStorage for convenience.
- **ESLint worktree fix**: Added `.claude/` to ESLint ignores — agent worktrees were bleeding into the main lint run.

---

## 2026-03-02 — Mantle Ability (Phase 2 Complete)

**Commits:** (v0.17.0)

- **Mantle ability**: New passive ability that lets the player climb ledges too high for step-height by jumping near them. Detection runs during the jump's ascending phase; smooth ease-out interpolation raises `z` to the target elevation.
- **MantlePhysics.js**: Pure functions (`checkMantle`, `updateMantleState`) — no Phaser dependency, fully unit-testable. Facing-aware tile scanning with configurable reach and height limits.
- **Player.js integration**: Mantle detection in `updateJump()` (ascending/apex phase only), execution via `updateMantleState()`, guards in `_startJump`/`handleInput`/`syncGroundPosition` to prevent conflicts with jump/step-up systems.
- **21 new unit tests** for mantle physics, 3 for ability definition. Updated `ability-manager.test.js` expectations to include mantle in defaults.
- **Phase 2 elevation system now complete**: Z-axis, physics jump, shadows, step-height collision, float ability, and mantling all working together.

---

## 2026-03-02 — Bug Reporter in Tile Editor + Parallel Agent Docs

**Commits:** (v0.16.3)

- **Bug reporter cog menu**: Mounted the existing `BugReporter` class in the tile editor — cog appears top-right, screenshot captures the tileset canvas, files GitHub issues via the WS server API. No modifications to BugReporter itself; it was already reusable.
- **ESLint ignores `assets/`**: New `assets/reference/` directory (third-party docs) was causing lint failures. Added `assets/` to ESLint ignores.
- **Parallel subagent docs**: Added "Parallel Work" section to CLAUDE.md and "Parallel Agent Strategy" to AGENTS.md — establishes worktree-isolated subagents as the default for multi-file work.

---

## 2026-03-02 — Tile Editor Tooltip Pass

**Commits:** (v0.16.2)

Added native HTML `title` tooltips to all interactive elements across the tile editor for first-time user guidance.

- **5 files updated**: TileEditor.js (toolbar), ObjectEditorList.js (list controls), ObjectEditorProperties.js (~30+ form fields), ObjectEditorCanvas.js (mode-aware canvas tooltip), ObjectCreationWizard.js (wizard nav, presets, draw mode).
- **DOM builder approach**: Added optional `tooltip` parameter to all 7 helper methods in ObjectEditorProperties (`_makeTextInput`, `_makeSelect`, `_makeNumberInput`, `_makeCheckbox`, `_makeTextarea`, `_makeTagsInput`, `_makeBtn`) for clean integration.
- **Dynamic canvas tooltips**: Canvas `title` updates when entering/exiting reassign mode, wizard mode, or draw mode.

---

## 2026-03-02 — Wizard Collision Step Fixes

**Commits:** (v0.16.1)

Fixed three issues with the collision step of the object creation wizard.

- **Re-render bug fix**: Removing or adding colliders appended duplicate content to the dialog. Root cause: `_renderCollisionStep()` was called directly from callbacks without clearing `_contentEl.innerHTML` first (the clear only happened in `_renderModalStep`). Added `innerHTML = ''` at top of `_renderCollisionStep()`.
- **Preset collision buttons**: Added Full, Bottom Half, and Center presets that instantly create colliders with common bounds configurations, sized proportionally to the object.
- **Draw collider on canvas**: Click+drag on the collision preview canvas to draw a rectangle. "Draw Collider" button creates a new collider from the drawn bounds. Per-collider "Draw" button redefines an existing collider's bounds. Live preview with cyan dashed rectangle and dimensions label during drag.
- **Visual improvements**: Colliders now show semi-transparent fills alongside dashed outlines for better visibility.

---

## 2026-03-02 — Object Editor Improvements & Creation Wizard

**Commits:** (v0.16.0)

Made object definitions fully editable and added a guided creation wizard.

- **Editable Object ID**: ID field is now directly editable with rename propagation across canvas, list, and properties. Sanitizes input (trims, underscores for spaces) and validates uniqueness.
- **Reassign Tiles**: New button in Grid section puts canvas into a drag mode with orange banner. Drawing a new rectangle replaces the object's grid tiles without needing to delete/recreate.
- **Duplicate & Clear All**: Duplicate button deep-clones an object with `_copy` suffix. Clear All button in list header wipes all definitions after confirmation.
- **New Object Wizard**: 4-step modal — (1) floating panel for tile selection on canvas, (2) basic info form with auto-slug ID, (3) collision editor with live preview, (4) review summary. "+ New" button in object list header.
- **Canvas modes**: ObjectEditorCanvas now supports `reassignMode` and `wizardMode` alongside normal selection. Both use drag without Shift key for intuitive interaction.

---

## 2026-03-02 — Fix Tavern Collision (Issues #9, #10)

**Commits:** (v0.15.1)

Fixed missing furniture collision in the tavern map. Player could walk through all tables, chairs, and stretched bar counter.

- **Root cause**: `create-tavern-map.js` passed `null` for the collision parameter in all `applyTo()` calls, so ObjectPlacer never wrote collision data for placed objects. Manual `generateCollisionData()` only covered walls/boundaries/plants/columns — skipped all tables and chairs entirely.
- **Merged wall+collision generation**: Replaced separate `generateWallsData()` + `generateCollisionData()` with unified `generateWallsAndCollision()` that passes the collision array through ObjectPlacer. Manual entries kept for walls, boundaries, plants, and columns (no object defs for these).
- **`large_table_4x2` fix**: Had only an `elevation: 1, type: "platform"` collider (table surface). Added ground-level `elevation: 0, type: "solid"` collider for the table base. ObjectPlacer skips elevation > 0 colliders.
- **Stretchable collider scaling**: `ObjectPlacer._resolveCollision` didn't scale collider width for stretched objects. Bar counter with `stretch: 10` (12 columns) only got 3 tiles of collision. Fixed by scaling `effectiveWidth` by `placedCols / origCols` when `collider.stretchable === true`.
- **Result**: Collision layer now has 155 solid tiles (up from ~100). All furniture blocks player movement.

---

## 2026-03-02 — Object Definition Editor (v0.15.0)

**Commits:** `7400e4a`

Added Object Definition Editor mode to the tileset editor for visual editing of multi-tile object definitions.

- **ObjectEditorList**: Filterable object list with composited thumbnails, category badges, text search, and validation indicators.
- **ObjectEditorProperties**: Full property form with collapsible sections for Basic, Grid, Rendering, Colliders, Nodes, Parts, and WFC data.
- **TileEditor orchestrator rewrite**: Mode toggle (Tiles/Objects) with dual canvas components sharing the same DOM element via `setActive()`. Import/export/save dispatch to mode-specific handlers.
- **Server endpoint**: `POST /api/object-defs` for saving object definitions to GitHub via the WS server.

---

## 2026-03-02 — Enrichment, ObjectPlacer & Tavern Refactor

**Commits:** (v0.14.0)

Enriched all 153 object definitions with WFC edges, parts, and nodes. Built ObjectPlacer module and refactored the tavern map to use it.

- **Enrichment script** (`scripts/enrich-object-defs.js`): Idempotent CLI that auto-populates WFC edges (tag-based rules), parts (stretchable left/middle/right for cols≥3), and nodes (sit, interact, item_placement based on category). Interior_1st_floor: 47 edges, 9 parts, 37 nodes enriched. Walls_interior: 2 door nodes added.
- **ObjectPlacer** (`scripts/lib/ObjectPlacer.js`): Converts object defs + positions into Tiled GID writes. Handles stretch via parts roles (repeatable middle columns). 11 unit tests.
- **Tavern refactor**: Replaced 4 placement helpers + manual counter/barrel loops with 15 `placer.place()` calls. Bar counter uses `stretch: 10` for 12-column counter. Output verified identical to baseline via layer-by-layer diff.
- **New objects**: Added `large_table_4x2`, `small_table_2x2`, `shelf_unit_2x2`, `bar_counter_3x2`, `chair_red_2x2`, `barrel_single` — tavern-specific objects the analysis pipeline missed due to aggressive grouping.
- **Key decision**: Collision layer kept manual for exact baseline match; ObjectPlacer collision handling to be refined later with stretchable collider scaling.

---

## 2026-03-02 — Object Definition System (WFC Prep)

**Commits:** (v0.13.0)

New object definition schema and bootstrap pipeline for defining multi-tile objects with pixel-level collision, nodes, and WFC data.

- **Object def schema** (`client/src/map/object-def-schema.js`): 5 enum exports, defaults, `validateObjectDef()` with grid/parts/collider/node validation. 34 unit tests.
- **Bootstrap script** (`scripts/bootstrap-object-defs.js`): Generates object definitions from tile analysis groups + identifications. Maps categories, creates default colliders (two-level for platform objects), extracts tags, assigns WFC edge sockets.
- **Generated data**: 129 objects for Interior_1st_floor (27 furniture, 6 structure, 96 decoration) and 19 for Walls_interior (all structure). All pass validation.
- **WFC socket vocabulary** (`_sockets.json`): 9 socket types (open_floor, wall_face, counter_end, etc.) with compatibility rules.
- **Next**: Visual editor for collision shapes and nodes, then ObjectPlacer to replace hardcoded map generation helpers.

---

## 2026-03-02 — Tile Analysis Pipeline & Tavern Fix (Issue #8)

**Commits:** (v0.12.0)

Built a 5-step AI-powered tile analysis pipeline to systematically identify tileset tiles and fix the tavern map (issue #8).

- **Tile analysis pipeline** (`scripts/analyze-tileset.js`): Reusable CLI tool with 5 steps — tile size detection (grid-line variance), tile extraction with labeled catalogs, edge-similarity grouping into multi-tile objects, catalog sheet generation for AI identification, and metadata generation.
- **Root cause of issue #8**: Tile GIDs in `create-tavern-map.js` were guessed from small tileset images and mapped to wrong tiles. Floor tiles used wall face row (row 9) instead of cobblestone row (row 10), wall face used frame/opening tiles (row 1) instead of stone face (row 9), columns used beam tiles instead of pillar tiles (group 7).
- **Fixed tavern map**: Updated all tile constants with correct GIDs verified via the analysis pipeline, regenerated `tavern.json`.
- **Tile metadata**: Generated metadata for 154 Walls_interior tiles (was 0) and added 251 new Interior_1st_floor tags (was 125, now 376).
- **Caveat**: Interior_1st_floor auto-detection picks 24px (scores close: 1.07 vs 1.32) — requires `--size 16` override. Furniture tiles need in-game verification.

---

## 2026-03-01 — Step-Height Elevation System (Issue #6, continued)

**Commits:** `07af35c` (v0.8.3)

After deploying the timing fix (v0.8.2), found a new bug: pushing down into the corner of a 16px-high platform while on an 8px platform caused position reset. The `bodyClip` condition was too aggressive — clearing collision for ALL tiles below ground row regardless of elevation.

- **Step-height system** (`07af35c`): Replaced blanket bodyClip with ability-driven step-height collision. New `canReach` check: allow passage if player is at/above tile elevation OR within `stepHeight` (8px default, one elevation level). bodyClip now only clears tiles the player is already high enough to pass over. Ground players auto-step onto elevation-1 naturally.
- **Ability param**: Added `stepHeight: 8` to movement ability — modifiable via ability system, so future items/buffs can increase step range.
- **Test map**: Added elevation-3 block (24px) for over-step-height blocking scenarios.
- **5 e2e tests**: Horizontal movement on platform, auto-step-up, over-step-height blocking (ground and elevation-1 player vs elevation-3), drop-down via gravity.

---

## 2026-03-01 — Fix Platform Movement (Issue #6)

**Commits:** `7b85273` → `75a3500` (v0.8.2)

Deep dive into why players couldn't move on elevated platforms. Root cause was more subtle than expected — a Phaser game loop timing issue.

- **Body-clip fix** (`7b85273`, v0.8.1): First attempt — added `bodyClip` condition to clear collision for tiles below the player's ground row when on an elevated surface. Fixed the body-straddling issue (14px body clips into adjacent tile rows) but didn't fully solve the problem in actual gameplay.
- **Phaser timing bug** (`75a3500`): `syncGroundPosition()` was reading `sprite.y` in `scene.update()`, but Phaser's `body.postUpdate()` (which syncs sprite from physics body) runs on `POST_UPDATE` — **after** `scene.update()`. So `_groundY` always read the stale preupdate value, causing the body to reset to the same position every frame during jumps. Fix: moved `syncGroundPosition()` and `updateDepth()` to the player's `postupdate` handler, which runs after `body.postUpdate()`.
- **Auto-step-up guard**: Prevented auto-step-up from triggering during jumps (z determined by jump physics, not terrain). Also fixed the step-up condition to use `this.z` instead of `this.groundZ` to prevent multi-frame escalation.
- **Key insight**: In Phaser 3.90, the scene lifecycle is: `preupdate` → `update` event (physics step) → `scene.update()` → `postupdate` (body.postUpdate). Game logic that reads sprite positions after physics MUST run in `postupdate`, not `scene.update()`.

---

## 2026-03-01 — Ability System, Jump, Modifiers, Debug Panel Refactor

**Commits:** `36df948` → `bcc9731`

Built out the full ability system from scratch and iterated on the debug panel to make it a proper development tool.

- **Ability system** (`36df948`): Data-driven abilities with `AbilityDefs` registry and `AbilityManager` (equip/unequip, active/passive types, input-driven activation, network serialization via `getState`/`applyState`). Sprint is now the first active ability — holding SHIFT activates movement's `sprintSpeed`. Debug panel wired up for live param editing.
- **Jump ability** (`f05f952`): SPACE triggers a visual hop tween (Y offset, not physics). Height and duration scale from `heightPower` param. Originally had aggressive caps (`Math.min(height, 24)` and `Math.min(duration, 600)`) that made param changes nearly invisible — removed both caps so future magic items can create dramatic effects.
- **Modifier system** (`d45a93e`): Dynamic buff/debuff stacking for all ability params. Modifiers are `{ id, param, op ('add'|'mul'), value, source }` — resolution order: `(base + additives) × multiplicatives`. `getParam()` transparently resolves through modifiers (zero changes needed in Player.js). Source-based clearing for equipment/environment effects. Full network serialization with backward compat. Debug panel shows resolved values (green) and modifier breakdowns (yellow). Filed issue #3 for float ability (needs physics-based jump).
- **Debug panel equipped-only view** (`bcc9731`): Replaced "show all abilities with checkboxes" with equipped-only display + X remove buttons + categorized Add menu. Abilities grouped by theme category (Movement/Combat/Magic/Utility). Much cleaner UX for when we have dozens of abilities.
- **SSH key fix**: Deploy script, CLAUDE.md, and deploy skill all referenced `~/.ssh/discord_dungeons` but the actual key is `discord_dungeons_vps`. Updated all three to match.

---

## 2026-02-28 — Bug Reporter, Player Debug Panel, Network Smoothing

**Commits:** `61143b9` → `fdb4850`

Major quality-of-life session: in-game bug reporting, live debug tools, and smooth multiplayer movement.

- **In-game bug reporter** (`61143b9`): Settings cog with "File Issue" menu item. Opens dialog to file GitHub issues with title, description, priority, and optional screenshot (captured from canvas). Server proxies to GitHub API with screenshot upload via Contents API. Reports include Discord username, platform, device, resolution, build version/commit.
- **Input context manager** (`b99e026` → `7a1f6af`): `acquireInputFocus()`/`releaseInputFocus()` system to suppress game input during UI overlays. Event-driven via EventBus — InputManager subscribes and disables keyboard immediately. Fixed Phaser `addKey()` captures eating WASD/Space in form fields by calling `clearCaptures()` when UI acquires focus.
- **Docker token fix** (`16bbc3e`): `docker-compose.yml` wasn't passing `GITHUB_API_TOKEN` to the container — bug reporter always got "token not configured". Added env var passthrough.
- **Collision body fix** (`f38a0ce` → `3f0066a`): Issue #2 — player could get too close to walls vertically. First attempt increased body height but didn't account for Phaser's `body.setSize()` working in **unscaled texture space** (values multiplied by `sprite.scaleX/Y` internally). Fixed by passing `dimension * TEXTURE_SCALE` so the final body matches intended world-pixel size.
- **Player Debug panel** (`7997785` → `9bb9030`): New "Player Debug" item in cog menu. Left-anchored side panel (game stays visible) with live controls for collision body W/H, RGB color (full texture regeneration via extracted `PlayerTextureGenerator`), and player name. Read-only position display updates per frame. Color picker uses native `<input type="color">` with bidirectional R/G/B sync. All changes replicate to other players — color via state payload, name via `identify` message.
- **Smooth remote player interpolation** (`fdb4850`): Remote players appeared to "mini-teleport" between positions. Root cause: fixed `LERP_FACTOR = 0.3` per frame reached the target in ~5 frames, then sat idle until the next 10Hz update. Replaced with time-based linear interpolation over `INTERP_DURATION = 100ms` (matching server broadcast rate). Movement now spreads evenly across the full update interval. Also frame-rate independent.

## 2026-02-28 — Wall Depth Sorting, Collision Fix, Build Status UX

**Commits:** `a12a26d` → `887f301`

Bug fixes and polish pass on the tilemap system, plus build status indicator improvements.

- **Wall/player layer overlapping fix**: Tile layers have a single depth for all tiles, which breaks 3/4 view depth sorting. Converted Walls and WallTops tile layers to individual Y-sorted sprites (depth = tile bottom Y). Walls south of the player now correctly occlude; walls north render behind. TileMapManager loads tilesets as spritesheets (`load.spritesheet` with `tileSize`) to get per-tile frames.
- **Collision body fix**: Player's feet-only hitbox was 12px wide (narrower than the character), letting the sprite visually sink into wall tiles horizontally. Widened to full sprite width while keeping the 8px-tall feet-only height for 3/4 view vertical overlap.
- **Build status indicator**: New floating DOM widget on game + devlog pages. Polls `/version.json` (5s) and GitHub Actions API (2min) to show deployment state as a colored dot — green (current), yellow (stale), flashing yellow (building), red (failed), gray (unknown). Click opens overlay panel with current status and color legend.
- **Camera centering fixes**: Series of fixes for camera centering on HiDPI screens — removed manual `applyDPR` scaling that conflicted with Phaser's camera follow, fixed vertical centering when map is smaller than viewport.
- **Tavern tileset assets**: Checked in Craftpix free tavern tileset (PNGs, TMX maps, license). Source files (.aseprite, .psd) kept local only.
- **Legacy cleanup**: Removed dead constants from platformer era, updated docs for tilemap architecture.

## 2026-02-28 — Tilemap System: Phase 1 MVP

**Commits:** `b5bbb36` → `3f55431`

Major architectural shift from side-scrolling platformer to 3/4 view tile-based RPG.

- **4-directional input**: Replaced left/right/jump with WASD/arrows D-pad (up/down/left/right + interact). Touch controls updated to D-pad layout. Diagonal movement normalized to same speed.
- **RPG constants**: TILE_SIZE=16, CHAR_WIDTH=16, CHAR_HEIGHT=24, MOVE_SPEED=80 px/s, CAMERA_ZOOM=3. Gravity disabled (y: 0).
- **4-direction textures**: BootScene generates up/down/left/right textures per player color. Down=centered eye, up=no eye (back of head).
- **Tilemap pipeline**: TileMapManager loads Tiled JSON maps with standard layer convention (Ground/GroundDecor/Walls/WallTops/Overlay/Collision/Objects). MapRegistry for map metadata lookup. Invisible collision layer blocks movement.
- **Test map generator**: `scripts/create-test-map.js` generates a 30×20 test map (floor, walls, wall tops, border collision, spawn point) without needing Tiled GUI.
- **Player rebuild**: Feet-only hitbox (12×8 at sprite bottom) for natural 3/4 view overlap. Y-sorted depth (sprite.y). Simplified network state (x, y, facing — no velocity).
- **GameScene rebuild**: Loads tilemap via TileMapManager, physics bounds from map, camera follow with zoom×DPR, depth sorting for all entities.
- **Dead code cleanup**: Removed JUMP_VELOCITY, WORLD_WIDTH/HEIGHT, FLOOR_HEIGHT, floor texture generation.

Next: Phase 2 (elevation/jump), real tavern map import via Tiled, tile animations.

## 2026-02-28 — Build Info Display + Versioning SOP (v0.2.0)

- **Build info on main menu**: Version, git commit hash, and build date shown at the bottom of MainMenuScene. Injected at build time via Vite `define` — no runtime API calls.
- **Versioning SOP**: Semver in `package.json` is source of truth. Bump on feature/fix commits, skip for chore/docs. Added to CLAUDE.md.
- **Version bump to 0.2.0**: Milestone — multiplayer, auth, mobile, Discord Activity, devlog, public devlog page all in place.
- ESLint globals added for `__APP_VERSION__`, `__GIT_COMMIT__`, `__BUILD_TIME__` in client code.

## 2026-02-28 — Process: Devlog + Public Devlog Page

- Established `DEVLOG.md` as a running development log checked into the repo
- Updated `CLAUDE.md` to make devlog updates part of the standard workflow
- Purpose: preserve context across machines, sessions, and agents
- **Public devlog page**: Added `discorddungeons.com/devlog` — standalone HTML page that fetches and renders DEVLOG.md client-side with `marked`. Dark theme matching the game. Vite multi-page build (`client/devlog.html` as second entry point). Build script copies DEVLOG.md to `client/public/` before Vite runs.
- Discord Activity fully configured in Developer Portal (Activities enabled, URL mappings, OAuth2 redirect, installed to server)

## 2026-02-28 — Resolution Independence + Deploy Script

**Commits:** `12f9a1b` → `db73e96` → `ef7bf1a`

*Work done on another machine.*

- **Fixed-zoom scrollable world**: Further resolution independence improvements
- **Deploy script**: `server/deploy-ws.sh` — rsyncs server files to VPS, rebuilds Docker container
- **HiDPI rendering**: Physical-pixel rendering for crisp display on 2K+ / Retina screens

## 2026-02-27 — Cross-Device Fixes + Discord Activity

**Commits:** `d5d49e8` → `c6e5074` → `ea8ec31` → `e6ec17e`

- **Bug: multiplayer desync across screen sizes** — Players on different devices (Chromebook vs iPhone 15 portrait) saw each other on different floor planes. Root cause: floor Y was calculated from screen height, which differs per device. Network sent absolute pixel coordinates.
  - **Fix**: Introduced fixed logical world (800×600). All positions use `WORLD_WIDTH`/`WORLD_HEIGHT` constants. Camera zoom scales the world to fit any screen.
- **Bug: camera rendering broken** — After the world-coords fix, floor floated on Chrome and was invisible on mobile. Root cause: Phaser's camera zoom is applied around the viewport center, not top-left. Manual `scrollX`/`scrollY` math assumed top-left origin.
  - **Fix**: Replaced manual scroll with `camera.startFollow(player.sprite)`. Phaser handles zoom + centering correctly.
- **Discord Activity integration**: Embedded App SDK (`@discord/embedded-app-sdk`). Dual-mode: same codebase runs as web app or Discord Activity. Activity detection via URL params (`frame_id`, `instance_id`, `platform`). SDK auth flow: `authorize()` → server token exchange at `/token` → `authenticate()`. `patchUrlMappings` routes fetch/WS through Discord's CSP proxy. Channel ID used as room ID for per-voice-channel multiplayer.

## 2026-02-26 — Player Identity + Visual Polish

**Commits:** `6d9c387` → `318079b` → `65b686f` → `8dd2267`

- **Player colors**: 32-color unified palette assigned by server join order. Consistent across all clients (server sends `colorIndex` on join)
- **Mobile touch controls**: On-screen D-pad + jump button with orientation support. Hybrid input: polls keyboard + touch each frame, merges snapshots
- **Discord OAuth login**: Full flow — redirect to Discord → exchange code on server → fetch profile. Session stored in `sessionStorage`
- **Guest mode**: Enter name → play immediately, no auth required
- **Player names**: Rendered above sprites, sent via `identify` message on WS connect

## 2026-02-26 — Multiplayer + Infrastructure

**Commits:** `465859c` → `9d64f71` → `45036a2` → `336e92a`

- **Event-driven architecture**: EventBus pub/sub, decoupled from Phaser. Scenes: BootScene → MainMenuScene → GameScene
- **Multiplayer networking**: WebSocket relay server (Node.js, not authoritative). State-based sync at 10Hz. Room management by URL param
- **VPS deployment**: Docker container on Hostinger VPS (93.188.166.147). Nginx reverse proxy with TLS at `wss://ws.discorddungeons.com`
- **Custom domain**: GitHub Pages serves client at `discorddungeons.com`
- **Dead end**: Initial WS connection used `ws://` — failed silently in browsers. Fixed by proxying through nginx with TLS certs

## 2026-02-25 — Project Bootstrap

**Commits:** `3418ef0` → `6fde848` → `6703b13`

- Scaffolded project: Vite + Phaser 3, Vitest, ESLint, GitHub Actions CI
- Built initial game client: 2D side-view platformer, player sprite with keyboard movement (WASD/arrows), arcade physics with gravity + floor collision
- Set up GitHub Pages deployment (CI: lint → test → build → deploy)
