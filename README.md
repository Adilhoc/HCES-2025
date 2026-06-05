# India NSS Health Dashboard — GitHub Pages version

This version is designed to work with GitHub browser upload. The raw dashboard CSV has been compressed as `data/health_level5_slim.csv.gz`, because GitHub browser uploads are limited to 25 MiB per file. The dashboard decompresses it in the browser using pako, then parses it with PapaParse.

## Files you must upload

Upload **all** of these at the root of your GitHub repository:

- `index.html`
- `assets/app.js`
- `assets/style.css`
- `data/health_level5_slim.csv.gz`
- `data/summary.json`
- `data/field_map.json`

Do not upload only `index.html`. The dashboard will not work without the `assets` and `data` folders.

## Local preview

Because browsers usually block local file fetches when you double-click `index.html`, preview it through a local server:

```bash
cd path/to/this/folder
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages

1. Create a new public repository.
2. Upload the **contents of this folder**, not the folder itself.
3. Confirm `index.html` is visible at repo root.
4. Confirm `data/health_level5_slim.csv.gz` exists in the repo.
5. Go to Settings → Pages.
6. Source: Deploy from branch.
7. Branch: main; Folder: /root.
8. Open the generated GitHub Pages URL.

If the dashboard says it cannot load data, the most likely issue is that `data/health_level5_slim.csv.gz` was not uploaded or the files are nested inside an extra folder.
