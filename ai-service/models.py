"""
MediTrack AI - serving layer for the trained disease-risk models.

- Loads models/<disease>.joblib (created by train_models.py).
- If a model file is missing, or was trained with a different scikit-learn version,
  it is re-fitted automatically from data/ (takes a few seconds).
- Explanations are exact Shapley values (SHAP) of the calibrated probability,
  computed against a reference sample of training patients.
"""
from __future__ import annotations

import json
import math
import os
import threading
from datetime import datetime, timezone

import joblib
import numpy as np
import sklearn

from disease_config import DISEASES, risk_level
from ml_utils import calibrated_probability
from symptom_checker import SYMPTOMS, check_symptoms  # noqa: F401  (re-exported for app.py)

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "models")
SELECTION_FILE = os.path.join(HERE, "model_selection.json")

_lock = threading.Lock()
_models: dict = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def _refit(key: str):
    import train_models  # imported lazily: only needed when (re)training
    with open(SELECTION_FILE, encoding="utf-8") as f:
        selection = json.load(f)
    print(f"[AI ] Training {key} model from data/ ...", flush=True)
    return train_models.fit_final(key, selection[key])


def get_model(key: str) -> dict:
    with _lock:
        if key in _models:
            return _models[key]
        path = os.path.join(MODEL_DIR, f"{key}.joblib")
        art = None
        if os.path.exists(path):
            try:
                art = joblib.load(path)
                if art.get("sklearn_version") != sklearn.__version__:
                    print(f"[AI ] {key}: model built with scikit-learn {art.get('sklearn_version')}, "
                          f"installed {sklearn.__version__} -> re-fitting", flush=True)
                    art = None
            except Exception as e:  # corrupted / incompatible file
                print(f"[AI ] {key}: could not load model ({e}) -> re-fitting", flush=True)
                art = None
        if art is None:
            art = _refit(key)
        _models[key] = art
        return art


def load_all() -> list[str]:
    return [k for k in DISEASES if get_model(k)]


def loaded_models() -> list[str]:
    """Models already in memory (does not trigger loading - keeps /health fast)."""
    return [k for k in DISEASES if k in _models]


# ---------------------------------------------------------------------------
# Exact Shapley values
# ---------------------------------------------------------------------------

def shapley_values(art: dict, x: np.ndarray):
    """Exact interventional Shapley values for one patient (all 2^n feature coalitions)."""
    bg = art["background"]
    n, B = x.shape[0], bg.shape[0]
    M = 1 << n
    bits = ((np.arange(M)[:, None] >> np.arange(n)) & 1).astype(bool)          # (M, n)
    rows = np.where(bits[:, None, :], x[None, None, :], bg[None, :, :])         # (M, B, n)
    v = calibrated_probability(art, rows.reshape(-1, n)).reshape(M, B).mean(axis=1)

    sizes = bits.sum(axis=1)
    weights = np.array([math.factorial(s) * math.factorial(n - s - 1) / math.factorial(n) for s in range(n)])
    phi = np.zeros(n)
    for i in range(n):
        without = np.where(~bits[:, i])[0]
        phi[i] = np.sum(weights[sizes[without]] * (v[without | (1 << i)] - v[without]))
    return phi, float(v[0])


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def _value_text(feat: dict, value: float) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return "not provided"
    for opt in feat.get("options", []):
        if float(opt["value"]) == float(value):
            return opt["label"]
    txt = f"{value:g}"
    return f"{txt} {feat['unit']}".strip() if feat.get("unit") else txt


def _parse_inputs(cfg: dict, features: dict) -> np.ndarray:
    values = []
    for f in cfg["features"]:
        raw = (features or {}).get(f["key"])
        if raw is None or (isinstance(raw, str) and raw.strip() == ""):
            if f.get("optional"):
                values.append(np.nan)
                continue
            raise ValueError(f"Please enter: {f['label']}")
        try:
            v = float(raw)
        except (TypeError, ValueError):
            raise ValueError(f"'{f['label']}' must be a number (got {raw!r})")
        if not math.isfinite(v):
            raise ValueError(f"'{f['label']}' must be a finite number")
        if "options" in f and v not in [float(o["value"]) for o in f["options"]]:
            raise ValueError(f"'{f['label']}' must be one of: {', '.join(o['label'] for o in f['options'])}")
        if "min" in f and "max" in f and not (f["min"] <= v <= f["max"]):
            raise ValueError(f"'{f['label']}' = {v:g} looks wrong (expected {f['min']}–{f['max']} {f.get('unit', '')}).".replace(" )", ")"))
        values.append(v)
    return np.array(values, dtype=float)


