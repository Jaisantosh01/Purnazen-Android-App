"""Helpers for presenting person names consistently across the API."""

import re

# Matches a leading "Dr" / "Dr." title (case-insensitive) with optional
# trailing dot and whitespace, e.g. "Dr", "Dr.", "dr ", "DR. ".
_DR_PREFIX_RE = re.compile(r"^\s*dr\.?\s+", re.IGNORECASE)


def format_doctor_name(full_name: str | None) -> str:
    """Return the doctor's name with exactly one "Dr. " prefix.

    Doctor records are sometimes stored with the title already baked into the
    name ("Dr Sarah Chen"). Blindly prepending "Dr. " produced duplicated
    titles like "Dr. Dr Sarah Chen"; strip any existing leading title first.
    """
    name = (full_name or "").strip()
    if not name:
        return "Doctor"
    name = _DR_PREFIX_RE.sub("", name).strip()
    return f"Dr. {name}" if name else "Doctor"
