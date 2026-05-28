# Technical Note

## Purpose

This tool helps researchers move from raw qualitative text to a QCA-ready
dataset. It is designed for digital governance research involving citizen
messages, government replies, consultation comments, and policy feedback. The
tool is not meant to automate interpretation. It offers a transparent first pass
that researchers can inspect, adjust, and document before using the results in
configurational analysis.

## Required Data

The required inputs are simple CSV files. The text dataset should contain one
row per case, a case identifier, a text column, and preferably an outcome
column. The prototype file should contain `condition_name`, `prototype`, and
`type`. Rows marked `condition` become QCA causal conditions. Rows marked
`outcome` are retained as conceptual references, while the main QCA outcome is
selected from the uploaded text dataset when available.

## Scoring Method

The scoring stage converts each text and prototype into a shared feature
representation. To support Chinese and English text, the tool uses Chinese
characters, Chinese character bigrams, Latin words, and Latin word bigrams. It
also uses a small transparent bilingual concept bridge for the demo concepts,
linking terms such as complaint, dissatisfaction, policy, cooperate, and
response to Chinese expressions such as 投诉, 不满, 政策, 配合, and 回复.

The tool calculates cosine similarity between each case text and each prototype.
The score table, case-level summary, and overlapping features are visible in the
interface. Prototype scoring should be treated as transparent assistance rather
than final coding: it helps order and inspect cases, but substantive
interpretation remains the researcher's responsibility.

## Calibration

The calibration stage converts raw similarity scores into set memberships. The
default fuzzy-set rule uses three anchors: full non-membership at `0.15`,
crossover at `0.35`, and full membership at `0.55`. Scores below the lower
anchor become `0`; scores above the upper anchor become `1`; scores between
anchors are linearly interpolated. The crisp-set option uses a selected
threshold. Researchers should adjust anchors only after inspecting score
distributions and substantive examples.

## Human Judgment

After calibration, researchers can manually adjust selected case-condition
memberships. This matters because QCA is a research-design exercise, not only a
classification task. A short text may be ambiguous, a prototype may miss local
phrasing, or background knowledge may justify a different membership score. The
tool keeps both the original computational membership and the adjusted
membership so that human judgment remains auditable.

## QCA Outputs

The QCA-ready dataset has one row per case, one column per condition, and a
clearly identified outcome column. The truth table groups cases by crisp
condition membership using the final adjusted membership values. If no manual
adjustment is entered, final membership equals calibrated computational
membership. For each configuration, the tool reports cases, outcome value,
consistency, and coverage. Weak or contradictory configurations remain visible.

The threshold sensitivity table tests multiple crisp thresholds and reports how
many truth-table configurations, solution configurations, and average
consistency values appear under each threshold. This is important because QCA
results can change when cases move across set-membership cutoffs. Sensitivity
analysis helps researchers see whether findings are robust or mainly artifacts
of one calibration choice.

## Research Transparency

The toolkit includes a research transparency and audit trail module. It records
selected columns, conditions, calibration method, thresholds, case count,
condition count, and analysis timestamp. It also lets the researcher enter
methodological notes about theoretical reasoning, calibration decisions, coding
assumptions, or contextual observations. These notes and settings are included
in the exported Markdown report and audit log.

This design supports reproducibility because another researcher can inspect the
workflow settings and intermediate outputs, not only the final solution table.
The project intentionally avoids opaque black-box APIs and external model calls.
That choice limits semantic sophistication, but it makes the scoring process
inspectable, portable, and suitable for GitHub Pages deployment.

## Interpretation

The outputs should be interpreted as research aids, not automated truth claims.
A high membership score means that a case is textually and conceptually close to
the relevant prototype under the current scoring rule. A solution configuration
indicates a condition pattern associated with the selected outcome in the
uploaded dataset. Researchers should review individual cases, inspect
intermediate scores, justify calibration thresholds, and report manual
adjustments when they affect results.

## Limitations And Future Improvements

The main limitations are prototype sensitivity, text ambiguity, small-sample
instability, and the lexical nature of the scoring method. The bilingual bridge
improves the demo but should be expanded, audited, or replaced for new projects.
With more time, I would add multilingual embeddings, manual validation labels,
intercoder comparison, formal minimization algorithms, and richer explanation
tools that show matched passages rather than only overlapping features.
