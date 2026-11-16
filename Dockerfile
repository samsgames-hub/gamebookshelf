# Stormfall game server (the website itself stays on GitHub Pages).
FROM node:22-alpine
WORKDIR /app
COPY gamebookshelf/server/stormfall gamebookshelf/server/stormfall
COPY gamebookshelf/games/stormfall gamebookshelf/games/stormfall
ENV PORT=8080
EXPOSE 8080
CMD ["node", "gamebookshelf/server/stormfall/server.js"]
