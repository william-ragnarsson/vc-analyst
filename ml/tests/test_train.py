"""The training procedure's moving parts: weights, gate, folds, forward chaining.

Synthetic data only, so these run without the confidential CSV.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from invest_model import config, train


N_SESSIONS = 14


def _table(n_sessions: int = N_SESSIONS, per_session: int = 30, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    n = n_sessions * per_session
    ratings = rng.integers(1, 6, (n, 6)).astype(float)
    funding = rng.choice([0.0, 2e5, 1e6, 5e6], n)
    label = (ratings.sum(axis=1) + rng.normal(0, 2, n) > 20).astype(int)
    session = np.repeat(np.arange(n_sessions), per_session)
    start = date(2025, 11, 5)
    table = pd.DataFrame(ratings, columns=list(config.FEATURES[:6]))
    table["funding"] = funding
    table["label"] = label
    table["session"] = [f"s{i}" for i in session]
    table["session_date"] = [start + timedelta(days=7 * int(i)) for i in session]
    table["startup"] = np.arange(n)
    return table


@pytest.fixture
def rows() -> train.Rows:
    return train.Rows.from_table(_table())


@pytest.fixture
def tiny_grid(monkeypatch: pytest.MonkeyPatch) -> None:
    """One fast recipe, so procedure tests run in seconds."""
    recipe = train.Recipe(0.1, 20, 4, 10, 5.0, "criteria")
    monkeypatch.setattr(train, "RECIPES", [recipe])


def test_ranks_follow_session_dates(rows: train.Rows) -> None:
    assert rows.ranks.min() == 0
    assert rows.ranks.max() == N_SESSIONS - 1
    # Shuffling the table must not change which rank a session gets.
    shuffled = train.Rows.from_table(_table().sample(frac=1, random_state=1))
    by_session = dict(zip(shuffled.sessions, shuffled.ranks, strict=True))
    assert by_session["s0"] == 0 and by_session[f"s{N_SESSIONS - 1}"] == N_SESSIONS - 1


def test_recency_weights_halve_per_half_life(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(train, "RECENCY_HALF_LIFE", 10.0)
    ranks = np.array([0, 0, 10, 20, 20])
    w = train.recency_weights(ranks)
    assert w is not None
    assert w.mean() == pytest.approx(1.0)
    assert w[2] / w[3] == pytest.approx(0.5)
    assert w[0] / w[3] == pytest.approx(0.25)
    # Only the gaps matter: the same sessions later in the season weigh the same.
    assert train.recency_weights(ranks + 7) == pytest.approx(w)


def test_recency_weights_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(train, "RECENCY_HALF_LIFE", None)
    assert train.recency_weights(np.arange(5)) is None


def test_gate_invests_at_the_training_rate() -> None:
    rng = np.random.default_rng(0)
    y = (rng.random(1000) < 0.26).astype(float)
    scores = np.clip(0.3 * y + rng.normal(0.3, 0.15, 1000), 0, 1)
    gate = train.gate_for(y, scores)
    assert np.mean(scores >= gate) == pytest.approx(y.mean(), abs=0.002)


def test_session_folds_hold_out_whole_sessions_and_purge_repeats(rows: train.Rows) -> None:
    # Make startup 0 (session s0) pitch again in session s5.
    startups = rows.startups.copy()
    startups[np.flatnonzero(rows.sessions == "s5")[0]] = 0
    rows = train.Rows(rows.X, rows.y, rows.sessions, startups, rows.dates, rows.ranks)
    for train_idx, test_idx in train.session_folds(rows, 4, seed=0):
        test_sessions = set(rows.sessions[test_idx])
        assert test_sessions.isdisjoint(rows.sessions[train_idx])
        assert len(test_idx) == 30 * len(test_sessions)
        assert np.isin(rows.startups[train_idx], rows.startups[test_idx]).sum() == 0


def test_forward_chain_trains_on_the_past_only(
    rows: train.Rows, tiny_grid: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[tuple[int, int]] = []
    original = train.select

    def spy(train_rows: train.Rows, seed: int):
        seen.append((int(train_rows.ranks.max()), len(np.unique(train_rows.sessions))))
        return original(train_rows, seed)

    monkeypatch.setattr(train, "select", spy)
    result = train.forward_chain(rows)

    steps = result["per_session"]
    assert len(steps) == train.FORWARD_SESSIONS
    # Step k scores the k-th of the newest sessions and trains on exactly the sessions before it.
    for k, (newest_trained, n_trained) in enumerate(seen):
        assert newest_trained == N_SESSIONS - train.FORWARD_SESSIONS + k - 1
        assert n_trained == steps[k]["trained_on_sessions"] == newest_trained + 1
    assert [s["session_date"] for s in steps] == sorted(s["session_date"] for s in steps)
    assert result["rows"] == 30 * train.FORWARD_SESSIONS
    recent = result[f"newest_{train.FORWARD_RECENT}"]
    assert recent["sessions"] == train.FORWARD_RECENT
    assert recent["rows"] == 30 * train.FORWARD_RECENT
    for block in (result, recent):
        assert set(block["bootstrap"]) == {"roc_auc", "brier", "mcc"}
        for spread in block["bootstrap"].values():
            assert spread["sd"] > 0 and spread["p5"] < spread["p95"]


def test_select_returns_the_gate_of_its_own_scores(rows: train.Rows, tiny_grid: None) -> None:
    recipe, gate, scores = train.select(rows, seed=0)
    assert recipe == train.RECIPES[0]
    assert not np.isnan(scores).any()
    assert gate == train.gate_for(rows.y, scores)


def test_near_gate_bands_cover_every_row() -> None:
    rng = np.random.default_rng(0)
    scores = rng.random(500)
    y = (rng.random(500) < scores).astype(float)
    bands = train.near_gate(y, scores, 0.4)
    assert sum(b["rows"] for b in bands) == 500


def test_model_response_reports_averages_only(rows: train.Rows) -> None:
    model = train.Recipe(0.1, 20, 4, 10, 5.0, "criteria").build().fit(rows.X, rows.y)
    response = train.model_response(model, 0.4, rows.X)
    funding = response["funding"]
    assert len(funding) == len(train.RESPONSE_FUNDING) + 1
    assert funding[-1]["funding_usd"] is None
    assert all(0.0 <= f["mean_score"] <= 1.0 and 0.0 <= f["invest_share"] <= 1.0 for f in funding)
    assert set(response["one_point_higher"]) == set(config.FEATURES[:6])
    for j, name in enumerate(config.FEATURES[:6]):
        assert response["one_point_higher"][name]["decks"] == int((rows.X[:, j] < 5).sum())
    # The criteria are monotone, so a higher rating never lowers the score.
    assert all(r["mean_score_change"] >= 0 for r in response["one_point_higher"].values())
