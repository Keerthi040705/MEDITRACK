export default function Splash({ onEnter }) {
  return (
    <section className="page-view active">
      <div className="splash-container">


        <h1 className="splash-title">MediTrack</h1>

        <button type="button" className="btn-enter-portal" style={{ marginTop: 36 }} onClick={onEnter}>
          <span>Enter</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </section>
  );
}
