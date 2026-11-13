# STORMFALL game server
Runs every online match of games/stormfall. No dependencies, Node 18+.
It reads ../../games/stormfall/game.js, so updating the game updates the server on the next deploy.

Deploy: render.com > New > Blueprint > this repo (uses render.yaml in the repo root).
The game connects to wss://stormfall-us.onrender.com (set in games/stormfall/index.html).
If Render gives the service a different address, change that line.

Local test: `node server.js`, then open http://localhost:8080 in two tabs.
Health: /health
