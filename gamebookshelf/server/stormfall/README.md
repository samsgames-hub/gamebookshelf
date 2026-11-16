# STORMFALL game server
Runs every online match of games/stormfall. No dependencies, Node 18+.
It reads ../../games/stormfall/game.js, so updating the game updates the server on the next deploy.

Deploy: render.com > New > Blueprint > this repo (uses render.yaml in the repo root).
The game connects to wss://stormfall-us.onrender.com (set in games/stormfall/index.html).
If Render gives the service a different address, change that line.

Local test: `node server.js`, then open http://localhost:8080 in two tabs.
Health: /health

## Zeabur (no credit card)
New project > Deploy service > GitHub > samsgames-hub/gamebookshelf.
package.json / zbpack.json at the repo root start this server. Add env vars REGION=US-East and MAX_MATCHES=2,
then Networking > generate a *.zeabur.app domain and put wss://<that domain> in gamebookshelf/games/stormfall/index.html.
