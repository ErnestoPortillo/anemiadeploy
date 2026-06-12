# =========================
# main.py – Backend final
# =========================

from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import json

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel
import numpy as np
import pandas as pd
import joblib
import os
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from sqlalchemy.orm import Session

try:
    from database import Base, engine, get_db
    from models import MedicalCenter, User
except ModuleNotFoundError:
    from backend.database import Base, engine, get_db
    from backend.models import MedicalCenter, User

app = FastAPI(title="Anemia Prediction API")

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
JWT_SECRET = os.getenv("JWT_SECRET")
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "8"))
SEED_DEFAULT_USERS = os.getenv("SEED_DEFAULT_USERS", "true").lower() == "true"
RESET_SEED_USER_PASSWORDS = os.getenv("RESET_SEED_USER_PASSWORDS", "true").lower() == "true"

if ENVIRONMENT == "production" and not JWT_SECRET:
    raise RuntimeError("Falta JWT_SECRET en producción")

JWT_SECRET = JWT_SECRET or "dev-secret-change-me"

ROLE_PERMISSIONS = {
    "nurse": {"predict"},
    "doctor": {"followup"},
    "coordinator": {"dashboard"},
    "admin": {"predict", "followup", "dashboard", "manage_users"},
}

SEED_USERS = [
    {"username": "admin", "password": "admin123", "role": "admin"},
    {"username": "enfermera1", "password": "enf123", "role": "nurse"},
    {"username": "medico1", "password": "med123", "role": "doctor"},
    {"username": "coordinador1", "password": "coor123", "role": "coordinator"},
]


@app.get("/")
def root():
    return {"status": "ok", "service": "Anemia Prediction API"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
def seed_default_users():
    Base.metadata.create_all(bind=engine)

    if not SEED_DEFAULT_USERS:
        return

    db = next(get_db())
    try:
        for seed in SEED_USERS:
            user = db.query(User).filter(User.username == seed["username"]).first()
            if user:
                user.role = seed["role"]
                if RESET_SEED_USER_PASSWORDS:
                    user.password_hash = pwd_context.hash(seed["password"])
                continue

            db.add(
                User(
                    username=seed["username"],
                    password_hash=pwd_context.hash(seed["password"]),
                    role=seed["role"],
                )
            )
        db.commit()
    finally:
        db.close()

def get_cors_origins() -> list[str]:
    origins = os.getenv("CORS_ORIGINS", "")
    if origins:
        return [origin.strip() for origin in origins.split(",") if origin.strip()]
    if ENVIRONMENT == "production":
        raise RuntimeError("Falta CORS_ORIGINS en producción")
    return ["*"]


# ============================
#    HABILITAR CORS
# ============================
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
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
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class LoginRequest(BaseModel):
    username: str
    password: str


class MedicalCenterRequest(BaseModel):
    nombre: str
    distrito: str


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("utf-8")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "exp": int((now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)).timestamp()),
    }
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = ".".join(
        [
            _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ]
    )
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url_encode(signature)}"


def decode_access_token(token: str) -> dict:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        signing_input = f"{header_b64}.{payload_b64}"
        expected_signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
        received_signature = _b64url_decode(signature_b64)

        if not hmac.compare_digest(expected_signature, received_signature):
            raise ValueError("Invalid signature")

        payload = json.loads(_b64url_decode(payload_b64))
        if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            raise ValueError("Expired token")

        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        ) from exc


def get_current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta token de autenticación",
        )

    payload = decode_access_token(token)
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    return user


def require_roles(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para esta acción",
            )
        return user

    return dependency


@app.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()

    if not user:
        return {"status": "error", "message": "Credenciales incorrectas"}

    try:
        if user.password_hash.startswith("$2"):
            password_ok = pwd_context.verify(data.password[:72], user.password_hash)
        else:
            # Compatibilidad temporal para usuarios de prueba creados manualmente.
            password_ok = data.password == user.password_hash
    except ValueError:
        password_ok = False

    if password_ok:
        return {
            "status": "ok",
            "role": user.role,
            "userId": user.id,
            "username": user.username,
            "token": create_access_token(user),
        }

    return {"status": "error", "message": "Credenciales incorrectas"}


@app.get("/medical-centers")
def list_medical_centers(db: Session = Depends(get_db)):
    centers = db.query(MedicalCenter).order_by(MedicalCenter.nombre.asc()).all()
    return [
        {
            "id": center.id,
            "nombre": center.nombre,
            "distrito": center.distrito,
        }
        for center in centers
    ]


@app.post("/medical-centers", status_code=status.HTTP_201_CREATED)
def create_medical_center(data: MedicalCenterRequest, db: Session = Depends(get_db)):
    nombre = data.nombre.strip()
    distrito = data.distrito.strip()

    if not nombre or not distrito:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completa el nombre del centro medico y su distrito.",
        )

    existing = db.query(MedicalCenter).filter(MedicalCenter.nombre == nombre).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un centro medico con ese nombre.",
        )

    center = MedicalCenter(nombre=nombre, distrito=distrito)
    db.add(center)
    db.commit()
    db.refresh(center)

    return {
        "id": center.id,
        "nombre": center.nombre,
        "distrito": center.distrito,
    }


# ------------------------------------------------------- 
# 5. ENDPOINT de predicción
# -------------------------------------------------------
@app.post("/predict")
def predict(data: InputData, current_user: User = Depends(require_roles("nurse", "admin"))):

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
