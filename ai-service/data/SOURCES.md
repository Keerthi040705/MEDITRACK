# Training datasets

All files in this folder are small public clinical research datasets, cleaned to consistent column names.
`target` = 1 means the disease is present. Empty cells are values that were not recorded in the original
study (the models fill them with the training median).

| File | Rows | Original dataset | Licence |
|---|---|---|---|
| `diabetes.csv` | 768 | **Pima Indians Diabetes Database** — Smith, J.W. et al. (1988), "Using the ADAP learning algorithm to forecast the onset of diabetes mellitus", *Proc. Symposium on Computer Applications in Medical Care*, 261–265. National Institute of Diabetes and Digestive and Kidney Diseases; distributed via the UCI repository / PMLB. Zeros in glucose, blood pressure, insulin and BMI were "not measured" and are stored as empty. | Public domain / CC0 (Kaggle) |
| `kidney.csv` | 400 | **Chronic Kidney Disease** — Rubini, L., Soundarapandian, P. & Eswaran, P. (2015). UCI Machine Learning Repository, https://doi.org/10.24432/C5G020 | CC BY 4.0 |
| `liver.csv` | 583 | **ILPD (Indian Liver Patient Dataset)** — Ramana, B. & Venkateswarlu, N. (2012). UCI Machine Learning Repository, https://doi.org/10.24432/C5D02C | CC BY 4.0 |
| `heart.csv` | 303 | **Heart Disease — Cleveland Clinic Foundation** — Janosi, A., Steinbrunn, W., Pfisterer, M. & Detrano, R. (1988). UCI Machine Learning Repository, https://doi.org/10.24432/C52P4X (via PMLB) | CC BY 4.0 |
| `heart_external.csv` | 494 | Same UCI Heart Disease study — **Hungarian Institute of Cardiology** and **VA Medical Center, Long Beach** cohorts. Used only to test the heart model on hospitals it never saw. | CC BY 4.0 |
| `parkinsons.csv` | 195 | **Parkinson's** — Little, M. et al. (2007), "Exploiting Nonlinear Recurrence and Fractal Scaling Properties for Voice Disorder Detection", *BioMedical Engineering OnLine* 6:23. UCI Machine Learning Repository, https://doi.org/10.24432/C59C74. 195 voice recordings from 32 people; `subject` identifies the person. | CC BY 4.0 |

Chest pain coding in the heart files follows the UCI study: 1 typical angina, 2 atypical angina,
3 non-anginal pain, 4 asymptomatic. ST slope: 0 upsloping, 1 flat, 2 downsloping.
