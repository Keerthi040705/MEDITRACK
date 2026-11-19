/**
 * SHAP feature-impact bars (green = increases risk, blue = lowers it).
 * unit="pts" shows impacts as percentage points (impact 0.12 -> "+12.0 pts").
 */
export default function ShapBars({ items = [], scale = 200, title, unit }) {
  const fmt = (v) => {
    const n = Number(v);
    const sign = n > 0 ? '+' : '';
    return unit === 'pts' ? `${sign}${(n * 100).toFixed(1)} pts` : `${sign}${n.toFixed(2)}`;
  };
  return (
    <>
      <div className="shap-section-title"><span>{title}</span></div>
      <div className="shap-bars-container">
        {items.map((s, i) => {
          const up = s.direction === 'RISK_INCREASING';
          return (
            <div className="shap-bar-item" key={`${s.feature}-${i}`}>
              <div className="shap-bar-label-row">
                <span>{s.feature}</span>
                <strong style={{ color: up ? 'var(--accent-emerald)' : '#38bdf8', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {fmt(s.impact)}
                </strong>
              </div>
              <div className="shap-bar-track">
                <div className={up ? 'shap-bar-pos' : 'shap-bar-neg'} style={{ width: `${Math.min(100, Math.abs(s.impact) * scale)}%` }} />
              </div>
              <small style={{ color: 'var(--text-dim)', fontSize: '0.74rem' }}>{s.explanation}</small>
            </div>
          );
        })}
      </div>
    </>
  );
}
