import os
import glob
import pickle
import numpy as np
import pandas as pd
from scipy import signal
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import warnings
from scipy.integrate import trapezoid


from catboost import CatBoostClassifier

# ----------------------------
# CONFIG
# ----------------------------
# Loads in the Dataset from your local Machine
WESAD_PATH = r"D:\Graduation Project Dataset\archive\WESAD"
MODEL_FILENAME = "catboost_wrist_stress_WESAD.cbm"

WINDOW_SECONDS = 6           # 6-second window (you can change to 8)
WINDOW_STEP_SECONDS = 3      # 50% overlap
DEFAULT_WRIST_SR = 32
DEFAULT_BVP_SR = 64          # Real BVP sample rate
ALLOWED_LABELS = [0, 1]
VERBOSE = True

def safe_print(*args, **kwargs):
    if VERBOSE:
        print(*args, **kwargs)


# ----------------------------
# LOAD ONE SUBJECT (WRIST ONLY)
# ----------------------------
def load_wesad_subject(subject_path):
    with open(subject_path, "rb") as f:
        data = pickle.load(f, encoding="latin1") # WESAD uses python2 pickles

    if "signal" not in data or "wrist" not in data["signal"]:
        warnings.warn(f"No wrist data in {subject_path}. Skipping.")
        return None

    wrist = data["signal"]["wrist"]
    chest_labels = np.array(data["label"])

    signals = {}

    if "EDA" in wrist:
        signals["EDA"] = np.array(wrist["EDA"]).flatten()

    if "TEMP" in wrist:
        signals["TEMP"] = np.array(wrist["TEMP"]).flatten()

    if "ACC" in wrist:
        acc = np.array(wrist["ACC"])
        if acc.ndim == 2 and acc.shape[1] == 3:
            signals["ACC_x"] = acc[:, 0]
            signals["ACC_y"] = acc[:, 1]
            signals["ACC_z"] = acc[:, 2]
        else:
            signals["ACC_x"] = acc.flatten()

    if "BVP" in wrist:
        signals["BVP"] = np.array(wrist["BVP"]).flatten()

    return signals, chest_labels


# ----------------------------
# FREQUENCY-DOMAIN HELPERS
# ----------------------------

def bandpower(arr, fs, low, high):
    # Use nperseg = len(arr) to remove warnings
    freqs, psd = signal.welch(arr, fs=fs, nperseg=len(arr))

    mask = (freqs >= low) & (freqs <= high)
    if not np.any(mask):
        return 0.0
    return float(trapezoid(psd[mask], freqs[mask]))


