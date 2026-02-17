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
});
