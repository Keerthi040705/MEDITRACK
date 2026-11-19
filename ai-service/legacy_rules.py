"""
LEGACY hand-written rules from the original project (NOT trained on data).
Kept only so train_models.py can measure how well they did, for comparison.

Original description: MediTrack AI models (pure Python, no external ML libraries needed).

1. Symptom checker   -> scores 5 conditions from a symptom checklist, with SHAP-style
                        per-feature contributions.
2. Disease predictors -> Kidney, Liver, Diabetes, Parkinson's and Heart risk from lab /
                        clinical biomarkers, with SHAP-style attributions.

Note: these are weighted logistic scoring models (the same logic as the original
project), presented with a DNN-style architecture summary. They are for
demonstration and education only - not medical advice.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def round_half_up(value: float, digits: int = 1) -> float:
    """Java-style Math.round (half up), unlike Python's banker's rounding."""
    factor = 10 ** digits
    return math.floor(value * factor + 0.5) / factor


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def risk_level(probability: float) -> str:
    if probability >= 75.0:
        return "HIGH RISK"
    if probability >= 45.0:
        return "MODERATE RISK"
    return "LOW RISK"


def shap(feature: str, impact: float, direction: str, explanation: str) -> dict:
    return {"feature": feature, "impact": impact, "direction": direction, "explanation": explanation}


def num_str(x: float) -> str:
    """Formats like Java's "" + double  (e.g. 54.0 -> '54.0', 1.8 -> '1.8')."""
    return repr(float(x))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# 1. Symptom checker
# ---------------------------------------------------------------------------

SYMPTOMS = [
    {"id": "fever", "label": "Fever / Elevated Body Temperature", "category": "General"},
    {"id": "fatigue", "label": "Chronic Fatigue / Lethargy", "category": "General"},
    {"id": "shortness_of_breath", "label": "Shortness of Breath (Dyspnea)", "category": "Cardiopulmonary"},
    {"id": "chest_pain", "label": "Chest Pain / Retrosternal Pressure", "category": "Cardiopulmonary"},
    {"id": "frequent_urination", "label": "Frequent Urination (Polyuria)", "category": "Renal / Metabolic"},
    {"id": "excessive_thirst", "label": "Excessive Thirst (Polydipsia)", "category": "Renal / Metabolic"},
    {"id": "tremors", "label": "Involuntary Tremors (Resting/Intention)", "category": "Neurological"},
    {"id": "muscle_rigidity", "label": "Muscle Rigidity / Stiffness", "category": "Neurological"},
    {"id": "slow_movement", "label": "Bradykinesia / Slow Movement", "category": "Neurological"},
    {"id": "swollen_ankles", "label": "Peripheral Edema (Swollen Ankles/Feet)", "category": "Renal / Cardiac"},
    {"id": "jaundice_yellowing", "label": "Jaundice (Scleral/Skin Yellowing)", "category": "Hepatic"},
    {"id": "abdominal_pain", "label": "Right Upper Quadrant / Abdominal Pain", "category": "Hepatic / GI"},
    {"id": "high_bp", "label": "Elevated Blood Pressure Readings", "category": "Cardiovascular"},
    {"id": "blurred_vision", "label": "Blurred / Impaired Vision", "category": "Metabolic"},
    {"id": "weight_loss", "label": "Unexplained Weight Loss", "category": "Metabolic"},
    {"id": "joint_pain", "label": "Joint Pain / Arthralgia", "category": "Musculoskeletal"},
    {"id": "persistent_cough", "label": "Persistent Cough (>2 weeks)", "category": "Respiratory"},
    {"id": "nausea_vomiting", "label": "Nausea & Persistent Vomiting", "category": "General / GI"},
]
SYMPTOM_LABELS = {s["id"]: s["label"] for s in SYMPTOMS}

