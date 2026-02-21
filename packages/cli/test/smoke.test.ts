import { describe, expect, test } from 'bun:test';
import { createProgram } from '../src/index';

describe('cli', () => {
  test('has expected program name', () => {
    const program = createProgram();
    expect(program.name()).toBe('bb');
  });

  test('supports init positional argument', () => {
    const program = createProgram();
    const init = program.commands.find((command) => command.name() === 'init');
    expect(init).toBeDefined();
    expect(init?.registeredArguments[0]?.name()).toBe('project-name');
  });




  test('registers generate crud command', () => {
    const program = createProgram();
    const generate = program.commands.find((command) => command.name() === 'generate');
    expect(generate).toBeDefined();

    const crud = generate?.commands.find((command) => command.name() === 'crud');
    expect(crud).toBeDefined();
  });

  test('registers auth setup command', () => {
    const program = createProgram();
    const auth = program.commands.find((command) => command.name() === 'auth');
    expect(auth).toBeDefined();

    const setup = auth?.commands.find((command) => command.name() === 'setup');
    expect(setup).toBeDefined();
  });

  test('registers dev command', () => {
    const program = createProgram();
    const dev = program.commands.find((command) => command.name() === 'dev');
    expect(dev).toBeDefined();
  });

  test('registers migrate commands', () => {
    const program = createProgram();

    const migrate = program.commands.find((command) => command.name() === 'migrate');
    const preview = program.commands.find((command) => command.name() === 'migrate:preview');
    const production = program.commands.find((command) => command.name() === 'migrate:production');

    expect(migrate).toBeDefined();
    expect(preview).toBeDefined();
    expect(production).toBeDefined();
  });
});
