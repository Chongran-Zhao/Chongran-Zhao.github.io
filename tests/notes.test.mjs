import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { load } from "cheerio";
import { validateNote } from "../lib/notes.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
test("metadata validation rejects mistakes before publishing", () => {
  const valid = { title: "Test", date: "2026-09-13", draft: true, tags: ["Mechanics"] };
  assert.equal(validateNote(valid, "test-note"), valid);
  for (const invalid of [
    { title: "" }, { date: "2026-02-30" }, { date: undefined },
    { draft: "false" }, { tags: "Mechanics" }, { updated: "2025-01-01" }
  ]) assert.throws(() => validateNote({ ...valid, ...invalid }, "test-note"));
  assert.throws(() => validateNote(valid, "../escape"));
});

test("production and preview builds isolate drafts, preserve URLs and render rich Markdown", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "website-notes-test-"));
  try {
    for (const name of ["package.json", "eleventy.config.js", "lib", "_includes", "search.njk", "index.html", ".nojekyll"])
      fs.cpSync(path.join(root, name), path.join(dir, name), { recursive: true });
    // Only copy Notes infrastructure; article fixtures must not depend on real content.
    fs.mkdirSync(path.join(dir, "notes"));
    for (const name of ["index.njk", "notes.11tydata.js"])
      fs.copyFileSync(path.join(root, "notes", name), path.join(dir, "notes", name));
    fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
    const folder = path.join(dir, "notes", "test-published");
    fs.mkdirSync(folder);
    const source = '---\ntitle: "Test <title>"\ndate: "2026-09-13"\ntags: [Mechanics]\ndraft: false\n---\n\n## Heading\n\nFulltextneedle $x^2$.\n\n$$\n\\det F = 1\n$$\n\n```python\nprint("hello")\n```\n\n![Example](figure.jpg)\n';
    const file = path.join(folder, "index.md");
    fs.writeFileSync(file, source);
    const attachment = Buffer.from("fixture attachment");
    fs.writeFileSync(path.join(folder, "figure.jpg"), attachment);
    const draftFolder = path.join(dir, "notes", "writing-example");
    fs.mkdirSync(draftFolder);
    fs.writeFileSync(path.join(draftFolder, "index.md"), source.replace("draft: false", "draft: true"));
    fs.writeFileSync(path.join(draftFolder, "figure.jpg"), attachment);
    const build = preview => execFileSync(process.execPath, [path.join(root, "node_modules/@11ty/eleventy/cmd.cjs")], {
      cwd: dir, env: { ...process.env, NOTES_PREVIEW: preview ? "1" : "0" }, stdio: "pipe"
    });
    const output = relative => path.join(dir, "_site", relative);
    build(false);
    assert.ok(!fs.existsSync(output("notes/writing-example")));
    const $ = load(fs.readFileSync(output("notes/test-published/index.html"), "utf8"));
    assert.equal($("h1").text(), "Test <title>");
    assert.ok($(".katex").length >= 2);
    assert.ok($(".hljs-string").length);
    assert.equal($('.note-outline a[href="#heading"]').length, 1);
    assert.equal($('.site-header a[href="/notes/"].active').length, 2);
    assert.ok(fs.existsSync(output("notes/test-published/figure.jpg")));
    assert.deepEqual(fs.readFileSync(output("notes/test-published/figure.jpg")), attachment);
    assert.ok(!fs.existsSync(output("notes/test-published/index.md")));
    const search = JSON.parse(fs.readFileSync(output("notes/search.json"), "utf8"));
    assert.equal(search.length, 1);
    assert.match(search[0].text, /Fulltextneedle/);
    assert.equal(search[0].url, "/notes/test-published/");
    build(true);
    assert.ok(fs.existsSync(output("notes/writing-example/index.html")));
    assert.ok(fs.existsSync(output("notes/writing-example/figure.jpg")));
    const draft = fs.readFileSync(output("notes/writing-example/index.html"), "utf8");
    assert.match(draft, /noindex/);
    fs.writeFileSync(file, source.replace("Test <title>", "Changed title").replace("draft: false", "draft: true"));
    build(false);
    assert.ok(!fs.existsSync(output("notes/writing-example")));
    assert.ok(!fs.existsSync(output("notes/test-published")));
    assert.deepEqual(JSON.parse(fs.readFileSync(output("notes/search.json"), "utf8")), []);
    assert.match(fs.readFileSync(output("notes/index.html"), "utf8"), /No notes published yet/);
    fs.writeFileSync(file, source.replace("Test <title>", "Changed title"));
    build(false);
    assert.match(fs.readFileSync(output("notes/test-published/index.html"), "utf8"), /Changed title/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
