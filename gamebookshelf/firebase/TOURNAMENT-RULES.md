# Server-side score checks for the weekly tournaments

The site has no server of its own, so scores are written straight into the Firebase Realtime Database. These **database rules** make Firebase itself check every tournament score before saving it. Game rooms for Neon Rift and Mitosis are never touched: every rule below only applies to codes that start with **O**, and room codes never contain an O.

What Firebase will then refuse:

- Scores that are impossible for the game or for how long the run took (the same limits the leaderboard already uses).
- Scores with a faked or old timestamp (the time must be Firebase's own clock at the moment of saving).
- Re-submitting faster than once every 5 seconds from the same player.
- Missing fields, huge names or junk data in leaderboards and friends groups.

## How to apply it (about 2 minutes)

1. Go to <https://console.firebase.google.com>, open the **gamebookshelf-9984c** project.
2. In the left menu choose **Build → Realtime Database**, then the **Rules** tab.
3. **Copy everything that's there into a text file first**, so you can put it back if anything goes wrong.
4. Find the block for room codes. It looks something like this (yours may have more lines inside it):

   ```json
   "nr": {
     "$code": {
       ".read": true,
       ".write": "$code.matches(/^[A-Z]{4}$/)",
       ...
     }
   }
   ```

5. Inside the `"$code": { ... }` block, after the last line that's already there, add a comma and paste the block from **tournament-rules-snippet.json** (in this folder). Don't change anything else.
6. Click **Publish**.
7. Check it: open <https://gamebookshelf.com/tournament/>, play any tournament run, and make sure your score shows up. If the rules editor shows a red error, don't publish; send me the error and the rules you have.

## The checks, in plain words

| Code starts with | Game | Score | Must be true |
|---|---|---|---|
| OS | Skyline | floors | at most 500, and at least 0.45 s per floor |
| OL | Slingshot | planets | at most 800, and at least 0.5 s per planet |
| OM | Mitosis | top mass | between 1 and 60,000, run at most 200 s, mass ≤ 400 + 1,500 × seconds |
| OR | Ridgeline | metres | at most 80,000, and no faster than 70 m/s on average |
| OC | Corner Pocket | time in tenths of a second | between 25 s and 1 hour, and not less than the time actually played |

Friends groups (codes starting with O followed by any other letter) may only hold a short label and member names.

This is as strong as checking gets without running your own server. A very determined cheater could still send a score that passes these limits, but they can no longer post nonsense like 99,999 floors.
