"""
Configuration centralisée du backend.
Toutes les variables d'environnement sont chargées depuis .env.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    # === Base ===
    ENV: str = "development"
    APP_URL: str = "http://localhost:3010"
    API_URL: str = "http://localhost:8010"
    
    # === Database ===
    DATABASE_URL: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    
    # === Redis ===
    REDIS_URL: str = "redis://redis:6379/0"
    
    # === Auth ===
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # === Twilio ===
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_FROM_NUMBER: Optional[str] = None
    
    # === Yousign ===
    YOUSIGN_API_KEY: Optional[str] = None
    YOUSIGN_BASE_URL: str = "https://api-sandbox.yousign.app/v3"
    
    # === SMTP ===
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_NAME: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    
    # === Google Calendar ===
    GOOGLE_CALENDAR_EMAIL: Optional[str] = None
    GOOGLE_APP_PASSWORD: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None


settings = Settings()
