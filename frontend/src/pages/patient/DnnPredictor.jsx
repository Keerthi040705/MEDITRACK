import { useEffect, useMemo, useState } from 'react';
import { SectionHeader } from '../../components/DashboardLayout';
import ShapBars from '../../components/ShapBars';
import { Api } from '../../api/client';
import { useAction, useApi } from '../../utils/useApi';
import { riskBadgeClass } from '../../utils/format';

const pct = (v, digits = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${(v * 100).toFixed(digits)}%`);
const defaultsFor = (m) => Object.fromEntries([...m.features, ...(m.guidelineInputs || [])].map((f) => [f.key, f.default ?? '']));

function FieldInput({ field, value, onChange }) {
 if (field.options) {
 return (
 <select className="form-control" value={value} onChange={(e) => onChange(e.target.value)}>
 {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
 </select>
 );
 }
 return (
 <input
 type="number"
 className="form-control"
 step={field.step ?? 'any'}
 min={field.min}
 max={field.max}
 placeholder={field.optional ? 'Leave blank if unknown' : undefined}
 value={value}
 onChange={(e) => onChange(e.target.value)}
 />
 );
}

function FieldGrid({ fields, values, setValue }) {
 const rows = [];
 for (let i = 0; i < fields.length; i += 2) rows.push(fields.slice(i, i + 2));
 return rows.map((row, i) => (
 <div className="form-row" key={i}>
 {row.map((f) => (
 <div className="form-group" key={f.key}>
 <label className="form-label">
 {f.label}{f.unit ? ` (${f.unit})` : ''}{!f.optional && <span className="req"> *</span>}
 </label>
 <FieldInput field={f} value={values[f.key] ?? ''} onChange={(v) => setValue(f.key, v)} />
 {(f.ref || f.optional) && (
 <small style={{ color: 'var(--text-dim)' }}>
 {f.ref ? `Normal: ${f.ref}` : ''}{f.ref && f.optional ? ' · ' : ''}{f.optional ? 'optional' : ''}
 </small>
 )}
 </div>
 ))}
 </div>
 ));
}

function ModelCard({ card }) {
 if (!card) return null;
 return (
 <div className="dnn-network-visualizer" style={{ marginTop: 18 }}>
 <div style={{ color: 'var(--accent-emerald)', fontWeight: 700, marginBottom: 6 }}> Trained model: {card.algorithm}</div>
 <div style={{ fontSize: '0.78rem', color: '#a7f3d0', lineHeight: 1.7 }}>
 <div>• Data: {card.dataset}</div>
 <div>• Cross-validated ROC-AUC: <strong>{card.rocAuc?.toFixed(3)}</strong> ± {card.rocAucStd?.toFixed(3)} (1.0 = perfect, 0.5 = guessing)</div>
 <div>• Accuracy {pct(card.accuracy)} · Sensitivity {pct(card.sensitivity)} · Specificity {pct(card.specificity)}</div>
 {card.external && (
 <div>• External check on other hospitals ({card.external.n_samples} patients): ROC-AUC {card.external.roc_auc.toFixed(3)}, accuracy {pct(card.external.accuracy)}</div>
 )}
 {card.legacyRulesAuc != null && <div>• Old hand-written rules on the same data: ROC-AUC {card.legacyRulesAuc.toFixed(3)}</div>}
 <div style={{ color: 'var(--text-dim)', marginTop: 4 }}>{card.populationNote}</div>
 </div>
 </div>
 );
}

const FLAG_STYLE = {
 danger: { background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.5)', color: '#fca5a5' },
 warning: { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.5)', color: '#fde68a' },
 info: { background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.4)', color: '#bae6fd' },
};

export default function DnnPredictor({ initialKey }) {
 const { busy, run } = useAction();
 const models = useApi(() => Api.getAiModels(), []);
 const [key, setKey] = useState(initialKey || 'diabetes');
 const [values, setValues] = useState({});
 const [result, setResult] = useState(null);

 const model = useMemo(() => models.data.find((m) => m.key === key) || models.data[0], [models.data, key]);

 // Reset the form whenever the selected model (or the model list) changes
 useEffect(() => {
 if (model) setValues(defaultsFor(model));
 setResult(null);
 }, [model]);

 const setValue = (k, v) => setValues((s) => ({ ...s, [k]: v }));

 const predict = async () => {
 const features = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : Number(v)]));
 const { ok, result: res } = await run(() => Api.predictDisease(model.key, features));
 if (ok) setResult(res);
 };

 return (
 <>
 <SectionHeader
 title="Disease Risk Prediction (Trained Machine-Learning Models)"
 subtitle="Five models trained on public clinical datasets — the best algorithm for each disease was chosen by cross-validation. Each result is explained with SHAP."
 />

 {models.loading && !models.data.length && <div className="table-status">Loading models from the AI service…</div>}
 {models.error && <div className="table-status error">Could not load models: {models.error}</div>}

 {model && (
 <>
 <div className="dnn-tabs-nav">
 {models.data.map((m) => (
 <button key={m.key} type="button" className={`dnn-tab-btn ${m.key === model.key ? 'active' : ''}`} onClick={() => setKey(m.key)}>
 {m.tab}
 </button>
 ))}
 </div>

 <div className="dnn-layout-grid">
 <div className="dnn-param-card">
 <h4 style={{ color: 'var(--accent-emerald)', marginBottom: 14 }}>{model.title} — {model.heading}</h4>
 <FieldGrid fields={model.features} values={values} setValue={setValue} />

 {model.guidelineInputs?.length > 0 && (
 <div style={{ borderTop: '1px dashed var(--border-subtle)', marginTop: 8, paddingTop: 12 }}>
 <small style={{ color: 'var(--text-muted)' }}>Clinical guideline check (ADA thresholds — not part of the model)</small>
 <FieldGrid fields={model.guidelineInputs} values={values} setValue={setValue} />
 </div>
 )}

 <button type="button" className="btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={predict}>
 <span>{busy ? 'Calculating…' : ' Calculate Risk & SHAP Explanation'}</span>
 </button>
 <ModelCard card={model.model} />
 </div>

 <div className="dnn-output-card">
 <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: 12 }}> Model Result</h3>
 {!result ? (
 <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '60px 20px' }}>
 <div style={{ fontSize: '2.5rem', marginBottom: 12, color: 'var(--accent-emerald)' }}></div>
 <p>Enter the values on the left (or keep the example values) and click &quot;Calculate Risk&quot;.</p>
 </div>
 ) : (
 <>
 <div className="dnn-risk-gauge-box">
 <small style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.8px' }}>Estimated probability</small>
 <div className="dnn-risk-number">{result.riskProbability}%</div>
 <span className={`badge ${riskBadgeClass(result.riskLevel)}`} style={{ fontSize: '0.95rem', padding: '6px 16px' }}>{result.riskLevel}</span>
 <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: 8 }}>
 Typical patient in the training data: {result.baseValue}%
 </div>
 </div>

 {result.guidelineFlags?.map((f, i) => (
 <div key={i} style={{ ...FLAG_STYLE[f.level], borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '0.84rem', marginBottom: 10 }}>
 {f.message}
 </div>
 ))}

 <div style={{ marginBottom: 16 }}>
 <ShapBars items={result.shapValues} unit="pts" scale={250} title=" SHAP — how each value moved the risk (percentage points)" />
 </div>

 <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 14, marginTop: 14 }}>
 <strong style={{ color: '#fff', fontSize: '0.88rem' }}>Interpretation:</strong>
 <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 10px' }}>{result.clinicalInterpretation}</p>
 <strong style={{ color: 'var(--accent-mint)', fontSize: '0.82rem', textTransform: 'uppercase' }}>Suggested next steps:</strong>
 <ul style={{ paddingLeft: 18, margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
 {(result.recommendations || []).map((r) => <li key={r}>{r}</li>)}
 </ul>
 </div>
 <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 12 }}>
 Educational screening tool — not a diagnosis. {result.model?.populationNote}
 </p>
 </>
 )}
 </div>
 </div>
 </>
 )}
 </>
 );
}
