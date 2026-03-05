import { Command, CommanderError } from 'commander';
import { runInitCommand } from './commands/init';
import { runDevCommand } from './commands/dev';
import { runMigrateCommand } from './commands/migrate';
import { runAuthSetupCommand } from './commands/auth';
import { runGenerateCrudCommand } from './commands/generate';
import { runStorageInitCommand, runStorageBucketsListCommand, runStorageUploadCommand } from './commands/storage';
import { runGenerateGraphqlCommand, runGraphqlPlaygroundCommand } from './commands/graphql';
import { runRlsCommand } from './commands/rls';
import { runWebhookCommand } from './commands/webhook';
import { runFunctionCommand } from './commands/function';
import { runLoginCommand, runLogoutCommand, isAuthenticated } from './commands/login';
import * as logger from './utils/logger';
import packageJson from '../package.json';

// Commands that don't require authentication
const PUBLIC_COMMANDS = ['login', 'logout', 'version', 'help'];

/**
 * Check if the user is authenticated before running a command.
 */
async function checkAuthHook(): Promise<void> {
  const commandName = process.argv[2];
  
  // Skip auth check for public commands
  if (PUBLIC_COMMANDS.includes(commandName)) {
    return;
  }
  
  // Check authentication status
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    logger.error(
      "Not logged in. Run: bb login\n" +
      "This connects your CLI with BetterBase so your project\n" +
      "can be registered and managed from the dashboard."
    );
    process.exit(1);
  }
}

