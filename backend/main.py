# =========================
# main.py – Backend final
# =========================

from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import pandas as pd
import joblib
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Anemia Prediction API")

# ============================
#    HABILITAR CORS
# ============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # ← Permite usar archivo local (file://) sin error
    allow_credentials=True,
    allow_methods=["*"],   # ← IMPORTANTE para permitir OPTIONS
    allow_headers=["*"],
)

# -------------------------------------------------------
# 1. Cargar Modelo y Preprocessor
# -------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "xgb_anemia_advanced.joblib")
PREPROCESSOR_PATH = os.path.join(BASE_DIR, "model", "preprocessor.joblib")

model = joblib.load(MODEL_PATH)
preprocessor = joblib.load(PREPROCESSOR_PATH)

# -------------------------------------------------------
# 2. Campos que recibimos desde el front
# -------------------------------------------------------
class InputData(BaseModel):
    child_age_months: float
    child_sex: int
    child_weight_kg: float
    child_height_cm: float
    birth_order: int
    birth_interval_months: float

    mother_age_years: float
    mother_weight_kg: float
    mother_height_cm: float
    mother_education_level_summary: int

    cigarettes_last24h: int
    marital_status: int
    currently_pregnant: int


# -------------------------------------------------------
# 3. Todas las columnas requeridas por el modelo
# -------------------------------------------------------
EXPECTED_NUMERIC = [
    "child_age_months","child_weight_kg","child_height_cm",
    "zscore_height_for_age","zscore_weight_for_age",
    "zscore_weight_for_height","zscore_bmi_for_age",

    "mother_age_years","mother_weight_kg","mother_height_cm",
    "mother_bmi","mother_rohrer_index",
    "mother_weight_for_height_std_dv",
    "mother_weight_for_height_percent_dhs",
    "mother_weight_for_height_percent_fogarty",
    "mother_weight_for_height_percent_oms"
]

EXPECTED_CATEGORICAL = [
    "birth_interval_months","birth_order","child_sex",
    "cigarettes_last24h","currently_pregnant",
    "dob_info_completeness","education_level_summary",
    "highest_education_level","marital_status",
    "measurement_position","mother_education_level_summary",
    "mother_highest_education_level",
    "mother_year_of_highest_education",
    "not_measured_reason","year_of_highest_education"
]

ALL_FEATURES = EXPECTED_NUMERIC + EXPECTED_CATEGORICAL


# -------------------------------------------------------
# 4. Preprocess inteligente
# -------------------------------------------------------
def preprocess_input(data: dict):

    # Pasar a DF
    df = pd.DataFrame([data])

    # ----------------------------
    # Cálculos automáticos
    # ----------------------------

    # BMI madre
    try:
        df["mother_bmi"] = df["mother_weight_kg"] / ((df["mother_height_cm"]/100)**2)
    except:
        df["mother_bmi"] = np.nan

    # Rohrer index
    try:
        df["mother_rohrer_index"] = (df["mother_weight_kg"] /
                                     (df["mother_height_cm"]**3)) * 1e7
    except:
        df["mother_rohrer_index"] = np.nan

    # Z-scores del niño (no disponibles en el front → NaN)
    df["zscore_height_for_age"] = np.nan
    df["zscore_weight_for_age"] = np.nan
    df["zscore_weight_for_height"] = np.nan
    df["zscore_bmi_for_age"] = np.nan

    # Otros de la madre (no disponibles)
    df["mother_weight_for_height_std_dv"] = np.nan
    df["mother_weight_for_height_percent_dhs"] = np.nan
    df["mother_weight_for_height_percent_fogarty"] = np.nan
    df["mother_weight_for_height_percent_oms"] = np.nan

    # Calidad de datos (supuestos razonables)
    df["not_measured_reason"] = "0"
    df["measurement_position"] = "1"
    df["dob_info_completeness"] = "1"

    # Educación (si falta, replicamos el summary)
    edu = df["mother_education_level_summary"].iloc[0]
    df["mother_highest_education_level"] = edu
    df["highest_education_level"] = edu
    df["education_level_summary"] = edu

    # Año (no disponible)
    df["mother_year_of_highest_education"] = "0"
    df["year_of_highest_education"] = "0"

    # ----------------------------
    # Asegurar columnas
    # ----------------------------
    for col in ALL_FEATURES:
        if col not in df.columns:
            df[col] = np.nan

    # Convertir numéricas
    for col in EXPECTED_NUMERIC:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Convertir categóricas
    for col in EXPECTED_CATEGORICAL:
        df[col] = df[col].astype("category")

    # Transformar
    X = preprocessor.transform(df)
    return X

# -------------------------------------------------------
# 0. LOGIN BÁSICO
# -------------------------------------------------------
import json

USER_FILE = os.path.join(BASE_DIR, "users.json")

# Cargar usuarios en memoria
with open(USER_FILE, "r", encoding="utf-8") as f:
    USER_DB = json.load(f)["users"]

class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/login")
def login(data: LoginRequest):
    for user in USER_DB:
        if user["username"] == data.username and user["password"] == data.password:
            return {"status": "ok", "role": user["role"]}
    return {"status": "error", "message": "Credenciales incorrectas"}


# ------------------------------------------------------- 
# 5. ENDPOINT de predicción
# -------------------------------------------------------
@app.post("/predict")
def predict(data: InputData):

    # Preprocesar datos → produce features
    X = preprocess_input(data.dict())

    # Probabilidad del modelo
    prob = float(model.predict_proba(X)[0][1])

    # Nueva clasificación por rangos
    if prob < 0.25:
        label = "Bajo"
    elif prob < 0.65:
        label = "Moderado"
    else:
        label = "Alto"

    # Retorno estándar
    return {
        "prob": prob,
        "label": label,
        "score": round(prob * 10, 1)
    }
