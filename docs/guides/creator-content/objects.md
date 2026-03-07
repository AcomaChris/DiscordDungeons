# Objects

<!-- @doc-auto-start -->
### Interactive Object

<sub>Source: `client/src/objects/InteractiveObject.js`</sub>

A placed object in the game world. Positioned at `(x, y)` in world pixels with
`width` and `height`. Owns multiple components via `ComponentManager`. Interaction
methods (`onInteract`, `onTouch`, `onStep`) dispatch to matching components.
Emits events via `emit(eventName, data)` (routed by ObjectEventRouter to connections
and the global EventBus). Receives events via `receiveEvent(eventName, data)`.
Serializable via `getState()` / `applyState(state)` for persistence and network sync.

### Object Manager

<sub>Source: `client/src/objects/ObjectManager.js`</sub>

Scene-level manager that owns all `InteractiveObject` instances for the current map.
`createFromMapData(objectDataList)` parses the Objects layer output from TileMapManager.
Spatial queries: `getObjectById(id)`, `getObjectsByType(type)`,
`getObjectsInRadius(x, y, radius)` (sorted by distance),
`getObjectsInTileRadius(tileX, tileY, tileRadius)`. Access all objects via `.all`.

<!-- @doc-auto-end -->
