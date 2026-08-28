local M = {}

M.config = {
  bin_path = 'atlas',
  default_token_budget = 12000,
  floating_window = true,
}

function M.setup(opts)
  M.config = vim.tbl_deep_extend('force', M.config, opts or {})
end

local function open_floating_window(title, lines, filetype)
  local width = math.floor(vim.o.columns * 0.8)
  local height = math.floor(vim.o.lines * 0.8)
  local row = math.floor((vim.o.lines - height) / 2)
  local col = math.floor((vim.o.columns - width) / 2)

  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)

  if filetype then
    vim.api.nvim_set_option_value('filetype', filetype, { buf = buf })
  end

  local win = vim.api.nvim_open_win(buf, true, {
    relative = 'editor',
    width = width,
    height = height,
    row = row,
    col = col,
    style = 'minimal',
    border = 'rounded',
    title = ' ' .. title .. ' ',
    title_pos = 'center',
  })

  vim.api.nvim_buf_set_keymap(buf, 'n', 'q', ':close<CR>', { noremap = true, silent = true })
  vim.api.nvim_buf_set_keymap(buf, 'n', '<Esc>', ':close<CR>', { noremap = true, silent = true })

  return buf, win
end

function M.run_command(args, on_success, on_error)
  local cmd = { M.config.bin_path }
  for _, arg in ipairs(args) do
    table.insert(cmd, arg)
  end

  local output = {}
  local errors = {}

  local job_id = vim.fn.jobstart(cmd, {
    stdout_buffered = true,
    stderr_buffered = true,
    on_stdout = function(_, data)
      if data then
        for _, line in ipairs(data) do
          if line ~= '' then
            table.insert(output, line)
          end
        end
      end
    end,
    on_stderr = function(_, data)
      if data then
        for _, line in ipairs(data) do
          if line ~= '' then
            table.insert(errors, line)
          end
        end
      end
    end,
    on_exit = function(_, exit_code)
      if exit_code == 0 then
        if on_success then
          on_success(output)
        end
      else
        local err_msg = table.concat(errors, '\n')
        if on_error then
          on_error(err_msg)
        else
          vim.notify('CodeAtlas Error: ' .. err_msg, vim.log.levels.ERROR)
        end
      end
    end,
  })

  if job_id <= 0 then
    vim.notify('Failed to start CodeAtlas binary at: ' .. M.config.bin_path, vim.log.levels.ERROR)
  end
end

function M.index()
  vim.notify('CodeAtlas: Indexing repository...', vim.log.levels.INFO)
  M.run_command({ 'index' }, function(output)
    vim.notify('CodeAtlas: Indexing completed successfully!', vim.log.levels.INFO)
  end)
end

function M.analyze()
  vim.notify('CodeAtlas: Running architecture analysis...', vim.log.levels.INFO)
  M.run_command({ 'analyze' }, function(output)
    open_floating_window('CodeAtlas Architecture Analysis', output, 'markdown')
  end)
end

function M.query(queryString)
  if not queryString or queryString == '' then
    queryString = vim.fn.input('Enter Cypher or Natural Language Query: ')
  end
  if queryString == '' then
    return
  end

  vim.notify('CodeAtlas: Executing graph query...', vim.log.levels.INFO)
  M.run_command({ 'query', queryString }, function(output)
    open_floating_window('CodeAtlas Query: ' .. queryString, output, 'text')
  end)
end

function M.context(task)
  if not task or task == '' then
    task = vim.fn.input('Enter Task description for Context Pack: ')
  end
  if task == '' then
    return
  end

  vim.notify('CodeAtlas: Building context pack for "' .. task .. '"...', vim.log.levels.INFO)
  M.run_command({ 'context', task, '--budget', tostring(M.config.default_token_budget) }, function(output)
    open_floating_window('CodeAtlas Context: ' .. task, output, 'markdown')
  end)
end

return M
