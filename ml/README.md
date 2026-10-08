# ml/ — offline training for the invest model

This folder trains the model behind SevenFold's invest / pass verdict. It is
run once on a laptop. Nothing here is deployed: `.vercelignore` drops the whole
folder, and the app only ships the two files it writes:

| File | What it is |
| --- | --- |
| `lib/invest/model.onnx` | The model, with the acceptance gate built into the graph |
| `lib/invest/model-card.json` | How it was trained and how well it did on sessions it never saw. Counts and metrics only |

## Confidentiality

The training data is a confidential export of real deal reviews: startup
names, funding, and private notes. **It never goes into git.**

- `ml/data/` is gitignored as a whole. The raw CSV lives at
  `ml/data/raw/plug-and-play-raw.csv`, and everything derived from it with
  one row per deck goes to `ml/data/processed/`.
- The cleaner reads the name column only to give each startup an integer id.
  It never writes or prints names, notes, summaries or URLs. A Funding cell
  it can't read is described by its shape (digits as 9, letters as a), never
  quoted. Other errors may quote ratings, labels, session labels and decoded
  funding amounts.
- The model card and the ONNX file hold no rows and no names.
- The tests run on synthetic exports and never touch the real file.

Before committing, check that `git status` lists nothing under `ml/data/`.

## Run it

