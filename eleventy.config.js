import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import texmath from "markdown-it-texmath";
import katex from "katex";
import hljs from "highlight.js";
import { load } from "cheerio";
import { preview, readNotes, dateISO, plainText, headings, copyAttachments } from "./lib/notes.mjs";

export default function (config) {
  const md = new MarkdownIt({
    html: true, linkify: true,
    highlight(code, language) {
      return language && hljs.getLanguage(language)
        ? hljs.highlight(code, { language, ignoreIllegals: true }).value : "";
    }
  }).use(texmath, { engine: katex, delimiters: ["dollars", "brackets"], katexOptions: { trust: false, throwOnError: true } })
    .use(anchor, { level: [2, 3, 4], slugify: text => text.trim().toLowerCase().replace(/\s+/g, "-") });
  const image = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    tokens[index].attrSet("loading", "lazy");
    tokens[index].attrSet("decoding", "async");
    return image(tokens, index, options, env, renderer);
  };
  config.setLibrary("md", md);
  config.setNunjucksEnvironmentOptions({ autoescape: true });
  for (const entry of ["README.md", "docs/**", "templates/**", "tests/**"]) config.ignores.add(entry);
  for (const entry of ["index.html", "research", "publications", "activities", "404", "404.html", "assets", "figures", "video", "resume.pdf", ".nojekyll"]) config.addPassthroughCopy(entry);
  config.addPassthroughCopy({ "node_modules/katex/dist": "assets/vendor/katex" });
  config.addPassthroughCopy({ "node_modules/markdown-it-texmath/css/texmath.css": "assets/vendor/texmath.css" });
  config.addWatchTarget("notes/");
  config.addWatchTarget("index.html");
  config.addGlobalData("site", {
    url: "https://chongran-zhao.github.io",
    name: "Chongran Zhao",
    year: new Date().getFullYear()
  });
  // Use the homepage navigation as the source of truth for generated notes.
  config.addGlobalData("navigation", () => {
    const $ = load(fs.readFileSync("index.html", "utf8"));
    const nav = $(".site-header");
    nav.find(".active").removeClass("active");
    nav.find('a[href="/notes/"]').addClass("active").attr("aria-current", "page");
    return $.html(nav);
  });
  config.addGlobalData("previewMode", preview);
  config.addFilter("dateISO", dateISO);
  config.addFilter("dateLabel", value => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)));
  config.addFilter("toc", headings);
  config.addFilter("readingTime", html => {
    const text = plainText(html), chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const words = text.replace(/[\u3400-\u9fff]/g, "").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(chinese / 350 + words / 220));
  });
  config.addFilter("excerpt", html => { const $ = load(html || ""); return $("p").first().text().slice(0, 180); });
  config.addFilter("searchIndex", notes => notes.map(note => ({
    url: note.url, title: note.data.title, tags: note.data.tags || [],
    text: plainText(note.templateContent)
  })));
  config.addCollection("notes", collection => collection.getFilteredByGlob("./notes/*/index.md")
    .filter(note => preview() || !note.data.draft)
    .sort((a, b) => b.date - a.date || a.url.localeCompare(b.url)));
  config.addCollection("noteTags", collection => [...new Set(collection.getFilteredByGlob("./notes/*/index.md")
    .filter(note => preview() || !note.data.draft).flatMap(note => note.data.tags || []))].sort((a, b) => a.localeCompare(b)));
  config.on("eleventy.before", () => {
    readNotes();
    // Remove generated notes so unpublishing also removes stale pages and assets.
    fs.rmSync(path.resolve("_site/notes"), { recursive: true, force: true });
  });
  config.on("eleventy.after", () => {
    for (const note of readNotes()) {
      if (note.data.draft && !preview()) continue;
      copyAttachments(path.dirname(note.file), path.join("_site/notes", note.slug));
    }
  });
  return { dir: { input: ".", output: "_site", includes: "_includes" }, templateFormats: ["md", "njk"], markdownTemplateEngine: false, htmlTemplateEngine: false };
}
