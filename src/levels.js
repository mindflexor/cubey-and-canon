// Campaign: five islands, each harder than the last. Levels 1-4 each end with a treasure map piece;
// the assembled map leads to Admiral Ironclaw's fortress in level 5.
export const LEVELS = [
  { n: 1, name: 'Saltgear Harbor', tag: 'Reclaim the harbor from the Rustwake pirates', load: () => import('./levels/level1.js') },
  { n: 2, name: 'Palmshade Ruins', tag: 'Climb the jungle temple of the ancient tide-kings', load: () => import('./levels/level2.js') },
  { n: 3, name: "Smuggler's Reef", tag: 'Brave the wreck-strewn reef and the smugglers’ caves', load: () => import('./levels/level3.js') },
  { n: 4, name: 'Cinderpeak Forge', tag: 'Shut down the orcs’ cannon forge inside the volcano', load: () => import('./levels/level4.js') },
  { n: 5, name: 'Skullrock Fortress', tag: 'Storm Ironclaw’s stronghold and end the Rustwake for good', load: () => import('./levels/level5.js') },
];

const KEY = 'cubey-canon-save-v2';
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)) || {}; return { unlocked: Math.min(5, Math.max(1, s.unlocked | 0 || 1)), golden: s.golden || {}, gears: s.gears | 0, best: s.best || {} }; }
  catch { return { unlocked: 1, golden: {}, gears: 0, best: {} }; }
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
