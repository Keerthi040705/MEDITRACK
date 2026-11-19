import { useState } from 'react';
import { SectionHeader } from '../../components/DashboardLayout';
import ShapBars from '../../components/ShapBars';
import { useToast } from '../../context/ToastContext';
import { Api } from '../../api/client';
import { useAction } from '../../utils/useApi';
import { riskBadgeClass } from '../../utils/format';
import { SYMPTOMS } from '../../constants';

export default function SymptomChecker({ onOpenModel }) {
 const { showToast } = useToast();
 const { busy, run } = useAction();
 const [selected, setSelected] = useState([]);
 const [result, setResult] = useState(null);

 const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

 const analyze = async () => {
 if (!selected.length) return showToast('Please check at least one symptom to run AI analysis.', 'error');
 const { ok, result: res } = await run(() => Api.checkSymptoms(selected));
 if (ok) setResult(res);
 };

 return (
 <>
 <SectionHeader
 title="Symptom Checker"
 subtitle="Checks selected symptoms against five condition profiles and explains each match with exact Shapley contributions"
 />

 <div className="ai-checker-container">
 <div className="symptom-selection-card">
 <h3 style={{ fontSize: '1.15rem', color: 'var(--accent-emerald)', marginBottom: 4 }}>Select Observed Symptoms</h3>
 <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Check all symptoms you are currently experiencing:</p>
 <div className="symptoms-checkbox-grid">
 {SYMPTOMS.map((s) => (
 <label key={s.id} className={`symptom-chip ${selected.includes(s.id) ? 'selected' : ''}`}>
 <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
 <span>{s.label}</span>
 </label>
 ))}
 </div>
 <button type="button" className="btn-primary" style={{ fontSize: '1.05rem' }} disabled={busy} onClick={analyze}>
 <span>{busy ? 'Analyzing…' : ' Check Symptoms'}</span>
 </button>
 </div>

 <div className="ai-results-panel">
 <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: 8 }}> Symptom Match Results</h3>
 {!result && (
 <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '50px 20px' }}>
 <div style={{ fontSize: '2.5rem', marginBottom: 12, color: 'var(--accent-emerald)' }}></div>
 <p>Tick your symptoms on the left and click &quot;Check Symptoms&quot;.</p>
 </div>
 )}
 {result && !result.predictions?.length && (
 <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>
 {result.message || 'No condition matches the selected symptoms.'}
 </div>
 )}
 {result?.predictions?.length > 0 && (
 <>
 <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
 <small style={{ color: 'var(--accent-emerald)', fontWeight: 700, textTransform: 'uppercase' }}>Closest match</small>
 <h3 style={{ fontSize: '1.4rem', color: '#fff' }}>{result.primaryDiagnosis}</h3>
 <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
 Symptom match score: <strong style={{ color: 'var(--accent-emerald)' }}>{result.confidenceScore}/100</strong>
 </p>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
 {result.predictions.slice(0, 3).map((p) => (
 <div className="prediction-card" key={p.diseaseName}>
 <div className="prediction-card-header">
 <div>
 <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{p.category}</span>
 <div className="prediction-disease-name">{p.diseaseName}</div>
 </div>
 <div style={{ textAlign: 'right' }}>
 <div className="prediction-pct">{p.probability}</div>
 <span className={`badge ${riskBadgeClass(p.riskLevel)}`}>{p.riskLevel}</span>
 </div>
 </div>
 <div className="probability-bar-track"><div className="probability-bar-fill" style={{ width: `${p.probability}%` }} /></div>
 <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 12 }}>{p.summary}</p>
 <ShapBars items={p.shapExplanations} title="Shapley contributions from selected symptoms" />
 <div style={{ marginTop: 14, borderTop: '1px dashed var(--border-subtle)', paddingTop: 10 }}>
 <small style={{ color: 'var(--accent-mint)', fontWeight: 700, textTransform: 'uppercase' }}>Recommended Next Steps:</small>
 <ul style={{ paddingLeft: 18, margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
 {(p.recommendedNextSteps || []).map((r) => <li key={r}>{r}</li>)}
 </ul>
 {p.suggestedModel && onOpenModel && (
 <button type="button" className="btn-secondary" style={{ marginTop: 10, fontSize: '0.82rem', padding: '6px 12px' }} onClick={() => onOpenModel(p.suggestedModel)}>
 Open the trained risk model →
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 14 }}>
 {result.method} The percentage is a symptom-match score, not a clinical probability or diagnosis. The symptom checker is knowledge-based; use the trained disease models with clinical values for separate risk estimates.
 </p>
 </>
 )}
 </div>
 </div>
 </>
 );
}
