# HCES Food Plate Dashboard

This repository contains a static GitHub Pages dashboard for exploring HCES 2023-24 household food consumption. The browser app loads compressed preprocessed files from `food_data/` and does all filtering and charting client-side.

## Main Files

Upload these files and folders to GitHub Pages:

- `index.html`
- `assets/app.js`
- `assets/style.css`
- `food_data/food_households.csv.gz`
- `food_data/food_item_cube.csv.gz`
- `food_data/food_summary.json`
- `food_data/item_map.json`

The raw `Files/` folder is not required for hosting. It is only needed when regenerating the dashboard data.

## Data Preparation

The raw HCES files are too large to load directly in a browser. Regenerate the compressed dashboard data with:

```bash
python scripts/preprocess_food_dashboard.py
```

The script reads the raw CSVs from `Files/` and writes the generated files to `food_data/`.

Food category totals use HCES subtotal item codes from Sections 5, 6, and 7. Detailed item/source charts exclude those subtotal rows to avoid double counting.

## Dashboard Behavior

- Food category mix uses household subtotal columns by default, then switches to detailed item-cube aggregation when the Source filter is active so the chart moves with that filter.
- Food item spend mix is shown as a doughnut for top items plus `Other items`; the adjacent horizontal ranking remains the better view for comparing long item names.

## Local Preview

Browsers usually block local `fetch()` calls if you double-click `index.html`. Preview with a local server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages

1. Create a public GitHub repository.
2. Upload the contents of this folder, not the folder itself.
3. Confirm `index.html`, `assets/`, and `food_data/` are visible at the repository root.
4. Go to Settings -> Pages.
5. Source: Deploy from branch.
6. Branch: `main`; Folder: `/root`.
7. Open the generated GitHub Pages URL.

If the dashboard cannot load data, confirm the `food_data` folder was uploaded at the repository root.
