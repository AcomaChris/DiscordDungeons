# DiscordDungeons

A Discord Activity (Embedded App) dungeon game — played directly inside Discord.

## Status

Early development — basic Phaser game client with movement prototype.

## Architecture

- **Game client**: Web-based Discord Activity (runs as an iframe inside Discord)
- **Backend**: n8n on Hostinger VPS for matchmaking and server-side game logic
- **Platform**: Discord API for user identity, voice channels, social features

## Development

```bash
npm install        # Install dependencies
npm run dev        # Start game dev server (http://localhost:8080)
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm test           # Run tests
npm run lint       # Lint code
npm run format     # Format code
```

## Project Structure

```
client/
  index.html          # Game entry point
  src/
    main.js            # Phaser game config and bootstrap
    scenes/
      GameScene.js     # Main game scene (floor, character, controls)
server/
  src/
    code/              # n8n Code node files (backend logic)
    workflow-builder.js
  deploy-workflow.js
tests/
  unit/                # Unit tests
```