# ----------------------------
# FEATURE EXTRACTION
# ----------------------------
def extract_window_features(signals, chest_labels, sr, window_samples, step_samples):

    features = []
    n = min(len(v) for v in signals.values())
    chest_len = len(chest_labels)
    scale = chest_len / n  # mapping wrist index → chest label index

    for start in range(0, n - window_samples + 1, step_samples):
        end = start + window_samples
        row = {}

        def stats_dict(arr):  # All of the signals have these features
            s = pd.Series(arr)
            return {
                "mean": float(s.mean()),
                "std": float(s.std()),
                "min": float(s.min()),
                "max": float(s.max()),
                "median": float(s.median()),
                "skew": float(s.skew()),
                "kurt": float(s.kurt()),
            }

        def valid(arr):
            return not (np.isnan(arr).any() or np.isinf(arr).any() or np.std(arr) == 0)

        # ---------------- EDA FEATURES ----------------
        if "EDA" in signals:
            eda = signals["EDA"][start:end]
            if not valid(eda):
                continue

            row.update({f"EDA_{k}": v for k, v in stats_dict(eda).items()})

            # EDA derivative
            eda_diff = np.diff(eda)
            row["EDA_diff_mean"] = float(np.mean(eda_diff))
            row["EDA_diff_std"] = float(np.std(eda_diff))

            # EDA peaks (simple SCR estimate)
            peaks, _ = signal.find_peaks(eda, distance=int(sr * 0.5))
            row["EDA_peak_count"] = len(peaks)
            row["EDA_peak_mean_amp"] = float(np.mean(eda[peaks])) if len(peaks) > 0 else 0.0

            # EDA frequency domain (stress increases high-frequency)
            row["EDA_LF"] = bandpower(eda, sr, 0.01, 0.1)
            row["EDA_HF"] = bandpower(eda, sr, 0.1, 0.25)
            row["EDA_LFHF"] = (
                row["EDA_LF"] / row["EDA_HF"] if row["EDA_HF"] > 0 else 0
            )

        # ---------------- TEMP FEATURES ----------------
        if "TEMP" in signals:
            temp = signals["TEMP"][start:end]
            if not valid(temp):
                continue

            row.update({f"TEMP_{k}": v for k, v in stats_dict(temp).items()})
            row["TEMP_slope"] = (temp[-1] - temp[0]) / len(temp)

        # ---------------- ACC FEATURES ----------------
        if all(k in signals for k in ["ACC_x", "ACC_y", "ACC_z"]):
            ax = signals["ACC_x"][start:end]
            ay = signals["ACC_y"][start:end]
            az = signals["ACC_z"][start:end]

            mag = np.sqrt(ax ** 2 + ay ** 2 + az ** 2)
            if not valid(mag):
                continue

            row.update({f"ACC_mag_{k}": v for k, v in stats_dict(mag).items()})
            row["ACC_energy"] = float(np.sum(mag ** 2) / len(mag))

        # ---------------- BVP (PPG) + HRV FEATURES ----------------
        if "BVP" in signals:
            bvp_start = start * 2
            bvp_end = end * 2
            bvp = signals["BVP"][bvp_start:bvp_end]

            if not valid(bvp):
                continue

            row.update({f"BVP_{k}": v for k, v in stats_dict(bvp).items()})

            # Peak detection for HRV
            peaks, _ = signal.find_peaks(bvp, distance=int(DEFAULT_BVP_SR * 0.3))

            if len(peaks) > 1:
                ibi = np.diff(peaks) / DEFAULT_BVP_SR  # RR intervals in seconds
                rr_diff = np.diff(ibi)

                hr = 60.0 / np.mean(ibi)
                sdnn = np.std(ibi)
                rmssd = np.sqrt(np.mean(rr_diff ** 2)) if len(rr_diff) > 0 else 0
                nn50 = np.sum(np.abs(rr_diff) > 0.05)
                pnn50 = nn50 / len(rr_diff) if len(rr_diff) > 0 else 0

                # frequency-domain HRV (LF/HF)
                # Interpolate IBIs to uniform time grid
                try:
                    times = np.cumsum(ibi)
                    interp_times = np.linspace(times[0], times[-1], len(times))
                    ibi_interp = np.interp(interp_times, times, ibi)

                    LF = bandpower(ibi_interp, 4, 0.04, 0.15)
                    HF = bandpower(ibi_interp, 4, 0.15, 0.4)
                    LFHF = LF / HF if HF > 0 else 0
                except:
                    LF = HF = LFHF = 0

            else:
                hr = sdnn = rmssd = pnn50 = LF = HF = LFHF = 0

            row["HR_mean"] = hr
            row["HRV_SDNN"] = sdnn
            row["HRV_RMSSD"] = rmssd
            row["HRV_pNN50"] = pnn50
            row["HRV_LF"] = LF
            row["HRV_HF"] = HF
            row["HRV_LFHF"] = LFHF

        # ---------------- LABEL ALIGNMENT ----------------
        c_start = int(start * scale)
        c_end = min(int(end * scale), chest_len)

        lbl = chest_labels[c_start:c_end]
        if len(lbl) > 0:
            m = pd.Series(lbl).mode().iloc[0]
            if m in ALLOWED_LABELS:
                row["label"] = int(m)

        if "label" in row:
            features.append(row)

    return features


# ----------------------------
# MAIN PIPELINE
# ----------------------------
def main():
    subject_paths = glob.glob(os.path.join(WESAD_PATH, "S*", "S*.pkl"))
    safe_print(f"Found {len(subject_paths)} subjects.")

    WINDOW = int(WINDOW_SECONDS * DEFAULT_WRIST_SR)
    STEP = int(WINDOW_STEP_SECONDS * DEFAULT_WRIST_SR)

    all_rows = []

    for path in subject_paths:
        safe_print(f"\nProcessing {path} ...")
        res = load_wesad_subject(path)
        if res is None:
            continue

        signals, labels = res
        feats = extract_window_features(
            signals, labels, DEFAULT_WRIST_SR, WINDOW, STEP
        )
        safe_print(f"Extracted {len(feats)} windows.")
        all_rows.extend(feats)

    df = pd.DataFrame(all_rows).dropna().reset_index()
    safe_print(f"\nFinal dataset shape: {df.shape}")
    safe_print(df["label"].value_counts())

    X = df.drop("label", axis=1)
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )



    # ---------------- CATBOOST ----------------
    model = CatBoostClassifier(
        depth=8,
        learning_rate=0.03,
        iterations=600,
        loss_function="Logloss",
        eval_metric="Accuracy",
        verbose=False,
        random_state=42
    )

    model.fit(X_train, y_train)  #  NO SCALER

    preds = model.predict(X_test)

    safe_print("\nAccuracy:", accuracy_score(y_test, preds))
    safe_print("\nClassification Report:\n", classification_report(y_test, preds))
    safe_print("\nConfusion Matrix:\n", confusion_matrix(y_test, preds))

    # Save as .cbm
    model.save_model(MODEL_FILENAME)  # e.g. "catboost_wrist_stress_WESAD.cbm"

    safe_print(f"\nSaved model to {MODEL_FILENAME}")



if __name__ == "__main__":
    main()
