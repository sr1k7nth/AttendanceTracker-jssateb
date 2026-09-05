from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")  # pyright: ignore
    DATABASE_HOSTNAME: str
    DATABASE_PORT: int
    DATABASE_USERNAME: str
    DATABASE_PASSWORD: str
    DATABASE_NAME: str
    ENCRYPTION_KEY: str
    JWT_SECRET_KEY: str
    OAUTH_ALGORITHM: str
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def database_url(self):
        return f"postgresql://{self.DATABASE_USERNAME}:{self.DATABASE_PASSWORD}@{self.DATABASE_HOSTNAME}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"


settings = Settings()  # pyright: ignore