SYMPTOM_DISEASES = [
    {
        "name": "Type 2 Diabetes Mellitus",
        "category": "Metabolic / Endocrine",
        "weights": {"frequent_urination": 0.32, "excessive_thirst": 0.28, "blurred_vision": 0.18, "fatigue": 0.12, "weight_loss": 0.15},
        "next_steps": ["Perform Fasting Plasma Glucose (FPG) test", "Schedule HbA1c screening", "Consult Endocrinologist"],
    },
    {
        "name": "Chronic Kidney Disease (CKD)",
        "category": "Nephrological",
        "weights": {"swollen_ankles": 0.34, "fatigue": 0.18, "high_bp": 0.22, "frequent_urination": 0.16, "shortness_of_breath": 0.15},
        "next_steps": ["Comprehensive Metabolic Panel (CMP)", "Serum Creatinine & eGFR Calculation", "Urine Albumin-to-Creatinine Ratio (uACR)"],
    },
    {
        "name": "Coronary Artery / Heart Disease",
        "category": "Cardiovascular",
        "weights": {"chest_pain": 0.40, "shortness_of_breath": 0.25, "fatigue": 0.14, "high_bp": 0.18, "swollen_ankles": 0.15},
        "next_steps": ["12-Lead Electrocardiogram (ECG)", "Echocardiogram & Cardiac Troponin T/I", "Immediate Cardiologist Consultation"],
    },
    {
        "name": "Parkinson's Disease",
        "category": "Neurological",
        "weights": {"tremors": 0.42, "muscle_rigidity": 0.28, "slow_movement": 0.24, "fatigue": 0.10},
        "next_steps": ["Neurological Motor Assessment (UPDRS)", "Brain MRI with Volumetry", "Movement Disorder Specialist Consultation"],
    },
    {
        "name": "Hepatic Dysfunction / Liver Disease",
        "category": "Hepatological / Gastrointestinal",
        "weights": {"jaundice_yellowing": 0.45, "abdominal_pain": 0.26, "nausea_vomiting": 0.16, "fatigue": 0.14, "swollen_ankles": 0.12},
        "next_steps": ["Liver Function Panel (ALT, AST, ALP, Bilirubin)", "Abdominal Ultrasound", "Serum Ferritin & Viral Hepatitis Panel"],
    },
]


def _evaluate_symptom_disease(disease: dict, user_symptoms: list[str]) -> dict:
    base_prior = 0.08
    total = 0.0
    shap_list = []
    for sym, weight in disease["weights"].items():
        label = SYMPTOM_LABELS.get(sym, sym)
        if sym in user_symptoms:
            total += weight
            shap_list.append(shap(label, round_half_up(weight, 2), "RISK_INCREASING",
                                  f"+{int(weight * 100)}% risk attributed to reported {label}"))
        else:
            shap_list.append(shap(f"{label} (Absent)", -0.04, "PROTECTIVE",
                                  f"-4% risk due to absence of {label}"))

    raw = base_prior + total
    probability = min(96.0, max(8.0, sigmoid(3.2 * (raw - 0.4)) * 100.0))
    probability = round_half_up(probability, 1)
    shap_list.sort(key=lambda s: abs(s["impact"]), reverse=True)
    observed = sum(1 for s in user_symptoms if s in disease["weights"])

    return {
        "diseaseName": disease["name"],
        "category": disease["category"],
        "probability": probability,
        "riskLevel": risk_level(probability),
        "summary": f"AI classifier predicts {disease['name']} with {probability:.1f}% confidence "
                   f"based on {observed} observed symptom(s).",
        "shapExplanations": shap_list,
        "recommendedNextSteps": disease["next_steps"],
    }


def check_symptoms(symptoms: list[str]) -> dict:
    symptoms = [s for s in symptoms if isinstance(s, str)]
    response = {"submittedSymptoms": symptoms, "predictions": [], "analyzedAt": now_iso()}
    if not symptoms:
        response.update(primaryDiagnosis="No symptoms reported", confidenceScore=0.0)
        return response

    predictions = [_evaluate_symptom_disease(d, symptoms) for d in SYMPTOM_DISEASES]
    predictions.sort(key=lambda p: p["probability"], reverse=True)
    response["predictions"] = predictions
    response["primaryDiagnosis"] = predictions[0]["diseaseName"]
    response["confidenceScore"] = predictions[0]["probability"]
    return response


