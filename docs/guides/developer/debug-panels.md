# Debug Panels

All debug panels are accessible from the cog menu (gear icon) in the top-right corner of the game screen.

<!-- @doc-auto-start -->
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

<!-- @doc-auto-end -->
