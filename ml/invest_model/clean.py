"""Turn the raw Plug and Play export into the training table.

    cd ml && uv run python -m invest_model.clean     # writes data/processed/clean.csv

What comes out (one row per reviewed deck):
  the 7 FEATURES (NaN = not rated / not recorded), label (1 = William invested),
  session, session_date, startup (an integer id, never the name), assignee
  and funding_regime. The last four are for validation and analysis only and
  never reach the model.

Every rule here fails loudly on a value it hasn't seen before. A silent
"coerce to NaN" would hide a changed export format, which is how the funding
column went wrong in the first place.

Confidentiality: the raw file holds startup names and free-text notes. Neither
is ever written out or printed. The name is used in memory only, to give each
startup an id; the summary that goes into the model card has counts only.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Final

import numpy as np
import pandas as pd

from invest_model import config, funding

# "[19/11] Wednesday Australia", "[28/01] Wednesday Notre Dame, ...": day/month, no year.
SESSION_PATTERN: Final[re.Pattern[str]] = re.compile(r"^\[(\d{1,2})/(\d{1,2})\]\s*(\S+)")
# The reviews run from autumn 2025 into spring 2026. Months from July on are 2025.
SEASON_START: Final[tuple[int, int]] = (2025, 7)
WEEKDAYS: Final[tuple[str, ...]] = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

# Labels whose bracket is a typo. Sessions ran on Wednesdays and Fridays, and
# each of these names a weekday its bracket date doesn't fall on ([25/4] is a
# Saturday, three weeks after the last session). The date given is the nearest
# day that matches the weekday, and each fills an otherwise empty slot in the
# Wednesday/Friday run. Every other label's weekday matches its date; a new
# mismatch stops cleaning rather than being guessed at.
DATE_FIXES: Final[dict[str, date]] = {
    "[25/4] Wednesday": date(2026, 3, 25),
    "[19/3] Wednesday": date(2026, 3, 18),
    "[21/3] Friday": date(2026, 3, 20),
}

# Some names carry the deck's position in its session ("#12 Acme"). It differs
# between sessions, so it is not part of the startup's identity.
ORDINAL_PREFIX: Final[re.Pattern[str]] = re.compile(r"^\s*#\d+\s*")

RATINGS: Final[dict[str, float]] = {"1": 1.0, "2": 2.0, "3": 3.0, "4": 4.0, "5": 5.0, "": np.nan}
LABELS: Final[dict[str, float]] = {"Yes": 1.0, "No": 0.0, "": np.nan}

# A session counts as still in progress while fewer than this share of its
# decks have a verdict. In the current export that is one session with 4 of 38
# decided (every other session is above 70%); its early verdicts may be
# provisional, so they are left out. Set to 0 to keep them.
IN_PROGRESS_BELOW: Final[float] = 0.5

ASSIGNEE_COL: Final[str] = "Assignee"
# Read only for amounts typed there in sessions with no Funding column (see
# funding.py); its links never leave this module.
URL_COL: Final[str] = "url"
REQUIRED: Final[tuple[str, ...]] = (
    config.NAME_COL,
    config.FUNDING_COL,
    URL_COL,
    config.SESSION_COL,
    config.LABEL_COL,
    ASSIGNEE_COL,
    *config.CRITERIA,
)


@dataclass(frozen=True)
class Cleaned:
    table: pd.DataFrame
    summary: dict[str, object]


def session_date(label: str) -> date:
    match = SESSION_PATTERN.match(label)
    if match is None:
        raise ValueError(f"unexpected Pitch Session format: {label!r}")
    fixed = DATE_FIXES.get(f"[{match.group(1)}/{match.group(2)}] {match.group(3)}")
    if fixed is not None:
        return fixed
    day, month = int(match.group(1)), int(match.group(2))
    year = SEASON_START[0] if month >= SEASON_START[1] else SEASON_START[0] + 1
    result = date(year, month, day)
    # Not every label names a weekday ("[1/4] Washington"); those that do must agree.
    weekday = match.group(3)
    if weekday in WEEKDAYS and WEEKDAYS[result.weekday()] != weekday:
        raise ValueError(f"Pitch Session {label!r} names a {weekday} but {result} is a {WEEKDAYS[result.weekday()]}")
    return result


def _exact(column: pd.Series, mapping: dict[str, float], what: str) -> pd.Series:
    unknown = sorted(set(column) - set(mapping))
    if unknown:
        # Safe to show: only criteria and label columns come through here.
        raise ValueError(f"unexpected {what} values: {unknown[:5]}")
    return column.map(mapping).astype(float)


def _startup_ids(names: pd.Series) -> pd.Series:
    """Same id for the same startup across sessions; blank names never collide."""
    key = names.str.replace(ORDINAL_PREFIX, "", regex=True).str.lower().str.replace(r"[^a-z0-9]+", "", regex=True)
    key = key.where(key != "", "__blank__" + names.index.astype(str))
    return pd.Series(pd.factorize(key)[0], index=names.index)


def clean(raw: pd.DataFrame) -> Cleaned:
    missing = [c for c in REQUIRED if c not in raw.columns]
    if missing:
        raise ValueError(f"raw export is missing columns: {missing}")
    raw = raw[list(REQUIRED)].apply(lambda col: col.str.strip())

    dates = raw[config.SESSION_COL].map(session_date)
    criteria = pd.DataFrame(
        {config.CRITERION_TO_FEATURE[c]: _exact(raw[c], RATINGS, c) for c in config.CRITERIA}
    )
    label = _exact(raw[config.LABEL_COL], LABELS, config.LABEL_COL)
    decoded = funding.decode(raw[config.FUNDING_COL], dates, raw[URL_COL])

    table = criteria.assign(
        funding=decoded.usd,
        label=label,
        session=raw[config.SESSION_COL],
        session_date=dates,
        startup=_startup_ids(raw[config.NAME_COL]),
        assignee=raw[ASSIGNEE_COL].replace("", "unassigned"),
        funding_regime=decoded.regime,
    )

    criteria_cols = list(config.FEATURES[:6])
    n_rated = table[criteria_cols].notna().sum(axis=1)
    scored = n_rated > 0
    labelled = table["label"].notna()

    verdict_share = labelled.groupby(table["session"]).mean()
    in_progress = sorted(verdict_share[verdict_share < IN_PROGRESS_BELOW].index)
    open_session = table["session"].isin(in_progress)

    keep = labelled & scored & ~open_session
    dropped = {
        "no_verdict": int((~labelled).sum()),
        "verdict_but_no_scores": int((labelled & ~scored).sum()),
        "verdict_in_unfinished_session": int((labelled & scored & open_session).sum()),
    }
    kept = table[keep].reset_index(drop=True)
    kept["label"] = kept["label"].astype(int)
    kept = kept[[*config.FEATURES, "label", "session", "session_date", "startup", "assignee", "funding_regime"]]

    repeat_startups = int((kept.groupby("startup")["session"].nunique() > 1).sum())
    summary = {
        "source": "Plug and Play review export (confidential, not in the repo)",
        "raw_rows": len(raw),
        "rows": len(kept),
        "invest": int(kept["label"].sum()),
        "pass": int((kept["label"] == 0).sum()),
        "invest_rate": float(kept["label"].mean()),
        "sessions": int(kept["session"].nunique()),
        "first_session": min(kept["session_date"]).isoformat(),
        "last_session": max(kept["session_date"]).isoformat(),
        "dropped": dropped,
        "unfinished_sessions_excluded": len(in_progress),
        "rows_partly_rated": int(((n_rated[keep] > 0) & (n_rated[keep] < 6)).sum()),
        "repeat_startups_across_sessions": repeat_startups,
        "funding": {
            **decoded.report,
            "in_training_rows": {
                "blank": int(kept["funding"].isna().sum()),
                "zero": int((kept["funding"] == 0).sum()),
                "positive": int((kept["funding"] > 0).sum()),
                "median_positive_usd": float(kept.loc[kept["funding"] > 0, "funding"].median()),
            },
        },
        "label_column": f"{config.LABEL_COL} (Yes = 1, No = 0); no other reviewer's verdict is used",
    }
    return Cleaned(table=kept, summary=summary)


def read_raw(path: Path = config.RAW_CSV) -> pd.DataFrame:
    # Everything as text, and "" stays "" (pandas would otherwise turn "NA"/"None" into NaN).
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def load(path: Path = config.RAW_CSV, write: bool = True) -> Cleaned:
    cleaned = clean(read_raw(path))
    if write:
        config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        cleaned.table.to_csv(config.PROCESSED_DIR / "clean.csv", index=False)
        (config.PROCESSED_DIR / "clean-summary.json").write_text(json.dumps(cleaned.summary, indent=2) + "\n")
    return cleaned


if __name__ == "__main__":
    result = load()
    print(json.dumps(result.summary, indent=2))
    print(f"wrote {config.PROCESSED_DIR.relative_to(config.REPO_ROOT)}/clean.csv")