# ---------------------------------------------------------------------------
# 2. Disease risk predictors
# ---------------------------------------------------------------------------

def _finish(res: dict, logit: float, shap_list: list, clinical: str, recs: list[str]) -> dict:
    prob = round_half_up(sigmoid(logit) * 100.0, 1)
    prob = min(97.5, max(5.0, prob))
    shap_list.sort(key=lambda s: abs(s["impact"]), reverse=True)
    res.update(
        riskProbability=prob,
        riskLevel=risk_level(prob),
        shapValues=shap_list,
        clinicalInterpretation=clinical,
        recommendations=recs,
        calculatedAt=now_iso(),
    )
    return res


def _kidney(f: dict, res: dict) -> dict:
    res["diseaseDisplayName"] = "Chronic Kidney Disease (CKD) Neural Predictor"
    res["dnnArchitecture"] = "Input[6] -> Dense(64, ReLU) -> Dense(32, ReLU) -> Dropout(0.2) -> Dense(16, ReLU) -> Dense(1, Sigmoid)"
    res["layerActivations"] = [
        "L1 Dense(64): Mean Activation 0.628, Sparse Fraction 0.18",
        "L2 Dense(32): Mean Activation 0.491, Non-linear ReLU saturation 0.12",
        "L3 Dropout(0.2): Regularization pass active",
        "L4 Output(1): Logit Activation passed to Sigmoid",
    ]
    creatinine = f.get("creatinine", 1.2)
    urea = f.get("blood_urea", 42.0)
    albumin = f.get("albumin", 1.0)
    hemoglobin = f.get("hemoglobin", 13.0)
    bp = f.get("blood_pressure", 125.0)

    s, logit = [], -1.2
    if creatinine > 1.4:
        imp = min(0.38, (creatinine - 1.2) * 0.18)
        logit += imp * 3.5
        s.append(shap(f"Serum Creatinine ({num_str(creatinine)} mg/dL)", imp, "RISK_INCREASING", "Elevated creatinine indicates impaired renal glomerular filtration"))
    else:
        s.append(shap(f"Serum Creatinine ({num_str(creatinine)} mg/dL)", -0.15, "PROTECTIVE", "Creatinine within physiological reference range"))

    if urea > 45:
        logit += 0.22 * 2.8
        s.append(shap(f"Blood Urea ({num_str(urea)} mg/dL)", 0.22, "RISK_INCREASING", "Azotemia: Accumulation of nitrogenous waste in bloodstream"))
    else:
        s.append(shap(f"Blood Urea ({num_str(urea)} mg/dL)", -0.10, "PROTECTIVE", "Normal blood urea nitrogen concentration"))

    if albumin >= 2.0:
        logit += 0.31 * 3.2
        s.append(shap(f"Albuminuria (Level {int(albumin)})", 0.31, "RISK_INCREASING", "Significant proteinuria suggesting glomerular barrier breakdown"))
    else:
        s.append(shap(f"Albuminuria (Level {int(albumin)})", -0.08, "PROTECTIVE", "Trace or zero protein in urine"))

    if hemoglobin < 11.0:
        logit += 0.25 * 2.5
        s.append(shap(f"Hemoglobin ({num_str(hemoglobin)} g/dL)", 0.25, "RISK_INCREASING", "Renal anemia due to diminished erythropoietin production"))
    else:
        s.append(shap(f"Hemoglobin ({num_str(hemoglobin)} g/dL)", -0.12, "PROTECTIVE", "Adequate oxygen-carrying capacity"))

    if bp > 140:
        logit += 0.18 * 2.0
        s.append(shap(f"Systolic BP ({int(bp)} mmHg)", 0.18, "RISK_INCREASING", "Renal vascular hypertension causing microvascular damage"))

    return _finish(res, logit, s,
                   "Patient profile demonstrates elevated renal biomarker thresholds indicating glomerular compromise.",
                   ["Conduct 24-hour urinary protein quantification", "Schedule Renal Doppler Sonogram",
                    "Dietary sodium & protein restriction under nephrologist guidance"])


