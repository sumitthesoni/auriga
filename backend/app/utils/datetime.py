"""Timezone-aware datetime helpers.

Every timestamp the application produces or stores is UTC. Centralizing
`utc_now()` here (rather than calling `datetime.now()`/`datetime.utcnow()`
directly all over the codebase) is what lets the queue and SLA tests
inject a fake clock deterministically.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

# The active "clock". Production code always uses the default
# (real UTC time). Tests can swap this out via `override_clock()` /
# `reset_clock()` to simulate the passage of time without sleeping or
# mocking every call site individually.
_clock: Callable[[], datetime] = lambda: datetime.now(UTC)


def utc_now() -> datetime:
    """Return the current time (UTC, timezone-aware).

    All "current time" reads in the application should go through this
    function so that tests can control it deterministically.
    """
    return _clock()


def override_clock(fixed_time: datetime) -> None:
    """Freeze `utc_now()` to always return `fixed_time` (test helper)."""
    if fixed_time.tzinfo is None:
        fixed_time = fixed_time.replace(tzinfo=UTC)

    global _clock
    _clock = lambda: fixed_time


def advance_clock(delta: timedelta) -> None:
    """Move the frozen clock forward/backward by `delta` (test helper)."""
    current = utc_now()
    override_clock(current + delta)


def reset_clock() -> None:
    """Restore the real system clock (test helper, call in teardown)."""
    global _clock
    _clock = lambda: datetime.now(UTC)


def ensure_utc(value: datetime) -> datetime:
    """Return `value` as a timezone-aware UTC datetime."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
