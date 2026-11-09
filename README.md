# Step Budget

A simple, private personal budget tracker. It's a static site (plain HTML, CSS and JavaScript) with no build step and no backend. Everything is saved in your browser's `localStorage`.

## Features

- Monthly budgets per category, with progress bars and over-budget warnings
- Income and expense transactions: add, edit, delete, search and filter
- "Left to spend" summary, plus income / spent / budgeted / net saved figures
- Spending-by-category donut chart and a 6-month income vs. spending trend
- Month-by-month navigation
- Light and dark themes
- Currency setting (AUD by default)
- Export a JSON backup, import it again, and export transactions to CSV

## Run it

Open `index.html` in a browser. To serve it locally instead:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Files

- `index.html`: page layout and dialogs
- `styles.css`: design and theme colours
- `app.js`: state, rendering and storage

> Your data is stored only in the browser you use. Export a backup regularly (⚙ → Export backup).
