"""Exact money handling.

Amounts are stored as whole cents (INTEGER) so sums never drift the way binary
floats do (0.1 + 0.2 != 0.3). In Python they are `Decimal` with two places;
the API still speaks plain JSON numbers.
"""

from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import BeforeValidator, PlainSerializer
from sqlalchemy import Integer
from sqlalchemy.types import TypeDecorator

CENT = Decimal("0.01")
ZERO = Decimal("0.00")
# 10^12 is far beyond any personal balance and keeps cents inside a 64-bit int
MAX_AMOUNT = Decimal("1000000000000")


def to_money(value) -> Decimal:
    """Coerce an int/float/str/Decimal to a 2-place Decimal (half-up)."""
    if isinstance(value, Decimal):
        d = value
    elif isinstance(value, float):
        d = Decimal(repr(value))  # repr gives the shortest round-tripping form
    else:
        d = Decimal(str(value))
    if not d.is_finite():
        raise ValueError("amount must be a finite number")
    return d.quantize(CENT, rounding=ROUND_HALF_UP)


class Money(TypeDecorator):
    """SQLAlchemy column type: Decimal in Python, integer cents in the DB."""

    impl = Integer
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return int(to_money(value) * 100)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return (Decimal(int(value)) / 100).quantize(CENT)


def _parse(v):
    if v is None or isinstance(v, bool):
        if isinstance(v, bool):
            raise ValueError("amount must be a number")
        return v
    try:
        d = to_money(v)
    except Exception:
        raise ValueError("amount must be a number") from None
    if abs(d) >= MAX_AMOUNT:
        raise ValueError("amount is too large")
    return d


# Request/response field type: accepts JSON numbers or numeric strings, rounds
# to cents, and serializes back as a JSON number.
MoneyField = Annotated[
    Decimal,
    BeforeValidator(_parse),
    PlainSerializer(lambda d: float(d), return_type=float, when_used="json"),
]
