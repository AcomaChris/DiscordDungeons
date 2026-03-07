# Abilities

Your character has a set of equipped abilities that grant different capabilities. Some are active (you trigger them) and some are passive (always on).

<!-- @doc-auto-start -->
### Movement

<sub>Source: `client/src/abilities/AbilityDefs.js`</sub>

**Walking and sprinting.** Move at 80 px/sec by default. Hold **Shift**
(or the RUN button on mobile) to sprint at 160 px/sec. Sprinting also
increases your auto-step-up height, letting you walk onto small ledges.

### Jump

<sub>Source: `client/src/abilities/AbilityDefs.js`</sub>

Press **Space** (or the JUMP button on mobile) to jump. Jumping is
physics-based — you launch upward and gravity pulls you back down.
While airborne, you can trigger mantling by jumping near a ledge.

### Float

<sub>Source: `client/src/abilities/AbilityDefs.js`</sub>

A passive ability that reduces gravity while you're falling. Makes
descent slower and floatier, giving you more air control after jumps.
Not equipped by default — equip it via the debug panel.

### Mantle

<sub>Source: `client/src/abilities/AbilityDefs.js`</sub>

A passive ability that lets you **climb ledges** during a jump. When
you jump facing a ledge that's above step-height but within mantle range,
your character automatically climbs up onto it instead of bouncing off.

### Ghost Mode

<sub>Source: `client/src/entities/Player.js`</sub>

When you spawn on top of another player, you enter **ghost mode** --
your character turns semi-transparent and can't interact with objects.
Simply **walk to an open space** and ghost mode clears automatically,
restoring full visibility and interaction.

<!-- @doc-auto-end -->
