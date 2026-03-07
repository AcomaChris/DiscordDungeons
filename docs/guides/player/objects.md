# Interactive Objects

<!-- @doc-auto-start -->
### Object Types

<sub>Source: `client/src/objects/ComponentDefs.js`</sub>

You will encounter several types of interactive objects in the world:
- **Doors** -- open, close, or walk through to travel to another map.
  Some doors are **locked** and require a key or switch to open.
- **Chests and containers** -- open to find loot and items inside.
- **Switches and levers** -- activate or deactivate linked mechanisms.
- **Traps** -- hidden hazards that trigger when you step on them.
- **Teleporters** -- step onto them to warp to another location or map.
- **NPCs** -- characters you can talk to for quests, shops, or dialogue.

### Interacting

<sub>Source: `client/src/objects/InteractionManager.js`</sub>

Walk near an interactive object and a **[E] prompt** appears above it.
Press `E` (or tap **ACT** on touch) to interact. The default interaction
range is **32 pixels**. Some objects like traps and teleporters activate
automatically when you **step on** or **touch** them instead.

<!-- @doc-auto-end -->
