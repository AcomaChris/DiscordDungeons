# Scripting

<!-- @doc-auto-start -->
### Lua Engine

<sub>Source: `client/src/scripting/LuaEngine.js`</sub>

Client-side Lua 5.4 VM powered by Wasmoon (WebAssembly). One shared engine per
game session. Scripts are isolated via function scoping, not separate VMs.
Game bindings are injected as Lua globals: `self` (own object), `world` (spatial
queries: `getObject(id)`, `nearby(radius)`, `getObjectsByType(type)`),
`timer` (`after(ms, callback)` for delayed execution), and `log(...)` for console output.
Must call `await init()` before use. All errors are caught to prevent script crashes.

### Script Component

<sub>Source: `client/src/scripting/ScriptComponent.js`</sub>

Component that runs custom Lua code on lifecycle events. The `code` parameter
contains inline Lua that defines handler functions: `on_init()`, `on_interact()`,
`on_touch()`, `on_step()`, `on_update(delta)`, `on_event(name, data)`.
Scripts execute in the shared LuaEngine with access to `self` (read/write params,
emit events), `world` (query nearby objects), `timer` (delayed callbacks), and `log`.
Each script instance is scoped to avoid namespace collisions between objects.

<!-- @doc-auto-end -->
