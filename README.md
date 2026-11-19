# MediTrack — Final Capstone

A healthcare portal with **Doctor**, **Patient** and **Pharmacist** dashboards, five **machine-learning disease-risk models trained on real clinical datasets** (with SHAP explanations), and a multi-select symptom checker.

| Layer | Technology | Folder | Port |
|---|---|---|---|
| **M**ongoDB | Database (Mongoose ODM) | — | 27017 |
| **E**xpress + **N**ode.js | REST API, login (JWT), business rules | `backend/` | 5000 |
| **R**eact (Vite) | User interface — HTML / CSS / JavaScript (JSX) | `frontend/` | 5173 |
| **Python** (Flask + scikit-learn) | 5 trained disease-risk models + SHAP, symptom checker | `ai-service/` | 8000 |

```
 Browser (React, :5173)
 │ /api/... (Vite forwards /api to the backend in development)
 ▼
 Express API (:5000) ──── Mongoose ────► MongoDB (:27017, database "final_capstone_db")
 │
 └── /api/ai/... ───── HTTP ───────► Python Flask AI service (:8000)
```

The browser only talks to Express. Express talks to MongoDB and forwards AI requests to Python.

---

## 1. Install the required software (one time)

| Software | Version | Download | Notes |
|---|---|---|---|
| Node.js | 18 LTS or newer | https://nodejs.org | Includes `npm` |
| Python | 3.10 – 3.13 recommended (3.8+ works) | https://www.python.org/downloads/ | **Windows: tick "Add python.exe to PATH"** in the installer |
| MongoDB Community Server | 6, 7 or 8 | https://www.mongodb.com/try/download/community | **Windows: keep "Install MongoD as a Service" ticked.** MongoDB Compass (optional) lets you browse the data |

Check in a new terminal (Command Prompt / PowerShell / Terminal):

```
node -v
npm -v
python --version (macOS/Linux: python3 --version)
```

---

## 2. Set up the project (one time)

1. Open the extracted `Final_Capstone` folder in VS Code.
2. **Windows:** double-click **`setup.bat`**.
 **Any OS (terminal in the project folder):**
 ```
 npm run setup
 ```
 This installs the root, backend and frontend packages, creates a Python virtual environment in `ai-service/.venv`, installs Flask + scikit-learn into it, and **trains the five disease models** on the bundled datasets (takes a few seconds).
3. (Optional) Copy `backend/.env.example` to `backend/.env` to change settings. `setup.bat` does this for you; the defaults work without it.

---

## 3. Run the app

1. **Make sure MongoDB is running.**
 - Windows: it starts automatically if installed as a service. If not, open Command Prompt **as Administrator** → `net start MongoDB`
 - macOS: `brew services start mongodb-community`
 - Linux: `sudo systemctl start mongod`
2. **Start everything with one command:**
 - Windows: double-click **`start.bat`**
 - Any OS: `npm run dev`

 This starts the backend (5000), the React app (5173) and the Python AI service (8000) together. Keep the window open; press `Ctrl + C` to stop.
3. Open the Vite URL printed in the frontend terminal (normally **http://localhost:5173**; if that port is busy, Vite may choose **5174**).

The database starts without demo accounts or default person IDs. Register a Doctor, Patient and Pharmacist account from the sign-up page. A starter catalogue of common Indian household medicines is added without creating any person records; the pharmacist should verify batch, expiry and MRP before selling.

### First-time use

1. Register a Doctor account.
2. Register a Patient account and book an appointment with the doctor.
3. The doctor accepts the appointment; the patient can then send daily health updates and the doctor can prescribe for that patient.
4. Register a Pharmacist account and add medicine batches with price in INR, quantity and expiry date.
5. Patients can browse available stock, place orders and receive itemized bills in Indian rupees.


---

## 4. Features

**Doctor** — sets how they consult (**Online**, **In-person** or **both**) and the **clinic address** (+ optional Google Maps link) at registration or in the profile; accept / reject / reschedule / cancel appointments — accepting an online visit asks for the **video-call link** (pre-filled from the profile); prescribe only medicines that are in stock, edit issued prescriptions, review patients' daily vitals and send advice, edit profile.

**Patient** — book / reschedule / cancel appointments (no past dates) choosing **Online (video call)** or **In-person (offline)**; for in-person visits the doctor's **clinic location** is shown with a Google Maps link, for online visits the **Join video call** link appears once the doctor accepts; order prescribed medicines in one click or browse the pharmacy, checkout with an itemized printable bill (5% tax), five trained disease-risk models (diabetes, kidney, liver, heart, Parkinson's) with model SHAP explanations and accuracy shown on screen, a multi-select symptom checker with exact Shapley contributions for its knowledge-based match score, send daily vitals to a doctor, edit medical profile.

