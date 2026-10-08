"""Paths, column names, and the feature contract shared with the app.

Imported by every other module; imports nothing from this package.
"""

from __future__ import annotations

from pathlib import Path
from typing import Final

# config.py -> invest_model -> ml -> repo root
ML_DIR: Final[Path] = Path(__file__).resolve().parents[1]
REPO_ROOT: Final[Path] = ML_DIR.parent

# Confidential inputs and row-level derivatives: all under ml/data/, which is
# gitignored. Nothing in here may be committed.
RAW_CSV: Final[Path] = ML_DIR / "data" / "raw" / "plug-and-play-raw.csv"
PROCESSED_DIR: Final[Path] = ML_DIR / "data" / "processed"

# The only two files this pipeline writes outside ml/. Both are aggregate-only
# (no startup names, no rows) and are committed so the deployed app can use them.
MODEL_OUT: Final[Path] = REPO_ROOT / "lib" / "invest" / "model.onnx"
CARD_OUT: Final[Path] = REPO_ROOT / "lib" / "invest" / "model-card.json"

# Every random draw descends from this. Changing it changes every reported number.
SEED: Final[int] = 20261007

# --- Raw export columns ------------------------------------------------------
NAME_COL: Final[str] = "Name"
FUNDING_COL: Final[str] = "Funding amount"
SESSION_COL: Final[str] = "Pitch Session"
LABEL_COL: Final[str] = "Invest William"

# The six 1-5 criteria, as named in the raw export.
CRITERIA: Final[tuple[str, ...]] = (
    "Team",
    "Technology",
    "Market",
    "Value Proposition",
    "Competitive Advantage",
    "Socially Impactful",
)

# --- The feature contract -----------------------------------------------------
# The model input is a float32 row in exactly this order. lib/invest/model.ts
# builds the same vector from the app's Scorecard; the names here are the
# Scorecard keys so the two can be checked against each other by eye.
#
# This is a whitelist. The raw export also holds "Invest Wout" (a second
# reviewer's verdict, ~99% agreement with the label) and "Notes William" (the
# written rationale for the verdict). Either would leak the answer, and neither
# exists at inference time — only these seven values do.
FEATURES: Final[tuple[str, ...]] = (
    "team",
    "technology",
    "marketSize",
    "valueProposition",
    "competitiveAdvantage",
    "socialImpact",
    "funding",
)
CRITERION_TO_FEATURE: Final[dict[str, str]] = dict(zip(CRITERIA, FEATURES[:6], strict=True))

ONNX_INPUT: Final[str] = "float_input"
