"""The production startup checks.

Every one of these values was already overridable by an environment variable.
The failure mode being tested is the one that actually happened: a deploy that
forgets one boots healthy, serves traffic on a publicly-known signing key or a
wildcard CORS policy, and says nothing.
"""
import pytest

from app.core import config as config_module
from app.core.config import Settings


def _settings(**overrides):
    # _env_file=None so a developer's own .env cannot change the result.
    return Settings(_env_file=None, **overrides)


def test_development_tolerates_the_committed_placeholders():
    s = _settings(ENVIRONMENT="development")
    assert s.SECRET_KEY == config_module._PLACEHOLDER_SECRET_KEY
    assert not s.is_production


def test_production_refuses_the_placeholder_secret_key():
    with pytest.raises(ValueError, match="SECRET_KEY"):
        _settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="a-real-jwt-secret-value-for-this-test",
        )


def test_production_refuses_the_placeholder_jwt_secret():
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        _settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-real-secret-value-for-this-test",
        )


def test_production_refuses_wildcard_cors():
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        _settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-real-secret-value-for-this-test",
            JWT_SECRET_KEY="a-real-jwt-secret-value-for-this-test",
            CORS_ORIGINS="*",
        )


def test_production_boots_when_configured():
    s = _settings(
        ENVIRONMENT="production",
        SECRET_KEY="a-real-secret-value-for-this-test",
        JWT_SECRET_KEY="a-real-jwt-secret-value-for-this-test",
        CORS_ORIGINS="https://app.purnazen.com, https://admin.purnazen.com",
        REDIS_URL="redis://cache:6379/0",
    )
    assert s.is_production
    assert s.cors_origins_list == [
        "https://app.purnazen.com",
        "https://admin.purnazen.com",
    ]


def test_empty_cors_means_no_cross_origin_access():
    assert _settings(ENVIRONMENT="development").cors_origins_list == []


def test_missing_redis_warns_but_still_boots(caplog):
    """Per-process limits are correct on one replica and wrong on two — loud,
    not fatal, because failing the deploy over it would be worse."""
    with caplog.at_level("WARNING"):
        _settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-real-secret-value-for-this-test",
            JWT_SECRET_KEY="a-real-jwt-secret-value-for-this-test",
            RATE_LIMIT_ENABLED=True,
            REDIS_URL="",
        )
    assert "REDIS_URL" in caplog.text
