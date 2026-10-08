"""The funding decoder, on synthetic cells (never the confidential export)."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
import pytest

from invest_model import funding

SHORTHAND_DAY = date(2026, 2, 25)
DOLLARS_DAY = date(2026, 3, 27)


@pytest.mark.parametrize(
    ("cell", "expected"),
    [("$2.500", 2.5), ("$0.000", 0.0), ("$350000000.000", 350_000_000.0), ("$30.000", 30.0)],
)
def test_parse_cell(cell: str, expected: float) -> None:
    assert funding.parse_cell(cell) == expected


def test_parse_blank_is_nan() -> None:
    assert np.isnan(funding.parse_cell(""))


@pytest.mark.parametrize("cell", ["2.5", "$2.5", "$1,000.000", "€5.000", "$2.500M", " $1.000", "$-1.000"])
def test_parse_rejects_unknown_formats(cell: str) -> None:
    with pytest.raises(ValueError):
        funding.parse_cell(cell)


@pytest.mark.parametrize(
    ("value", "usd"),
    [
        (1.0, 1_000_000),
        (2.5, 2_500_000),
        (27.5, 27_500_000),
        (29.0, 29_000_000),
        (30.0, 30_000),
        (50.0, 50_000),
        (700.0, 700_000),
        (999.0, 999_000),
    ],
)
def test_shorthand_units(value: float, usd: float) -> None:
    assert funding.shorthand_to_usd(value) == usd


def test_shorthand_zero_and_blank_pass_through() -> None:
    assert funding.shorthand_to_usd(0.0) == 0.0
    assert np.isnan(funding.shorthand_to_usd(float("nan")))


@pytest.mark.parametrize("value", [0.5, 45.5])
def test_shorthand_rejects_values_with_no_known_unit(value: float) -> None:
    with pytest.raises(ValueError):
        funding.shorthand_to_usd(value)


def test_regime_switches_on_11_march() -> None:
    assert funding.regime(date(2026, 3, 6)) == "shorthand"
    assert funding.regime(date(2025, 11, 7)) == "shorthand"
    assert funding.regime(date(2026, 3, 11)) == "dollars"
    assert funding.regime(date(2026, 4, 25)) == "dollars"


def _decode(cells: list[str], dates: list[date], urls: list[str] | None = None) -> funding.Decoded:
    return funding.decode(pd.Series(cells), pd.Series(dates), pd.Series(urls or [""] * len(cells)))


def test_decode_mixed_column(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(funding, "OVERRIDES", ())
    cells = ["$2.500", "$400.000", "$0.000", "", "$2500000.000", "$0.000", "", "$40000.000"]
    dates = [SHORTHAND_DAY] * 4 + [DOLLARS_DAY] * 4
    decoded = _decode(cells, dates)
    expected = [2_500_000, 400_000, 0, np.nan, 2_500_000, 0, np.nan, 40_000]
    np.testing.assert_array_equal(decoded.usd.to_numpy(), np.array(expected, dtype=float))
    assert decoded.regime.tolist() == ["shorthand"] * 4 + ["dollars"] * 4
    assert decoded.report["shorthand"] == {
        "rows": 4, "blank": 1, "zero": 1, "positive": 2, "read_as_millions": 1, "read_as_thousands": 1,
    }
    assert decoded.report["dollars"] == {"rows": 4, "blank": 1, "zero": 1, "positive": 2}


def test_decode_keeps_zero_apart_from_blank(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(funding, "OVERRIDES", ())
    usd = _decode(["$0.000", ""], [DOLLARS_DAY, DOLLARS_DAY]).usd
    assert usd.iloc[0] == 0
    assert np.isnan(usd.iloc[1])


def test_decode_rejects_session_that_contradicts_its_date(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(funding, "OVERRIDES", ())
    with pytest.raises(ValueError, match="dated shorthand"):
        _decode(["$2.500", "$1500.000"], [SHORTHAND_DAY, SHORTHAND_DAY])
    with pytest.raises(ValueError, match="dated dollars"):
        _decode(["$2.500", "$1500000.000"], [DOLLARS_DAY, DOLLARS_DAY])


def test_override_applies_to_exactly_one_row(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        funding, "OVERRIDES", (funding.Override(DOLLARS_DAY, "$10000.000", 3_500_000, "test"),)
    )
    usd = _decode(["$10000.000", "$20000.000"], [DOLLARS_DAY, DOLLARS_DAY]).usd
    assert usd.tolist() == [3_500_000, 20_000]


@pytest.mark.parametrize("cells", [["$20000.000"], ["$10000.000", "$10000.000"]])
def test_override_must_match_exactly_one_row(monkeypatch: pytest.MonkeyPatch, cells: list[str]) -> None:
    monkeypatch.setattr(
        funding, "OVERRIDES", (funding.Override(DOLLARS_DAY, "$10000.000", 3_500_000, "test"),)
    )
    with pytest.raises(ValueError, match="expected exactly 1"):
        _decode(cells, [DOLLARS_DAY] * len(cells))


# Half the raises are $1M+ in both conventions, 50 of each, enough for the share check.
CELLS = ["$2.500", "$700.000"] * 25 + ["$2500000.000", "$700000.000"] * 25
CELL_DATES = [SHORTHAND_DAY] * 50 + [DOLLARS_DAY] * 50


def test_correct_rule_passes_the_checks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(funding, "OVERRIDES", ())
    usd = _decode(CELLS, CELL_DATES).usd
    assert usd.iloc[:2].tolist() == [2_500_000, 700_000]


def test_old_times_1000_rule_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    """The legacy rule turns $2.5M into $2,500, below any real raise in the data."""
    monkeypatch.setattr(funding, "OVERRIDES", ())
    monkeypatch.setattr(funding, "shorthand_to_usd", lambda v: v if np.isnan(v) or v == 0 else v * 1_000)
    with pytest.raises(ValueError, match="below \\$10K"):
        _decode(CELLS, CELL_DATES)


def test_all_millions_rule_is_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    """Reading 700 as $700M makes every shorthand raise $1M+ vs half in dollar sessions."""
    monkeypatch.setattr(funding, "OVERRIDES", ())
    monkeypatch.setattr(funding, "shorthand_to_usd", lambda v: v if np.isnan(v) or v == 0 else v * 1_000_000)
    with pytest.raises(ValueError, match="differs too much"):
        _decode(CELLS, CELL_DATES)


# --- Amounts typed into the url column ---------------------------------------
URL_DAY = date(2025, 11, 12)


@pytest.mark.parametrize(
    ("cell", "usd"),
    [("$28M", 28_000_000), ("$1.5M", 1_500_000), ("$325K", 325_000), ("$0", 0), ("€2M", 2_000_000),
     ("Bootstrapped", 0), ("bootstrapped", 0)],
)
def test_url_cell_amounts(cell: str, usd: float) -> None:
    assert funding.parse_url_cell(cell) == usd


@pytest.mark.parametrize("cell", ["", "https://acme.example", "http://acme.example/deck"])
def test_url_cell_links_and_blanks_stay_unknown(cell: str) -> None:
    assert np.isnan(funding.parse_url_cell(cell))


@pytest.mark.parametrize("cell", ["acme.example", "$2 million", "2M", "$2B", "Secret Startup"])
def test_url_cell_unknown_shapes_fail_without_quoting_the_cell(cell: str) -> None:
    with pytest.raises(ValueError, match="value not shown") as excinfo:
        funding.parse_url_cell(cell)
    assert cell not in str(excinfo.value)


@pytest.mark.parametrize(
    ("cell", "masked"),
    [("$2.5M", "$9.9a"), ("1,000,000", "9,999,999"), ("Secret Startup", "aaaaaa aaaaaaa"), ("https://acme.example", "aaaaa://aaaa.aaaaaaa")],
)
def test_funding_cell_errors_give_the_shape_not_the_cell(cell: str, masked: str) -> None:
    with pytest.raises(ValueError, match="value not shown") as excinfo:
        funding.parse_cell(cell)
    assert cell not in str(excinfo.value)
    assert masked in str(excinfo.value)


def test_url_column_read_only_where_a_session_has_no_funding(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(funding, "OVERRIDES", ())
    cells = ["", "", "", "", "$2.500", ""]
    dates = [URL_DAY] * 4 + [SHORTHAND_DAY] * 2
    # The last url is an amount too, but its session has a Funding column: ignored.
    urls = ["$28M", "$325K", "https://acme.example", "Bootstrapped", "", "$9M"]
    decoded = _decode(cells, dates, urls)
    np.testing.assert_array_equal(
        decoded.usd.to_numpy(), np.array([28_000_000, 325_000, np.nan, 0, 2_500_000, np.nan])
    )
    assert decoded.regime.tolist() == ["url_column"] * 4 + ["shorthand"] * 2
    assert decoded.report["url_column"] == {"sessions": 1, "rows": 4, "blank": 1, "zero": 1, "positive": 2}
    assert decoded.report["shorthand"]["rows"] == 2


def test_url_amount_without_a_unit_is_held_to_the_10k_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(funding, "OVERRIDES", ())
    with pytest.raises(ValueError, match="below \\$10K"):
        _decode([""], [URL_DAY], ["$500"])


def test_overrides_point_at_real_session_days() -> None:
    """Override dates use the corrected session calendar (Wednesdays and Fridays)."""
    for override in funding.OVERRIDES:
        assert override.session_date.weekday() in (2, 4), override.session_date
