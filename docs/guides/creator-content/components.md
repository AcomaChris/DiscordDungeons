# Components

<!-- @doc-auto-start -->
### Base Class

<sub>Source: `client/src/objects/Component.js`</sub>

All interactive object components extend this class. Override lifecycle hooks as needed:
| Hook | Trigger | Purpose |
|------|---------|---------|
| `init()` | Once after creation | Setup, cache references |
| `update(delta)` | Each frame | Per-frame logic (delta in ms) |
| `onInteract(player)` | Player presses E | `trigger: 'interact'` components |
| `onTouch(player)` | Physics overlap | `trigger: 'touch'` components |
| `onStep(player)` | Standing on tile | `trigger: 'step'` components |
| `onEvent(eventName, data)` | Routed event from another object | Cross-object communication |
| `getState()` / `applyState(state)` | Persistence/network | Serialize and restore component state |

### Component Definition Format

<sub>Source: `client/src/objects/ComponentDefs.js`</sub>

Each component in `ComponentDefs` is an object with these fields:
- **id** -- unique string identifier (e.g. `"door"`, `"container"`)
- **name** -- human-readable display name
- **category** -- one of `CORE`, `MECHANICAL`, `ENVIRONMENTAL`, or `EFFECT`
- **authority** -- `CLIENT` (resolved locally) or `SERVER` (server-authoritative)
- **persistence** -- `VOLATILE` (resets on reload), `SESSION`, or `PERSISTENT`
- **trigger** -- `INTERACT` (press E), `TOUCH` (overlap), `STEP` (stand on), or `NONE`
- **params** -- default parameter values for this component type

### Component Registry

<sub>Source: `client/src/objects/ComponentRegistry.js`</sub>

Central registry that maps component IDs to their class constructors.
Components self-register at import time: `componentRegistry.register('door', DoorComponent)`.
`create(id, owner, overrides)` instantiates a component by looking up its definition
from `ComponentDefs` and its constructor from the registry. If no specific class is
registered for an ID, it falls back to the base `Component` class (useful for
data-only components that only need params and state, no custom behavior).

### Container Component

<sub>Source: `client/src/objects/components/ContainerComponent.js`</sub>

Inventory container with a slot limit. Opens a floating UI panel on interact.
On first open, rolls a `lootTable` (if defined) to populate items.
Parameters: `items[]` (array of `{ id, name, quantity }`), `maxSlots`, `lootTable`,
`promptText`. Loot table entries: `{ id, name, quantity, chance }` where `chance`
is 0-1 probability (default 1). Use `takeItem(index)` and `addItem(item)` to
modify contents programmatically. Emits `container:opened`, `container:closed`,
and `container:itemTaken` events.

### Door Component

<sub>Source: `client/src/objects/components/DoorComponent.js`</sub>

Toggles between open and closed states on interact. Supports three modes:
- **Toggle door**: flips `isOpen`, emits `door:opened`/`door:closed` events
- **Locked door**: if `lockId` is set, blocks interaction until player has matching key
- **Portal door**: if `targetMap` is set, triggers a map transition instead of toggling
Parameters: `isOpen`, `lockId`, `targetMap`, `targetSpawn`, `targetX`, `targetY`,
`promptOpen`, `promptClose`. Responds to `switch:toggled` events from connected switches.

### Switch Component

<sub>Source: `client/src/objects/components/SwitchComponent.js`</sub>

Toggle switch (lever, button, pressure plate). Flips `isOn` on interact and
emits `switch:on`/`switch:off` plus `switch:toggled` events. Connected objects
(e.g. doors) can listen for these events via the connection system.
Parameters: `isOn` (initial state), `promptOn` (text when on), `promptOff` (text when off).

### Teleporter Component

<sub>Source: `client/src/objects/components/TeleporterComponent.js`</sub>

Step-triggered map transition. When a player steps onto this object, fires a
`MAP_TRANSITION_REQUEST` to move the player to a target location on the same
or a different map. Prefers named spawn points; falls back to raw coordinates.
Parameters: `targetMap` (required map ID), `targetSpawn` (named spawn point),
`targetX` / `targetY` (fallback pixel coordinates).

### Trap Component

<sub>Source: `client/src/objects/components/TrapComponent.js`</sub>

Step-triggered damage trap. When `armed` and a player steps on it, emits
`trap:triggered` with the `damage` value, then disarms. Automatically rearms
after `rearmDelay` milliseconds (0 = stays disarmed). Emits `trap:rearmed` on rearm.
Parameters: `damage` (number), `armed` (boolean), `rearmDelay` (ms).

<!-- @doc-auto-end -->
