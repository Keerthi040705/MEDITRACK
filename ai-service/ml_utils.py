"""Small helpers shared by training and serving, so both compute scores identically."""
import numpy as np


def logit(p):
    p = np.clip(np.asarray(p, dtype=float), 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p)).reshape(-1, 1)


def raw_score(pipe, X):
    """Model output on a log-odds-like scale (works for models with or without predict_proba)."""
    if hasattr(pipe, "predict_proba"):
        return logit(pipe.predict_proba(X)[:, 1]).ravel()
    return np.asarray(pipe.decision_function(X), dtype=float).ravel()


def calibrated_probability(artifact, X):
    """Calibrated probability of disease for each row of X."""
    raw = raw_score(artifact["pipeline"], X)
    return artifact["calibrator"].predict_proba(raw.reshape(-1, 1))[:, 1]


def log_columns(X, cols=()):
    """log(1 + x) for very skewed lab values (bilirubin, enzymes, creatinine...). NaN stays NaN."""
    X = np.array(X, dtype=float, copy=True)
    if len(cols):
        X[:, cols] = np.log1p(np.clip(X[:, cols], 0, None))
    return X
