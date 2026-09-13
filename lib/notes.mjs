import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { load } from "cheerio";

export const preview = () => process.env.ELEVENTY_RUN_MODE === "serve" || process.env.NOTES_PREVIEW === "1";
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function dateISO(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("Invalid note date: " + value);
  return date.toISOString().slice(0, 10);
}
export function validateNote(data, slug) {
  const fail = message => { throw new Error("notes/" + slug + "/index.md: " + message); };
  if (!slugPattern.test(slug)) fail("folder name must use lowercase letters, numbers and hyphens");
  if (typeof data.title !== "string" || !data.title.trim()) fail("title is required");
  for (const key of ["date", "updated"]) {
    if (key === "updated" && data[key] == null) continue;
    const value = data[key];
    if (!(value instanceof Date) && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))) fail(key + " must be YYYY-MM-DD");
    try { if (typeof value === "string" && dateISO(value) !== value) fail("invalid " + key); else dateISO(value); }
    catch { fail("invalid " + key); }
  }
  if (data.updated && dateISO(data.updated) < dateISO(data.date)) fail("updated cannot be earlier than date");
  if (data.draft != null && typeof data.draft !== "boolean") fail("draft must be true or false");
  if (data.tags != null && (!Array.isArray(data.tags) || data.tags.some(tag => typeof tag !== "string" || !tag.trim()))) fail("tags must be a list of text labels");
  if (data.description != null && typeof data.description !== "string") fail("description must be text");
  if (data.language && !["zh-CN", "en"].includes(data.language)) fail("language must be zh-CN or en");
  return data;
}
export function readNotes(root = "notes") {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
    const file = path.join(root, entry.name, "index.md");
    if (!fs.existsSync(file)) throw new Error(file + " is missing");
    const parsed = matter.read(file);
    validateNote(parsed.data, entry.name);
    return { slug: entry.name, file, ...parsed };
  });
}
export function plainText(html) {
  const $ = load(html || "");
  $("script, style, .katex-mathml").remove();
  return $.root().text().replace(/\s+/g, " ").trim();
}
export function headings(html) {
  const $ = load(html || "");
  return $("h2[id],h3[id]").toArray().map(el => ({ id: $(el).attr("id"), title: $(el).text(), level: el.tagName }));
}
const extensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg", ".pdf", ".mp4", ".webm", ".mp3", ".ogg"]);
export function copyAttachments(source, target) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const from = path.join(source, entry.name), to = path.join(target, entry.name);
    if (entry.isDirectory()) copyAttachments(from, to);
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      fs.mkdirSync(target, { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}
