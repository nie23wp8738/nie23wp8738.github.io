# DR.WANG 数学教学与习题库

网站地址 <https://nie23wp8738.github.io/>。本站提供课程讲义、分类练习与浏览器组卷。关于老师页面收录学历和教学经历。

## 本地预览

使用 Node.js 24，在项目目录运行 `npm ci` 和 `npm run dev`。运行 `npm run build` 生成 `dist/`。主分支由 GitHub Actions 自动构建并发布到 Pages。

## 更新题目和讲义

- 在 `src/data/problems.json` 维护原创或获准公开的练习。每个条目使用唯一、稳定的英文 `id`；该值同时决定题目链接和学生本地选题记录。
- 中文题名、课程标签、主题、方法和难度用于检索。英文题干、答案和解析同时用于网页和 PDF。组卷 PDF 目前使用内置西文字体，题干与解析请使用 ASCII 英文及数学记号（如 `x^2`），并在发布前测试 PDF。
- 在 `src/data/lessons.json` 维护课程。英文学生讲义位于 `public/handouts/`。讲义重新生成入口为 `scripts/build-handouts.py`。
- 在 `src/pages/about.astro` 更新教师学历与教学经历。
