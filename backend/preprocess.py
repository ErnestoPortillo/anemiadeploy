import joblib
import numpy as np
import pandas as pd

# ===========================
# Load preprocessor from training
# ===========================
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PREPROCESSOR_PATH = os.path.join(BASE_DIR, "model", "preprocessor.joblib")


try:
    preprocessor = joblib.load(PREPROCESSOR_PATH)
except:
    raise RuntimeError("❌ ERROR: No se encontró el preprocessor.joblib. "
                       "Entrena el modelo o coloca el archivo en /models")

# ===========================
# Feature list expected by the model
# ===========================
EXPECTED_NUMERIC = [
    "child_age_months",
    "child_weight_kg",
    "child_height_cm",
    "zscore_height_for_age",
    "zscore_weight_for_age",
    "zscore_weight_for_height",
    "zscore_bmi_for_age",
    "mother_age_years",
    "mother_weight_kg",
    "mother_height_cm",
    "mother_bmi",
    "mother_rohrer_index",
    "mother_weight_for_height_std_dv",
    "mother_weight_for_height_percent_dhs",
    "mother_weight_for_height_percent_fogarty",
    "mother_weight_for_height_percent_oms"
]

EXPECTED_CATEGORICAL = [
    "birth_interval_months",
    "birth_order",
    "child_sex",
    "cigarettes_last24h",
    "currently_pregnant",
    "dob_info_completeness",
    "education_level_summary",
    "highest_education_level",
    "marital_status",
    "measurement_position",
    "mother_education_level_summary",
    "mother_highest_education_level",
    "mother_year_of_highest_education",
    "not_measured_reason",
    "year_of_highest_education"
]

ALL_FEATURES = EXPECTED_NUMERIC + EXPECTED_CATEGORICAL


# ======================================================
# --------- MAIN FUNCTION: preprocess incoming data ----
# ======================================================
def preprocess_input(data: dict):

    """Convierte el JSON del front-end en las 342 features que necesita el modelo."""

    # ---------------------
    # Convertir a DataFrame
    # ---------------------
    df = pd.DataFrame([data])

    # ---------------------
    # Asegurar columnas faltantes
    # ---------------------
    for col in ALL_FEATURES:
        if col not in df.columns:
            df[col] = np.nan   # rellenar con NA para procesador

    # ---------------------
    # Ordenar columnas
    # ---------------------
    df = df[ALL_FEATURES]

    # ---------------------
    # Convertir tipos
    # ---------------------
    for col in EXPECTED_NUMERIC:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in EXPECTED_CATEGORICAL:
        df[col] = df[col].astype("category")

    # ---------------------
    # Aplicar el preprocessor original
    # ---------------------
    try:
        X_processed = preprocessor.transform(df)
    except Exception as e:
        raise RuntimeError(f"❌ Error al transformar los datos: {e}")

    # Convertir a lista para FastAPI
    return X_processed.toarray() if hasattr(X_processed, "toarray") else X_processed
