# BengalGuard Dashboard

A simple dark-themed Bengali hate speech and sarcasm analytics dashboard.

## Files
- `index.html` — dashboard structure and Tailwind CSS CDN
- `style.css` — additional custom styling
- `app.js` — CSV parsing, filtering, metrics, insights and Chart.js chart

## Run in VS Code
1. Open the `BengalGuard` folder in VS Code.
2. Install the **Live Server** extension if you do not already have it.
3. Right-click `index.html` and choose **Open with Live Server**.
4. Use **Browse files** to upload your CSV, or click **Load demo data** to test the interface.

## CSV format
The dashboard looks for a label column named one of:
`label`, `category`, `class`, `target`, `sentiment`, `prediction`.

It optionally detects a text column (`text`, `post`, `comment`, `content`, etc.),
a source column (`source`, `dataset`, `origin`) and a confidence column
(`confidence`, `score`, `probability`).

CSV should be UTF-8 encoded for Bengali text. Confidence can be decimal
(e.g. `0.92`) or percentage (e.g. `92` or `92%`).

## Notes
- The demo data is illustrative. Upload your actual project CSV for real results.
- This is a visualization dashboard. It does not run your trained ML model.
  To display model predictions, export the model's predictions to CSV first.
- External CDN libraries require an internet connection.
