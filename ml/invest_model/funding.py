"""Decode the "Funding amount" column into whole US dollars.

How the export wrote this column (reverse-engineered from all 822 rows and
checked against every amount the analysts quote in their notes):

* Every filled cell is "$" + digits + "." + exactly three decimals, e.g.
  "$2.500" or "$350000000.000". The three decimals are display formatting;
  the "." is always a decimal point, never a thousands separator.
* The number in the cell means different things depending on *when* the deck
  was reviewed:

  - Sessions up to 6 March 2026 ("shorthand"): the amount was typed as
    shorthand like "2.5M" or "700K" and the unit letter was lost on the way
    out. Millions were typed with at most one decimal and never reached 30;
    thousands were always typed as whole numbers of 30 or more. So
    2.5 -> $2.5M, 27.5 -> $27.5M, 50 -> $50K, 700 -> $700K. No value in these
    sessions reaches 1,000.
  - Sessions from 11 March 2026 ("dollars"): the full amount in USD. Every
    non-zero value is at least $10,000.

  The old rule of multiplying every shorthand value by 1,000 is wrong for
  about half of them: it turns $2.5M into $2,500.
* "$0.000" is a confirmed zero (nothing raised yet). A blank cell means the
  amount was never recorded and stays NaN.
* Two sessions left the column empty for every deck. In one of them (12 Nov
  2025) the analysts typed the amount into the url column instead, with its
  unit: "$28M", "$325K", "$0", one in euros, one "Bootstrapped". Those cells
  are read (see URL_AMOUNT). Euros are taken at par, as everywhere else: the
  shorthand sessions lost the currency along with the unit.

The column is "funding raised to date", not the size of the round being
raised; the notes confirm this wherever both are mentioned.

A few cells are unit slips that the rule above cannot see. Where the analysts'
own notes state the amount already raised and it differs from the cell by at
least 10x (a unit error, not a rounding difference), the note wins. They are
listed in OVERRIDES, keyed by session and raw cell so no startup name is
needed; each key must match exactly one row or cleaning stops.

Smaller disagreements (1.5-2.3x, four cells, plus one blank a note calls
bootstrapped) are left as recorded. They read like typos or a round size
typed instead of the amount raised, and the notes that reveal them were
mostly written to explain a pass, so correcting only those would nudge
funding toward the label.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Final, Literal

import numpy as np
import pandas as pd

Regime = Literal["shorthand", "dollars", "url_column"]

# First session reviewed in whole dollars. Every earlier session is shorthand.
DOLLARS_FROM: Final[date] = date(2026, 3, 11)

# In shorthand sessions: below this the cell is millions, at or above it thousands.
MILLIONS_BELOW: Final[float] = 30.0

# The $1M+ share check below needs at least this many raises per convention.
MIN_FOR_SHARE_CHECK: Final[int] = 50

CELL_PATTERN: Final[re.Pattern[str]] = re.compile(r"^\$(\d+\.\d{3})$")

# An amount typed into the url column, unit included. Read only in sessions
# whose Funding column is empty for every deck, and only when it is the whole
# cell; links and blanks stay unknown.
URL_AMOUNT: Final[re.Pattern[str]] = re.compile(r"^[$€](\d+(?:\.\d+)?)([KM]?)$")
URL_UNITS: Final[dict[str, int]] = {"": 1, "K": 1_000, "M": 1_000_000}
URL_LINK: Final[re.Pattern[str]] = re.compile(r"^https?://", re.IGNORECASE)


@dataclass(frozen=True)
class Override:
    session_date: date
    raw: str
    usd: float
    reason: str


# Unit slips confirmed by the analysts' notes. Reasons describe the evidence
# without quoting it, because the notes are confidential.
OVERRIDES: Final[tuple[Override, ...]] = (
    Override(date(2025, 12, 10), "$89.000", 89_000_000,
             "shorthand 89 read as thousands by the rule; both notes put it at $89M raised"),
    Override(date(2026, 3, 25), "$500000.000", 16_000_000,
             "cell $500K; both analysts' notes say $16M already raised"),
    Override(date(2026, 3, 20), "$10000.000", 3_500_000,
             "cell $10K; the note says $3.5M already raised"),
)


def parse_cell(cell: str) -> float:
    """One raw cell to its number as written. Blank -> NaN; anything unexpected raises.

    The error gives the cell's shape, not the cell: a link or a name typed into
    the wrong column must not end up in a traceback.
    """
    if cell == "":
        return float("nan")
    match = CELL_PATTERN.match(cell)
    if match is None:
        raise ValueError(f"unexpected Funding amount format, shaped like {shape(cell)!r} (value not shown)")
    return float(match.group(1))


def shape(cell: str) -> str:
    """Digits as 9 and letters as a, so "$2.5M" reads "$9.9a"."""
    masked = re.sub(r"[^\W\d_]", "a", re.sub(r"\d", "9", cell))
    return masked if len(masked) <= 24 else masked[:24] + "…"


def parse_url_cell(cell: str) -> float:
    """A url cell in a session with no Funding column: an amount, or NaN.

    Never quotes the cell in an error: elsewhere this column holds links that
    would identify the startup.
    """
    if cell == "" or URL_LINK.match(cell):
        return float("nan")
    if cell.lower() == "bootstrapped":
        return 0.0
    match = URL_AMOUNT.match(cell)
    if match is None:
        raise ValueError("unexpected url cell in a session without funding amounts (value not shown)")
    return float(match.group(1)) * URL_UNITS[match.group(2)]


def regime(session_date: date) -> Regime:
    return "dollars" if session_date >= DOLLARS_FROM else "shorthand"


def shorthand_to_usd(value: float) -> float:
    """A shorthand cell (unit letter lost) to whole dollars."""
    if np.isnan(value) or value == 0:
        return value
    if value < 1:
        raise ValueError(f"shorthand value {value} below 1: no known unit")
    if value < MILLIONS_BELOW:
        return round(value * 1_000_000)
    if value != int(value):
        raise ValueError(f"shorthand value {value} >= {MILLIONS_BELOW} has decimals: thousands never do")
    return round(value * 1_000)


@dataclass(frozen=True)
class Decoded:
    usd: pd.Series  # float, NaN = not recorded
    regime: pd.Series  # "shorthand" | "dollars" | "url_column"
    report: dict[str, object]  # aggregate counts for the model card; no row data


def decode(cells: pd.Series, session_dates: pd.Series, url_cells: pd.Series) -> Decoded:
    """Decode a whole column. `session_dates` holds each row's session date and
    `url_cells` the url column, which is only read where Funding is empty for
    the whole session."""
    raw = cells.map(parse_cell)
    regimes = session_dates.map(regime)
    _check_regimes(raw, regimes, session_dates)

    usd = raw.copy()
    shorthand = regimes == "shorthand"
    usd[shorthand] = raw[shorthand].map(shorthand_to_usd)

    no_funding_column = raw.isna().groupby(session_dates).transform("all").astype(bool)
    usd[no_funding_column] = url_cells[no_funding_column].map(parse_url_cell)
    regimes = regimes.where(~no_funding_column, "url_column")
    shorthand = regimes == "shorthand"

    applied = []
    for override in OVERRIDES:
        hit = (session_dates == override.session_date) & (cells == override.raw)
        if hit.sum() != 1:
            raise ValueError(
                f"override for session {override.session_date} cell {override.raw} "
                f"matches {int(hit.sum())} rows, expected exactly 1"
            )
        usd[hit] = override.usd
        applied.append({"session": override.session_date.isoformat(), "usd": override.usd, "reason": override.reason})

    _check_decoded(usd, regimes)

    def counts(mask: pd.Series) -> dict[str, int]:
        return {
            "rows": int(mask.sum()),
            "blank": int(usd[mask].isna().sum()),
            "zero": int((usd[mask] == 0).sum()),
            "positive": int((usd[mask] > 0).sum()),
        }

    shorthand_raw = raw[shorthand & (raw > 0)]
    report = {
        "rule": (
            f"sessions before {DOLLARS_FROM.isoformat()} are shorthand with the unit letter lost: "
            f"values below {MILLIONS_BELOW:g} are millions, values from {MILLIONS_BELOW:g} up are "
            f"thousands; later sessions are whole USD; $0 = nothing raised; blank = not recorded; "
            f"where a session left the column empty, amounts typed into the url column with their unit"
        ),
        "shorthand": {
            **counts(shorthand),
            "read_as_millions": int((shorthand_raw < MILLIONS_BELOW).sum()),
            "read_as_thousands": int((shorthand_raw >= MILLIONS_BELOW).sum()),
        },
        "dollars": counts(regimes == "dollars"),
        "url_column": {
            "sessions": int(session_dates[no_funding_column].nunique()),
            **counts(no_funding_column),
        },
        "overrides": applied,
    }
    return Decoded(usd=usd, regime=regimes, report=report)


def _check_regimes(raw: pd.Series, regimes: pd.Series, session_dates: pd.Series) -> None:
    """The date rule must agree with the data in every session that has values."""
    for session_date, values in raw.groupby(session_dates):
        values = values.dropna()
        if values.empty:
            continue
        nonzero = values[values > 0]
        if regime(session_date) == "shorthand":
            if values.max() >= 1_000:
                raise ValueError(f"session {session_date} is dated shorthand but holds {values.max():g}")
        elif not nonzero.empty and nonzero.min() < 1_000:
            raise ValueError(f"session {session_date} is dated dollars but holds {nonzero.min():g}")


def _check_decoded(usd: pd.Series, regimes: pd.Series) -> None:
    if (usd < 0).any():
        raise ValueError("negative funding after decoding")
    positive = usd[usd > 0]
    if not positive.empty and positive.min() < 10_000:
        raise ValueError(f"decoded funding {positive.min():g} below $10K: a unit is likely wrong")
    # The two conventions should describe the same kind of startups: the share
    # raising $1M+ came out at ~50% vs ~55% in the forensics. A unit bug moves it
    # by tens of points (the old x1000 rule gives ~0%).
    # Only meaningful with enough raises on both sides.
    shares = {
        name: float((usd[(regimes == name) & (usd > 0)] >= 1_000_000).mean())
        for name in ("shorthand", "dollars")
        if ((regimes == name) & (usd > 0)).sum() >= MIN_FOR_SHARE_CHECK
    }
    if len(shares) == 2 and abs(shares["shorthand"] - shares["dollars"]) > 0.15:
        raise ValueError(f"share of $1M+ raises differs too much between conventions: {shares}")
