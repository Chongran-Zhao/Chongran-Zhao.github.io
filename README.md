# Chongran Zhao — Personal Academic Website

Static site served by GitHub Pages at <https://chongran-zhao.github.io>.
No build step: the HTML/CSS/JS in this repository is the source and is
deployed as-is.

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

Preview locally with `python3 -m http.server` from the repository root
(the site uses absolute paths like `/assets/style.css`, so open it via the
server, not as a `file://` page).
