# Chongran Zhao — Personal Academic Website

Static site served by GitHub Pages at <https://chongran-zhao.github.io>.
Existing pages use plain HTML/CSS/JS. Eleventy generates Markdown notes,
and GitHub Actions builds and deploys `_site/` to GitHub Pages.

## Writing notes

See [笔记维护指南](docs/WRITING.md) for the complete Markdown workflow.

```sh
npm ci
npm run new:note -- my-note "Note title"
npm run dev
```

Edit `notes/my-note/index.md` in Typora or Obsidian. Local preview includes
drafts; set `draft: false`, commit and push to publish. Each note owns its
attachments and keeps a stable URL based on its folder name.

Run `npm test` for validation tests and `npm run build` for a production
build. Node.js 22 or newer is required. Generated files and dependencies
are not committed. Committed draft sources are visible in this public repo.

## Structure

```
index.html                Home (biography, research focus, selected publications)
research/index.html       Research page (MathJax equations, figures, videos)
publications/index.html   Full publication list with DOI / BibTeX buttons
activities/index.html     Conferences and academic activities
404.html, 404/index.html  Not-found page (keep the two files identical)
assets/style.css          All styling (design tokens at the top, then per-section rules)
assets/main.js            Theme toggle, mobile menu, home-page clock, BibTeX copy
figures/, video/          Images and simulation videos
resume.pdf                CV linked from the navigation bar
notes/                    Markdown notes and article attachments
_includes/                Shared Notes layouts
assets/notes.css, notes.js Notes typography, search and filtering
templates/note.md          Blank note template
docs/WRITING.md            Chinese writing and publishing guide
.github/workflows/pages.yml Build, test and deploy
```

## Updating content

- **Text**: edit the corresponding HTML file directly; every page is plain,
  indented HTML.
- **Add a publication**: copy one `<div class="pub-card">…</div>` block in
  `publications/index.html`, then update the title, authors, venue, history
  line, DOI link, and the `data-bibtex` attribute (the BibTeX button copies
  that attribute). For the home page, copy a `<div class="pub-preview">`
  block in `index.html`.
- **Add an activity**: copy a `<div class="activity-card">` block in
  `activities/index.html`.
- **Math**: write LaTeX inside `\( … \)` or `\[ … \]`; MathJax is loaded on
  the research page. To use math on another page, copy the two MathJax
  `<script>` tags from the head of `research/index.html`.
- **Colors / fonts**: change the CSS variables at the top of
  `assets/style.css` (light mode in `:root`, dark mode in `.dark`).
- **Footer date**: update the "Last updated" line in each page's footer.

Preview locally with `npm run dev` (the site uses absolute paths, so open
the local server URL, not a `file://` page). Existing HTML pages are copied
unchanged during the build.
