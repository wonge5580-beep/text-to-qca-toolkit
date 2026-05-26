# Technical Note

## Purpose

This tool helps researchers move from raw qualitative text to a QCA-ready
dataset. It is intended for digital governance research settings such as
citizen messages, government replies, public consultation comments, and policy
feedback. The goal is not to replace human interpretation. Instead, the tool
offers a transparent first pass that researchers can inspect, adjust, and
document before using the results in configurational analysis.

## Required Data

The required inputs are simple CSV files. The text dataset should contain one
row per case, a case identifier, a text column, and preferably an outcome
column. The prototype file should contain `condition_name`, `prototype`, and
`type`. Prototypes are short conceptual descriptions written by the researcher.
Rows marked `condition` become QCA causal conditions. Rows marked `outcome` are
retained as conceptual references, while the main QCA outcome is selected from
the uploaded text dataset when available.

## Scoring Method

The scoring stage converts each text and prototype into a shared feature
representation. To support Chinese and English text, the tool uses Chinese
characters, Chinese character bigrams, Latin words, and Latin word bigrams. It
also uses a small transparent bilingual concept bridge for the demo concepts,
linking terms such as complaint, dissatisfaction, policy, cooperate, and
response to Chinese expressions such as 投诉, 不满, 政策, 配合, and 回复.

The tool calculates cosine similarity between each case text and each prototype.
The score table is shown directly in the interface, so the researcher can see
how raw text becomes condition scores. The interface also lists overlapping
features as a simple explanation for why a case is close to a prototype.

## Calibration

The calibration stage converts raw similarity scores into set memberships. The
default fuzzy-set rule uses three anchors: full non-membership at `0.15`,
crossover at `0.35`, and full membership at `0.55`. Scores below the lower
anchor become `0`; scores above the upper anchor become `1`; scores between
anchors are linearly interpolated, with the crossover set to `0.5`.

The crisp-set option uses a user-selected threshold. Scores at or above the
threshold are coded `1`, and lower scores are coded `0`. These defaults are
intentionally conservative because short Chinese texts and English conceptual
prototypes may not share many literal features. Researchers should adjust
anchors after inspecting score distributions and substantive examples.

## QCA Outputs

The QCA-ready dataset has one row per case, one column per condition, and a
clearly identified outcome column. The truth table groups cases by crisp
condition membership. For each configuration, the tool reports the number of
cases, case IDs, outcome value, consistency, and coverage.

Consistency is calculated as the proportion of cases in a configuration that
show the outcome. Coverage is calculated as the proportion of all positive
outcome cases covered by the configuration. The solution table reports
configurations that meet the selected minimum case count and consistency
threshold. Weak or contradictory configurations remain visible in the truth
table.

## Interpretation

The outputs should be interpreted as research aids, not final automated
judgments. A high membership score means that a case is textually and
conceptually close to the relevant prototype under the current scoring rule. A
solution configuration indicates a condition pattern that is consistently
associated with the selected outcome in the uploaded dataset. Researchers
should review individual cases, inspect intermediate scores, and justify
calibration thresholds in relation to the research design.

## Assumptions

The tool assumes that prototypes are substantively meaningful, that the selected
text field contains enough information for classification, and that the chosen
calibration anchors are defensible. It also assumes that the outcome variable is
appropriate for QCA and that each row represents a distinct case.

## Limitations

The main limitations are prototype sensitivity, text ambiguity, small-sample
instability, and the lexical nature of the scoring method. The bilingual bridge
improves the demo, but it should be expanded, audited, or replaced for a new
project. The tool does not currently perform formal Boolean minimization or
validate scores against human-coded labels.

## Future Improvements

With more time, I would add multilingual embedding models, manual validation
labels, intercoder comparison, formal minimization algorithms, and richer
explanation tools that show matched passages rather than only overlapping
features. I would also add project-level configuration files so researchers can
save prototype sets, calibration anchors, and reporting preferences across
multiple datasets.
