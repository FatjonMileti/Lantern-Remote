/**
 * Mock adapters for platform input testing.
 *
 * WHY: tests must never move the real OS cursor. These mocks validate
 * the protocol and coordinate math without side effects.
 */

export interface MockInputAdapter {
  move(x: number, y: number): Promise<void>;
  button(button: string, event: string): Promise<void>;
  wheel(deltaX: number, deltaY: number): Promise<void>;
  key(code: string, event: string): Promise<void>;
}

export class MockLinuxInputAdapter implements MockInputAdapter {
  private commands: string[] = [];

  async move(x: number, y: number): Promise<void> {
    this.commands.push(`mousemove ${x} ${y}`);
  }

  async button(button: string, event: string): Promise<void> {
    this.commands.push(`mousedown ${button}`);
    if (event === 'up') {
      this.commands.push(`mouseup ${button}`);
    }
  }

  async wheel(deltaX: number, deltaY: number): Promise<void> {
    this.commands.push(`wheel ${deltaX} ${deltaY}`);
  }

  async key(code: string, event: string): Promise<void> {
    this.commands.push(`key ${code} ${event}`);
  }

  getCommands(): string[] {
    return [...this.commands];
  }

  clear(): void {
    this.commands = [];
  }
}

export class MockWindowsInputAdapter implements MockInputAdapter {
  private commands: string[] = [];

  async move(x: number, y: number): Promise<void> {
    this.commands.push(`mousemove ${x} ${y}`);
  }

  async button(button: string, event: string): Promise<void> {
    this.commands.push(`mousebutton ${button} ${event}`);
  }

  async wheel(deltaX: number, deltaY: number): Promise<void> {
    this.commands.push(`mousewheel ${deltaX} ${deltaY}`);
  }

  async key(code: string, event: string): Promise<void> {
    this.commands.push(`key ${code} ${event}`);
  }

  getCommands(): string[] {
    return [...this.commands];
  }

  clear(): void {
    this.commands = [];
  }
}

export class MockMacOSInputAdapter implements MockInputAdapter {
  private commands: string[] = [];

  async move(x: number, y: number): Promise<void> {
    this.commands.push(`m ${x} ${y}`);
  }

  async button(button: string, event: string): Promise<void> {
    if (event === 'down') {
      this.commands.push(`dd ${button}`);
    } else if (event === 'up') {
      this.commands.push(`du ${button}`);
    }
  }

  async wheel(_deltaX: number, _deltaY: number): Promise<void> {
    // cliclick doesn't support wheel, so this is a no-op
    this.commands.push('wheel unsupported');
  }

  async key(code: string, event: string): Promise<void> {
    if (event === 'down') {
      this.commands.push(`kd ${code}`);
    } else if (event === 'up') {
      this.commands.push(`ku ${code}`);
    }
  }

  getCommands(): string[] {
    return [...this.commands];
  }

  clear(): void {
    this.commands = [];
  }
}