**Pharmacist** — inventory with search and filters, add / edit / delete stock, +50 quick restock, low-stock alerts, automatic daily expiry removal, sales history with invoices, revenue total, edit profile.

**Everywhere** — the **MediTrack Assistant** chatbot ( button, bottom-right of every dashboard) answers from your live data: next appointment with its place or video link, prescriptions, bills, medicine price/stock, pending requests and logs (doctor), low-stock / expired / sales (pharmacist). Patients can type how they feel ("I have fever and cough") for a quick symptom match. Emergency words get an "call 112 / 911 now" answer first. It is rule-based — no API key, works offline from the internet.

All displayed medicine prices and bills use Indian rupees (₹). Expired batches are removed automatically at startup and hourly while the backend is running.

A banner at the top tells you immediately if the backend, MongoDB or the AI service is not running.

---

## 5. Project structure

```
Final_Capstone/
├─ package.json root scripts: setup, dev, start, build, check
├─ setup.bat / start.bat Windows one-click setup and start
├─ scripts/
│ ├─ python.js installs / runs the Python service on any OS
│ └─ check.js "npm run check" - environment diagnostics
├─ backend/ Node.js + Express + Mongoose
│ ├─ server.js app entry (also serves the built React app)
│ ├─ .env.example settings template
│ ├─ config/ env settings + MongoDB connection
│ ├─ models/ User, Appointment, Medicine, Prescription, Order, HealthLog
│ ├─ routes/ auth, appointments, medicines, prescriptions, orders, healthLogs, ai, chat, health
│ ├─ middleware/ JWT auth + role checks, JSON error handler
│ └─ seed/medicineCatalog.js Indian household medicine starter stock (no demo users)
├─ frontend/ React 18 + Vite
│ ├─ index.html
│ ├─ vite.config.js dev server + /api proxy to :5000
│ └─ src/
│ ├─ api/client.js all API calls, login token, connection status
│ ├─ context/ AuthContext (login session), ToastContext (messages)
│ ├─ components/ DashboardLayout, ChatBot, Modal, InvoiceModal, ShapBars, ProfileTab, ConnectionBanner
│ ├─ pages/ Splash, AuthPage, doctor/, patient/, pharmacist/
│ ├─ styles/style.css dark green & black theme
│ └─ constants.js symptoms, disease-model form fields, dropdown lists
└─ ai-service/ Python + Flask + scikit-learn
 ├─ app.py HTTP endpoints
 ├─ disease_config.py features, units, normal ranges and form defaults of each model
 ├─ train_models.py trains / compares algorithms, writes models/ and the report
 ├─ models.py loads trained models, predictions + exact SHAP values
 ├─ ml_utils.py shared scoring helpers
 ├─ symptom_checker.py knowledge-based symptom matching
 ├─ legacy_rules.py the ORIGINAL hand-written rules (kept only for comparison)
 ├─ model_selection.json the chosen algorithm + settings per disease
 ├─ data/ the 5 public datasets (+ SOURCES.md with citations)
 ├─ models/ trained models (*.joblib, created by setup) + MODEL_REPORT.md + DNN_COMPARISON.md
 ├─ test_models.py self-tests ("npm run test:ai")
 └─ requirements.txt
```

---

## 6. Useful commands (run in the project folder)

| Command | What it does |
|---|---|
| `npm run setup` | Install everything (Node packages + Python venv) |
| `npm run dev` | Start backend + React + AI together (development) |
| `npm run check` | Diagnose Node, Python, packages, MongoDB, backend and AI service |
| `npm run test:ai` | Run the Python model tests |
| `npm run train:ai` | Re-fit the selected models (seconds) |
| `npm run evaluate:ai` | Re-run the full comparison of all algorithms and rewrite `ai-service/models/MODEL_REPORT.md` (several minutes) |
| `npm run api` / `npm run web` / `npm run ai` | Start one service only (each in its own terminal) |
| `npm run build` then `npm start` | Production mode: one URL, **http://localhost:5000** (Express serves the built React app) |

