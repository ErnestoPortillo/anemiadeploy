from sqlalchemy import Column, DateTime, Integer, String, func

try:
    from database import Base
except ModuleNotFoundError:
    from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String(30), nullable=False, default="nurse")
    created_at = Column(DateTime, server_default=func.now())


class MedicalCenter(Base):
    __tablename__ = "medical_centers"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(120), unique=True, nullable=False, index=True)
    distrito = Column(String(60), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
