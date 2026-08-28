import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'CodeAtlas',
  description: 'AI Context Intelligence & Interactive Architecture Engine for Modern Codebases',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#000000' }],
  ],
  themeConfig: {
    siteTitle: 'CodeAtlas',
    nav: [
      { text: 'Documentation', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/guide/architecture' },
      { text: 'CLI Reference', link: '/guide/cli' },
      { text: 'AI Exporters', link: '/guide/rules-export' },
      { text: 'MCP Server', link: '/guide/mcp' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/guide/' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Core Concepts', link: '/guide/core-concepts' },
        ],
      },
      {
        text: 'Architecture & Engine',
        items: [
          { text: 'System Architecture', link: '/guide/architecture' },
          { text: 'AST Parser Pipeline', link: '/guide/parser' },
          { text: 'Dependency Graph', link: '/guide/graph' },
          { text: 'Context Compression', link: '/guide/compression' },
          { text: 'Storage & Database Schema', link: '/guide/storage' },
        ],
      },
      {
        text: 'AI Agent Integrations',
        items: [
          { text: 'Rules & Context Export', link: '/guide/rules-export' },
          { text: 'Model Context Protocol (MCP)', link: '/guide/mcp' },
          { text: 'Agent Workflow Best Practices', link: '/guide/agents-workflow' },
        ],
      },
      {
        text: 'Tools & Interfaces',
        items: [
          { text: 'CLI Reference', link: '/guide/cli' },
          { text: 'VS Code Extension', link: '/guide/vscode' },
          { text: 'Configuration Reference', link: '/guide/configuration' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/shditz/codeatlas' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present CodeAtlas',
    },

    search: {
      provider: 'local',
    },
  },
});
