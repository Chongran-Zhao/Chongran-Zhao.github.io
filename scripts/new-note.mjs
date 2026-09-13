import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { slugPattern } from "../lib/notes.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const [slug, ...titleWords] = process.argv.slice(2);
if (!slug || !slugPattern.test(slug)) {
  console.error('Usage: npm run new:note -- my-note "Note title"');
  process.exit(1);
}
const folder = path.join(root, "notes", slug);
if (fs.existsSync(folder)) {
  console.error("Already exists: " + folder);
  process.exit(1);
}
const template = matter.read(path.join(root, "templates/note.md"));
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
fs.mkdirSync(folder);
fs.writeFileSync(path.join(folder, "index.md"), matter.stringify(template.content, {
  ...template.data, title: titleWords.join(" ") || slug, date, description: "", tags: [], draft: true
}));
console.log("Created draft: " + path.join(folder, "index.md"));
