# 笔记维护指南

## 第一次使用

在网站仓库目录安装 Node.js 22 或更新版本，然后运行：

```sh
npm ci
npm run dev
```

打开终端提示的本地网址（默认 http://localhost:8080/notes/）。本地预览包含草稿，保存后自动刷新。按 Ctrl+C 关闭预览。

## 新建笔记

```sh
npm run new:note -- finite-strain "有限应变学习笔记"
```

也可以不用命令：新建 `notes/finite-strain/` 文件夹，把 `templates/note.md` 复制进去并改名为 `index.md`。

用 Typora 打开 `index.md`，或用 Obsidian 将仓库中的 `notes` 文件夹作为库打开。每篇文章结构如下：

```text
notes/finite-strain/
  index.md
  figure.png
  images/
    result.jpg
```

文件夹名只用英文小写字母、数字和连字符，它决定永久网址 `/notes/finite-strain/`。发布后不要随意改文件夹名，文章标题可以随时改。

## 文件顶部信息

```yaml
---
title: 有限应变学习笔记
date: '2026-09-13'
updated: '2026-09-14'
description: 关于变形梯度和应变度量的阅读笔记。
tags: [Mechanics, Mathematics]
language: zh-CN
draft: true
---
```

- `title` 和 `date` 必填；日期使用带引号的 YYYY-MM-DD。
- `updated` 可省略，只在实质修改时更新；不能早于发布日期。
- `description` 是列表摘要；不填时取正文第一段。
- `tags` 用于筛选，标签名保持统一；没有标签写 `[]`。
- `language` 为 `zh-CN` 或 `en`。
- `draft: true` 仅本地预览；准备发布时改为 `false`（不加引号）。

## 正文格式

直接写 Markdown，不需要编辑 HTML。不要在正文重复写一级标题；用 `##` 和 `###` 生成目录。

- 数学：行内 `$J = \det F$`，独立公式使用单独两行 `$$` 包围 LaTeX。
- 代码：使用三个反引号，后面标注 `python`、`cpp` 等语言名。
- 图片：`![图片说明](figure.png)`，或 `![结果](images/result.jpg)`。
- 附件链接：`[下载 PDF](supplement.pdf)`。
- Obsidian 请使用标准 Markdown 图片和链接，不使用 `![[图片]]`、Dataview 或插件专属语法。推荐设置新链接格式为相对路径，关闭 Wikilinks。

支持复制到网站的附件格式：PNG、JPG、JPEG、WebP、GIF、AVIF、SVG、PDF、MP4、WebM、MP3、OGG。附件放在文章文件夹内。不要链接本机绝对路径。

本地草稿 `notes/writing-example/index.md` 展示了公式、代码、图片和表格。它不会出现在正式网站。

## 发布

1. 在本地预览中检查文章，将 `draft` 改为 `false`。
2. 用 GitHub Desktop 提交修改并 Push，或使用平时的 git commit / git push。
3. GitHub Actions 的 **Deploy website** 完成后，网站自动更新，不需要手动维护列表或上传 HTML。

仅发布后的文章参与正式网站搜索。草稿页面和附件不会进入部署包，但**这个仓库是公开的，提交到 GitHub 的草稿源文件仍然公开可见**。私密笔记不要放进仓库提交。

撤下文章时设为 `draft: true` 并提交推送，或删除文章文件夹；下次部署会移除页面和对应附件。不要提交 `node_modules`、`_site`、`.obsidian`。

## 检查与排错

```sh
npm test
npm run build
```

构建生成 `_site/`，其中只包含正式发布内容。构建失败时先检查报错中的文件名、顶部 YAML 信息、日期和公式。GitHub 上打开 Actions → Deploy website 查看线上构建日志。已有主页、Research、Publications 等仍直接编辑对应 HTML 文件。
