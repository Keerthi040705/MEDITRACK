"""
Train the MediTrack disease-risk models on real public datasets.

    python train_models.py              # FAST (seconds): refit the selected models -> models/*.joblib
    python train_models.py --evaluate   # FULL: nested cross-validation of every algorithm, pick the best,
                                        #       write models/MODEL_REPORT.md + model_selection.json, then refit

Algorithms compared for every disease:
    Logistic Regression, Random Forest, Gradient Boosting, SVM (RBF) and a Neural Network (MLP).
The winner is the one with the highest mean ROC-AUC in nested cross-validation (outer folds never
see the data used to tune hyper-parameters). For Parkinson's, folds are split by PERSON so the same
person's recordings never appear in both training and test folds.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import time
import warnings
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
import sklearn.base
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold, StratifiedKFold
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from disease_config import DISEASES
from ml_utils import log_columns, raw_score
from sklearn.preprocessing import FunctionTransformer

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
MODEL_DIR = os.path.join(HERE, "models")
SELECTION_FILE = os.path.join(HERE, "model_selection.json")
SEED = 42
BACKGROUND_ROWS = 30   # reference rows kept for SHAP explanations

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=RuntimeWarning)
try:
    from sklearn.exceptions import ConvergenceWarning
    warnings.filterwarnings("ignore", category=ConvergenceWarning)
except ImportError:  # pragma: no cover
    pass

# Simplest first: used to break near-ties (within 0.005 AUC) in favour of the more interpretable model
SIMPLICITY = ["Logistic Regression", "Random Forest", "Gradient Boosting", "SVM (RBF)", "Neural Network (MLP)"]


# ---------------------------------------------------------------------------
# Candidate algorithms
# ---------------------------------------------------------------------------

def _log(log_cols):
    return ("log", FunctionTransformer(log_columns, kw_args={"cols": list(log_cols)}))


def _scaled(clf, log_cols=()):
    return Pipeline([_log(log_cols), ("impute", SimpleImputer(strategy="median", add_indicator=True)),
                     ("scale", StandardScaler()), ("clf", clf)])


def _tree(clf, log_cols=()):
    return Pipeline([_log(log_cols), ("impute", SimpleImputer(strategy="median", add_indicator=True)), ("clf", clf)])


def build(name: str, params: dict | None = None, log_cols=()):
    """Returns (pipeline, param_grid) for an algorithm name."""
    if name == "Logistic Regression":
        pipe, grid = _scaled(LogisticRegression(max_iter=5000), log_cols), {"clf__C": [0.03, 0.1, 0.3, 1.0, 3.0]}
    elif name == "Random Forest":
        pipe = _tree(RandomForestClassifier(n_estimators=200, random_state=SEED, n_jobs=1), log_cols)
        grid = {"clf__max_depth": [3, 6, None], "clf__min_samples_leaf": [1, 5]}
    elif name == "Gradient Boosting":
        pipe = _tree(HistGradientBoostingClassifier(max_iter=150, random_state=SEED), log_cols)
        grid = {"clf__learning_rate": [0.03, 0.1], "clf__max_depth": [2, 3], "clf__min_samples_leaf": [10, 20]}
    elif name == "SVM (RBF)":
        pipe = _scaled(SVC(random_state=SEED), log_cols)  # scores via decision_function, calibrated below
        grid = {"clf__C": [0.3, 1.0, 3.0, 10.0], "clf__gamma": ["scale", 0.03]}
    elif name == "Neural Network (MLP)":
        pipe = _scaled(MLPClassifier(solver="lbfgs", max_iter=3000, random_state=SEED), log_cols)
        grid = {"clf__hidden_layer_sizes": [(16,), (32, 16)], "clf__alpha": [0.1, 1.0, 10.0]}
    else:
        raise ValueError(name)
    if params:
        pipe.set_params(**{k: (tuple(v) if k.endswith("hidden_layer_sizes") else v) for k, v in params.items()})
    return pipe, grid


ALGORITHMS = ["Logistic Regression", "Random Forest", "Gradient Boosting", "SVM (RBF)", "Neural Network (MLP)"]


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

def load(key: str):
    cfg = DISEASES[key]
    df = pd.read_csv(os.path.join(DATA_DIR, cfg["file"]))
    cols = [f["key"] for f in cfg["features"]]
    X = df[cols].to_numpy(dtype=float)
    y = df["target"].to_numpy(dtype=int)
    groups = df[cfg["group_column"]].to_numpy() if cfg.get("group_column") else None
    return df, X, y, groups, cols


def log_indices(key):
    return [i for i, f in enumerate(DISEASES[key]["features"]) if f.get("log")]


def splitter(groups, n_splits, seed):
    if groups is not None:
        return StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=seed)


def _sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.asarray(z, dtype=float)))


def fold_metrics(y_true, prob):
    pred = (prob >= 0.5).astype(int)
    tp = int(((pred == 1) & (y_true == 1)).sum()); tn = int(((pred == 0) & (y_true == 0)).sum())
    fp = int(((pred == 1) & (y_true == 0)).sum()); fn = int(((pred == 0) & (y_true == 1)).sum())
    return {
        "roc_auc": roc_auc_score(y_true, prob),
        "accuracy": accuracy_score(y_true, pred),
        "sensitivity": tp / (tp + fn) if tp + fn else float("nan"),
        "specificity": tn / (tn + fp) if tn + fp else float("nan"),
        "brier": brier_score_loss(y_true, prob),
    }


def summarize(folds):
    out = {}
    for m in folds[0]:
        vals = np.array([f[m] for f in folds], dtype=float)
        out[m] = round(float(np.nanmean(vals)), 4)
        out[m + "_std"] = round(float(np.nanstd(vals)), 4)
    return out


# ---------------------------------------------------------------------------
# Legacy rule comparison (the original hand-written formulas, never trained)
# ---------------------------------------------------------------------------

LEGACY_MAP = {
    "diabetes": {"glucose": "glucose", "bmi": "bmi", "age": "age"},
    "kidney": {"serum_creatinine": "creatinine", "blood_urea": "blood_urea", "albumin": "albumin",
               "hemoglobin": "hemoglobin", "blood_pressure": "blood_pressure", "specific_gravity": "specific_gravity"},
    "liver": {"total_bilirubin": "total_bilirubin", "alt_sgpt": "alt_sgpt", "ast_sgot": "ast_sgot",
              "alkaline_phosphatase": "alkaline_phosphatase", "albumin": "albumin"},
    "heart": {"chest_pain_type": "chest_pain_type", "st_depression": "st_depression",
              "cholesterol": "cholesterol", "resting_bp": "resting_bp", "age": "age"},
    "parkinsons": {"mdvp_jitter": "mdvp_jitter", "mdvp_shimmer": "mdvp_shimmer", "hnr": "hnr", "rpde": "rpde"},
}


def legacy_auc(key, df):
    try:
        from legacy_rules import predict_disease as legacy_predict
    except ImportError:
        return None
    probs = []
    for _, row in df.iterrows():
        feats = {old: row[new] for new, old in LEGACY_MAP[key].items() if pd.notna(row[new])}
        probs.append(legacy_predict(key, feats)["riskProbability"] / 100.0)
    try:
        return round(float(roc_auc_score(df["target"], probs)), 4)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Full evaluation (nested cross-validation)
# ---------------------------------------------------------------------------

def evaluate(key, outer_splits=5, repeats=2, inner_splits=3):
    df, X, y, groups, cols = load(key)
    results = {}
    for name in ALGORITHMS:
        t0 = time.time()
        folds, chosen = [], []
        for r in range(repeats):
            outer = splitter(groups, outer_splits, SEED + r)
            for tr, te in outer.split(X, y, groups):
                pipe, grid = build(name, log_cols=log_indices(key))
                inner = splitter(groups[tr] if groups is not None else None, inner_splits, SEED)
                gs = GridSearchCV(pipe, grid, scoring="roc_auc", cv=inner, n_jobs=-1, error_score="raise")
                if groups is not None:
                    gs.fit(X[tr], y[tr], groups=groups[tr])
                else:
                    gs.fit(X[tr], y[tr])
                prob = _sigmoid(raw_score(gs.best_estimator_, X[te]))
                folds.append(fold_metrics(y[te], prob))
                chosen.append(json.dumps(gs.best_params_, sort_keys=True))
        results[name] = summarize(folds)
        results[name]["seconds"] = round(time.time() - t0, 1)
        print(f"  {key:10s} {name:22s} AUC {results[name]['roc_auc']:.3f} ± {results[name]['roc_auc_std']:.3f}"
              f"  acc {results[name]['accuracy']:.3f}  ({results[name]['seconds']} s)", flush=True)

    best_auc = max(r["roc_auc"] for r in results.values())
    near = [n for n in ALGORITHMS if results[n]["roc_auc"] >= best_auc - 0.005]
    winner = min(near, key=SIMPLICITY.index)

    # Final hyper-parameters for the winner: tuned on ALL data
    pipe, grid = build(winner, log_cols=log_indices(key))
    cv = splitter(groups, 5, SEED)
    gs = GridSearchCV(pipe, grid, scoring="roc_auc", cv=cv, n_jobs=-1)
    gs.fit(X, y, groups=groups) if groups is not None else gs.fit(X, y)
    params = {k: (list(v) if isinstance(v, tuple) else v) for k, v in gs.best_params_.items()}

    return {
        "algorithm": winner,
        "params": params,
        "cv": results[winner],
        "leaderboard": results,
        "legacy_rules_auc": legacy_auc(key, df),
        "n_samples": int(len(y)),
        "n_people": int(len(set(groups))) if groups is not None else int(len(y)),
        "positive_rate": round(float(y.mean()), 3),
    }


# ---------------------------------------------------------------------------
# Final fit (fast) -> models/<disease>.joblib
# ---------------------------------------------------------------------------

def oof_raw_scores(pipe, X, y, cv, groups):
    """Out-of-fold raw scores (manual loop so it works with any model type)."""
    out = np.zeros(len(y), dtype=float)
    for tr, te in cv.split(X, y, groups):
        p = sklearn.base.clone(pipe).fit(X[tr], y[tr])
        out[te] = raw_score(p, X[te])
    return out


def fit_final(key, selection):
    cfg = DISEASES[key]
    df, X, y, groups, cols = load(key)
    pipe, _ = build(selection["algorithm"], selection["params"], log_cols=log_indices(key))

    # Out-of-fold probabilities -> Platt calibration so "risk %" is well calibrated
    cv = splitter(groups, 5, SEED)
    oof = oof_raw_scores(pipe, X, y, cv, groups)
    calibrator = LogisticRegression(C=100.0).fit(oof.reshape(-1, 1), y)
    cal_oof = calibrator.predict_proba(oof.reshape(-1, 1))[:, 1]

    pipe.fit(X, y)

    rng = np.random.RandomState(SEED)
    idx = rng.choice(len(X), size=min(BACKGROUND_ROWS, len(X)), replace=False)
    imputer = SimpleImputer(strategy="median").fit(X)

    artifact = {
        "disease": key,
        "features": cols,
        "pipeline": pipe,
        "calibrator": calibrator,
        "background": imputer.transform(X[idx]),   # complete rows used as the SHAP reference
        "medians": dict(zip(cols, imputer.statistics_.round(4).tolist())),
        "base_rate": float(y.mean()),
        "algorithm": selection["algorithm"],
        "params": selection["params"],
        "cv": selection.get("cv", {}),
        "legacy_rules_auc": selection.get("legacy_rules_auc"),
        "n_people": selection.get("n_people", int(len(y))),
        "calibrated_oof_brier": round(float(brier_score_loss(y, cal_oof)), 4),
        "n_samples": int(len(y)),
        "sklearn_version": sklearn.__version__,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    # External validation (heart: other hospitals)
    if cfg.get("external_file"):
        ext = pd.read_csv(os.path.join(DATA_DIR, cfg["external_file"]))
        Xe, ye = ext[cols].to_numpy(dtype=float), ext["target"].to_numpy(dtype=int)
        pe = calibrator.predict_proba(raw_score(pipe, Xe).reshape(-1, 1))[:, 1]
        artifact["external"] = {"roc_auc": round(float(roc_auc_score(ye, pe)), 4),
                                "accuracy": round(float(accuracy_score(ye, pe >= 0.5)), 4),
                                "n_samples": int(len(ye)), "cohorts": sorted(ext["cohort"].unique().tolist())}

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(artifact, os.path.join(MODEL_DIR, f"{key}.joblib"))
    return artifact


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def pct(x):
    return "—" if x is None or (isinstance(x, float) and math.isnan(x)) else f"{x * 100:.1f}%"


def write_report(selection, artifacts):
    lines = [
        "# MediTrack AI — Model Training Report",
        "",
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} with scikit-learn {sklearn.__version__}.",
        "",
        "Very skewed lab values (bilirubin, liver enzymes, creatinine, urea, insulin, voice jitter...) are log-transformed. "
        "Every disease model was chosen by **nested cross-validation** (outer 5-fold × 2 repeats; hyper-parameters tuned "
        "only inside the training folds). Parkinson's folds are split **by person**. Scores are means across outer folds. "
        "\"Old rules\" is the ROC-AUC of the original hand-written formulas on the same data (no training).",
        "",
        "## Selected models",
        "",
        "| Disease | Selected model | ROC-AUC | Accuracy | Sensitivity | Specificity | Old rules AUC | Data |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for key, sel in selection.items():
        cv = sel["cv"]
        lines.append(
            f"| {DISEASES[key]['title']} | {sel['algorithm']} | {cv['roc_auc']:.3f} ± {cv['roc_auc_std']:.3f} | {pct(cv['accuracy'])} | "
            f"{pct(cv['sensitivity'])} | {pct(cv['specificity'])} | {sel['legacy_rules_auc'] if sel.get('legacy_rules_auc') is not None else '—'} | "
            f"{sel['n_samples']} rows{' / ' + str(sel['n_people']) + ' people' if sel['n_people'] != sel['n_samples'] else ''} |"
        )
    ext = artifacts.get("heart", {}).get("external")
    if ext:
        lines += ["", f"**Heart external check:** trained on Cleveland only, tested on {', '.join(ext['cohorts'])} "
                      f"({ext['n_samples']} patients, different hospitals): ROC-AUC {ext['roc_auc']:.3f}, accuracy {pct(ext['accuracy'])}."]
    lines += ["", "## Full leaderboards", ""]
    for key, sel in selection.items():
        lines += [f"### {DISEASES[key]['title']}", "", f"Dataset: {DISEASES[key]['dataset']}  ", f"Positive (disease) rate: {pct(sel['positive_rate'])}", "",
                  "| Algorithm | ROC-AUC | Accuracy | Sensitivity | Specificity | Brier |", "|---|---|---|---|---|---|"]
        for name, r in sorted(sel["leaderboard"].items(), key=lambda kv: -kv[1]["roc_auc"]):
            star = " ✅" if name == sel["algorithm"] else ""
            lines.append(f"| {name}{star} | {r['roc_auc']:.3f} ± {r['roc_auc_std']:.3f} | {pct(r['accuracy'])} | {pct(r['sensitivity'])} | {pct(r['specificity'])} | {r['brier']:.3f} |")
        lines += ["", f"Selected hyper-parameters: `{json.dumps(sel['params'])}`", ""]
    lines += [
        "## Notes",
        "",
        "- Probabilities are calibrated (Platt scaling on out-of-fold predictions).",
        "- Each dataset comes from a clinical study population with a high disease rate, so predicted risks are relative to "
        "that population, not the general public.",
        "- Explanations use exact Shapley values (SHAP) computed against a reference sample of training patients.",
        "- Educational project — not a medical device and not medical advice.",
    ]
    with open(os.path.join(MODEL_DIR, "MODEL_REPORT.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--evaluate", action="store_true", help="run full nested cross-validation and model selection")
    ap.add_argument("--only", help="comma-separated diseases (default: all)")
    args = ap.parse_args()
    keys = args.only.split(",") if args.only else list(DISEASES)

    if args.evaluate:
        selection = {}
        if os.path.exists(SELECTION_FILE):
            with open(SELECTION_FILE, encoding="utf-8") as f:
                selection = json.load(f)
        for key in keys:
            print(f"[train] Evaluating {key} ...", flush=True)
            selection[key] = evaluate(key)
            print(f"[train]   -> selected {selection[key]['algorithm']} {selection[key]['params']}", flush=True)
        selection = {k: selection[k] for k in DISEASES if k in selection}
        with open(SELECTION_FILE, "w", encoding="utf-8") as f:
            json.dump(selection, f, indent=2)
    else:
        if not os.path.exists(SELECTION_FILE):
            raise SystemExit("model_selection.json not found - run: python train_models.py --evaluate")
        with open(SELECTION_FILE, encoding="utf-8") as f:
            selection = json.load(f)

    artifacts = {}
    for key in DISEASES:
        if key in selection:
            t0 = time.time()
            artifacts[key] = fit_final(key, selection[key])
            extra = f", external AUC {artifacts[key]['external']['roc_auc']:.3f}" if "external" in artifacts[key] else ""
            print(f"[train] {key:10s} {selection[key]['algorithm']:22s} fitted in {time.time() - t0:.1f}s{extra}", flush=True)
    if args.evaluate:
        write_report(selection, artifacts)
        print(f"[train] Report written to {os.path.join(MODEL_DIR, 'MODEL_REPORT.md')}")
    print("[train] Models ready in", MODEL_DIR)


if __name__ == "__main__":
    main()
