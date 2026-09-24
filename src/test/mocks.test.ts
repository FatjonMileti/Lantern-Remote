import { describe, it, expect, beforeEach } from 'vitest';
import {
  MockLinuxInputAdapter,
  MockWindowsInputAdapter,
  MockMacOSInputAdapter,
} from './mocks.js';

describe('Mock Input Adapters', () => {
  describe('MockLinuxInputAdapter', () => {
    let adapter: MockLinuxInputAdapter;

    beforeEach(() => {
      adapter = new MockLinuxInputAdapter();
    });

    it('records mouse move commands', async () => {
      await adapter.move(100, 200);
      expect(adapter.getCommands()).toEqual(['mousemove 100 200']);
    });

    it('records mouse button commands', async () => {
      await adapter.button('left', 'down');
      expect(adapter.getCommands()).toEqual(['mousedown left']);

      adapter.clear();
      await adapter.button('right', 'up');
      expect(adapter.getCommands()).toEqual(['mousedown right', 'mouseup right']);
    });

    it('records wheel commands', async () => {
      await adapter.wheel(50, -30);
      expect(adapter.getCommands()).toEqual(['wheel 50 -30']);
    });

    it('records key commands', async () => {
      await adapter.key('KeyA', 'down');
      expect(adapter.getCommands()).toEqual(['key KeyA down']);
    });

    it('can clear command history', async () => {
      await adapter.move(100, 200);
      adapter.clear();
      expect(adapter.getCommands()).toEqual([]);
    });
  });

  describe('MockWindowsInputAdapter', () => {
    let adapter: MockWindowsInputAdapter;

    beforeEach(() => {
      adapter = new MockWindowsInputAdapter();
    });

    it('records mouse move commands', async () => {
      await adapter.move(100, 200);
      expect(adapter.getCommands()).toEqual(['mousemove 100 200']);
    });

    it('records mouse button commands', async () => {
      await adapter.button('left', 'down');
      expect(adapter.getCommands()).toEqual(['mousebutton left down']);
    });

    it('records wheel commands', async () => {
      await adapter.wheel(50, -30);
      expect(adapter.getCommands()).toEqual(['mousewheel 50 -30']);
    });

    it('records key commands', async () => {
      await adapter.key('KeyA', 'down');
      expect(adapter.getCommands()).toEqual(['key KeyA down']);
    });

    it('can clear command history', async () => {
      await adapter.move(100, 200);
      adapter.clear();
      expect(adapter.getCommands()).toEqual([]);
    });
  });

  describe('MockMacOSInputAdapter', () => {
    let adapter: MockMacOSInputAdapter;

    beforeEach(() => {
      adapter = new MockMacOSInputAdapter();
    });

    it('records mouse move commands with cliclick format', async () => {
      await adapter.move(100, 200);
      expect(adapter.getCommands()).toEqual(['m 100 200']);
    });

    it('records mouse button commands with cliclick format', async () => {
      await adapter.button('left', 'down');
      expect(adapter.getCommands()).toEqual(['dd left']);

      adapter.clear();
      await adapter.button('right', 'up');
      expect(adapter.getCommands()).toEqual(['du right']);
    });

    it('records wheel as unsupported', async () => {
      await adapter.wheel(50, -30);
      expect(adapter.getCommands()).toEqual(['wheel unsupported']);
    });

    it('records key commands with cliclick format', async () => {
      await adapter.key('KeyA', 'down');
      expect(adapter.getCommands()).toEqual(['kd KeyA']);

      adapter.clear();
      await adapter.key('KeyA', 'up');
      expect(adapter.getCommands()).toEqual(['ku KeyA']);
    });

    it('can clear command history', async () => {
      await adapter.move(100, 200);
      adapter.clear();
      expect(adapter.getCommands()).toEqual([]);
    });
  });

  describe('Mock adapter safety', () => {
    it('never actually moves the OS cursor', async () => {
      const adapter = new MockLinuxInputAdapter();
      await adapter.move(100, 200);
      // This should only record commands, not move the real cursor
      expect(adapter.getCommands()).toHaveLength(1);
    });

    it('never performs real keyboard input', async () => {
      const adapter = new MockWindowsInputAdapter();
      await adapter.key('KeyA', 'down');
      // This should only record commands, not type in the real system
      expect(adapter.getCommands()).toHaveLength(1);
    });
  });
});
