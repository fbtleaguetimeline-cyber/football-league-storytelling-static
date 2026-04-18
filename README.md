# Football League Storytelling Static

Static GitHub Pages archive for football league season narratives.

## Run locally

Open `index.html` directly, or serve it over HTTP:

```bash
python -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Add a league

Create a league folder under `league`:

```text
league/
  epl/
    1888-1889-football-league-narrative.txt
  la-liga/
    1929-1930-la-liga-narrative.txt
```

Then regenerate the archive manifest:

```bash
npm run generate:data
```

The generated files are `data/seasons.json` and `data/archive.js`. Commit the text files and both generated files.

To generate a sitemap after the GitHub Pages URL is ready:

```bash
SITE_URL=https://your-user.github.io/your-repo npm run generate:data
```

## Publish on GitHub Pages

Use GitHub Pages with the source set to the repository root. No build step is required.

If you prefer publishing `dist`, install dependencies and run:

```bash
npm install
npm run build
```
