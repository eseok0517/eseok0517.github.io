# Ehahn Seok — Finance & Operations Analytics

Portfolio: https://eseok0517.github.io/

## Review the work

| Project | Business question | Evidence |
|---|---|---|
| [Manufacturing Purchasing Strategy](https://eseok0517.github.io/projects/purchasing/) | How much inventory is worth holding? | SQL, synthetic records, held-out simulation, Excel model, management memo |
| [Asset Register Review](https://eseok0517.github.io/projects/asset-analysis/) | Which assets or records need follow-up? | Browser tool, sample register, editable assumptions, exceptions export |
| [Market Regimes](https://eseok0517.github.io/projects/macro-regimes/) | How do forward returns differ across economic regimes? | FRED downloads, monthly results, pipeline, sample counts and limitations |

Company records from the LG internship are confidential. The public purchasing study uses synthetic data. The asset tool is a prototype and its sample data is simulated. Market research uses public FRED records and is descriptive, not a trading backtest.

## Run and maintain

This is a static GitHub Pages site. Serve the repository root with a local HTTP server to preview it. No package installation or build step is needed.

```bash
python scripts/fetch_macro.py --out data
python -m unittest discover -s tests
python projects/purchasing/scripts/verify_analysis.py
```

`fetch_macro.py` downloads all four FRED series. `--saved-source data/raw` rebuilds from the existing real downloads without claiming a new download. `--fixture DIR` is reserved for tests and marks results synthetic. Partial calendar months are excluded. Each regime comparison uses its own available sample; short credit history does not truncate the longer yield-curve history.

The `Update data` workflow runs weekly and can be run manually. On GitHub Pages, both macro charts read the latest committed JSON from the public repository, with the deployed JSON as a network fallback. This lets scheduled data commits appear even when a bot commit does not trigger a Pages rebuild. Local previews use the local JSON. Refresh previews by refreshing that data, not by editing chart labels.

Homepage: `index.html`, `style.css`, `portfolio.js`. Detailed cases live under `projects/`; `asset-dashboard.html` is the browser-based tool.
