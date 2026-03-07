# URL Parameters

<!-- @doc-auto-start -->
### Available Parameters

<sub>Source: `client/src/main.js`</sub>

The game client supports the following URL parameters for development and testing:
- `?map=X` -- load a specific map by ID (e.g., `?map=test`, `?map=tavern`).
  Defaults to `test` if omitted. See **Map Selection** below.
- `?touch=1` -- force touch/D-pad controls on desktop browsers, useful for
  testing the mobile UI without a touch device.

### Map Selection

<sub>Source: `client/src/scenes/GameScene.js`</sub>

The `?map=X` query parameter selects which map to load on startup. GameScene reads
the param via `getActiveMapId()` and looks up the map in `MapRegistry`. If no param
is provided, the default map (`test`) is loaded. This is useful for jumping directly
to a specific map during development without navigating through doors.
Example: `http://localhost:5173/?map=tavern`

<!-- @doc-auto-end -->
