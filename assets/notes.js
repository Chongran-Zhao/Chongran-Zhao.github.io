(() => {
  const outline = document.querySelector(".note-outline details");
  if (outline && matchMedia("(max-width: 1023px)").matches) outline.open = false;
  const input = document.querySelector("#notes-query");
  const select = document.querySelector("#notes-tag");
  if (!input || !select) return;
  const entries = [...document.querySelectorAll("[data-note-url]")];
  const params = new URLSearchParams(location.search);
  input.value = params.get("q") || "";
  select.value = [...select.options].some(o => o.value === params.get("tag")) ? params.get("tag") : "";
  let search = new Map();
  const normalize = text => String(text).normalize("NFKC").toLocaleLowerCase();
  function filter() {
    const query = normalize(input.value.trim());
    const terms = query.split(/\s+/).filter(Boolean);
    let count = 0;
    for (const entry of entries) {
      const data = search.get(entry.dataset.noteUrl);
      const text = normalize(data ? data.title + " " + data.tags.join(" ") + " " + data.text : entry.textContent);
      const tags = JSON.parse(entry.dataset.noteTags || "[]");
      const visible = (!select.value || tags.includes(select.value)) && terms.every(term => text.includes(term));
      entry.hidden = !visible;
      if (visible) count++;
    }
    document.querySelector("#notes-count").textContent = count + (count === 1 ? " note" : " notes");
    document.querySelector("#notes-no-results").hidden = count !== 0;
    const url = new URL(location.href);
    for (const [key, value] of [["q", input.value.trim()], ["tag", select.value]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, "", url);
  }
  document.querySelector(".notes-controls").addEventListener("submit", event => { event.preventDefault(); filter(); });
  input.addEventListener("input", filter);
  select.addEventListener("change", filter);
  filter();
  fetch("/notes/search.json").then(response => {
    if (!response.ok) throw new Error("Search index unavailable");
    return response.json();
  }).then(data => { search = new Map(data.map(note => [note.url, note])); filter(); })
    .catch(() => { document.querySelector("#notes-count").textContent += " · searching titles and summaries"; });
})();