def _liver(f: dict, res: dict) -> dict:
    res["diseaseDisplayName"] = "Hepatic Cirrhosis & Liver Dysfunction DNN"
    res["dnnArchitecture"] = "Input[7] -> Dense(64, ReLU) -> Dense(32, ReLU) -> Dropout(0.25) -> Dense(1, Sigmoid)"
    res["layerActivations"] = [
        "L1 Dense(64): Mean Activation 0.584, Kurtosis 2.14",
        "L2 Dense(32): Mean Activation 0.432",
        "L3 Dropout(0.25): Feature regularizer active",
        "L4 Output Sigmoid: Calibrated via Platt Scaling",
    ]
    tb = f.get("total_bilirubin", 0.9)
    alp = f.get("alkaline_phosphatase", 180.0)
    alt = f.get("alt_sgpt", 32.0)
    ast = f.get("ast_sgot", 28.0)
    albumin = f.get("albumin", 3.8)

    s, logit = [], -1.5
    if tb > 1.3:
        logit += 0.35 * 3.4
        s.append(shap(f"Total Bilirubin ({num_str(tb)} mg/dL)", 0.35, "RISK_INCREASING", "Hyperbilirubinemia indicating cholestasis or hepatic clearance failure"))
    else:
        s.append(shap(f"Total Bilirubin ({num_str(tb)} mg/dL)", -0.14, "PROTECTIVE", "Physiological bilirubin processing"))

    if alt > 45:
        logit += 0.29 * 3.0
        s.append(shap(f"ALT/SGPT ({int(alt)} U/L)", 0.29, "RISK_INCREASING", "Hepatocyte membrane leakage and ongoing parenchymal inflammation"))
    else:
        s.append(shap(f"ALT/SGPT ({int(alt)} U/L)", -0.11, "PROTECTIVE", "Normal transaminase activity"))

    if ast > 40:
        logit += 0.24 * 2.6
        s.append(shap(f"AST/SGOT ({int(ast)} U/L)", 0.24, "RISK_INCREASING", "Cellular injury involving mitochondrial hepatic architecture"))

    if alp > 250:
        logit += 0.21 * 2.2
        s.append(shap(f"Alkaline Phosphatase ({int(alp)} U/L)", 0.21, "RISK_INCREASING", "Biliary tree obstruction or canalicular membrane irritation"))

    if albumin < 3.4:
        logit += 0.26 * 2.5
        s.append(shap(f"Serum Albumin ({num_str(albumin)} g/dL)", 0.26, "RISK_INCREASING", "Hypoalbuminemia reflecting impaired hepatic biosynthetic capacity"))

    return _finish(res, logit, s,
                   "Enzymatic profile shows transaminase perturbation consistent with acute or progressive hepatopathy.",
                   ["Schedule Upper Abdominal Ultrasound / FibroScan", "Order Viral Hepatitis Serology (HBV, HCV)",
                    "Abstain from all hepatotoxic medications & alcohol"])


