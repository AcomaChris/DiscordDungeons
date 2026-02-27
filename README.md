# DiscordDungeons

A Discord Activity (Embedded App) dungeon game — played directly inside Discord.

## Status

Early development — project scaffolding and tooling setup.

## Architecture

- **Game client**: Web-based Discord Activity (runs as an iframe inside Discord)
- **Backend**: n8n on Hostinger VPS for matchmaking and server-side game logic
- **Platform**: Discord API for user identity, voice channels, social features

## Development

```bash
npm install        # Install dependencies
npm test           # Run tests
npm run lint       # Lint code
npm run format     # Format code
```

## Project Structure

```
client/             # Game client (Discord Activity frontend)
server/
  src/
    code/           # n8n Code node files (backend logic)
    workflow-builder.js
  deploy-workflow.js
tests/
  unit/             # Unit tests
```