You need [uv](https://docs.astral.sh/uv/) and, for the parity check, the
app's `npm install`.

```bash
cd ml
uv sync                                                    # Python 3.13 + pinned deps
uv run pytest -q                                           # cleaner, funding, export, training tests
uv run python -m invest_model.clean                        # optional: just clean, print the summary
uv run python -m invest_model.train                        # clean, evaluate, fit, export
cd .. && node ml/scripts/check-onnx.mjs                    # same outputs under onnxruntime-node?
node ml/scripts/try-model.mjs 4 3 4 4 3 3 750K              # score one scorecard, as the app would
```

`try-model` takes the six ratings in `config.FEATURES` order and, optionally,
funding raised in US dollars (leave it out for unknown). It prints the score,
the gate and the verdict, and what one point more on each rating would do.
It needs no API key and doesn't read the CSV.

`train` cleans the export again, so you don't need to run `clean` first. It
runs every fit on a single thread. The models are small enough that spreading
each fit over all cores makes training about 10x slower.

## How the export is written

All of this was worked out from the export itself, and every rule in
`invest_model/clean.py` and `invest_model/funding.py` stops with an error on
a value it hasn't seen before. A silent "coerce to NaN" would hide a change
in the export format.

**Pitch Session.** `"[19/11] Wednesday …"`: day/month in brackets, no year.
The season runs from autumn 2025 into spring 2026, so months from July on
are 2025 and the rest are 2026. Sessions ran on Wednesdays and Fridays, and
the weekday in the label is checked against the date. Three brackets are
typos: `[25/4] Wednesday` falls on a Saturday, three weeks after the last
session; `[19/3] Wednesday` and `[21/3] Friday` fall on a Thursday and a
Saturday. Each is moved to the nearest day with the weekday the label names
(25 March, 18 March, 20 March). Each of those days was otherwise empty in
the Wednesday/Friday run. `clean.DATE_FIXES` lists them. Any other mismatch
stops cleaning. Session order matters here: it decides which decks the
forward-chaining test treats as "the future".

**Name.** It is used only to spot a startup that pitched more than once. Some
names start with the deck's position in its session (`#12 …`), which changes
between sessions, so that prefix is removed before comparing.

**Criteria.** Six columns with the text values `1`–`5`, or blank when not
rated. Blank becomes NaN, and the trees route it as its own branch.

**Invest William.** `Yes` / `No` / blank. This is the label and nothing else
is: `Invest Wout` (a second reviewer's verdict) and `Notes William` (the
written reason) would leak the answer and don't exist when the app runs.

**Funding amount.** This is the messy column. Every filled cell has the form
`$` + digits + `.` + three decimals (`$2.500`, `$350000000.000`). The `.` is
always a decimal point, and the three decimals are only display formatting.
The number means different things depending on when the deck was reviewed:

- **Sessions before 11 March 2026: shorthand with the unit letter lost.**
  Analysts typed `2.5M` or `700K` and the export dropped the letter. Millions
  were written with at most one decimal and never reached 30. Thousands were
  always whole numbers of 30 or more. So `2.5` is $2.5M, `27.5` is $27.5M, `50`
  is $50K and `700` is $700K. No cell in these sessions reaches 1,000.
- **Sessions from 11 March 2026: whole US dollars.** Every non-zero value is
  at least $10,000.

Multiplying every old value by 1,000 is wrong for about half of them: it
turns $2.5M into $2,500. `funding.py` checks for this. Each session's values
must fit its convention. After decoding, no raise may be under $10K. The
share of $1M+ raises must also roughly match between the two conventions.

`$0.000` means nothing has been raised yet. A blank cell means the amount was
never recorded and stays NaN. They are different facts, and the model sees
them as different. The column is funding *raised to date*, not the size of
the round being asked for.

Two sessions left the Funding column empty for every deck. In one of them
(12 Nov 2025) the amounts were typed into the `url` column instead, with
their unit: `$28M`, `$325K`, `$0`, one in euros, one `Bootstrapped`. Those
35 cells are read (34 of them in training rows); euros are taken at par, and
"Bootstrapped" is $0. The `url` column is read for nothing else, and only in
sessions with no Funding values. Links and blanks there stay NaN, and any
other value stops cleaning without being printed. The other session
(5 Dec 2025) has no amounts anywhere and stays NaN.

The cut-off of 30 decides exactly one cell: a `$30.000` that falls between
the largest millions value (27.5) and the smallest thousands value
otherwise seen (50). It is read as $30K.

Three cells are unit slips that no rule can detect. The analysts' notes give
an amount raised that differs from the cell by 10x or more. These cells are
corrected in `funding.OVERRIDES`. Each one is keyed by session date and raw
cell, so the code needs no startup name. Cleaning stops if a key doesn't
match exactly one row. Smaller disagreements are left as recorded: four
cells off by 1.5–2.3x, and one blank that a note calls bootstrapped. They
look like typos or a round size typed in place of the amount raised. The
notes that reveal them were mostly written to explain a pass, so correcting
only those cells would nudge funding toward the label.

## What gets dropped

From the 822 rows in the current export:

| Dropped | Rows | Why |
| --- | --- | --- |
| No verdict | 51 | Nothing to learn from |
| Verdict but no criteria rated | 2 | Nothing to learn from |
| Verdict in an unfinished session | 4 | The `[1/4]` session had 4 of 38 decks decided (every other session is above 70%), so those early calls may be provisional. Set `clean.IN_PROGRESS_BELOW = 0` to keep them |

That leaves 765 decks (199 invest, 566 pass, 26%) from 22 sessions,
7 Nov 2025 – 8 Apr 2026. Funding is known for 701 of them: 77 with nothing
raised and 624 with a raise (median $1M). One startup pitched twice, four
months apart. Every split keeps its two decks on the same side, so the model
is never tested on a startup it has already seen.

## The model

**What it predicts.** Only `Invest William`: 1 = invest, 0 = pass. The
model is a scikit-learn `HistGradientBoostingRegressor` with squared error,
fitted to those 0/1 labels. A regressor fitted that way estimates the invest
rate among past decks rated like this one, so it returns a graded 0–1 score
rather than a class. The **acceptance gate** turns the score into the
verdict: invest when score ≥ gate. Both live in `lib/invest/model.onnx`. The
app reads `score`, `invest` and `threshold` from it and holds no number of
its own.

**Inputs.** The six 1–5 ratings and funding raised to date in USD, in the
order of `config.FEATURES`. The score can only rise with a rating
(`monotonic_cst`). Funding is unconstrained. An unknown funding amount is NaN,
and the trees route it to its own branch. Only 2 training decks had a missing
rating, so the app refuses to score a deck until all six are in
(`lib/invest/model.ts`).

**Recipe** (`train.py`):

- **Trees:** small trees, 4 leaves each, at least 10 decks per leaf, L2 5.0,
  learning rate 0.05.
- **Rounds:** 100 or 250, chosen by out-of-fold Brier score in 5-fold CV over
  whole pitch sessions. The final fit chose 100.
- **Recency weights:** a deck's weight halves for every 20 sessions before
  the newest one, so the oldest session counts 0.48 as much as the newest.
  William's bar moved over the season: the same ratings earned fewer invests
  later on.
- **Gate:** the out-of-fold score above which the model invests in the same
  share of decks as William did (26%). It comes out at 0.399.

All of this was chosen by comparing it with an earlier version of this
pipeline: wider trees (4 or 8 leaves, L2 1.0), a gate set to maximise MCC,
and no recency weights. Two tests were run, each repeated over 20 different
inner CV splits:

- **Forward:** the full procedure is re-run before each of the newest 8
  sessions. The current recipe beat the earlier one in every split. Its
  Brier score was lower by about 0.009 (95% interval 0.002–0.020 over
  resampled sessions), AUC higher by 0.014, and MCC higher by 0.09.
- **Cross-validation over all 22 sessions:** the two were within noise of
  each other.

Three caveats on that comparison:

- About three quarters of the Brier gain comes from two sessions. William
  turned down more decks there than his ratings implied, and the earlier
  recipe, depending on how its inner folds fell, invested in up to two to
  three times as many as he did.
- The MCC-maximising gate moved nearly twice as much between CV folds as the
  share-based one.
- The recency weights mostly correct the overall level of the score on recent
  sessions, not the order of decks. A shorter half-life does better forward
  but worse in CV; 20 is a compromise.

### How well it does

All of these are on sessions the model never trained on. `model-card.json`
has the full set, including per-session results.

| Test | Decks | William's invest rate | AUC | Brier | MCC | Accuracy | Model's invest rate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Forward, newest 8 sessions | 287 | 24.7% | 0.915 (0.888–0.941) | 0.106 (0.097–0.114) | 0.700 (0.658–0.747) | 0.878 | 30.0% |
| Forward, newest 5 sessions | 184 | 23.9% | 0.893 | 0.111 | 0.674 | 0.870 | 29.3% |
| Nested CV, 10 × 5 folds of whole sessions | 765 | 26.0% | 0.853 | 0.127 | 0.558 | 0.830 | 26.0% |

- **Forward rows:** the whole procedure (choosing the recipe, setting the
  gate, fitting) is re-run before each session on the earlier sessions only.
  Ranges are 5th–95th percentiles over resampled sessions.
- **CV row:** the whole procedure is re-run inside every outer fold. Across
  repeats, AUC varies by ±0.003 and MCC by ±0.011.

Baselines:

- **Base rate:** predicting each training fold's invest rate for every deck
  scores Brier 0.187 forward and 0.193 in CV.
- **Plain sum of the six ratings:** this ranks decks with AUC 0.717 forward
  and 0.745 overall.
- **Always pass:** 74% accuracy and MCC 0.

**What moves the verdict.** Training decks are re-scored with one input
changed, from `response` in the card. For a rating, that is every deck not
already rated 5 on it (657–742 decks, counted in `decks`), one point higher.
For funding, it is all 765 decks at each amount.

| Change | Share of verdicts that flip |
| --- | --- |
| Value proposition +1 | 16.9% |
| Competitive advantage +1 | 12.7% |
| Market size +1 | 1.7% |
| Technology +1 | 0.7% |
| Team +1 | 0.2% |
| Social impact +1 | 0% |

| Funding raised | $0–100K | $250K–1M | $1.25–1.6M | $1.7–5M | $10M | $20M+ | Unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Decks that would be invested in | 49% | 44% | 41% | 2% | 2.5% | ≤1% | 44% |

**Know this before trusting a verdict:**

- **The funding cliff.**
  - Between $1.6M and $1.7M raised, the average score falls from 0.28 to
    0.11, and about 40% of verdicts flip from invest to pass.
  - This is William's behaviour from mid-season on. In the newest 8
    sessions he invested in 4% of decks that had raised more than $1.6M,
    against 38% of those at or below it. Early in the season there was no
    such line.
  - Where exactly the drop sits is not pinned down: almost no training deck
    raised between $1.6M and $2M.
  - A funding figure misread near the cliff flips the verdict.
  - The score also rises a little at about $10M. Funding is unconstrained,
    and this is noise.
- **It over-invests on recent decks.**
  - The gate copies William's all-season share of 26%. Newer decks score
    higher, so on the newest 8 sessions the model said invest on 30% of
    decks (86 decks), against William's 25% (71).
  - That is about two extra invests per 35-deck session: the model was
    above William in 5 of the 8 sessions (by 2 to 5 decks) and never below.
  - Most of the extra invests are decks with good ratings that raised $1.6M
    or less.
  - The score is likewise high on recent decks: a mean of 0.31 against a rate
    of 0.25. Read it as a ranking with a calibrated cut-off, not as an exact
    probability.
  - The gate is fixed at training time. If William's bar moves, the model
    follows only after a retrain.
- **Two ratings barely count.** Team and social impact hardly move the score,
  because in the data they hardly moved William's verdict once the other
  ratings were known. The model rests on value proposition, competitive
  advantage and funding.
- **Unknown funding.** It is scored about like $300K raised: a little lower
  than "nothing raised yet", well above anything past the cliff.
- **Who does the rating.** The training ratings came from human analysts. In
  the app, the scorecard stage rates the deck instead. If its ratings run
  higher or lower than the analysts' did, the verdicts shift with them.
- **Near the gate it's a coin flip.**
  - Out-of-fold, William invested in 33% of decks scored just below the gate
    (within 0.05) and 50% of those just above it. That compares with 8% far
    below and 74% far above.
  - The app labels a verdict "borderline" within 0.05 of the gate.
- **Small sample.**
  - There are 765 decks, one reviewer, and 8 forward sessions.
  - Differences smaller than the bootstrap ranges above are noise.
  - The gate's value varied between 0.33 and 0.44 across CV folds, and
    between 0.40 and 0.43 across forward steps.

**Retraining.** Export the review sheet again to
`ml/data/raw/plug-and-play-raw.csv`, run `train`, then run the parity check.
Once the run finishes, compare William's invest share on the newest sessions
with the model's (`forward_chaining.per_session` in the card). If the model
keeps investing in well over William's share, the gate needs revisiting.