def _guidelines(key: str, features: dict, x: np.ndarray, cfg: dict):
    """Clinical guideline checks shown next to the model (ADA thresholds for diabetes)."""
    flags, escalate = [], False
    if key == "diabetes":
        idx = [f["key"] for f in cfg["features"]].index("glucose")
        glucose = x[idx]
        hba1c = None
        try:
            if str(features.get("hba1c", "")).strip() != "":
                hba1c = float(features["hba1c"])
        except (TypeError, ValueError):
            raise ValueError("'HbA1c' must be a number")
        if hba1c is not None:
            if not 3 <= hba1c <= 20:
                raise ValueError(f"HbA1c {hba1c:g}% looks wrong (expected 3–20%).")
            if hba1c >= 6.5:
                flags.append({"level": "danger", "message": f"HbA1c {hba1c:g}% is at or above 6.5% — the ADA diagnostic threshold for diabetes. Confirm with your doctor."})
                escalate = True
            elif hba1c >= 5.7:
                flags.append({"level": "warning", "message": f"HbA1c {hba1c:g}% is in the prediabetes range (5.7–6.4%)."})
            else:
                flags.append({"level": "info", "message": f"HbA1c {hba1c:g}% is in the normal range (<5.7%)."})
        if glucose >= 200:
            flags.append({"level": "danger", "message": f"2-hour glucose {glucose:g} mg/dL is ≥200 — meets the ADA diagnostic threshold for diabetes."})
            escalate = True
        elif glucose >= 140:
            flags.append({"level": "warning", "message": f"2-hour glucose {glucose:g} mg/dL is 140–199 — impaired glucose tolerance (prediabetes)."})
    return flags, escalate


def model_card(key: str, art: dict) -> dict:
    cfg = DISEASES[key]
    cv = art.get("cv", {})
    card = {
        "algorithm": art["algorithm"],
        "dataset": cfg["dataset"],
        "nSamples": art["n_samples"],
        "nPeople": art.get("n_people", art["n_samples"]),
        "rocAuc": cv.get("roc_auc"),
        "rocAucStd": cv.get("roc_auc_std"),
        "accuracy": cv.get("accuracy"),
        "sensitivity": cv.get("sensitivity"),
        "specificity": cv.get("specificity"),
        "legacyRulesAuc": art.get("legacy_rules_auc"),
        "baseRate": round(art["base_rate"], 3),
        "populationNote": cfg["population_note"],
        "trainedAt": art.get("trained_at"),
    }
    if art.get("external"):
        card["external"] = art["external"]
    return card


def predict_disease(disease_type: str, features: dict) -> dict:
    key = (disease_type or "").strip().lower()
    if key not in DISEASES:
        raise ValueError(f"Unknown diseaseType '{disease_type}'. Use one of: {', '.join(DISEASES)}")
    if features is not None and not isinstance(features, dict):
        raise ValueError("'features' must be an object of name -> number")
    cfg = DISEASES[key]
    features = features or {}
    x = _parse_inputs(cfg, features)
    flags, escalate = _guidelines(key, features, x, cfg)

    art = get_model(key)
    prob = float(calibrated_probability(art, x.reshape(1, -1))[0])
    phi, base = shapley_values(art, x)

    shap_rows = []
    for f, val, contrib in zip(cfg["features"], x, phi):
        vt = _value_text(f, val)
        pts = contrib * 100
        ref = f" (normal {f['ref']})" if f.get("ref") and not f.get("options") else ""
        shap_rows.append({
            "key": f["key"],
            "feature": f"{f['label']}: {vt}",
            "value": None if math.isnan(val) else val,
            "impact": round(float(contrib), 4),
            "direction": "RISK_INCREASING" if contrib > 0 else "PROTECTIVE",
            "explanation": (f"{'Raised' if contrib > 0 else 'Lowered'} the predicted risk by {abs(pts):.1f} percentage points{ref}."
                            if abs(pts) >= 0.05 else f"Little effect on the prediction{ref}."),
        })
    shap_rows.sort(key=lambda r: abs(r["impact"]), reverse=True)

    # A screening model should never claim certainty: show 1-99 %
    pct = round(min(99.0, max(1.0, prob * 100)), 1)
    level = risk_level(pct)
    if escalate and level != "HIGH RISK":
        level = "HIGH RISK"

    up = [r for r in shap_rows if r["impact"] > 0.005][:2]
    down = [r for r in shap_rows if r["impact"] < -0.005][:2]
    interp = f"Estimated risk {pct}% compared with {base * 100:.0f}% for a typical patient in the training data."
    if up:
        interp += " Main factors raising it: " + "; ".join(r["feature"] for r in up) + "."
    if down:
        interp += " Main factors lowering it: " + "; ".join(r["feature"] for r in down) + "."

    return {
        "diseaseType": key,
        "diseaseDisplayName": cfg["title"],
        "riskProbability": pct,
        "riskLevel": level,
        "baseValue": round(base * 100, 1),
        "shapValues": shap_rows,
        "guidelineFlags": flags,
        "clinicalInterpretation": interp,
        "recommendations": cfg["recommendations"],
        "model": model_card(key, art),
        "calculatedAt": now_iso(),
    }


def list_models() -> list[dict]:
    """Form definitions + model cards for the React app."""
    out = []
    for key, cfg in DISEASES.items():
        art = get_model(key)
        out.append({
            "key": key,
            "title": cfg["title"],
            "tab": cfg["tab"],
            "heading": cfg["heading"],
            "features": cfg["features"],
            "guidelineInputs": cfg.get("guideline_inputs", []),
            "model": model_card(key, art),
        })
    return out
