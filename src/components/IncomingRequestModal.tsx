interface IncomingRequestModalProps {
  fromDeviceId: string;
  onAccept: () => void;
  onReject: () => void;
}

/** Host-side consent dialog. Accept is always explicit — never auto-approved. */
export function IncomingRequestModal({
  fromDeviceId,
  onAccept,
  onReject,
}: IncomingRequestModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="incoming-title"
        aria-describedby="incoming-desc"
      >
        <h2 id="incoming-title">Incoming connection</h2>
        <p id="incoming-desc">
          Incoming connection from <strong>{fromDeviceId}</strong>
        </p>
        <div className="row">
          <button type="button" onClick={onAccept}>
            Accept
          </button>
          <button type="button" className="button-secondary" onClick={onReject}>
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
