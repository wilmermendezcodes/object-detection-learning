from pydantic import BaseSettings


class Settings(BaseSettings):
    cors_origins: list[str] = ["*"]
    max_upload_mb: int = 10

    class Config:
        env_prefix = "APP_"
        case_sensitive = False


settings = Settings()

