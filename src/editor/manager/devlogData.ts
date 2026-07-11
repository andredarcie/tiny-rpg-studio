/**
 * Engine devlog entries, ordered newest first.
 *
 * These are curated, plain-language summaries of the changes shipped to the
 * Tiny RPG Maker engine, derived from the project's git history. Each entry is
 * written for a non-technical reader so creators can quickly understand what is
 * new without having to read commit messages.
 *
 * IMPORTANT: an entry's `id` must stay stable once published. It is the value
 * stored in localStorage to remember which updates a user has already seen, so
 * changing it would make an old update look new again.
 */
export type DevlogEntry = {
  /** Stable unique id, never reused or changed once published. */
  id: string;
  /** Exact release date in ISO `YYYY-MM-DD` form. */
  date: string;
  /** Short headline for the feature. */
  title: string;
  /** Plain-language explanation aimed at a non-technical reader. */
  description: string;
};

export const DEVLOG_ENTRIES: DevlogEntry[] = [
  {
    id: '2026-07-11-custom-sprites-pack',
    date: '2026-07-11',
    title: 'Share custom pixel art as a pack',
    description:
      'Under Project → Visuals you can export all custom sprites as one file and import them into another project. Merge art in, restore a full pack, or clear overrides — palette colors stay on their own import/export.',
  },
  {
    id: '2026-07-05-pwa-auto-updates',
    date: '2026-07-05',
    title: 'Installed apps stay up to date',
    description:
      'Tiny RPG Studio now checks for a fresh version when it opens, comes back online, or returns to the foreground. Installed app and browser users can move to the newest build more reliably, while the editor protects unsaved work before any forced refresh.',
  },
  {
    id: '2026-06-21-choice-dialogs',
    date: '2026-06-21',
    title: 'Branching Yes/No dialogs',
    description:
      'NPCs can now ask the player a question with two answers. Picking Yes or No shows its own message and can switch a variable on, so a single choice can change how the rest of your game unfolds. The decision is final for the whole playthrough — only restarting the game from scratch resets it — which rewards replaying to discover the other path.',
  },
  {
    id: '2026-06-21-crisper-dialogs',
    date: '2026-06-21',
    title: 'Crisper, easier-to-read dialogs',
    description:
      'Dialog boxes are now sharp at every screen size and keep a steady, comfortable size. Longer messages reveal with a typewriter effect and turn to the next page as you continue, and Yes/No questions appear as two big buttons that are easy to tap on phones.',
  },
  {
    id: '2026-06-18-explore-browsing',
    date: '2026-06-18',
    title: 'Smoother community game browsing',
    description:
      'Opening "Explore" no longer slows the game down, and community games now load a handful at a time as you scroll instead of all at once. Browsing other creators\' worlds is fast and effortless.',
  },
  {
    id: '2026-06-18-title-fit',
    date: '2026-06-18',
    title: 'Title screens that always fit',
    description:
      "Your game's title now resizes itself to fit the screen. Long, single-word titles shrink to stay readable instead of being awkwardly broken in the middle.",
  },
  {
    id: '2026-06-18-faster-loading',
    date: '2026-06-18',
    title: 'Faster loading and smoother play',
    description:
      'We trimmed the startup and made the engine run lighter, so games open quicker and play more smoothly. We also fixed the game screen sometimes appearing at the wrong size right after the loading screen.',
  },
  {
    id: '2026-06-17-new-font',
    date: '2026-06-17',
    title: 'A refreshed look',
    description:
      'Text across the engine now uses a new font, giving menus, dialog, and titles a cleaner, more polished feel.',
  },
  {
    id: '2026-06-15-dpad-controls',
    date: '2026-06-15',
    title: 'On-screen D-pad controls',
    description:
      'A directional pad now appears below the game so you can play with touch on phones and tablets — no keyboard required.',
  },
  {
    id: '2026-06-15-creator-kit-1-4-0',
    date: '2026-06-15',
    title: 'Creator Kit 1.4.0',
    description:
      'We bundled all of the recent improvements into a new version of the creator kit. Games you build from now on ship with the latest engine, features, and fixes by default.',
  },
  {
    id: '2026-06-11-combat-inventory-fixes',
    date: '2026-06-11',
    title: 'Smoother combat and inventory',
    description:
      'Squashed a glitch that made sword attacks misbehave and another bug that could mix up the items in your bag. Fighting and managing your inventory now work the way you expect.',
  },
  {
    id: '2026-06-08-enemy-editing',
    date: '2026-06-08',
    title: 'Edit and move enemies easily',
    description:
      'Click any enemy to open a dedicated editor, and drag enemies around to place them exactly where you want. Buttons also light up when you hover over them, making it clearer what you can interact with.',
  },
  {
    id: '2026-06-07-boss-per-playthrough',
    date: '2026-06-07',
    title: 'Boss fights reset between playthroughs',
    description:
      'Beating a boss now counts only for your current play session instead of being remembered forever. This makes it much easier to test and replay your game from a clean slate.',
  },
  {
    id: '2026-06-05-online-polish',
    date: '2026-06-05',
    title: 'Smoother online play',
    description:
      'Online games now feel more responsive: pushing boxes reacts instantly on your screen, and players reappear correctly for everyone after they respawn.',
  },
  {
    id: '2026-06-04-online-multiplayer',
    date: '2026-06-04',
    title: 'Play together online',
    description:
      'The big one: invite a friend and explore the same world at the same time. Player movement, switches, pressure plates, pushable boxes, and rewards all stay in sync between you, and a built-in chat lets you talk while you play.',
  },
  {
    id: '2026-06-02-music-volume',
    date: '2026-06-02',
    title: 'Background music volume control',
    description:
      'You can now fine-tune how loud the background music plays, so it sits nicely behind your sound effects instead of drowning them out.',
  },
  {
    id: '2026-06-02-deadly-traps',
    date: '2026-06-02',
    title: 'Deadly traps',
    description:
      'Traps can now defeat the player just like other dangers, complete with a proper defeat sequence. Perfect for spike pits and hazard rooms.',
  },
  {
    id: '2026-06-02-object-categories',
    date: '2026-06-02',
    title: 'Organized object editing',
    description:
      'Map objects are now grouped into categories, each with its own edit window, plus a map indicator that helps you spot them at a glance.',
  },
  {
    id: '2026-06-01-shared-variables',
    date: '2026-06-01',
    title: 'More room for game logic',
    description:
      'You can now use up to 16 shared variables to track things across your game, such as quest progress, scores, or which doors are unlocked.',
  },
  {
    id: '2026-06-01-logic-links',
    date: '2026-06-01',
    title: 'See how your logic connects',
    description:
      'A new logic category and a "show variable links" option let you visualize how switches, variables, and events are wired together.',
  },
  {
    id: '2026-05-30-sword-swing',
    date: '2026-05-30',
    title: 'Sword swing animation',
    description:
      'Melee attacks now show a satisfying sword swing, making combat feel more lively and responsive.',
  },
  {
    id: '2026-05-27-background-music',
    date: '2026-05-27',
    title: 'Background music',
    description:
      'Your games can now play background music, setting the mood for every scene.',
  },
  {
    id: '2026-05-18-world-metrics',
    date: '2026-05-18',
    title: 'World metrics panel',
    description:
      'Added a panel that shows useful stats about your world, helping you keep an eye on the size and contents of your game as it grows.',
  },
];

/** The id of the most recent entry; used to detect unseen updates. */
export const LATEST_DEVLOG_ID: string = DEVLOG_ENTRIES[0]?.id ?? '';
