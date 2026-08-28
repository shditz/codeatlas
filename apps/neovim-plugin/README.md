# CodeAtlas Neovim Plugin

Brings CodeAtlas context intelligence, graph architecture analysis, and natural language queries directly into Neovim.

## 📦 Installation

Using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
  'codeatlas/codeatlas.nvim',
  dependencies = { 'nvim-lua/plenary.nvim' },
  config = function()
    require('codeatlas').setup({
      bin_path = 'atlas', -- path to your global atlas binary
      default_token_budget = 12000,
    })
  end,
}
```

## 🚀 Available Commands

| Command | Description |
|---|---|
| `:CodeAtlasIndex` | Indexes the workspace files, AST symbols, and dependency graph |
| `:CodeAtlasAnalyze` | Opens a floating window with dead code, cycle detection, and coupling metrics |
| `:CodeAtlasQuery <query>` | Runs a Cypher query or Natural Language query and displays the table |
| `:CodeAtlasContext <task>` | Generates a token-budgeted Context Pack for your coding task |
