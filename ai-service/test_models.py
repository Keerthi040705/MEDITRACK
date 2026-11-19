"""Self-tests for the AI service:  python test_models.py"""
import json
import os
import unittest

import numpy as np

from app import app
from disease_config import DISEASES
from models import check_symptoms, get_model, predict_disease, shapley_values
from ml_utils import calibrated_probability

HERE = os.path.dirname(os.path.abspath(__file__))


class TrainedModelTests(unittest.TestCase):
    def test_every_model_loads_and_beats_chance(self):
        with open(os.path.join(HERE, "model_selection.json"), encoding="utf-8") as f:
            selection = json.load(f)
        for key in DISEASES:
            art = get_model(key)
            self.assertEqual(art["algorithm"], selection[key]["algorithm"])
            self.assertGreater(selection[key]["cv"]["roc_auc"], 0.65, key)

    def test_shap_values_add_up_to_the_prediction(self):
        for key in DISEASES:
            art = get_model(key)
            x = art["background"][0].copy()
            phi, base = shapley_values(art, x)
            prob = float(calibrated_probability(art, x.reshape(1, -1))[0])
            self.assertAlmostEqual(base + phi.sum(), prob, places=6, msg=key)

    def test_defaults_predict_for_every_disease(self):
        for key, cfg in DISEASES.items():
            feats = {f["key"]: f["default"] for f in cfg["features"]}
            res = predict_disease(key, feats)
            self.assertTrue(0 <= res["riskProbability"] <= 100)
            self.assertEqual(len(res["shapValues"]), len(cfg["features"]))
            self.assertIn("rocAuc", res["model"])

    def test_clinically_sensible_directions(self):
        # Diabetes: much higher glucose must raise risk
        base = {"glucose": 100, "bmi": 25, "age": 35, "pregnancies": 1}
        low = predict_disease("diabetes", base)["riskProbability"]
        high = predict_disease("diabetes", {**base, "glucose": 190})["riskProbability"]
        self.assertGreater(high, low)
        # Heart: asymptomatic chest pain + exercise angina + ST depression is higher risk than none of these
        h = {f["key"]: f["default"] for f in DISEASES["heart"]["features"]}
        risky = predict_disease("heart", {**h, "chest_pain_type": 4, "exercise_angina": 1, "st_depression": 2.5})["riskProbability"]
        calm = predict_disease("heart", {**h, "chest_pain_type": 3, "exercise_angina": 0, "st_depression": 0, "st_slope": 0})["riskProbability"]
        self.assertGreater(risky, calm)
        # Kidney: normal labs -> low risk
        k = {"serum_creatinine": 0.9, "hemoglobin": 15, "specific_gravity": 1.020, "albumin": 0, "blood_urea": 30,
             "blood_pressure": 70, "age": 40, "hypertension": 0, "diabetes": 0}
        self.assertLess(predict_disease("kidney", k)["riskProbability"], 30)

    def test_optional_fields_may_be_blank(self):
        res = predict_disease("diabetes", {"glucose": 150, "bmi": 30, "age": 50, "pregnancies": 2, "insulin": None, "pedigree": ""})
        self.assertIn("riskProbability", res)

    def test_hba1c_guideline_escalates(self):
        res = predict_disease("diabetes", {"glucose": 110, "bmi": 24, "age": 30, "pregnancies": 0, "hba1c": 7.1})
        self.assertEqual(res["riskLevel"], "HIGH RISK")
        self.assertTrue(any(f["level"] == "danger" for f in res["guidelineFlags"]))

    def test_bad_input(self):
        with self.assertRaises(ValueError):
            predict_disease("unknown", {})
        with self.assertRaises(ValueError):
            predict_disease("kidney", {"serum_creatinine": "abc"})
        with self.assertRaises(ValueError):
            predict_disease("diabetes", {"bmi": 30, "age": 50, "pregnancies": 1})  # glucose missing
        with self.assertRaises(ValueError):
            predict_disease("diabetes", {"glucose": 9999, "bmi": 30, "age": 50, "pregnancies": 1})  # implausible


class SymptomTests(unittest.TestCase):
    def test_parkinsons_symptoms(self):
        res = check_symptoms(["tremors", "muscle_rigidity", "slow_movement"])
        self.assertEqual(res["primaryDiagnosis"], "Parkinson's Disease")
        self.assertEqual(res["predictions"][0]["suggestedModel"], "parkinsons")

    def test_unrelated_symptoms_give_no_match(self):
        res = check_symptoms(["fever", "joint_pain"])
        self.assertEqual(res["predictions"], [])
        self.assertIn("message", res)


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_and_models(self):
        self.assertEqual(self.client.get("/health").get_json()["status"], "UP")
        models = self.client.get("/models").get_json()
        self.assertEqual({m["key"] for m in models}, set(DISEASES))

    def test_predict_endpoint_validation(self):
        r = self.client.post("/predict-disease", json={"diseaseType": "kidney", "features": {"serum_creatinine": "x"}})
        self.assertEqual(r.status_code, 400)


if __name__ == "__main__":
    np.seterr(all="ignore")
    unittest.main(verbosity=2)
