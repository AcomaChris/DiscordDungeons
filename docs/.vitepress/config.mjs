import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'DiscordDungeons',
  description: 'Player, Developer, and Creator guides for DiscordDungeons',
  base: '/docs/',
  themeConfig: {
    nav: [
      { text: 'Play', link: 'https://discorddungeons.com' },
      { text: 'Dev Log', link: 'https://discorddungeons.com/devlog.html' },
    ],
    sidebar: [
      {
        text: "Player's Guide",
        collapsed: false,
        items: [
          { text: 'Introduction', link: '/guides/player/' },
          { text: 'Controls', link: '/guides/player/controls' },
          { text: 'Abilities', link: '/guides/player/abilities' },
          { text: 'Multiplayer', link: '/guides/player/multiplayer' },
          { text: 'Interactive Objects', link: '/guides/player/objects' },
        ],
      },
      {
        text: "Developer's Guide",
        collapsed: true,
        items: [
          { text: 'Introduction', link: '/guides/developer/' },
          { text: 'Debug Panels', link: '/guides/developer/debug-panels' },
          { text: 'URL Parameters', link: '/guides/developer/url-params' },
          { text: 'Bug Reporter', link: '/guides/developer/bug-reporter' },
        ],
      },
      {
        text: "Creator's Guide: Tools",
        collapsed: true,
        items: [
          { text: 'Introduction', link: '/guides/creator-tools/' },
          { text: 'Map Editor', link: '/guides/creator-tools/map-editor' },
          { text: 'Tile Editor', link: '/guides/creator-tools/tile-editor' },
          { text: 'Scripts', link: '/guides/creator-tools/scripts' },
        ],
      },
      {
        text: "Creator's Guide: Content",
        collapsed: true,
        items: [
          { text: 'Introduction', link: '/guides/creator-content/' },
          { text: 'Abilities', link: '/guides/creator-content/abilities' },
          { text: 'Components', link: '/guides/creator-content/components' },
          { text: 'Maps', link: '/guides/creator-content/maps' },
          { text: 'Objects', link: '/guides/creator-content/objects' },
          { text: 'Scripting', link: '/guides/creator-content/scripting' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/AcomaChris/DiscordDungeons' },
    ],
  },
});
