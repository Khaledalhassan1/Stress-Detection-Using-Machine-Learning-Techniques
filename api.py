# ==========================
# Stress Detection API (CatBoost)
# ==========================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
from scipy import signal
from scipy.stats import skew, kurtosis
from catboost import CatBoostClassifier


# =========================================================
# Load CatBoost model
# =========================================================
# Loads The Model from your local disk
MODEL_PATH = r"D:\Graduation Project Dataset\archive\WESAD\catboost_wrist_stress_WESAD.cbm"

model = CatBoostClassifier()
model.load_model(MODEL_PATH)


# =========================================================
# FastAPI setup
# =========================================================
app = FastAPI(title="Stress Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Input Schema
# =========================================================
class SensorInput(BaseModel):
    BVP: float
    EDA: float
    TEMP: float
    ACC_x: float
    ACC_y: float
    ACC_z: float


# =========================================================
# Bandpower helper
# =========================================================
def bandpower(arr, fs, low, high):
    freqs, psd = signal.welch(arr, fs=fs, nperseg=len(arr))
    mask = (freqs >= low) & (freqs <= high)
    if not np.any(mask):
        return 0.0
    return float(np.trapezoid(psd[mask], freqs[mask]))


# =========================================================
# Advice Generator
# =========================================================
def generate_advice(features):
    """
    Generates supportive non-medical advice based on physiology.
    """
    hr = features["HR_mean"]
    eda = features["EDA_mean"]
    temp = features["TEMP_mean"]
    acc = features["ACC_mag_mean"]
    hrv = features["HRV_SDNN"]

    advice_messages = []

    # HEART RATE
    if hr > 100:
        advice_messages.append(
            "Your heart rate is elevated. Try taking slow, deep breaths or pausing for a short rest."

        )
    elif hr < 55:
        advice_messages.append(
            "Your heart rate seems low. If you feel sluggish, a brief walk or stretch may help."
        )

    # EDA
    if eda > 5:
        advice_messages.append(
            "Skin conductance is high, which may indicate stress. A quick break or hydration may help."
        )
    elif eda < 0.5:
        advice_messages.append(
            "Your EDA is very low, suggesting a calm state."
        )

    # TEMPERATURE
    if temp > 37.7:
        advice_messages.append(
            "Your temperature is slightly elevated. Cooling down or drinking water may help."
        )
    elif temp < 35.5:
        advice_messages.append(
            "Your temperature is low. Consider warming up or moving gently."
        )

    # MOVEMENT / ACC
    if acc > 120:
        advice_messages.append(
            "Movement level is high, which can reflect physical agitation. Try slowing your pace or sitting comfortably."
        )
    elif acc < 15:
        advice_messages.append(
            "Very low movement detected. If you're tense or sitting still for long, consider stretching."
        )

    # HRV
    if hrv < 0.03:
        advice_messages.append(
            "Your HRV is low, which may reflect reduced stress tolerance. A short relaxation exercise could help."
        )

    if not advice_messages:
        advice_messages.append("Everything looks stable. Keep up the good balance!")

    return " ".join(advice_messages)


# =========================================================
# Feature Extraction
# =========================================================
def extract_features_window(signals):

    row = {}

    # ---------- EDA ----------
    eda = signals["EDA"]
    row["EDA_mean"] = float(np.mean(eda))
    row["EDA_std"] = float(np.std(eda))
    row["EDA_min"] = float(np.min(eda))
    row["EDA_max"] = float(np.max(eda))
    row["EDA_median"] = float(np.median(eda))
    row["EDA_skew"] = float(skew(eda))
    row["EDA_kurt"] = float(kurtosis(eda))

    eda_diff = np.diff(eda)
    row["EDA_diff_mean"] = float(np.mean(eda_diff))
    row["EDA_diff_std"] = float(np.std(eda_diff))

    peaks, _ = signal.find_peaks(eda, distance=16)
    row["EDA_peak_count"] = len(peaks)
    row["EDA_peak_mean_amp"] = float(np.mean(eda[peaks])) if len(peaks) else 0.0

    row["EDA_LF"] = bandpower(eda, 32, 0.01, 0.1)
    row["EDA_HF"] = bandpower(eda, 32, 0.1, 0.25)
    row["EDA_LFHF"] = row["EDA_LF"] / row["EDA_HF"] if row["EDA_HF"] else 0.0

    # ---------- TEMP ----------
    temp = signals["TEMP"]
    row["TEMP_mean"] = float(np.mean(temp))
    row["TEMP_std"] = float(np.std(temp))
    row["TEMP_min"] = float(np.min(temp))
    row["TEMP_max"] = float(np.max(temp))
    row["TEMP_median"] = float(np.median(temp))
    row["TEMP_skew"] = float(skew(temp))
    row["TEMP_kurt"] = float(kurtosis(temp))
    row["TEMP_slope"] = float(temp[-1] - temp[0]) / len(temp)

    # ---------- ACC ----------
    ax, ay, az = signals["ACC_x"], signals["ACC_y"], signals["ACC_z"]
    mag = np.sqrt(ax**2 + ay**2 + az**2)

    row["ACC_mag_mean"] = float(np.mean(mag))
    row["ACC_mag_std"] = float(np.std(mag))
    row["ACC_mag_min"] = float(np.min(mag))
    row["ACC_mag_max"] = float(np.max(mag))
    row["ACC_mag_median"] = float(np.median(mag))
    row["ACC_mag_skew"] = float(skew(mag))
    row["ACC_mag_kurt"] = float(kurtosis(mag))
    row["ACC_energy"] = float(np.sum(mag**2) / len(mag))

    # ---------- BVP ----------
    bvp = signals["BVP"]
    row["BVP_mean"] = float(np.mean(bvp))
    row["BVP_std"] = float(np.std(bvp))
    row["BVP_min"] = float(np.min(bvp))
    row["BVP_max"] = float(np.max(bvp))
    row["BVP_median"] = float(np.median(bvp))
    row["BVP_skew"] = float(skew(bvp))
    row["BVP_kurt"] = float(kurtosis(bvp))

    # ---------- HRV ----------
    peaks, _ = signal.find_peaks(bvp, distance=20)
    if len(peaks) > 1:
        ibi = np.diff(peaks) / 64.0
        rr_diff = np.diff(ibi)

        row["HR_mean"] = float(60.0 / np.mean(ibi))
        row["HRV_SDNN"] = float(np.std(ibi))
        row["HRV_RMSSD"] = float(np.sqrt(np.mean(rr_diff**2))) if len(rr_diff) else 0.0
        row["HRV_pNN50"] = float(np.sum(np.abs(rr_diff) > 0.05)) / len(rr_diff) if len(rr_diff) else 0.0

        try:
            times = np.cumsum(ibi)
            interp_times = np.linspace(times[0], times[-1], len(times))
            ibi_interp = np.interp(interp_times, times, ibi)

            row["HRV_LF"] = bandpower(ibi_interp, 4, 0.04, 0.15)
            row["HRV_HF"] = bandpower(ibi_interp, 4, 0.15, 0.40)
            row["HRV_LFHF"] = row["HRV_LF"] / row["HRV_HF"] if row["HRV_HF"] else 0.0
        except:
            row["HRV_LF"] = row["HRV_HF"] = row["HRV_LFHF"] = 0.0
    else:
        for k in ["HR_mean","HRV_SDNN","HRV_RMSSD","HRV_pNN50","HRV_LF","HRV_HF","HRV_LFHF"]:
            row[k] = 0.0

    return row


# =========================================================
# Prediction Endpoint
# =========================================================
@app.post("/predict")
def predict_stress(input: SensorInput):

    try:
        # 1️⃣ Physiological override (avoid false stress)
        if (
            36.0 <= input.TEMP <= 37.5 and
            input.EDA <= 3.0 and
            abs(input.ACC_x) < 50 and
            abs(input.ACC_y) < 50 and
            abs(input.ACC_z) < 50
        ):
            return {
                "prediction": "NOT STRESSED",
                "probability": 0.0,
                "advice": "Your vital signs appear normal. Everything looks stable."
            }

        # 2️⃣ Build synthetic 6-second window
        signals = {
            "BVP": input.BVP + 0.01 * np.random.randn(384),
            "EDA": input.EDA + 0.02 * np.random.randn(192),
            "TEMP": input.TEMP + 0.005 * np.random.randn(192),
            "ACC_x": input.ACC_x + 2 * np.random.randn(192),
            "ACC_y": input.ACC_y + 2 * np.random.randn(192),
            "ACC_z": input.ACC_z + 2 * np.random.randn(192),
        }

        # 3️⃣ Extract features
        features = extract_features_window(signals)

        df = pd.DataFrame([features]).fillna(0)
        df.insert(0, "index", 0)

        # 4️⃣ Correct feature order from the Training
        order = [
            'index',
            'EDA_mean', 'EDA_std', 'EDA_min', 'EDA_max', 'EDA_median', 'EDA_skew', 'EDA_kurt',
            'EDA_diff_mean', 'EDA_diff_std',
            'EDA_peak_count', 'EDA_peak_mean_amp',
            'EDA_LF', 'EDA_HF', 'EDA_LFHF',

            'TEMP_mean', 'TEMP_std', 'TEMP_min', 'TEMP_max', 'TEMP_median',
            'TEMP_skew', 'TEMP_kurt', 'TEMP_slope',

            'ACC_mag_mean', 'ACC_mag_std', 'ACC_mag_min', 'ACC_mag_max',
            'ACC_mag_median', 'ACC_mag_skew', 'ACC_mag_kurt', 'ACC_energy',

            'BVP_mean', 'BVP_std', 'BVP_min', 'BVP_max', 'BVP_median',
            'BVP_skew', 'BVP_kurt',

            'HR_mean', 'HRV_SDNN', 'HRV_RMSSD', 'HRV_pNN50',
            'HRV_LF', 'HRV_HF', 'HRV_LFHF'
        ]

        df = df[order]

        # 5️⃣ Predict
        proba = model.predict_proba(df)[0][1]
        # Its now 70% you can easily change it at anytime
        THRESH = 0.70

        status = "STRESSED" if proba >= THRESH else "NOT STRESSED"

        # 6️⃣ Advice Generation
        advice = generate_advice(features)

        return {
            "prediction": status,
            "probability": float(proba),
            "advice": advice
        }

    except Exception as e:
        return {"error": str(e)}
