GAME BOOKSHELF — your games website
=====================================

WHAT'S INSIDE
  index.html                         the website (featured banner + all games)
  assets/                            banner and tile pictures for each game
  games/neon-rift/                   NEON RIFT (index.html, style.css, game.js)
  games/gamble-with-friends/         Gamble With Friends (index.html)

TRY IT ON YOUR COMPUTER
  Extract the zip, then double-click index.html.

PUT IT ONLINE FOR FREE (pick one)
  Netlify Drop: go to app.netlify.com/drop and drag the whole "game-bookshelf" folder onto the page.
                You get a link right away. Make a free account to keep it and pick a nicer name.
  GitHub Pages: make a repository, upload everything in this folder, then turn on Pages in
                Settings > Pages. Your site appears at yourname.github.io/repository-name.
  Any web host: upload the folder as-is. Nothing needs a server.

ADD A NEW GAME
  1. Put the game's folder inside games/ (for example games/my-new-game/index.html).
  2. Optional: add two pictures to assets/
       my-new-game-hero.jpg   wide banner, about 1920 x 820 (keep the left side darker,
                              the title and Play button sit there)
       my-new-game-tile.jpg   16:9 tile, about 800 x 450
     No pictures? Leave hero and tile out and the site makes a colored tile for you.
  3. Open index.html in a text editor, find "const GAMES=[" and copy one of the entries.
  4. Change id, title, path, hero, tile, accent (the highlight color), tags, pitch
     (one sentence for the banner), blurb, facts and controls.
  The banner rotates through every game in the list; the first one shows first.

RENAME THE SITE
  In index.html, edit the SITE lines (name, about text and footer).

NOTE ABOUT GAMBLE WITH FRIENDS
  Shared rooms use claude.ai's database, so on your own site the game runs in solo practice mode.
