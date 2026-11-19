"""
Disease model definitions shared by training (train_models.py) and serving (models.py).

Each feature:
  key      column name in data/<file>.csv and the key the API expects
  label    shown in the form
  unit     shown after values
  ref      normal / reference range text (optional)
  default  value pre-filled in the form
  step/min/max  input hints
  options  list of {value, label} for categorical inputs
  optional True -> user may leave blank; the model imputes it from the training data
  log      True -> very skewed lab value; the model uses log(1 + value)
"""

DISEASES = {
    "diabetes": {
        "file": "diabetes.csv",
        "title": "Type 2 Diabetes Risk",
        "tab": "🩸 Diabetes",
        "heading": "Glucose tolerance & metabolic markers",
        "dataset": "Pima Indians Diabetes Database (NIDDK, via UCI) — 768 women aged 21+",
        "population_note": "Trained on Pima women aged 21+; risk for other groups may differ.",
        "features": [
            {"key": "glucose", "label": "Plasma glucose, 2-hour oral glucose tolerance test", "unit": "mg/dL", "ref": "<140 normal, 140–199 impaired, ≥200 diabetes", "default": 148, "step": 1, "min": 40, "max": 400},
            {"key": "bmi", "label": "Body mass index (BMI)", "unit": "kg/m²", "ref": "18.5–24.9", "default": 33.6, "step": 0.1, "min": 10, "max": 80},
            {"key": "age", "label": "Age", "unit": "years", "default": 50, "step": 1, "min": 18, "max": 100},
            {"key": "pregnancies", "label": "Number of pregnancies", "unit": "", "default": 2, "step": 1, "min": 0, "max": 20},
            {"key": "blood_pressure", "label": "Diastolic blood pressure", "unit": "mmHg", "ref": "<80", "default": 72, "step": 1, "min": 30, "max": 140, "optional": True},
            {"key": "insulin", "log": True, "label": "2-hour serum insulin", "unit": "µU/mL", "ref": "16–166", "default": "", "step": 1, "min": 0, "max": 900, "optional": True},
            {"key": "pedigree", "log": True, "label": "Diabetes pedigree function (family history score)", "unit": "", "ref": "typical 0.1–1.0; higher = stronger family history", "default": 0.47, "step": 0.01, "min": 0, "max": 2.5, "optional": True},
        ],
        # Not a model input: checked against ADA diagnostic thresholds
        "guideline_inputs": [
            {"key": "hba1c", "label": "HbA1c (if known)", "unit": "%", "ref": "<5.7 normal, 5.7–6.4 prediabetes, ≥6.5 diabetes", "default": "", "step": 0.1, "min": 3, "max": 20, "optional": True},
        ],
        "recommendations": [
            "Confirm with fasting plasma glucose and HbA1c tests",
            "Discuss results with a physician or endocrinologist",
            "Maintain a healthy weight, balanced low-sugar diet and 150 min/week of activity",
        ],
    },
    "kidney": {
        "file": "kidney.csv",
        "title": "Chronic Kidney Disease Risk",
        "tab": "💧 Kidney",
        "heading": "Renal function, urine and blood markers",
        "dataset": "UCI Chronic Kidney Disease dataset (Apollo Hospitals, India) — 400 patients",
        "population_note": "Trained on 400 hospital patients; this dataset is unusually easy to separate, so real-world accuracy will be lower than the cross-validation score.",
        "features": [
            {"key": "serum_creatinine", "log": True, "label": "Serum creatinine", "unit": "mg/dL", "ref": "0.6–1.3", "default": 1.8, "step": 0.1, "min": 0.2, "max": 80},
            {"key": "hemoglobin", "label": "Hemoglobin", "unit": "g/dL", "ref": "12–17", "default": 10.8, "step": 0.1, "min": 2, "max": 20},
            {"key": "specific_gravity", "label": "Urine specific gravity", "unit": "", "ref": "1.015–1.025",
             "default": 1.010, "options": [{"value": v, "label": f"{v:.3f}"} for v in (1.005, 1.010, 1.015, 1.020, 1.025)]},
            {"key": "albumin", "label": "Urine albumin (dipstick 0–5)", "unit": "", "ref": "0",
             "default": 2, "options": [{"value": v, "label": str(v)} for v in range(6)]},
            {"key": "blood_urea", "log": True, "label": "Blood urea", "unit": "mg/dL", "ref": "15–45", "default": 54, "step": 1, "min": 1, "max": 400},
            {"key": "blood_glucose_random", "log": True, "label": "Random blood glucose", "unit": "mg/dL", "ref": "<140", "default": 121, "step": 1, "min": 20, "max": 500, "optional": True},
            {"key": "blood_pressure", "label": "Diastolic blood pressure", "unit": "mmHg", "ref": "<80", "default": 80, "step": 1, "min": 40, "max": 180},
            {"key": "age", "label": "Age", "unit": "years", "default": 52, "step": 1, "min": 1, "max": 100},
            {"key": "sugar", "label": "Urine sugar (dipstick 0–5)", "unit": "", "ref": "0",
             "default": 0, "options": [{"value": v, "label": str(v)} for v in range(6)], "optional": True},
            {"key": "hypertension", "label": "Diagnosed hypertension", "unit": "", "default": 1, "options": [{"value": 0, "label": "No"}, {"value": 1, "label": "Yes"}]},
            {"key": "diabetes", "label": "Diagnosed diabetes", "unit": "", "default": 0, "options": [{"value": 0, "label": "No"}, {"value": 1, "label": "Yes"}]},
        ],
        "recommendations": [
            "Check eGFR (from creatinine) and urine albumin-to-creatinine ratio",
            "Repeat abnormal tests in 3 months to confirm a chronic pattern",
            "Control blood pressure and blood sugar; review medicines with a nephrologist",
        ],
    },
    "liver": {
        "file": "liver.csv",
        "title": "Liver Disease Risk",
        "tab": "🧪 Liver",
        "heading": "Liver function test (LFT) panel",
        "dataset": "UCI Indian Liver Patient Dataset (ILPD, Andhra Pradesh) — 583 patients",
        "population_note": "Trained on 583 hospital patients (71% liver patients). Liver disease is hard to predict from LFTs alone, so treat this as a rough screen.",
        "features": [
            {"key": "total_bilirubin", "log": True, "label": "Total bilirubin", "unit": "mg/dL", "ref": "0.3–1.2", "default": 2.1, "step": 0.1, "min": 0.1, "max": 80},
            {"key": "direct_bilirubin", "log": True, "label": "Direct bilirubin", "unit": "mg/dL", "ref": "0–0.3", "default": 0.8, "step": 0.1, "min": 0, "max": 30},
            {"key": "alt_sgpt", "log": True, "label": "ALT / SGPT", "unit": "U/L", "ref": "7–56", "default": 68, "step": 1, "min": 1, "max": 3000},
            {"key": "ast_sgot", "log": True, "label": "AST / SGOT", "unit": "U/L", "ref": "8–40", "default": 58, "step": 1, "min": 1, "max": 5000},
            {"key": "alkaline_phosphatase", "log": True, "label": "Alkaline phosphatase (ALP)", "unit": "U/L", "ref": "44–147", "default": 260, "step": 1, "min": 10, "max": 2500},
            {"key": "albumin", "label": "Serum albumin", "unit": "g/dL", "ref": "3.5–5.0", "default": 3.1, "step": 0.1, "min": 0.5, "max": 7},
            {"key": "total_proteins", "label": "Total proteins", "unit": "g/dL", "ref": "6.0–8.3", "default": 6.5, "step": 0.1, "min": 2, "max": 12},
            {"key": "age", "label": "Age", "unit": "years", "default": 45, "step": 1, "min": 1, "max": 100},
            {"key": "sex", "label": "Sex", "unit": "", "default": 1, "options": [{"value": 0, "label": "Female"}, {"value": 1, "label": "Male"}]},
        ],
        "recommendations": [
            "Repeat the liver function panel and add GGT and INR",
            "Abdominal ultrasound / FibroScan if values stay abnormal",
            "Avoid alcohol and liver-toxic medicines; test for viral hepatitis (HBV, HCV)",
        ],
    },
    "heart": {
        "file": "heart.csv",
        "external_file": "heart_external.csv",
        "title": "Coronary Heart Disease Risk",
        "tab": "❤️ Heart",
        "heading": "Clinical history, resting & exercise ECG",
        "dataset": "UCI Heart Disease — Cleveland Clinic (303 patients); externally checked on Hungarian & VA Long Beach cohorts",
        "population_note": "Trained on patients referred for angiography (46% had disease), so risks are higher than for the general public.",
        "features": [
            {"key": "chest_pain_type", "label": "Chest pain type", "unit": "", "default": 4,
             "options": [{"value": 1, "label": "Typical angina"}, {"value": 2, "label": "Atypical angina"},
                         {"value": 3, "label": "Non-anginal pain"}, {"value": 4, "label": "No chest pain (asymptomatic)"}]},
            {"key": "exercise_angina", "label": "Chest pain during exercise", "unit": "", "default": 1, "options": [{"value": 0, "label": "No"}, {"value": 1, "label": "Yes"}]},
            {"key": "st_depression", "label": "ST depression on exercise ECG (oldpeak)", "unit": "mm", "ref": "0", "default": 1.8, "step": 0.1, "min": -3, "max": 7},
            {"key": "st_slope", "label": "Peak exercise ST slope", "unit": "", "default": 1,
             "options": [{"value": 0, "label": "Upsloping"}, {"value": 1, "label": "Flat"}, {"value": 2, "label": "Downsloping"}]},
            {"key": "max_heart_rate", "label": "Maximum heart rate on exercise test", "unit": "bpm", "default": 138, "step": 1, "min": 60, "max": 220},
            {"key": "age", "label": "Age", "unit": "years", "default": 58, "step": 1, "min": 18, "max": 100},
            {"key": "sex", "label": "Sex", "unit": "", "default": 1, "options": [{"value": 0, "label": "Female"}, {"value": 1, "label": "Male"}]},
            {"key": "resting_bp", "label": "Resting systolic blood pressure", "unit": "mmHg", "ref": "<120", "default": 146, "step": 1, "min": 80, "max": 220},
            {"key": "cholesterol", "label": "Serum cholesterol", "unit": "mg/dL", "ref": "<200", "default": 264, "step": 1, "min": 100, "max": 600, "optional": True},
            {"key": "fasting_blood_sugar", "label": "Fasting blood sugar > 120 mg/dL", "unit": "", "default": 0, "options": [{"value": 0, "label": "No"}, {"value": 1, "label": "Yes"}]},
            {"key": "resting_ecg", "label": "Resting ECG", "unit": "", "default": 0,
             "options": [{"value": 0, "label": "Normal"}, {"value": 1, "label": "ST-T wave abnormality"}, {"value": 2, "label": "Left ventricular hypertrophy"}]},
        ],
        "recommendations": [
            "Discuss with a cardiologist; a stress test or CT coronary angiography may be advised",
            "Check lipid profile, HbA1c and blood pressure regularly",
            "Seek emergency care for chest pain at rest, breathlessness or fainting",
        ],
    },
    "parkinsons": {
        "file": "parkinsons.csv",
        "group_column": "subject",
        "title": "Parkinson's Disease (Voice) Risk",
        "tab": "🧠 Parkinson's",
        "heading": "Voice recording measures (from Praat / MDVP analysis)",
        "dataset": "UCI Parkinson's voice dataset (Little et al., Oxford) — 195 recordings from 32 people",
        "population_note": "Only 32 people (8 healthy) in the training data, so this estimate is uncertain. Values come from voice-analysis software such as Praat.",
        "features": [
            {"key": "spread1", "label": "Spread1 (fundamental frequency variation)", "unit": "", "ref": "healthy ≈ −6.8", "default": -5.0, "step": 0.1, "min": -9, "max": -1},
            {"key": "ppe", "label": "PPE (pitch period entropy)", "unit": "", "ref": "healthy ≈ 0.12", "default": 0.25, "step": 0.01, "min": 0, "max": 0.6},
            {"key": "mdvp_fo", "label": "Average vocal frequency (MDVP:Fo)", "unit": "Hz", "default": 145, "step": 1, "min": 60, "max": 300},
            {"key": "mdvp_jitter", "log": True, "label": "Jitter (MDVP:Jitter, fraction)", "unit": "", "ref": "healthy ≈ 0.004", "default": 0.0068, "step": 0.0001, "min": 0, "max": 0.05},
            {"key": "mdvp_shimmer", "log": True, "label": "Shimmer (MDVP:Shimmer)", "unit": "", "ref": "healthy ≈ 0.018", "default": 0.033, "step": 0.001, "min": 0, "max": 0.2},
            {"key": "hnr", "label": "Harmonics-to-noise ratio (HNR)", "unit": "dB", "ref": "healthy ≈ 24", "default": 20.0, "step": 0.1, "min": 5, "max": 40},
            {"key": "nhr", "log": True, "label": "Noise-to-harmonics ratio (NHR)", "unit": "", "default": 0.03, "step": 0.001, "min": 0, "max": 0.5},
            {"key": "rpde", "label": "RPDE (recurrence period density entropy)", "unit": "", "default": 0.52, "step": 0.01, "min": 0.2, "max": 0.8},
            {"key": "dfa", "label": "DFA (detrended fluctuation analysis)", "unit": "", "default": 0.72, "step": 0.01, "min": 0.5, "max": 0.9},
        ],
        "recommendations": [
            "Book a neurologist / movement-disorder specialist examination",
            "A voice test alone cannot diagnose Parkinson's; clinical motor assessment is needed",
            "Speech therapy (e.g. LSVT LOUD) helps if voice changes are confirmed",
        ],
    },
}

RISK_BANDS = [(60.0, "HIGH RISK"), (30.0, "MODERATE RISK"), (0.0, "LOW RISK")]


def risk_level(probability_pct: float) -> str:
    for threshold, level in RISK_BANDS:
        if probability_pct >= threshold:
            return level
    return "LOW RISK"