def _diabetes(f: dict, res: dict) -> dict:
    res["diseaseDisplayName"] = "Type 2 Diabetes Neural Network Classifier"
    res["dnnArchitecture"] = "Input[8] -> Dense(128, ReLU) -> Dense(64, ReLU) -> Dense(32, ReLU) -> Dense(1, Sigmoid)"
    res["layerActivations"] = [
        "L1 Dense(128): Relu sparsity 24.1%, Norm 4.2",
        "L2 Dense(64): Gradient flow steady",
        "L3 Dense(32): Bottleneck feature extraction",
        "L4 Sigmoid: Logistic probability map",
    ]
    glucose = f.get("glucose", 110.0)
    bmi = f.get("bmi", 26.5)
    hba1c = f.get("hba1c", 5.6)
    age = f.get("age", 42.0)

    s, logit = [], -1.8
    if glucose >= 126.0:
        logit += 0.42 * 3.8
        s.append(shap(f"Fasting Glucose ({int(glucose)} mg/dL)", 0.42, "RISK_INCREASING", "Fasting hyperglycemia exceeding standard diagnostic threshold"))
    elif glucose >= 100.0:
        logit += 0.20 * 2.1
        s.append(shap(f"Fasting Glucose ({int(glucose)} mg/dL)", 0.20, "RISK_INCREASING", "Impaired fasting glycaemia (Pre-diabetic metabolic range)"))
    else:
        s.append(shap(f"Fasting Glucose ({int(glucose)} mg/dL)", -0.22, "PROTECTIVE", "Normoglycemic metabolic state"))

    if hba1c >= 6.5:
        logit += 0.44 * 4.0
        s.append(shap(f"HbA1c ({num_str(hba1c)}%)", 0.44, "RISK_INCREASING", "Glycated hemoglobin above diabetic threshold indicating chronic hyperglycemia"))
    elif hba1c >= 5.7:
        logit += 0.22 * 2.2
        s.append(shap(f"HbA1c ({num_str(hba1c)}%)", 0.22, "RISK_INCREASING", "Elevated 3-month glycation marker"))
    else:
        s.append(shap(f"HbA1c ({num_str(hba1c)}%)", -0.20, "PROTECTIVE", "Optimal glucose hemoglobin saturation"))

    if bmi >= 30.0:
        logit += 0.25 * 2.4
        s.append(shap(f"BMI ({num_str(bmi)} kg/m²)", 0.25, "RISK_INCREASING", "Adiposity driving peripheral insulin receptor desensitization"))
    elif bmi < 24.9:
        s.append(shap(f"BMI ({num_str(bmi)} kg/m²)", -0.12, "PROTECTIVE", "Healthy body mass index"))

    if age > 45:
        logit += 0.14 * 1.5
        s.append(shap(f"Age ({int(age)} yrs)", 0.14, "RISK_INCREASING", "Age-associated decline in beta-cell proliferative capacity"))

    return _finish(res, logit, s,
                   "Glycemic indices and anthropometric markers indicate metabolic syndrome progression.",
                   ["Perform Oral Glucose Tolerance Test (OGTT)", "Begin continuous glucose tracking / diet diary",
                    "Initiate low-glycemic dietary and physical exercise regimen"])


def _parkinsons(f: dict, res: dict) -> dict:
    res["diseaseDisplayName"] = "Parkinson's Movement & Acoustic Dysphonia DNN"
    res["dnnArchitecture"] = "Input[8] -> Dense(64, ReLU) -> Dense(32, ReLU) -> Dense(16, ReLU) -> Dense(1, Sigmoid)"
    res["layerActivations"] = [
        "L1 Dense(64): Vocal biomarker Fourier features mapped",
        "L2 Dense(32): High-order non-linear frequency perturbation encoding",
        "L3 Dense(16): Motor entropy bottleneck layer",
        "L4 Sigmoid: Neuro-degenerative probability score",
    ]
    jitter = f.get("mdvp_jitter", 0.005)
    shimmer = f.get("mdvp_shimmer", 0.025)
    hnr = f.get("hnr", 22.0)
    rpde = f.get("rpde", 0.45)

    s, logit = [], -1.4
    if jitter > 0.007:
        logit += 0.36 * 3.2
        s.append(shap(f"MDVP:Jitter ({jitter:.4f})", 0.36, "RISK_INCREASING", "Vocal micro-tremor manifesting in frequency instability"))
    else:
        s.append(shap(f"MDVP:Jitter ({jitter:.4f})", -0.14, "PROTECTIVE", "Stable vocal cord vibration period"))

    if shimmer > 0.035:
        logit += 0.32 * 3.0
        s.append(shap(f"MDVP:Shimmer ({shimmer:.3f})", 0.32, "RISK_INCREASING", "Subglottic pressure fluctuations from basal ganglia dysregulation"))

    if hnr < 18.0:
        logit += 0.30 * 2.8
        s.append(shap(f"HNR ({hnr:.1f} dB)", 0.30, "RISK_INCREASING", "Elevated acoustic turbulence and dysphonia"))
    else:
        s.append(shap(f"HNR ({hnr:.1f} dB)", -0.16, "PROTECTIVE", "Normal tonal harmonic resonance"))

    if rpde > 0.55:
        logit += 0.26 * 2.5
        s.append(shap(f"RPDE Entropy ({rpde:.2f})", 0.26, "RISK_INCREASING", "High non-linear dynamical complexity in speech signals"))

    return _finish(res, logit, s,
                   "Acoustic and phonetic perturbation coefficients correlate with extrapyramidal dopaminergic deficits.",
                   ["Schedule DaTscan (Dopamine Transporter SPECT Imaging)", "Complete UPDRS Part III Motor Examination",
                    "Consult movement disorder neurologist"])


