# Multiplayer

<!-- @doc-auto-start -->
### Parties

<sub>Source: `client/src/hud/PartyUI.js`</sub>

To form a party, open the roster and click **Invite** next to a player's name.
They receive a **toast notification** with **Accept** and **Decline** buttons
(the invite expires after **30 seconds**). Once in a party, a **party panel**
shows the leader and all members. You can **leave** the party at any time.

### Roster

<sub>Source: `client/src/hud/RosterHUD.js`</sub>

A **"Players: N" badge** in the top-left corner shows how many players are online.
Click it to expand the **roster panel**, which lists all connected players
grouped by their current map. From the roster you can click **Invite** next
to any player's name to send them a party invitation.

### Connecting

<sub>Source: `client/src/network/NetworkManager.js`</sub>

The game **automatically connects** to the multiplayer server when you join.
All players in the same room can see each other move in real time.
Each player is assigned a **unique color** so you can tell everyone apart.
Player positions sync at **10 updates per second** for smooth movement.

<!-- @doc-auto-end -->
