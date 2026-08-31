import { Command } from 'commander';
import chalk from 'chalk';
import { registerInitCommand } from './commands/init.js';
import { registerScanCommand } from './commands/scan.js';
import { registerIndexCommand } from './commands/index-cmd.js';
import { registerMapCommand } from './commands/map.js';
import { registerSearchCommand } from './commands/search.js';
import { registerContextCommand } from './commands/context.js';
import { registerRulesCommand } from './commands/rules.js';
import { registerExportCommand } from './commands/export.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerCleanCommand } from './commands/clean.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerWatchCommand } from './commands/watch.js';
import { registerDiffCommand } from './commands/diff.js';
import { registerPrCommand } from './commands/pr.js';
import { registerQueryCommand } from './commands/query.js';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerInstallHooksCommand } from './commands/install-hooks.js';
import { registerAuditCommand } from './commands/audit-cmd.js';
import { registerLinkCommand } from './commands/link-cmd.js';
import updateNotifier from 'update-notifier';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

updateNotifier({ pkg }).notify();

const program = new Command();

program
  .name('atlas')
  .description(chalk.bold('CodeAtlas') + ' — Give AI a map of your codebase.')
  .version('1.5.1');

registerInitCommand(program);
registerScanCommand(program);
registerIndexCommand(program);
registerMapCommand(program);
registerSearchCommand(program);
registerContextCommand(program);
registerRulesCommand(program);
registerExportCommand(program);
registerDoctorCommand(program);
registerCleanCommand(program);
registerMcpCommand(program);
registerWatchCommand(program);
registerDiffCommand(program);
registerPrCommand(program);
registerQueryCommand(program);
registerAnalyzeCommand(program);
registerInstallHooksCommand(program);
registerAuditCommand(program);
registerLinkCommand(program);

program.parse(process.argv);
