# India NSS 80th Round Health Dashboard - GitHub Pages ready

This repository contains a static, browser-based interactive dashboard built from the uploaded `hhscsL5.csv` file.

## Important dataset note

The uploaded file is **not** the HCES food-consumption/nutrition file. It is detected as:

- `rnd = 80`
- `sch = 250`
- Level 5, Blocks 8 and 9
- NSS 80th Round, Schedule 25.0: **Household Social Consumption - Health**
- Survey period: January-December 2025

The dashboard therefore visualises morbidity, treatment, care-seeking, hospitalisation and medical expenditure. It includes a **Nutrition proxy** via the `Endocrine, metabolic & nutritional` ailment group, but it cannot produce a true food-consumption nutrition landscape without the HCES food questionnaire/item-consumption files.

## What is inside

```text
index.html                      Main dashboard
assets/app.js                   Browser-side analytics and Plotly charts
assets/style.css                Responsive, resizable dashboard styling
data/health_level5_slim.csv     Cleaned and labelled row-level extract
data/field_map.json             Field labels and code mappings
data/summary.json               Precomputed top-line summary
```

## Dashboard features

- Dynamic filters: state/UT, sector, sub-round, ailment group, chronicity, hospitalisation status
- Metric switcher: episode expenditure, medical expenditure, OOP, reimbursement, hospitalisation share, chronic share, weighted record counts
- Interactive map bubbles with state ranking
- Treemap and bar charts for ailment mix and treatment patterns
- Expenditure distribution with outlier cap
- Finance source and place-of-treatment charts
- Resizable chart cards and layout presets
- Export the filtered data as CSV
- Works on GitHub Pages with no backend

## Deploy on GitHub Pages

1. Create a new GitHub repository, for example `india-health-dashboard`.
2. Upload all files and folders in this package to the repository root.
3. Go to **Settings -> Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/root`.
6. Save. GitHub will publish the dashboard at your Pages URL.

## Local preview

Because browsers often block local CSV loading from `file://`, preview it through a tiny local server:

```bash
cd india_health_dashboard
python -m http.server 8000
```

Then open `http://localhost:8000`.

## To turn this into a true nutrition dashboard

Add the HCES food-consumption item-level file(s), ideally including item code, quantity, value, household size/MPCE, state, sector and survey multiplier. Then the same dashboard shell can be repurposed for:

- food group expenditure shares
- quantity consumption by food group
- cereal/pulse/milk/vegetable/fruit diversification
- rural-urban nutrition basket comparison
- state-level affordability and dietary-diversity views
- MPCE-linked food basket gradients

## Sources used for the layout/codebook

- MoSPI Microdata Portal: NSS 80th Round Schedule 25.0 Health layout
- MoSPI Report No. 596: Household Social Consumption: Health
