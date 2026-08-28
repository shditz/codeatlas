if vim.g.loaded_codeatlas then
  return
end
vim.g.loaded_codeatlas = 1

local codeatlas = require('codeatlas')

vim.api.nvim_create_user_command('CodeAtlasIndex', function()
  codeatlas.index()
end, { desc = 'Index current codebase with CodeAtlas' })

vim.api.nvim_create_user_command('CodeAtlasAnalyze', function()
  codeatlas.analyze()
end, { desc = 'Run deep graph architectural analysis with CodeAtlas' })

vim.api.nvim_create_user_command('CodeAtlasQuery', function(opts)
  codeatlas.query(opts.args)
end, { nargs = '?', desc = 'Run Cypher or natural language query on codebase graph' })

vim.api.nvim_create_user_command('CodeAtlasContext', function(opts)
  codeatlas.context(opts.args)
end, { nargs = '?', desc = 'Generate AI token-budgeted context pack for a task' })
