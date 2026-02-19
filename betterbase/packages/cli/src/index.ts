import { Command, CommanderError } from 'commander';
import { runInitCommand } from './commands/init';
import { runDevCommand } from './commands/dev';
import { runMigrateCommand } from './commands/migrate';
import { runAuthSetupCommand } from './commands/auth';
import * as logger from './utils/logger';
import packageJson from '../package.json';

/**
 * Create and configure the BetterBase CLI program.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('bb')
    .description('BetterBase CLI')
    .version(packageJson.version, '-v, --version', 'display the CLI version')
    .exitOverride();

  program
    .command('init')
    .description('Initialize a BetterBase project')
    .argument('[project-name]', 'project name')
    .action(async (projectName?: string) => {
      await runInitCommand({ projectName });
    });


  program
    .command('dev')
    .description('Watch schema/routes and regenerate .betterbase-context.json')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runDevCommand(projectRoot);
    });


  const auth = program.command('auth').description('Authentication helpers');

  auth
    .command('setup')
    .description('Install and scaffold BetterAuth integration')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runAuthSetupCommand(projectRoot);
    });

  program
    .command('migrate')
    .description('Generate and apply migrations for local development')
    .action(async () => {
      await runMigrateCommand({});
    });

  program
    .command('migrate:preview')
    .description('Preview migration diff without applying changes')
    .action(async () => {
      await runMigrateCommand({ preview: true });
    });

  program
    .command('migrate:production')
    .description('Apply migrations to production (requires confirmation)')
    .action(async () => {
      await runMigrateCommand({ production: true });
    });

  return program;
}

/**
 * Execute the CLI with process arguments.
 */
export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError && (err.code === 'commander.helpDisplayed' || err.code === 'commander.version')) {
      return;
    }

    throw err;
  }
}

if (import.meta.main) {
  try {
    await runCli();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown CLI error';
    logger.error(message);
    process.exitCode = 1;
  }
}