/**
 * Create and configure the BetterBase CLI program.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('bb')
    .description('BetterBase CLI')
    .version(packageJson.version, '-v, --version', 'display the CLI version')
    .exitOverride()
    .hook('preAction', checkAuthHook);

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
      const cleanup = await runDevCommand(projectRoot);

      let cleanedUp = false;
      const onExit = (): void => {
        if (!cleanedUp) {
          cleanedUp = true;
          try {
            cleanup();
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.warn(`Dev cleanup failed: ${message}`);
          }
        }

        process.off('SIGINT', onSigInt);
        process.off('SIGTERM', onSigTerm);
        process.off('exit', onProcessExit);
      };
      const onSigInt = (): void => {
        onExit();
        process.exit(0);
      };
      const onSigTerm = (): void => {
        onExit();
        process.exit(0);
      };
      const onProcessExit = (): void => {
        onExit();
      };

      process.on('SIGINT', onSigInt);
      process.on('SIGTERM', onSigTerm);
      process.on('exit', onProcessExit);
    });


  const auth = program.command('auth').description('Authentication helpers');

  auth
    .command('setup')
    .description('Install and scaffold BetterAuth integration')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runAuthSetupCommand(projectRoot);
    });


  const generate = program.command('generate').description('Code generation helpers');

  generate
    .command('crud')
    .description('Generate full CRUD routes for a table')
    .argument('<table-name>', 'table name from src/db/schema.ts')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (tableName: string, projectRoot: string) => {
      await runGenerateCrudCommand(projectRoot, tableName);
    });

  const graphql = program.command('graphql').description('GraphQL API management');

  graphql
    .command('generate')
    .description('Generate GraphQL schema from database schema')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runGenerateGraphqlCommand(projectRoot);
    });

  graphql
    .command('playground')
    .description('Open GraphQL Playground in browser')
    .action(async () => {
      await runGraphqlPlaygroundCommand();
    });

  const migrate = program.command('migrate').description('Generate and apply migrations for local development');

  migrate
    .action(async () => {
      await runMigrateCommand({});
    });

  migrate
    .command('preview')
    .description('Preview migration diff without applying changes')
    .action(async () => {
      await runMigrateCommand({ preview: true });
    });

  migrate
    .command('production')
    .description('Apply migrations to production (requires confirmation)')
    .action(async () => {
      await runMigrateCommand({ production: true });
    });


  const storage = program.command('storage').description('Storage management');

  storage
    .command('init')
    .description('Initialize storage with a provider')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runStorageInitCommand(projectRoot);
    });

  storage
    .command('list')
    .description('List objects in storage bucket')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runStorageBucketsListCommand(projectRoot);
    });

  storage
    .command('buckets')
    .description('List objects in storage bucket (alias for list)')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runStorageBucketsListCommand(projectRoot);
    });

  storage
    .command('upload')
    .description('Upload a file to storage')
    .argument('<file>', 'file path to upload')
    .option('-b, --bucket <name>', 'bucket name')
    .option('-p, --path <path>', 'remote path')
    .option('-r, --root <path>', 'project root directory', process.cwd())
    .action(async (file: string, options: { bucket?: string; path?: string; root?: string }) => {
      await runStorageUploadCommand(file, {
        bucket: options.bucket,
        path: options.path,
        projectRoot: options.root,
      });
    });


  const rls = program.command('rls').description('Row Level Security policy management');

  rls
    .command('create')
    .description('Create a new RLS policy file for a table')
    .argument('<table>', 'table name')
    .action(async (table: string) => {
      await runRlsCommand(['create', table]);
    });

  rls
    .command('list')
    .description('List all RLS policy files')
    .action(async () => {
      await runRlsCommand(['list']);
    });

  rls
    .command('disable')
    .description('Show how to disable RLS for a table')
    .argument('<table>', 'table name')
    .action(async (table: string) => {
      await runRlsCommand(['disable', table]);
    });

  rls
    .action(async () => {
      await runRlsCommand([]);
    });

  const webhook = program.command('webhook').description('Webhook management');

  webhook
    .command('create')
    .description('Create a new webhook')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runWebhookCommand(['create'], projectRoot);
    });

  webhook
    .command('list')
    .description('List all configured webhooks')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runWebhookCommand(['list'], projectRoot);
    });

  webhook
    .command('test')
    .description('Test a webhook by sending a synthetic payload')
    .argument('<webhook-id>', 'webhook ID to test')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (webhookId: string, projectRoot: string) => {
      await runWebhookCommand(['test', webhookId], projectRoot);
    });

  webhook
    .command('logs')
    .description('Show delivery logs for a webhook')
    .argument('<webhook-id>', 'webhook ID')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (webhookId: string, projectRoot: string) => {
      await runWebhookCommand(['logs', webhookId], projectRoot);
    });

  webhook
    .action(async () => {
      await runWebhookCommand([], process.cwd());
    });

  const fn = program.command('function').description('Edge function management');

  fn
    .command('create')
    .description('Create a new edge function')
    .argument('<name>', 'function name')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (name: string, projectRoot: string) => {
      await runFunctionCommand(['create', name], projectRoot);
    });

  fn
    .command('dev')
    .description('Run function locally with hot reload')
    .argument('<name>', 'function name')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (name: string, projectRoot: string) => {
      await runFunctionCommand(['dev', name], projectRoot);
    });

  fn
    .command('build')
    .description('Bundle function for deployment')
    .argument('<name>', 'function name')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (name: string, projectRoot: string) => {
      await runFunctionCommand(['build', name], projectRoot);
    });

  fn
    .command('list')
    .description('List all functions')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (projectRoot: string) => {
      await runFunctionCommand(['list'], projectRoot);
    });

  fn
    .command('logs')
    .description('Show function logs')
    .argument('<name>', 'function name')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (name: string, projectRoot: string) => {
      await runFunctionCommand(['logs', name], projectRoot);
    });

  fn
    .command('deploy')
    .description('Deploy function to cloud')
    .argument('<name>', 'function name')
    .option('--sync-env', 'Sync environment variables from .env')
    .argument('[project-root]', 'project root directory', process.cwd())
    .action(async (name: string, options: { syncEnv?: boolean; projectRoot?: string }) => {
      const projectRoot = options.projectRoot ?? process.cwd();
      await runFunctionCommand(['deploy', name, options.syncEnv ? '--sync-env' : ''], projectRoot);
    });

  // ── bb login — STAGED FOR ACTIVATION ────────────────────────────────────────
  // This code is complete and tested. Uncomment when app.betterbase.com is live.
  // See: betterbase_backend_rebuild.md Part 3
  // ────────────────────────────────────────────────────────────────────────────
  program
    .command('login')
    .description('Authenticate the CLI with app.betterbase.com')
    .action(runLoginCommand);
  
  program
    .command('logout')
    .description('Sign out of app.betterbase.com')
    .action(runLogoutCommand);

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
		if (
			err instanceof CommanderError &&
			(err.code === "commander.helpDisplayed" || err.code === "commander.version")
		) {
			return;
		}

		throw err;
	}
}

if (import.meta.main) {
	try {
		await runCli();
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown CLI error";
		logger.error(message);
		process.exitCode = 1;
	}
}
