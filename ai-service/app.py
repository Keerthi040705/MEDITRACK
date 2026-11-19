"""
MediTrack AI Service (Python + Flask)

    GET  /health            -> {"status": "UP", "models": [...]}
    GET  /symptoms          -> symptom checklist
    POST /symptom-check     -> {"symptoms": ["fever", "fatigue", ...]}
    GET  /models            -> form fields + accuracy "model card" for each trained disease model
    POST /predict-disease   -> {"diseaseType": "diabetes|kidney|liver|heart|parkinsons", "features": {...}}

Called by the Node/Express backend (not directly by the browser).
Run:  python app.py      (http://127.0.0.1:8000; set AI_PORT to change)
"""
import os

from flask import Flask, jsonify, request

from models import SYMPTOMS, check_symptoms, list_models, load_all, loaded_models, predict_disease

app = Flask(__name__)
app.json.sort_keys = False
app.json.ensure_ascii = False


@app.get("/health")
def health():
    return jsonify(status="UP", service="meditrack-ai", models=loaded_models())


@app.get("/symptoms")
def symptoms():
    return jsonify(SYMPTOMS)


@app.post("/symptom-check")
def symptom_check():
    body = request.get_json(silent=True) or {}
    symptoms_in = body.get("symptoms", [])
    if not isinstance(symptoms_in, list):
        return jsonify(error="'symptoms' must be a list of symptom ids"), 400
    return jsonify(check_symptoms(symptoms_in))


@app.get("/models")
def models():
    return jsonify(list_models())


@app.post("/predict-disease")
def predict():
    body = request.get_json(silent=True) or {}
    try:
        return jsonify(predict_disease(body.get("diseaseType"), body.get("features", {})))
    except ValueError as e:
        return jsonify(error=str(e)), 400


@app.errorhandler(404)
def not_found(_e):
    return jsonify(error="Not found"), 404


@app.errorhandler(500)
def server_error(_e):
    return jsonify(error="AI service internal error"), 500


if __name__ == "__main__":
    port = int(os.environ.get("AI_PORT", "8000"))
    host = os.environ.get("AI_HOST", "127.0.0.1")
    print("[AI ] Loading trained models ...", flush=True)
    print(f"[AI ] Models ready: {', '.join(load_all())}", flush=True)
    print(f"[AI ] MediTrack AI service on http://{host}:{port}", flush=True)
    app.run(host=host, port=port, debug=False)