---

## 7. Configuration — `backend/.env`

| Setting | Default | Meaning |
|---|---|---|
| `PORT` | `5000` | Express API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/final_capstone_db` | Database. For MongoDB Atlas paste your `mongodb+srv://...` string |
| `JWT_SECRET` | dev value | **Change to any long random text** — signs login tokens |
| `JWT_EXPIRES_IN` | `7d` | How long a login lasts |
| `AI_SERVICE_URL` | `http://127.0.0.1:8000` | Python service address |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed browser origin (any localhost port is allowed anyway) |

The AI service port can be changed with the `AI_PORT` environment variable (then update `AI_SERVICE_URL`).
If the backend runs on another machine, start the React app with `VITE_BACKEND_URL=http://HOST:5000 npm run web`.

---

## 8. Troubleshooting

Run **`npm run check`** first — it tells you which piece is missing.

| What you see | Cause | Fix |
|---|---|---|
| Red banner **"Backend not connected"** | Express is not running | Run `npm run dev` (or `start.bat`) and keep the window open |
| Red banner **"MongoDB not connected"** / backend log `COULD NOT CONNECT TO MONGODB` | MongoDB not running | Start MongoDB (section 3). The backend retries every 5 s — no restart needed |
| Yellow banner **"AI service offline"** | Python service not running or not installed | `npm run setup`, then `npm run dev` (or `npm run ai` alone) |
| `Python 3.8+ was not found` | Python missing or not on PATH | Reinstall Python with "Add python.exe to PATH" ticked, open a **new** terminal, `npm run setup` |
| scikit-learn / numpy fails to install | Very new or very old Python | Use Python 3.10–3.13 (64-bit), then `npm run setup` again |
| AI service log says "re-fitting" | scikit-learn version changed | Normal — it retrains automatically in a few seconds |
| `'npm' is not recognized` | Node.js missing / terminal opened before install | Install Node.js, then open a new terminal |
| `Port 5000 is already in use` | Another program uses 5000 (on macOS often AirPlay Receiver) | Set `PORT=5001` in `backend/.env` **and** start React with `VITE_BACKEND_URL=http://localhost:5001` |
| `net start MongoDB` → "Access is denied" | Needs admin rights | Open Command Prompt **as Administrator** |
| Login: *Invalid password* / *Role mismatch* | Wrong credentials or role | Use the demo table; choose the matching role |
| *Session expired* | Login token expired or `JWT_SECRET` changed | Sign in again |
| Blank page after editing code | Old cache | Hard refresh `Ctrl + F5` |

---

## 9. REST API (all under `/api`)

All routes except `health`, `auth/login` and `auth/register` need `Authorization: Bearer <token>` (the React app adds it automatically). Errors always come back as `{"error": "message"}`.

