# Controls

<!-- @doc-auto-start -->
### Login

<sub>Source: `client/src/auth/AuthManager.js`</sub>

You can sign in with **Discord** for a persistent identity that carries
across sessions, or choose **Guest mode** and pick a custom name with no
account required. When playing inside Discord as an Activity, login is
automatic. Your session is saved locally so you stay logged in between visits.

### Keyboard

<sub>Source: `client/src/input/InputActions.js`</sub>

Move with **WASD** or **arrow keys**. Additional bindings:

| Action | Keys |
|--------|------|
| Move | WASD / Arrow keys |
| Sprint | Shift |
| Jump | Space |
| Interact | E |

Diagonal movement is normalized so you move at the same speed in all directions.
On mobile, use the on-screen joystick (left) and action buttons (right).

### Touch

<sub>Source: `client/src/input/TouchManager.js`</sub>

On touch devices, an **on-screen joystick** appears on the left side of the
screen for analog movement. Three **action buttons** sit on the right:
**JUMP**, **RUN** (hold to sprint), and **ACT** (interact with nearby objects).
The layout adapts to both portrait and landscape orientations.
To force touch controls on a desktop browser, add `?touch=1` to the URL.

<!-- @doc-auto-end -->
