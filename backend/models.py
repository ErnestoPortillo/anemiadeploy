from sqlalchemy import Column, DateTime, Integer, String, func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String(30), nullable=False, default="nurse")
    created_at = Column(DateTime, server_default=func.now())

