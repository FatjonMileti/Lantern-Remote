import { useEffect, useRef, useState } from 'react';
import { remoteInputService } from '../services/RemoteInputService.js';
import { useConnectionStore } from '../stores/connectionStore.js';
import { ConnectionToolbar } from './ConnectionToolbar.js';

interface RemoteDesktopViewerProps {
  stream: MediaStream | null;
  onDisconnect: () => void;
  isFullscreen?: boolean;
  onFullscreenChange?: (fullscreen: boolean) => void;
}

type VideoFrameCallback = (now: number) => void;

/**
 * Remote desktop viewer (Phase 5).
 *
 * Preserves aspect ratio, fits the available area, supports fullscreen and
 * 1:1 scaling, and shows connection state plus FPS/resolution. The stream is
 * attached imperatively via ref — React's video typings have no `srcObject`
 * prop, and this avoids any cast.
 */
export function RemoteDesktopViewer({
  stream,
  onDisconnect,
  isFullscreen = false,
  onFullscreenChange,
}: RemoteDesktopViewerProps) {
  const containerRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scaleMode, setScaleMode] = useState<'fit' | 'actual'>('fit');
  const [fps, setFps] = useState(0);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  // Capture is client-side only: the host never drives input into itself.
  const role = useConnectionStore((s) => s.role);
  const sessionStatus = useConnectionStore((s) => s.status);
  const inputActive = role === 'client' && sessionStatus === 'connected' && stream !== null;

  // Attach the remote stream imperatively; clear on teardown.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) {
      void video.play().catch(() => {
        // Autoplay may be blocked before user gesture; user can press play.
      });
    }
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  // Remote control: capture pointer events over the video while this client
  // is connected. Normalization/throttle/serialization live in the service —
  // this effect is wiring only, detached on cleanup.
  useEffect(() => {
    if (!inputActive) return;
    const video = videoRef.current;
    if (!video) return;
    return remoteInputService.attachCapture(video);
  }, [inputActive]);

  // Intrinsic size for the aspect-ratio box and overlay.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoadedMetadata = () => {
      setVideoSize({ width: video.videoWidth, height: video.videoHeight });
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [stream]);

  // FPS via per-frame callback when available, rAF otherwise. Handle is
  // cancelled on cleanup so no counting survives stream switches.
  useEffect(() => {
    if (!stream) {
      setFps(0);
      return;
    }
    let frames = 0;
    let lastWindowStart = performance.now();
    let handle = 0;
    let cancelled = false;
    const video = videoRef.current;

    const tick: VideoFrameCallback = (now: number) => {
      if (cancelled) return;
      frames += 1;
      if (now - lastWindowStart >= 1000) {
        setFps(frames);
        frames = 0;
        lastWindowStart = now;
      }
      schedule();
    };

    function schedule(): void {
      if (cancelled || !video) return;
      if (typeof video.requestVideoFrameCallback === 'function') {
        handle = video.requestVideoFrameCallback(tick);
      } else {
        handle = requestAnimationFrame(tick);
      }
    }

    schedule();
    return () => {
      cancelled = true;
      if (!video) return;
      if (typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(handle);
      } else {
        cancelAnimationFrame(handle);
      }
    };
  }, [stream]);

  // Fullscreen the whole viewer (video + toolbar). Browser chrome (Esc) is
  // reported back through `fullscreenchange` so store state never lies.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onChange = () => {
      onFullscreenChange?.(document.fullscreenElement === container);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, [onFullscreenChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = document.fullscreenElement === container;
    if (isFullscreen && !active) {
      void container.requestFullscreen().catch(() => {
        onFullscreenChange?.(false);
      });
    } else if (!isFullscreen && active) {
      void document.exitFullscreen().catch(() => {
        // Already exiting (e.g. Esc pressed); `fullscreenchange` syncs state.
      });
    }
  }, [isFullscreen, onFullscreenChange]);

  if (!stream) {
    return (
      <section className="viewer-card" aria-label="Remote screen">
        <div className="viewer-placeholder">
          <div className="viewer-placeholder-icon" aria-hidden="true">
            🖥️
          </div>
          <p>No active stream</p>
          <span className="hint">Waiting for the host to start sharing…</span>
        </div>
        <ConnectionToolbar onDisconnect={onDisconnect} disabled />
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className="viewer-card"
      aria-label="Remote screen"
      style={
        videoSize.width > 0 && videoSize.height > 0
          ? { aspectRatio: `${videoSize.width} / ${videoSize.height}` }
          : undefined
      }
    >
      <div className="viewer-container">
        <video
          ref={videoRef}
          className={`remote-video${scaleMode === 'actual' ? ' actual-size' : ''}`}
          autoPlay
          playsInline
        />
        <div className="viewer-overlay" aria-live="off">
          <span className="fps-badge">{fps} FPS</span>
          <span className="size-badge">
            {videoSize.width}×{videoSize.height}
          </span>
          {inputActive && (
            <span className="input-badge" title="Mouse input is being sent to the host">
              INPUT
            </span>
          )}
        </div>
      </div>
      <ConnectionToolbar
        scaleMode={scaleMode}
        onScaleModeChange={setScaleMode}
        onFullscreenToggle={() => onFullscreenChange?.(!isFullscreen)}
        isFullscreen={isFullscreen}
        onDisconnect={onDisconnect}
      />
    </section>
  );
}
