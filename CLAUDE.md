# Game Bookshelf: how to work in this project

This folder holds Sam's browser games for Game Bookshelf. Each game lives in its own folder under `games/`, for example `games/ironoath/`.

## Goal
Every game should be one that people would choose to play and come back to, not a tech demo. Work like a small game studio and keep going until the game meets the bar below.

## Before coding
- Decide the core loop, the hook (what's fun in the first 30 seconds), and why a player would want "one more run". Make good calls without asking a lot of questions, and say what you picked.
- Pick one art style (colors, shapes, lighting, font) and use it everywhere.
- Start from a game type that's proven to work (Steam, consoles, popular browser game sites) and give it its own twist. If an idea is vague or weak, turn it into a strong one and explain what changed and why.
- Keep themes grounded and consistent: no joke placeholders and no random mash-ups.

## Every game must have
- The full flow: title screen, a short tutorial or how-to-play, pause (Esc/P), a game-over or win screen, instant restart, and settings with volume, mute and a screen-shake toggle.
- Feedback on every action: easing, hit-stop, screen shake, particles, flashes and impact sounds. Every action gets both a sound and a visual.
- Sound: Web Audio sound effects and music generated in code (no audio files). Start audio on the first click or key press.
- Replay value: a difficulty ramp, variety (several enemy types, levels, upgrades or events), and high scores or unlocks saved in localStorage (wrapped in try/catch). There should be at least 15–30 minutes of play before it gets repetitive.
- Real-looking visuals: no plain cubes or flat rectangles. Use shading, gradients, textures, detailed models, idle/hit/death animations and a clear HUD. Use CC0 assets when needed.
- Controls: keyboard and mouse, plus touch controls on phones. The canvas resizes with the window and is sharp on high-DPI screens (devicePixelRatio).

## Tech standards
- Plain HTML/CSS/JS. Three.js from a CDN is fine for 3D. No backend: everything must work as static files.
- Default files per game: `index.html`, `style.css`, `game.js`.
- Run the game loop on requestAnimationFrame with delta time and a fixed timestep for physics. Use object pooling, avoid memory leaks and cap particle counts. Aim for 60 fps on a low-spec PC, and give heavy games a low-quality setting.
- No console errors, placeholders, TODOs or half-finished features.

## Playtest before saying it's done
- Serve the game locally and open it in a headless browser (Playwright). Check the console, then play with simulated input: start, move, attack, die, restart, and open the menus. Take screenshots and look at them.
- Score it honestly from 1 to 10 on fun, feel, visuals, sound, UI clarity, difficulty curve, performance and bugs. Fix the weakest areas and retest until every score is at least 8.
- When improving an existing game, keep everything that already works and never quietly remove features.

## When finished
- Commit with a clear message. Push only when Sam asks.
- Report in a few lines: the controls, what's in the game, and the 2–3 things you'd improve next.
