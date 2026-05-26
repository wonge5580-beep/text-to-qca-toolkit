# Text-to-QCA Research Tool

This project completes Task 2 of the take-home assessment: it converts raw text into prototype-based condition scores, calibrates those scores into QCA set memberships, and produces basic QCA outputs.

## What Is Included

- `index.html`, `styles.css`, `app.js`: a browser-based research tool with no required server.
- `data/demo_texts.csv`: demo Chinese public-message data.
- `data/prototypes.csv`: example conceptual prototypes.
- `scripts/generate_sample_outputs.py`: reproducible sample-output generator using only the Python standard library.
- `outputs/`: generated scoring, calibration, QCA, truth-table, solution, and figure-data files.
- `TECHNICAL_NOTE.md`: a 500-1,000 word explanation of workflow, assumptions, interpretation, limitations, and future improvements.

## Run The Web Tool

Open `index.html` in a browser.

The page includes a `Load demo data` button, so the reviewer can run the main workflow without editing code. The reviewer can also upload their own CSV files.

Expected input files:

- Text dataset CSV with one case per row.
- Required text column selected in the interface.
- Optional outcome column containing `0/1`, `true/false`, `yes/no`, or numeric fuzzy-set membership.
- Prototype CSV with `condition_name`, `prototype`, and `type` columns. Use `type=condition` for causal conditions and `type=outcome` for conceptual outcome prototypes.

## Reproduce Sample Outputs

From the project folder:

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

The tool builds transparent text scores using character and word n-gram cosine similarity. Chinese characters, Chinese bigrams, Latin words, and Latin word bigrams are included so the same method works with Chinese citizen messages and English prototype descriptions. Scores are calibrated with user-visible anchors:

- full membership: default 0.55
- crossover: default 0.35
- full non-membership: default 0.15
- crisp threshold: default 0.50

For QCA, each calibrated condition becomes a set-membership column. The truth table groups cases by crisp condition membership and reports case count, outcome share, consistency, and coverage. Solution configurations are rows whose consistency and case count meet the selected thresholds.

## Notes For Hosting

Because the interface is static, it can be hosted on GitHub Pages, Netlify, Vercel, or any static file host. No backend or API key is required.
