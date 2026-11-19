"""
Symptom checker - knowledge-based symptom matching with exact Shapley attribution.

There is no bundled labelled patient dataset linking these symptoms to the five conditions.
The match score is therefore not a trained diagnosis model or clinical probability. Exact
Shapley values explain how each selected symptom contributes to the rule-based match score.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

SYMPTOMS = [
    {"id": "fever", "label": "Fever / Elevated Body Temperature", "category": "General"},
    {"id": "fatigue", "label": "Chronic Fatigue / Lethargy", "category": "General"},
    {"id": "shortness_of_breath", "label": "Shortness of Breath (Dyspnea)", "category": "Cardiopulmonary"},
    {"id": "chest_pain", "label": "Chest Pain / Retrosternal Pressure", "category": "Cardiopulmonary"},
    {"id": "frequent_urination", "label": "Frequent Urination (Polyuria)", "category": "Renal / Metabolic"},
    {"id": "excessive_thirst", "label": "Excessive Thirst (Polydipsia)", "category": "Renal / Metabolic"},
    {"id": "tremors", "label": "Involuntary Tremors (Resting)", "category": "Neurological"},
    {"id": "muscle_rigidity", "label": "Muscle Rigidity / Stiffness", "category": "Neurological"},
    {"id": "slow_movement", "label": "Bradykinesia / Slow Movement", "category": "Neurological"},
    {"id": "swollen_ankles", "label": "Peripheral Edema (Swollen Ankles/Feet)", "category": "Renal / Cardiac"},
    {"id": "jaundice_yellowing", "label": "Jaundice (Skin/Eye Yellowing)", "category": "Hepatic"},
    {"id": "abdominal_pain", "label": "Right Upper Abdominal Pain", "category": "Hepatic / GI"},
    {"id": "high_bp", "label": "Elevated Blood Pressure Readings", "category": "Cardiovascular"},
    {"id": "blurred_vision", "label": "Blurred / Impaired Vision", "category": "Metabolic"},
    {"id": "weight_loss", "label": "Unexplained Weight Loss", "category": "Metabolic"},
    {"id": "joint_pain", "label": "Joint Pain / Arthralgia", "category": "Musculoskeletal"},
    {"id": "persistent_cough", "label": "Persistent Cough (>2 weeks)", "category": "Respiratory"},
    {"id": "nausea_vomiting", "label": "Nausea & Persistent Vomiting", "category": "General / GI"},
]
LABELS = {s["id"]: s["label"] for s in SYMPTOMS}

# weight = how characteristic the symptom is for the condition (clinical knowledge, 0-1)
CONDITIONS = [
    {"name": "Type 2 Diabetes Mellitus", "category": "Metabolic / Endocrine", "model": "diabetes",
     "weights": {"frequent_urination": 0.30, "excessive_thirst": 0.30, "blurred_vision": 0.15, "weight_loss": 0.15, "fatigue": 0.10},
     "next_steps": ["Fasting plasma glucose and HbA1c blood tests", "Use the Diabetes risk model with your lab values", "See a physician if symptoms persist"]},
    {"name": "Chronic Kidney Disease (CKD)", "category": "Nephrological", "model": "kidney",
     "weights": {"swollen_ankles": 0.30, "high_bp": 0.20, "fatigue": 0.15, "frequent_urination": 0.15, "nausea_vomiting": 0.10, "shortness_of_breath": 0.10},
     "next_steps": ["Serum creatinine / eGFR and urine albumin tests", "Use the Kidney risk model with your lab values", "Consult a nephrologist if results are abnormal"]},
    {"name": "Coronary Artery / Heart Disease", "category": "Cardiovascular", "model": "heart",
     "weights": {"chest_pain": 0.40, "shortness_of_breath": 0.25, "fatigue": 0.10, "high_bp": 0.15, "swollen_ankles": 0.10},
     "next_steps": ["ECG and cardiology review", "Use the Heart risk model with your test results", "Chest pain at rest is an emergency — call emergency services"]},
    {"name": "Parkinson's Disease", "category": "Neurological", "model": "parkinsons",
     "weights": {"tremors": 0.40, "muscle_rigidity": 0.30, "slow_movement": 0.30},
     "next_steps": ["Neurologist / movement-disorder specialist examination", "Use the Parkinson's voice model if you have voice-analysis values"]},
    {"name": "Liver Disease", "category": "Hepatological / Gastrointestinal", "model": "liver",
     "weights": {"jaundice_yellowing": 0.45, "abdominal_pain": 0.20, "nausea_vomiting": 0.15, "fatigue": 0.10, "weight_loss": 0.10},
     "next_steps": ["Liver function blood tests (bilirubin, ALT, AST, ALP, albumin)", "Use the Liver risk model with your lab values", "Abdominal ultrasound if tests are abnormal"]},
]

METHOD = "Knowledge-based symptom matching; exact Shapley values explain each selected symptom contribution (not a trained diagnosis model)."


def _match_level(score: float) -> str:
    if score >= 60:
        return "STRONG MATCH"
    if score >= 30:
        return "PARTIAL MATCH"
    return "WEAK MATCH"


def _match_score(weight_sum: float) -> float:
    return 100 * (1 - math.exp(-2.2 * weight_sum)) / (1 - math.exp(-2.2))


def _exact_shapley_for_selected(selected: list, weights: dict) -> dict:
    """Exact Shapley values for the symptom-match scoring function over selected symptoms."""
    n = len(selected)
    if n == 0:
        return {}
    factorial = math.factorial
    denom = factorial(n)
    values = {}
    for feature in selected:
        others = [x for x in selected if x != feature]
        contribution = 0.0
        for mask in range(1 << len(others)):
            coalition = [others[j] for j in range(len(others)) if mask & (1 << j)]
            k = len(coalition)
            weight = factorial(k) * factorial(n - k - 1) / denom
            before = _match_score(sum(weights[x] for x in coalition))
            after = _match_score(sum(weights[x] for x in coalition) + weights[feature])
            contribution += weight * (after - before)
        values[feature] = contribution
    return values


def check_symptoms(symptoms: list) -> dict:
    chosen = [s for s in symptoms if isinstance(s, str) and s in LABELS]
    resp = {"submittedSymptoms": chosen, "predictions": [], "method": METHOD,
            "analyzedAt": datetime.now(timezone.utc).isoformat()}
    if not chosen:
        resp.update(primaryDiagnosis="No symptoms reported", confidenceScore=0.0)
        return resp

    preds = []
    for c in CONDITIONS:
        matched = [s for s in chosen if s in c["weights"]]
        if not matched:
            continue
        coverage = sum(c["weights"][s] for s in matched)
        score = round(_match_score(coverage), 1)
        contributions = _exact_shapley_for_selected(matched, c["weights"])
        shap = [{"feature": LABELS[s], "impact": round(contributions[s], 3), "direction": "RISK_INCREASING",
                 "explanation": f"Contributes {contributions[s]:.1f} points to this rule-based symptom match score."} for s in matched]
        shap.sort(key=lambda r: abs(r["impact"]), reverse=True)
        preds.append({
            "diseaseName": c["name"],
            "category": c["category"],
            "probability": score,                 # legacy UI key; value is a match score, not probability
            "riskLevel": _match_level(score),
            "suggestedModel": c["model"],
            "summary": f"{len(matched)} of {len(c['weights'])} typical symptoms reported. "
                       f"This is a symptom match score, not a diagnosis or clinical probability.",
            "shapExplanations": shap,
            "recommendedNextSteps": c["next_steps"],
        })

    if not preds:
        resp.update(primaryDiagnosis="No match", confidenceScore=0.0,
                    message="None of the selected symptoms are specific to the 5 conditions this tool covers. "
                            "If symptoms persist, see a doctor.")
        return resp

    preds.sort(key=lambda p: p["probability"], reverse=True)
    resp["predictions"] = preds
    resp["primaryDiagnosis"] = preds[0]["diseaseName"]
    resp["confidenceScore"] = preds[0]["probability"]
    return resp
