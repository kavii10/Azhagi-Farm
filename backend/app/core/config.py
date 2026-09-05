from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
