# Text-to-QCA Toolkit for Government–Citizen Interaction Analysis

Live demo: https://wonge5580-beep.github.io/text-to-qca-toolkit/

This repository completes Task 2 of the take-home assessment. It is a small
browser-based research prototype that converts raw text into prototype-based
condition scores, calibrates those scores into QCA set memberships, and
produces QCA-ready outputs.

This project prioritises interpretability and methodological transparency over
model complexity. The current implementation is designed as a lightweight
exploratory research assistant rather than a production-level automated coding
system.

The tool is designed with digital governance research in mind, especially
analysis of citizen messages, government replies, public consultation comments,
and policy feedback. It does not require an API key, backend server, database,
or manual code editing for the main workflow.

## Quick Start

### Option 1: Live Demo

Open the hosted demo:

https://wonge5580-beep.github.io/text-to-qca-toolkit/

Click `Load demo data`, then inspect the score table, calibrated membership
table, optional manual adjustments, threshold sensitivity analysis, truth table,
solution configurations, heatmap, and consistency-coverage plot.

### Option 2: Local Run

Open `index.html` directly in a browser.

If the browser blocks local file behavior, serve the folder locally:

```bash
python3 -m http.server 8765
```

Then open:

```text
http://localhost:8765/index.html
```

## Repository Contents

- `index.html`, `styles.css`, `app.js`: static browser application.
- `data/demo_texts.csv`: demo Chinese government-citizen interaction data.
- `data/prototypes.csv`: conceptual prototype descriptions.
- `outputs/`: sample scoring, calibration, QCA, truth-table, solution, and
  figure-data outputs.
- `scripts/generate_sample_outputs.py`: reproducible output generator using
  only the Python standard library.
- `TECHNICAL_NOTE.md`: methodological note covering interpretation,
  assumptions, limitations, and future improvements.

## Input Data

The text dataset should be a CSV file with one row per case. It should include:

- a case identifier column;
- a text column;
- optionally, an outcome column coded as `0/1`, `true/false`, `yes/no`, or a
  numeric fuzzy-set membership value.

The prototype dataset should be a CSV file with these columns:

- `condition_name`
- `prototype`
- `type`

Use `type=condition` for QCA causal conditions. Use `type=outcome` for
conceptual outcome prototypes.

## Main Workflow

1. Upload or load a text dataset.
2. Select the case ID, text, and outcome columns.
3. Upload or load conceptual prototypes.
4. Score each text against each prototype.
5. Calibrate raw similarity scores into fuzzy-set or crisp-set membership.
6. Optionally adjust selected case-condition memberships using researcher
   judgment.
7. Generate a QCA-ready dataset.
8. Test threshold sensitivity across multiple crisp-set thresholds.
9. Produce a truth table with consistency and coverage.
10. Identify solution, contradictory, and weak configurations.
11. Export tables and a Markdown analysis report.

## Advanced Features

### Human-In-The-Loop Adjustment

After calibration, the interface shows the original computational membership
and an editable adjusted membership for every case-condition pair. Adjusted
values are used in the QCA-ready dataset, truth table, solution configurations,
and plots. The original computational values remain visible for auditability.

Manual adjustments should be treated as researcher judgment and justified
theoretically in any report.

### Threshold Sensitivity Analysis

The toolkit can compare multiple crisp-set thresholds, such as `0.25`, `0.30`,
`0.35`, `0.40`, and `0.50`. For each threshold, it reports:

- number of truth-table configurations;
- number of solution configurations;
- average consistency.

This helps researchers check whether QCA findings depend heavily on one
threshold choice.

### Case-Level Scoring Explanation

The case-level summary identifies the top matched condition for each case,
shows the top similarity score, and combines original text, raw scores,
calibrated memberships, and final adjusted memberships in one table.

### Export Package

The export controls can download:

- similarity scores;
- calibrated membership table;
- adjusted membership table;
- QCA-ready dataset;
- truth table;
- solution configurations;
- threshold sensitivity table;
- research audit log;
- `analysis_report.md`, a short Markdown report summarizing the analysis.

### Research Transparency & Audit Trail

The toolkit includes a collapsible research transparency panel that records
workflow decisions such as selected columns, selected conditions, calibration
method, thresholds, case count, condition count, and analysis timestamp. It also
provides researcher notes and condition-level interpretation statements.

## Why Transparency Matters In Computational Social Science

Text-as-data workflows involve measurement choices, calibration decisions, and
contextual interpretation. In a real mixed-methods project, the important
question is not only whether the code runs, but whether the coding decisions can
be explained. The toolkit therefore keeps intermediate outputs visible instead
of hiding them behind a black-box score. Researchers can inspect raw similarity
scores, calibrated memberships, adjusted memberships, truth-table logic,
threshold sensitivity, and the audit trail before interpreting any QCA result.

## Reproduce Sample Outputs

From the project folder, run:

```bash
python3 scripts/generate_sample_outputs.py
```

The script reads `data/demo_texts.csv` and `data/prototypes.csv`, then writes:

- `outputs/similarity_scores.csv`
- `outputs/calibrated_membership.csv`
- `outputs/qca_ready_dataset.csv`
- `outputs/truth_table.csv`
- `outputs/solution_configurations.csv`
- `outputs/membership_heatmap.csv`
- `outputs/consistency_coverage_plot.csv`

## Method Summary

The tool uses transparent lexical scoring rather than a hidden model. This is a
deliberate tradeoff: the method is less semantically powerful than a large
language model, but easier to inspect in a take-home assessment setting. It
constructs character and word n-gram features for Chinese and English text, adds
a small bilingual concept bridge for the demo concepts, and calculates cosine
similarity between each text and each prototype.

The project intentionally avoids external black-box APIs, backend services, and
runtime package dependencies so that the demo remains reproducible on GitHub
Pages and easy for reviewers to inspect.

Scores are calibrated with visible user-adjustable anchors:

- full membership: default `0.55`
- crossover: default `0.35`
- full non-membership: default `0.15`
- crisp threshold: default `0.50`

For QCA, each final membership column becomes a set-membership condition. If no
manual override is entered, final membership equals calibrated membership. The
truth table groups cases by crisp condition membership and reports case count,
outcome share, consistency, and coverage.

## Hosting

The application is fully static. It can be hosted on GitHub Pages, Netlify,
Vercel, or any static file host.
