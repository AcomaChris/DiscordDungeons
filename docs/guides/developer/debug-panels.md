# Debug Panels

All debug panels are accessible from the cog menu (gear icon) in the top-right corner of the game screen.

<!-- @doc-auto-start -->
### Build Status

<sub>Source: `client/src/build-status/BuildStatusIndicator.js`</sub>

A small colored dot in the bottom-left corner shows the current deploy state.
Click it to expand a tooltip with the **version number**, **git commit hash**, and
**build timestamp**. The dot color indicates status: green = up to date, yellow =
new version available or build in progress, red = build failed, grey = unknown.
It polls `/version.json` and the GitHub Actions API to stay current.

### Player Debug

<sub>Source: `client/src/debug/PlayerDebugPanel.js`</sub>

Opens from the **cog menu** (top-right gear icon). Lets you live-edit:

- **Collision Body** — adjust hitbox width/height in world pixels
- **Character Color** — RGB sliders + color picker (syncs to all players)
- **Identity** — edit your player name (syncs to all players)
- **Position** — real-time X, Y, Z coordinates (read-only)
- **Abilities** — equip/unequip abilities, tweak parameters, view active modifiers

Click the game canvas to release input focus (move your character while panel is open).
Click the panel to re-acquire focus for typing.

### State Display

<sub>Source: `client/src/debug/StateDisplayPanel.js`</sub>

Toggle **Show State** from the cog menu to display a live badge strip at the bottom
of the screen. Badges light up for each active player state: **idle**, **moving**,
**sprinting**, **jumping**, **mantling**, **floating**, and **interacting**. Multiple
states can be active simultaneously (e.g., jumping + floating). A facing direction
arrow (▲▼◄►) updates every frame alongside the badges.

### World Debug

<sub>Source: `client/src/debug/WorldDebugOverlay.js`</sub>

Toggle **World Debug** from the cog menu to open an overlay panel in the top-left corner.
Check **"Show Height Data"** to render elevation values as color-coded labels on every
elevated tile (grey = lowest, green, orange, red = highest). Labels scroll and zoom
with the map. The panel also displays **map info**: current map ID, whether the map is
instanced or shared, and the number of players currently on the map.

<!-- @doc-auto-end -->
