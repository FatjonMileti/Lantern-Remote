import { useEffect, useRef } from 'react';
import { useConnectionStore } from '../stores/connectionStore.js';

/**
 * Minimal remote video view (Phase 4). Shows the peer's shared screen once
 * the host starts sharing. Phase 5 replaces this with the full
 * RemoteDesktopViewer (scaling, fullscreen, FPS overlay, toolbar).
 */
export function RemoteVideo() {
  const remoteStream = useConnectionStore((s) => s.remoteStream);
  const status = useConnectionStore((s) => s.status);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = remoteStream;
    if (!remoteStream) {
      video.removeAttribute('src');
    }
  }, [remoteStream]);

  return (
    <section className="card card-wide" aria-label="Remote screen">
      <h2>Remote Screen</h2>
      {remoteStream ? (
        <video ref={videoRef} className="remote-video" autoPlay playsInline />
      ) : (
        <p className="hint">
          {status === 'connected'
            ? 'Connected — waiting for the host to start sharing.'
            : 'No active session.'}
        </p>
      )}
    </section>
  );
}
