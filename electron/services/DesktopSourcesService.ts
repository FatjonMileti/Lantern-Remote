import { desktopCapturer } from 'electron';
import type { DesktopSource } from '../../shared/ipc.js';

/**
 * Lists capturable displays via Electron's desktopCapturer.
 *
 * WHY main-process: `desktopCapturer` is a privileged Electron API the
 * renderer must never touch. Main returns plain data (ids, names, thumbnail
 * previews); the renderer turns the chosen id into a MediaStream with
 * standard getUserMedia constraints — no Electron in the renderer.
 */
export class DesktopSourcesService {
  async listScreens(): Promise<DesktopSource[]> {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 320, height: 200 },
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.name || 'Display',
      thumbnailDataUrl: source.thumbnail.isEmpty()
        ? ''
        : source.thumbnail.toDataURL(),
    }));
  }
}
