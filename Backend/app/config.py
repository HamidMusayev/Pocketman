from pydantic_settings import BaseSettings, SettingsConfigDict

# The placeholder secrets that shipped in compose/.env.example. If one of these
# (or nothing usable) is configured, security.py generates a random key and
# persists it next to the database instead of signing tokens with a public value.
INSECURE_SECRET_KEYS = {"", "dev-secret-key-change-me", "change-me-to-a-long-random-string"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SECRET_KEY: str = "dev-secret-key-change-me"
    DATABASE_URL: str = "sqlite:///./data/pocketman.db"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    JWT_ALGORITHM: str = "HS256"

    # Set to false to stop new sign-ups (existing users can still log in).
    ALLOW_REGISTRATION: bool = True

    # Brute-force protection for login (per username and per client IP).
    LOGIN_MAX_FAILURES: int = 5
    LOGIN_IP_MAX_ATTEMPTS: int = 30
    LOGIN_WINDOW_SECONDS: int = 15 * 60
    REGISTER_IP_MAX: int = 10
    REGISTER_WINDOW_SECONDS: int = 60 * 60

    # Largest CSV accepted by POST /api/transactions/import.
    MAX_IMPORT_BYTES: int = 5 * 1024 * 1024

    # Largest Money Manager backup (.mmbak) accepted, as uploaded and once
    # unzipped. Keep MMBAK_MAX_UPLOAD_BYTES in step with nginx.conf.
    MMBAK_MAX_UPLOAD_BYTES: int = 20 * 1024 * 1024
    MMBAK_MAX_DB_BYTES: int = 100 * 1024 * 1024

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
