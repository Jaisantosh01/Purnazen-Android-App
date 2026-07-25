"""Account-email validation rules.

Deliberately network-free: every case here resolves before (or with) the MX
lookup disabled, so the suite never depends on the runner's DNS. conftest turns
`settings.EMAIL_CHECK_DELIVERABILITY` off globally; these tests pass the flag
explicitly where the distinction matters.
"""
import pytest

from app.core.config import settings
from app.utils.email_validation import (
    MSG_DISPOSABLE,
    MSG_INVALID,
    validate_account_email,
)


@pytest.mark.parametrize(
    "email",
    ["", "   ", "not-an-email", "no-at-sign.com", "@nodomain.com", "spaces in@name.com"],
)
def test_rejects_malformed_addresses(email):
    result = validate_account_email(email, check_deliverability=False)
    assert result["valid"] is False
    assert result["message"] == MSG_INVALID


@pytest.mark.parametrize(
    "email",
    [
        "someone@mailinator.com",
        "someone@guerrillamail.com",
        "someone@10minutemail.com",
        "SomeOne@YOPMAIL.com",  # case-insensitive
    ],
)
def test_rejects_disposable_domains(email):
    # The blocklist is checked before any lookup, so this holds with the
    # deliverability check on OR off.
    result = validate_account_email(email, check_deliverability=False)
    assert result["valid"] is False
    assert result["message"] == MSG_DISPOSABLE


def test_accepts_and_normalizes_a_well_formed_address():
    result = validate_account_email("  User.Name@Example.COM  ", check_deliverability=False)
    assert result["valid"] is True
    assert result["message"] is None
    # The domain is lowercased; the local part is left alone (it is case-sensitive
    # per RFC 5321, even though most providers ignore it).
    assert result["email"].endswith("@example.com")


def test_deliverability_flag_is_honoured():
    # A domain with no mail server passes only because the lookup is skipped —
    # this is what keeps the suite off the network.
    result = validate_account_email("someone@t.com", check_deliverability=False)
    assert result["valid"] is True


def test_defaults_to_the_configured_setting():
    # conftest sets this False for the whole suite; assert the default path
    # actually reads it rather than hardcoding True.
    assert settings.EMAIL_CHECK_DELIVERABILITY is False
    assert validate_account_email("someone@t.com")["valid"] is True
