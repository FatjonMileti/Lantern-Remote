/**
 * Structured logger (Phase 10: rotating file transport in prod).
 *
 * WHY: connection/WebRTC/signaling diagnostics need consistent levels
 * from day one. Phase 10 extends this with rotating file transport.
 * NEVER log passwords, tokens, clipboard contents, or raw input events.
 */
import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_LOG_FILES = 3; // Keep 3 rotated files
const LOGS_DIR = 'logs';

/**
 * Detect development mode (for console-only logging).
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1';
}

export class Logger {
  private logFilePath: string | null = null;
  private initialized = false;

  constructor(
    private readonly scope: string,
    private readonly minLevel: LogLevel = 'info',
  ) {}

  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write('info', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.write('error', message, args);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (isDevelopment()) {
      this.initialized = true;
      return;
    }

    try {
      const logsDir = join(app.getPath('userData'), LOGS_DIR);
      await mkdir(logsDir, { recursive: true });
      this.logFilePath = join(logsDir, `${this.scope}.log`);
      this.initialized = true;
    } catch (error) {
      // If file logging fails, fall back to console-only and log the error
      console.error('[Logger] Failed to initialize file logging:', error);
      this.initialized = true;
    }
  }

  private async rotateLogFile(): Promise<void> {
    if (!this.logFilePath) return;

    try {
      const stats = await stat(this.logFilePath);
      if (stats.size < MAX_LOG_SIZE) return;

      // Rotate: current.log -> current.1.log -> current.2.log -> delete oldest
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const oldPath = i === 1 ? this.logFilePath : `${this.logFilePath}.${i - 1}`;
        const newPath = `${this.logFilePath}.${i}`;
        try {
          await rename(oldPath, newPath);
        } catch {
          // File might not exist, skip
        }
      }
    } catch (error) {
      // If rotation fails, continue with current file
      console.error('[Logger] Failed to rotate log file:', error);
    }
  }

  private write(level: LogLevel, message: string, args: unknown[]): void {
    if (levelOrder[level] < levelOrder[this.minLevel]) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.scope}] [${level.toUpperCase()}]`;
    const formattedMessage = `${prefix} ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`;

    // Always write to console in development or on error
    if (isDevelopment() || level === 'error') {
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    }

    // Write to file in production (async, fire-and-forget)
    if (!isDevelopment() && this.logFilePath) {
      void (async () => {
        try {
          await this.ensureInitialized();
          await this.rotateLogFile();
          if (this.logFilePath) {
            await appendFile(this.logFilePath, formattedMessage, 'utf8');
          }
        } catch {
          // Silently fail on file write errors to avoid disrupting the app
        }
      })();
    }
  }
}