def _heart(f: dict, res: dict) -> dict:
    res["diseaseDisplayName"] = "Coronary Heart & Myocardial Disease DNN"
    res["dnnArchitecture"] = "Input[8] -> Dense(128, ReLU) -> Dense(64, ReLU) -> Dense(32, ReLU) -> Dense(1, Sigmoid)"
    res["layerActivations"] = [
        "L1 Dense(128): Hemodynamic and ECG vector ingestion",
        "L2 Dense(64): Ischemic risk pattern mapping",
        "L3 Dense(32): Arterial stiffness synthesis",
        "L4 Sigmoid: Cardiovascular event risk estimator",
    ]
    chest_pain = f.get("chest_pain_type", 2.0)
    resting_bp = f.get("resting_bp", 138.0)
    cholesterol = f.get("cholesterol", 240.0)
    st = f.get("st_depression", 1.4)

    s, logit = [], -1.3
    if chest_pain == 1.0:
        logit += 0.40 * 3.6
        s.append(shap("Typical Anginal Chest Pain", 0.40, "RISK_INCREASING", "Substernal ischemic discomfort provoked by physical or emotional stress"))
    elif chest_pain == 2.0:
        logit += 0.22 * 2.0
        s.append(shap("Atypical Anginal Chest Pain", 0.22, "RISK_INCREASING", "Non-classical anginal presentation requiring cardiac evaluation"))

    if st > 1.0:
        logit += 0.38 * 3.5
        s.append(shap(f"ST Depression ({num_str(st)} mm)", 0.38, "RISK_INCREASING", "Subendocardial ischemia noted during repolarization phase"))
    else:
        s.append(shap(f"ST Segment ({num_str(st)} mm)", -0.15, "PROTECTIVE", "Normal repolarization morphology without ischemic deviation"))

    if cholesterol > 220:
        logit += 0.28 * 2.6
        s.append(shap(f"Serum Cholesterol ({int(cholesterol)} mg/dL)", 0.28, "RISK_INCREASING", "Atherogenic lipid accumulation promoting plaque instability"))
    else:
        s.append(shap(f"Serum Cholesterol ({int(cholesterol)} mg/dL)", -0.12, "PROTECTIVE", "Desirable lipid concentration"))

    if resting_bp > 140:
        logit += 0.24 * 2.3
        s.append(shap(f"Resting BP ({int(resting_bp)} mmHg)", 0.24, "RISK_INCREASING", "Stage 2 Hypertension contributing to ventricular afterload"))

    return _finish(res, logit, s,
                   "Cardiac biomarkers, hemodynamic indices, and ECG repolarization metrics suggest ischemic risk.",
                   ["Perform Treadmill Stress Test (Bruce Protocol)", "Schedule 2D Echocardiogram with Doppler",
                    "Coronary CT Angiography (CCTA) under cardiologist review"])


DISEASE_MODELS = {
    "kidney": _kidney,
    "liver": _liver,
    "diabetes": _diabetes,
    "parkinsons": _parkinsons,
    "heart": _heart,
}


def predict_disease(disease_type: str, features: dict) -> dict:
    key = (disease_type or "diabetes").strip().lower()
    if key not in DISEASE_MODELS:
        raise ValueError(f"Unknown diseaseType '{disease_type}'. Use one of: {', '.join(DISEASE_MODELS)}")
    clean = {}
    for name, value in (features or {}).items():
        try:
            clean[name] = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"Feature '{name}' must be a number (got {value!r})")
        if not math.isfinite(clean[name]):
            raise ValueError(f"Feature '{name}' must be a finite number")
    return DISEASE_MODELS[key](clean, {"diseaseType": key})
