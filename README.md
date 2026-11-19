# Cubey & Canon — Saltgear Harbor

[Play Cubey & Canon](https://mindflexor.github.io/cubey-and-canon/)

A third-person action-platformer for the browser, built with three.js. You play two heroes and switch between them; the other one follows you.

- **Cubey** is made of six floating concrete cubes. He places cement cubes to climb, weighs down pressure plates, ground-slams switches and enemies, and raises a cube shield that blocks shots.
- **Canon** is a pirate captain built from ship columns, with a ship's cannon for a head. He fires cannonballs at orcs, targets and barricades. Hold fire to charge a heavy shot that breaks iron-banded barricades.

## Run it

```powershell
npm ci
npm start
```

Then open http://127.0.0.1:5173/ in Chrome and click **Set Sail**.

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move / look | WASD · mouse (click the game to capture the mouse) | Left stick · right stick |
| Jump / double jump | Space (press twice) | A |
| Swap hero | Q or Tab | Y |
| Cubey | Click: place a cube (the ghost cube shows where) · right mouse: shield · click in the air: slam · R: recall cubes | RT · LT · X |
| Canon | Click: fire at the crosshair · hold click: heavy shot · right mouse: aim over the shoulder | RT · LT |
| Pause | Esc | Menu (D-pad and A navigate menus) |

On a touchscreen phone (play in landscape), drag the left thumb anywhere to move and drag the right side to look. The buttons are ▲ jump, ● place/fire (hold to charge), ◈ shield/aim, ⇄ swap, ↺ recall and II pause. Xbox controllers rumble on hits and explosions.

The camera is an over-the-shoulder third-person-shooter camera. Canon always faces the crosshair, and Cubey places cubes wherever the crosshair points; the ghost cube shows the spot. If the browser won't capture the mouse, mouse look still works with a free cursor.

## The level: Saltgear Harbor

The level is a Caribbean archipelago. Like a Ratchet & Clank planet, it moves through traversal, puzzles, combat and a boss:

1. **Beach landing and pier.** Tutorials, crates full of gears, a cargo stack you climb with a cube, and buried treasure opened with a ground-slam switch.
2. **Market quay.** Orc pirates, and a wooden barricade only Canon can break.
3. **Town plaza gate.** Two plates hold the gate open. One is *heavy* and needs 2 cubes; the other is up on the bandstand. You have exactly 4 cubes.
4. **Lagoon crossing.** Canon shoots the mooring target to free the barge, then you ride the barge and hop across bobbing buoys.
5. **Fortress battery.** Deck turrets fire at you, so use Cubey's shield or cubes as cover. Climb the rampart with a cube, then break an iron barricade with a heavy shot.
6. **Grind rail** over the water to the shipyard.
7. **Shipyard arena.** Three waves of orcs and gull drones.
8. **Lighthouse cape boss.** Admiral Ironclaw, an orc captain riding a crab mech. Dodge the mortar circles, block the broadside volleys, and hit the glowing core when he vents.

There are 3 hidden golden gears on the balcony, in the fort alcove and on the shipyard scaffold.

## Tech notes

- `src/islands.js` builds heightfield islands with an analytic coastline. The water shader uses the same coastline, so the turquoise shallows and surf foam line up with the beaches. You can walk on the terrain.
- `src/render.js` handles ACES tone mapping, GTAO ambient occlusion, bloom, color grading, a procedural sky with clouds, and the three.js `Water` with planar reflections.
- Textures are generated procedurally at load time in `src/textures.js` (color, normal and roughness maps).
- Music (`src/audio.js`) is an adaptive procedural orchestra in D minor 6/8: string ostinato, horns, timpani and choir. It shifts between menu, exploration, combat and boss moods, and the melodies are original.

## Credits and licenses

- [three.js](https://github.com/mrdoob/three.js) (MIT), including `examples/jsm/objects/Water.js`, which comes from [jbouny/ocean](https://github.com/jbouny/ocean) (MIT), and `examples/textures/waternormals.jpg` (in `public/textures/`).
- Sound effects and ambience are CC0 or public domain. See `public/audio/CREDITS.txt` (Kenney) and `public/audio/CREDITS_CC0.txt` (OpenGameArt, xeno-canto, US NPS and Kenney sources), which list every file.
