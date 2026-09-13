import path from "node:path";
import { preview } from "../lib/notes.mjs";
export default {
  layout: "note.njk",
  language: "zh-CN",
  eleventyComputed: {
    permalink: data => data.page.inputPath.endsWith(".md")
      ? (data.draft && !preview() ? false : "/notes/" + path.basename(path.dirname(data.page.inputPath)) + "/")
      : "/notes/",
    eleventyExcludeFromCollections: data => Boolean(data.draft && !preview())
  }
};
