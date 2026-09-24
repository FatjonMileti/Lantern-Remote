import { describe, it, expect, beforeEach } from 'vitest';
import { serializeClipboardMessage } from '../../shared/clipboard.js';
import {
  RendererClipboardService,
  clipboardService,
  type ClipboardDeps,
} from './ClipboardService.js';

/**
 * Clipboard sync behavior through the injectable deps seam — no bridge,
 * no DataChannel, no timers relied upon beyond start/stop. Live-default
 * calls are covered by the `window.lantern` mock in test setup.
 */
function makeDeps(
  local = '',
): ClipboardDeps & { sent: string[]; written: string[]; local: string } {
  const deps: ClipboardDeps & { sent: string[]; written: string[]; local: string } = {
    local,
    sent: [],
    written: [],
    readLocal: async () => deps.local,
    writeLocal: async (text: string) => {
      deps.written.push(text);
      deps.local = text;
      return true;
    },
    send: (data: string) => {
      deps.sent.push(data);
      return true;
    },
  };
  return deps;
}

async function started(service: RendererClipboardService, deps: ClipboardDeps): Promise<void> {
  service.start(deps);
  // Seed read resolves through chained microtasks; a macrotask flushes all.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('RendererClipboardService', () => {
  beforeEach(() => {
    clipboardService.stop();
  });

  describe('start/stop lifecycle', () => {
    it('starts and stops without throwing', () => {
      const deps = makeDeps();
      expect(() => clipboardService.start(deps)).not.toThrow();
      expect(() => clipboardService.stop()).not.toThrow();
    });

    it('stopping when not started is safe', () => {
      expect(() => clipboardService.stop()).not.toThrow();
    });

    it('stop is idempotent', () => {
      const deps = makeDeps();
      clipboardService.start(deps);
      clipboardService.stop();
      expect(() => clipboardService.stop()).not.toThrow();
    });

    it('can be restarted after stop', () => {
      const deps = makeDeps();
      clipboardService.start(deps);
      clipboardService.stop();
      expect(() => clipboardService.start(deps)).not.toThrow();
      clipboardService.stop();
    });
  });

  describe('change detection', () => {
    it('seeds the baseline without sending', async () => {
      const svc = new RendererClipboardService();
      const deps = makeDeps('pre-existing');
      await started(svc, deps);
      await svc.pollOnce(deps);
      expect(deps.sent).toHaveLength(0);
      svc.stop();
    });

    it('sends a local change exactly once', async () => {
      const svc = new RendererClipboardService();
      const deps = makeDeps('seed');
      await started(svc, deps);
      deps.local = 'copied text';
      await svc.pollOnce(deps);
      expect(deps.sent).toHaveLength(1);
      expect(JSON.parse(deps.sent[0] ?? '').text).toBe('copied text');
      await svc.pollOnce(deps);
      expect(deps.sent).toHaveLength(1);
      svc.stop();
    });
  });

  describe('inbound handling', () => {
    it('applies a valid frame locally', async () => {
      const svc = new RendererClipboardService();
      const deps = makeDeps('');
      await started(svc, deps);
      await svc.handleRemoteMessage(
        serializeClipboardMessage({ kind: 'clipboard-text', text: 'from peer' }),
        deps,
      );
      expect(deps.written).toEqual(['from peer']);
      svc.stop();
    });

    it('does not echo applied text back', async () => {
      const svc = new RendererClipboardService();
      const deps = makeDeps('');
      await started(svc, deps);
      await svc.handleRemoteMessage(
        serializeClipboardMessage({ kind: 'clipboard-text', text: 'from peer' }),
        deps,
      );
      await svc.pollOnce(deps);
      expect(deps.sent).toHaveLength(0);
      svc.stop();
    });

    it('ignores malformed, duplicate, and oversize frames', async () => {
      const svc = new RendererClipboardService();
      const deps = makeDeps('');
      await started(svc, deps);
      const frame = serializeClipboardMessage({ kind: 'clipboard-text', text: 'ok' });
      await svc.handleRemoteMessage(frame, deps);
      expect(deps.written).toHaveLength(1);
      await svc.handleRemoteMessage('{{bad json', deps);
      await svc.handleRemoteMessage(JSON.stringify({ kind: 'nope', text: 'x' }), deps);
      await svc.handleRemoteMessage(
        serializeClipboardMessage({ kind: 'clipboard-text', text: 'x'.repeat(300 * 1024) }),
        deps,
      );
      await svc.handleRemoteMessage(frame, deps);
      expect(deps.written).toHaveLength(1);
      svc.stop();
    });
  });

  describe('stopped service', () => {
    it('poll is a no-op and inbound is dropped', async () => {
      const svc = new RendererClipboardService();
      const deps = makeDeps('something');
      await svc.pollOnce(deps);
      await svc.handleRemoteMessage(
        serializeClipboardMessage({ kind: 'clipboard-text', text: 'peer text' }),
        deps,
      );
      expect(deps.sent).toHaveLength(0);
      expect(deps.written).toHaveLength(0);
    });
  });
});
