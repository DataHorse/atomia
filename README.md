# Atomia · Element Explorer

A clean, kid-friendly periodic table app: flip-card flashcards for all 118 elements, a full interactive periodic table, four quiz modes, and a progress tracker — all working fully offline once installed.

## What's inside
- **Cards** — flip-card flashcards with symbol, name, atomic mass, category, phase, discovery year, a fun fact, and a real-world use. Filter by element family, shuffle, swipe, or mark elements as learned.
- **Table** — the full periodic table, color-coded by family, tap any tile for details.
- **Quiz** — Symbol→Name, Name→Symbol, Atomic Number, and Element Families modes, 10 questions each, with best-score tracking.
- **Progress** — elements learned, quizzes played, best score, and a per-family breakdown.

No frameworks, no build step, no tracking — just HTML/CSS/JS, and it works offline as an installable PWA.

## Host it on GitHub Pages (free, permanent URL)
1. Create a new **public** GitHub repository (e.g. `atomia`).
2. Upload every file in this folder, keeping the same structure (`index.html` at the repo root, plus the `css/`, `js/`, and `icons/` folders).
3. In the repo, go to **Settings → Pages**, set **Source** to the `main` branch and `/ (root)`, then save.
4. After a minute or two, your app is live at `https://<your-username>.github.io/<repo-name>/`.

## Install it as an app
- **iPhone/iPad (Safari):** open the URL → tap the Share icon → **Add to Home Screen**.
- **Android (Chrome):** open the URL → tap the **⋮** menu → **Install app** (or **Add to Home screen**).
- **Laptop (Chrome/Edge):** open the URL → click the install icon (⊕) in the address bar, or **⋮ menu → Install Atomia**.

Once installed, it opens in its own window/icon and works with no internet connection.

## Local preview
Any static file server works, e.g. from this folder:
```
python3 -m http.server 8080
```
then open `http://localhost:8080`.

## Notes
- Progress (learned elements, quiz scores) is saved on-device via `localStorage`, so it's private and persists between visits — reset any time from the Progress tab.
- Data covers all 118 confirmed elements (as of IUPAC's current periodic table), including the four most recently named: nihonium, moscovium, tennessine, and oganesson.
