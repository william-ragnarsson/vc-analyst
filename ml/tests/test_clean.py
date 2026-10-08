"""The cleaner, on a synthetic export with the real column layout."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
import pytest

from invest_model import clean, config, funding

SCORES = {c: "3" for c in config.CRITERIA}
BLANK_SCORES = {c: "" for c in config.CRITERIA}


def _row(name: str, session: str, verdict: str, money: str = "$1.000", url: str = "", **scores: str) -> dict[str, str]:
    row = {
        config.NAME_COL: name,
        config.FUNDING_COL: money,
        clean.URL_COL: url,
        config.SESSION_COL: session,
        config.LABEL_COL: verdict,
        clean.ASSIGNEE_COL: "William",
        # Columns the cleaner must ignore, including the leaky ones.
        "Invest Wout": "Yes",
        "Notes William": "free text",
        "Summary": "free text",
    }
    row.update(SCORES)
    row.update(scores)
    return row


@pytest.fixture(autouse=True)
def _no_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(funding, "OVERRIDES", ())


def _export(rows: list[dict[str, str]]) -> pd.DataFrame:
    return pd.DataFrame(rows).fillna("")


EARLY = "[19/11] Wednesday Australia"
LATE = "[27/3] Friday Energy Session"


def test_session_dates_span_the_season() -> None:
    assert clean.session_date(EARLY) == date(2025, 11, 19)
    assert clean.session_date("[28/01] Wednesday Notre Dame, Indiana") == date(2026, 1, 28)
    assert clean.session_date(LATE) == date(2026, 3, 27)


@pytest.mark.parametrize("label", ["19/11 Wednesday", "[19-11] x", "[19/11]", ""])
def test_session_date_rejects_unknown_formats(label: str) -> None:
    with pytest.raises(ValueError):
        clean.session_date(label)


@pytest.mark.parametrize(
    ("label", "expected"),
    [
        ("[25/4] Wednesday Harvard", date(2026, 3, 25)),
        ("[19/3] Wednesday Fintech", date(2026, 3, 18)),
        ("[21/3] Friday Mobility", date(2026, 3, 20)),
    ],
)
def test_mistyped_session_brackets_are_fixed(label: str, expected: date) -> None:
    assert clean.session_date(label) == expected


def test_a_new_weekday_mismatch_stops_cleaning() -> None:
    with pytest.raises(ValueError, match="names a Friday"):
        clean.session_date("[19/11] Friday")  # 19 Nov 2025 is a Wednesday


def test_labels_without_a_weekday_are_not_checked() -> None:
    assert clean.session_date("[1/4] Washington") == date(2026, 4, 1)


def test_every_date_fix_lands_on_its_weekday() -> None:
    for key, fixed in clean.DATE_FIXES.items():
        assert clean.WEEKDAYS[fixed.weekday()] == key.split()[-1]


def test_clean_keeps_only_scored_and_labelled_rows() -> None:
    rows = [
        _row("Alpha", EARLY, "Yes", "$2.500"),
        _row("Beta", EARLY, "No", "$700.000"),
        _row("Gamma", EARLY, "", "$0.000"),  # no verdict
        _row("Delta", EARLY, "No", "", **BLANK_SCORES),  # verdict, nothing scored
        _row("Epsilon", LATE, "No", "$2500000.000", **{"Market": ""}),  # partly rated: kept
        _row("Zeta", LATE, "Yes", "$0.000"),
    ]
    result = clean.clean(_export(rows))
    t = result.table
    assert len(t) == 4
    assert t["label"].tolist() == [1, 0, 0, 1]
    np.testing.assert_array_equal(t["funding"].to_numpy(), [2_500_000, 700_000, 2_500_000, 0])
    assert np.isnan(t.loc[2, "marketSize"])
    assert result.summary["dropped"] == {
        "no_verdict": 1,
        "verdict_but_no_scores": 1,
        "verdict_in_unfinished_session": 0,
    }
    assert result.summary["rows_partly_rated"] == 1


def test_output_has_the_feature_contract_and_no_free_text() -> None:
    t = clean.clean(_export([_row("Alpha", EARLY, "Yes"), _row("Beta", LATE, "No", "$50000.000")])).table
    assert list(t.columns[:7]) == list(config.FEATURES)
    assert t[list(config.FEATURES)].dtypes.map(lambda d: d.kind == "f").all()
    for leaked in (config.NAME_COL, "Invest Wout", "Notes William", "Summary"):
        assert leaked not in t.columns
    assert "Alpha" not in t.to_csv()


def test_unfinished_session_verdicts_are_left_out() -> None:
    late_rows = [_row(f"L{i}", LATE, "", "$100000.000", **BLANK_SCORES) for i in range(3)]
    late_rows.append(_row("Decided", LATE, "No", "$100000.000"))
    rows = [_row("A", EARLY, "Yes"), _row("B", EARLY, "No"), *late_rows]
    result = clean.clean(_export(rows))
    assert len(result.table) == 2
    assert result.summary["dropped"]["verdict_in_unfinished_session"] == 1
    assert result.summary["unfinished_sessions_excluded"] == 1


def test_startup_ids_match_across_sessions_and_never_merge_blank_names() -> None:
    rows = [
        _row("Acme Robotics", EARLY, "No"),
        _row("acme-robotics ", LATE, "Yes", "$3000000.000"),
        _row("", EARLY, "No"),
        _row("", LATE, "No", "$3000000.000"),
    ]
    result = clean.clean(_export(rows))
    ids = result.table["startup"].tolist()
    assert ids[0] == ids[1]
    assert len({ids[0], ids[2], ids[3]}) == 3
    assert result.summary["repeat_startups_across_sessions"] == 1


def test_startup_ids_ignore_the_deck_position_prefix() -> None:
    rows = [
        _row("#12 Acme Robotics", EARLY, "No"),
        _row("#3  Acme Robotics", LATE, "Yes", "$3000000.000"),
        _row("Acme #2", LATE, "No", "$3000000.000"),  # a "#" later in the name is part of it
    ]
    ids = clean.clean(_export(rows)).table["startup"].tolist()
    assert ids[0] == ids[1] != ids[2]


def test_funding_typed_into_the_url_column_is_used_and_links_are_not_kept() -> None:
    session = "[12/11] Wednesday"
    rows = [
        _row("Alpha", session, "Yes", "", url="$2M"),
        _row("Beta", session, "No", "", url="https://beta.example"),
        _row("Gamma", EARLY, "No", "$700.000", url="https://gamma.example"),
    ]
    result = clean.clean(_export(rows))
    t = result.table
    assert t["funding"].iloc[0] == 2_000_000
    assert np.isnan(t["funding"].iloc[1])
    assert t["funding"].iloc[2] == 700_000
    assert t["funding_regime"].tolist() == ["url_column", "url_column", "shorthand"]
    assert clean.URL_COL not in t.columns
    assert "example" not in t.to_csv()
    assert "example" not in str(result.summary)


@pytest.mark.parametrize(
    ("column", "value"),
    [("Team", "0"), ("Team", "3.5"), ("Market", "6"), (config.LABEL_COL, "yes"), (config.LABEL_COL, "Maybe")],
)
def test_unexpected_values_fail_loudly(column: str, value: str) -> None:
    rows = [_row("Alpha", EARLY, "Yes", **({column: value} if column != config.LABEL_COL else {}))]
    if column == config.LABEL_COL:
        rows[0][config.LABEL_COL] = value
    with pytest.raises(ValueError, match="unexpected"):
        clean.clean(_export(rows))


def test_error_messages_never_contain_names() -> None:
    rows = [_row("Secret Startup", EARLY, "Yes", "$1,000.000")]
    with pytest.raises(ValueError) as excinfo:
        clean.clean(_export(rows))
    assert "Secret" not in str(excinfo.value)


def test_missing_column_is_reported() -> None:
    frame = _export([_row("Alpha", EARLY, "Yes")]).drop(columns=["Market"])
    with pytest.raises(ValueError, match="missing columns"):
        clean.clean(frame)
