# MediTrack AI — Model Training Report

Generated 2026-10-18 13:30 UTC with scikit-learn 1.9.1.

Very skewed lab values (bilirubin, liver enzymes, creatinine, urea, insulin, voice jitter...) are log-transformed. Every disease model was chosen by **nested cross-validation** (outer 5-fold × 2 repeats; hyper-parameters tuned only inside the training folds). Parkinson's folds are split **by person**. Scores are means across outer folds. "Old rules" is the ROC-AUC of the original hand-written formulas on the same data (no training).

## Selected models

| Disease | Selected model | ROC-AUC | Accuracy | Sensitivity | Specificity | Old rules AUC | Data |
|---|---|---|---|---|---|---|---|
| Type 2 Diabetes Risk | Neural Network (MLP) | 0.845 ± 0.041 | 76.4% | 59.9% | 85.3% | 0.7926 | 768 rows |
| Chronic Kidney Disease Risk | Logistic Regression | 0.999 ± 0.003 | 98.1% | 98.0% | 98.3% | 0.8992 | 400 rows |
| Liver Disease Risk | Logistic Regression | 0.750 ± 0.044 | 70.6% | 92.9% | 15.0% | 0.7183 | 583 rows |
| Coronary Heart Disease Risk | Logistic Regression | 0.868 ± 0.025 | 78.9% | 73.8% | 83.2% | 0.671 | 303 rows |
| Parkinson's Disease (Voice) Risk | Logistic Regression | 0.852 ± 0.107 | 83.3% | 96.0% | 40.8% | 0.749 | 195 rows / 32 people |

**Heart external check:** trained on Cleveland only, tested on hungarian, va_long_beach (494 patients, different hospitals): ROC-AUC 0.862, accuracy 77.3%.

## Full leaderboards

### Type 2 Diabetes Risk

Dataset: Pima Indians Diabetes Database (NIDDK, via UCI) — 768 women aged 21+ 
Positive (disease) rate: 34.9%

| Algorithm | ROC-AUC | Accuracy | Sensitivity | Specificity | Brier |
|---|---|---|---|---|---|
| Neural Network (MLP) | 0.845 ± 0.041 | 76.4% | 59.9% | 85.3% | 0.154 |
| SVM (RBF) | 0.838 ± 0.038 | 75.9% | 54.0% | 87.7% | 0.161 |
| Logistic Regression | 0.837 ± 0.044 | 76.9% | 54.9% | 88.7% | 0.158 |
| Random Forest | 0.834 ± 0.039 | 75.7% | 55.5% | 86.6% | 0.158 |
| Gradient Boosting | 0.834 ± 0.040 | 75.7% | 57.3% | 85.6% | 0.157 |

Selected hyper-parameters: `{"clf__alpha": 10.0, "clf__hidden_layer_sizes": [32, 16]}`

### Chronic Kidney Disease Risk

Dataset: UCI Chronic Kidney Disease dataset (Apollo Hospitals, India) — 400 patients 
Positive (disease) rate: 62.5%

| Algorithm | ROC-AUC | Accuracy | Sensitivity | Specificity | Brier |
|---|---|---|---|---|---|
| Gradient Boosting | 1.000 ± 0.001 | 98.9% | 99.0% | 98.7% | 0.008 |
| Random Forest | 1.000 ± 0.001 | 98.8% | 99.6% | 97.3% | 0.016 |
| Logistic Regression | 0.999 ± 0.003 | 98.1% | 98.0% | 98.3% | 0.014 |
| Neural Network (MLP) | 0.999 ± 0.002 | 98.1% | 98.2% | 98.0% | 0.015 |
| SVM (RBF) | 0.997 ± 0.004 | 97.4% | 97.2% | 97.7% | 0.047 |

Selected hyper-parameters: `{"clf__C": 3.0}`

### Liver Disease Risk

Dataset: UCI Indian Liver Patient Dataset (ILPD, Andhra Pradesh) — 583 patients 
Positive (disease) rate: 71.4%

| Algorithm | ROC-AUC | Accuracy | Sensitivity | Specificity | Brier |
|---|---|---|---|---|---|
| Neural Network (MLP) | 0.754 ± 0.044 | 71.1% | 92.3% | 18.2% | 0.172 |
| Logistic Regression | 0.750 ± 0.044 | 70.6% | 92.9% | 15.0% | 0.174 |
| Random Forest | 0.745 ± 0.045 | 69.7% | 91.3% | 15.9% | 0.176 |
| Gradient Boosting | 0.726 ± 0.041 | 68.5% | 88.7% | 18.3% | 0.185 |
| SVM (RBF) | 0.682 ± 0.033 | 70.1% | 90.6% | 18.9% | 0.198 |

Selected hyper-parameters: `{"clf__C": 0.1}`

### Coronary Heart Disease Risk

Dataset: UCI Heart Disease — Cleveland Clinic (303 patients); externally checked on Hungarian & VA Long Beach cohorts 
Positive (disease) rate: 45.9%

| Algorithm | ROC-AUC | Accuracy | Sensitivity | Specificity | Brier |
|---|---|---|---|---|---|
| Neural Network (MLP) | 0.868 ± 0.026 | 78.7% | 73.4% | 83.3% | 0.148 |
| Logistic Regression | 0.868 ± 0.025 | 78.9% | 73.8% | 83.2% | 0.149 |
| Gradient Boosting | 0.868 ± 0.024 | 77.1% | 72.7% | 80.8% | 0.150 |
| Random Forest | 0.863 ± 0.019 | 78.1% | 71.6% | 83.6% | 0.153 |
| SVM (RBF) | 0.857 ± 0.031 | 78.4% | 71.6% | 84.2% | 0.163 |

Selected hyper-parameters: `{"clf__C": 0.03}`

### Parkinson's Disease (Voice) Risk

Dataset: UCI Parkinson's voice dataset (Little et al., Oxford) — 195 recordings from 32 people 
Positive (disease) rate: 75.4%

| Algorithm | ROC-AUC | Accuracy | Sensitivity | Specificity | Brier |
|---|---|---|---|---|---|
| Logistic Regression | 0.852 ± 0.107 | 83.3% | 96.0% | 40.8% | 0.142 |
| Random Forest | 0.838 ± 0.106 | 78.1% | 92.3% | 31.7% | 0.150 |
| Neural Network (MLP) | 0.739 ± 0.180 | 76.5% | 89.1% | 34.2% | 0.186 |
| Gradient Boosting | 0.712 ± 0.146 | 73.6% | 87.2% | 30.8% | 0.218 |
| SVM (RBF) | 0.680 ± 0.225 | 79.7% | 97.3% | 24.2% | 0.169 |

Selected hyper-parameters: `{"clf__C": 0.03}`

## Notes

- Probabilities are calibrated (Platt scaling on out-of-fold predictions).
- Each dataset comes from a clinical study population with a high disease rate, so predicted risks are relative to that population, not the general public.
- Explanations use exact Shapley values (SHAP) computed against a reference sample of training patients.
- Educational project — not a medical device and not medical advice.