| Area | Endpoints | Who |
|---|---|---|
| Health | `GET /health` → `{status, database, aiService}` | public |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/profile/:id`, `GET /auth/doctors`, `GET /auth/patients` | profile: self; patients: doctor |
| Appointments | `POST /appointments` (body: `doctorId, appointmentDate, appointmentTime, mode: ONLINE\|OFFLINE, reason, symptoms`), `GET /appointments/doctor/:id`, `GET /appointments/patient/:id`, `PUT /appointments/:id/status` (body: `status, notes, meetingLink`), `PUT /appointments/:id/cancel` | patient books/cancels, doctor decides |
| Chatbot | `POST /chat` (body: `{message}`) → `{reply, actions, chips, kind}` | signed-in users (answers use only their own data) |
| Medicines | `GET /medicines`, `GET /medicines/available`, `GET /medicines/low-stock-alerts`, `POST /medicines`, `PUT /medicines/:id`, `DELETE /medicines/:id`, `POST /medicines/remove-expired` | changes: pharmacist |
| Prescriptions | `POST /prescriptions`, `PUT /prescriptions/:id`, `GET /prescriptions/doctor/:id`, `GET /prescriptions/patient/:id` | doctor writes |
| Orders | `POST /orders`, `GET /orders/patient/:id`, `GET /orders/sales-history` | patient orders; sales: pharmacist |
| Health logs | `POST /health-logs`, `GET /health-logs/patient/:id`, `GET /health-logs/doctor/:id`, `PUT /health-logs/:id/feedback` | patient sends, doctor reviews |
| AI (→ Python) | `GET /ai/models`, `GET /ai/symptoms`, `POST /ai/symptom-check`, `POST /ai/predict-disease` | signed-in users |

Python service (called by Express): `GET /health`, `GET /models`, `GET /symptoms`, `POST /symptom-check`, `POST /predict-disease`.

---

## 10. What changed from the Spring Boot version

- Backend rewritten in **Node.js + Express + Mongoose**; frontend rewritten in **React**; AI moved to a **Python Flask** service. All original features and the dark-green design are kept.
- The AI "DNN" models were hand-written formulas that had never seen data. They are replaced by **models trained on real clinical datasets** (section 11).
- **Passwords are hashed** (bcrypt) and never sent to the browser; login uses **JWT tokens**; every route checks the user's role and ownership (e.g. a patient can only see their own orders).
- **Orders are safe:** prices come from the inventory (not the browser), stock is checked first and deducted atomically, and a failed line rolls the whole order back.
- **No fake offline data:** the old app silently switched to browser storage when the backend failed. Now every failure is shown, with a status banner.
- The backend keeps running and reconnects when MongoDB starts later.

---

## 11. AI models

The original project's "DNN models" were hand-written formulas that had never been trained on data. They are now **real machine-learning models trained on public clinical datasets**. For every disease, five algorithms were compared (Logistic Regression, Random Forest, Gradient Boosting, SVM and a Neural Network/MLP), and the best one was kept.

| Disease | Best model | ROC-AUC (cross-validated) | Accuracy | Old hand-written rules (ROC-AUC) | Training data |
|---|---|---|---|---|---|
| Diabetes | Neural Network (MLP 32-16) | **0.845** ± 0.041 | 76.4% | 0.793 | Pima Indians Diabetes, 768 people |
| Kidney (CKD) | Logistic Regression | **0.999** ± 0.003 | 98.1% | 0.899 | UCI Chronic Kidney Disease, 400 patients |
| Liver | Logistic Regression | **0.750** ± 0.044 | 70.6% | 0.718 | Indian Liver Patient Dataset, 583 patients |
| Heart | Logistic Regression | **0.868** ± 0.025 | 78.9% | 0.671 | UCI Heart Disease, Cleveland, 303 patients |
| Parkinson's (voice) | Logistic Regression | **0.852** ± 0.107 | 83.3% | 0.749 | UCI Parkinson's, 195 recordings / 32 people |

ROC-AUC measures how well a model ranks sick above healthy people: 1.0 = perfect, 0.5 = coin toss. The full leaderboards (all five algorithms, sensitivity, specificity, Brier score and chosen settings) are in **`ai-service/models/MODEL_REPORT.md`**.

**How the models were built and checked**
- **Nested cross-validation** (outer 5 folds × 2 repeats, hyper-parameters tuned only inside training folds), so the scores above are honest estimates on unseen patients.
- **Parkinson's is split by person**: one person's recordings never appear in both training and test folds. The often-quoted "95%+" results for this dataset come from skipping this step.
- **Heart external check**: the heart model, trained only on Cleveland, scored ROC-AUC **0.862** on 494 patients from two other hospitals (Hungary and VA Long Beach).
- **Ties go to the simpler model.** When algorithms score within 0.005 AUC of each other, the more interpretable one wins. For heart, logistic regression, gradient boosting and the neural network all scored 0.868. The neural network won clearly only for diabetes. On small tables of lab values, simpler models are usually as good as deep networks.
- Very skewed lab values (bilirubin, liver enzymes, creatinine, urea, insulin, voice jitter) are log-transformed. Missing optional values are filled with the training median.
- Probabilities are calibrated, and the app never shows less than 1% or more than 99%.
- **Real SHAP values**: each result shows exact Shapley values, i.e. how many percentage points each input moved the risk compared with a typical training patient. They add up exactly to the prediction.
- **Diabetes + HbA1c**: the Pima data has no HbA1c, so HbA1c (optional) and the 2-hour glucose are also checked against the official **ADA diagnostic thresholds**. HbA1c ≥ 6.5% or glucose ≥ 200 mg/dL is flagged and raises the result to HIGH RISK.
- A widely shared 100,000-row "diabetes prediction" dataset was examined and **rejected**: its labels follow fixed cut-offs exactly, so it is synthetic.

**What changed medically vs the old rules** (examples): the old heart rules treated "asymptomatic" chest pain as safest, but in the real data it carries the *highest* risk. The old liver and kidney rules ignored how skewed lab values are.

**Limits — read before presenting results**
- Each dataset comes from hospital patients with a high disease rate (liver 71%, Parkinson's 75%, kidney 62%), so risks are relative to those patients, not the general public. For example, normal liver tests still show about 40%. The app shows the "typical patient" risk next to every result.
- The kidney dataset is almost perfectly separable, so real-world accuracy will be lower than 0.999.
- The liver and Parkinson's models flag most people at a 50% cut-off (high sensitivity, low specificity) because most of their training patients were ill.
- **Symptom checker**: no public dataset links these 18 symptoms to these 5 diseases, so it stays knowledge-based. It now gives a "match score" (not a fake probability), says when symptoms don't match any of the 5 conditions, and links to the matching trained model.

**Retraining**
- `npm run train:ai` — re-fit the selected models (seconds). Setup runs this automatically, and the AI service also re-fits automatically if model files are missing or scikit-learn was updated.
- `npm run evaluate:ai` — re-run the whole comparison (about 15–20 minutes on 2 CPU cores) and rewrite `model_selection.json` + `MODEL_REPORT.md`.
- Dataset citations and licences: `ai-service/data/SOURCES.md` (UCI datasets are CC BY 4.0, so keep the credits if you publish).

### 11b. The uploaded DNN models (DNN.zip) — are they better?

**No — the MediTrack models are kept.** Your zip's notebooks report 98.5% (heart), 98.8% (kidney), 89.7% (Parkinson's), 76.6% (diabetes) and 72.6% (liver). Those numbers are real for that one 80/20 split, but two of them are inflated by data leaks, and when both model types are tested the same honest way, ours win or tie on every disease.

| Disease | Zip's reported accuracy (its own split) | Uploaded DNN, honest test, zip's features (AUC) | MediTrack algorithm, same folds & features (AUC) | Uploaded DNN on MediTrack data (AUC) | **MediTrack model in the app (AUC)** |
|---|---|---|---|---|---|
| Diabetes | 76.6% | 0.821 | 0.842 | 0.834 | **0.845** |
| Kidney | 98.8% | 1.000 | 1.000 | 0.999 | **0.999** |
| Liver | 72.6% | 0.684 | 0.743 | 0.696 | **0.750** |
| Heart | 98.5% | 0.891 | 0.909 | 0.863 | **0.868** |
| Parkinson's | 89.7% | 0.813 | 0.838 | 0.713 | **0.852** |

*Honest test* = 5-fold cross-validation × 2 repeats, the same CustomDNN architecture and training settings as the notebooks (Adam 0.001, batch 16, up to 100 epochs, early stopping), duplicates removed, Parkinson's split by person.

Why the zip's heart and Parkinson's numbers are too high:
- **Heart:** `heart.csv` has 1,025 rows but only **302 different patients** — each is copied ~3 times. In the zip's test set, **202 of 205** test rows are exact copies of training rows, so the model is mostly recognising patients it has already seen.
- **Heart labels are reversed** in that Kaggle file compared with the original UCI study: `target = 1` rows are the patients **without** heart disease (and chest-pain type is coded 0–3 instead of 1–4). Unless the app flips it, the uploaded heart model's output is the chance of being *healthy*.
- **Parkinson's:** 195 recordings come from only 32 people (6–7 each). A random split puts **all 24 test people** in training too, so the model recognises voices instead of detecting disease. Split by person, it drops to 0.81.
- **Liver:** at the 0.5 cut-off it labels almost everyone as ill (≈15% specificity).

The zip's heart set also uses two extra hospital tests (`ca` = blocked vessels seen on angiography, `thal` = thallium scan). They raise AUC to ~0.91, but `ca` comes from the same angiogram that defines "heart disease" in this study, patients rarely have either value, and the other hospitals' data used for our external check doesn't have them — so MediTrack keeps the 11 routinely available inputs. Full details: `ai-service/models/DNN_COMPARISON.md`.

## 12. Notes

- Educational project — the models are screening demonstrations, **not medical advice** and not a medical device.
- Money is shown in Indian rupees (₹) in the application.
- Before any real deployment: set a strong `JWT_SECRET`, use HTTPS, run Flask behind a production server (e.g. waitress/gunicorn) and restrict `CLIENT_ORIGIN`.