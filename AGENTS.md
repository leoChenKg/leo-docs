# Leo Learn 内容任务入口

这是一个由文件驱动的本地静态文档站。新增或修改网站内容时，先阅读：

1. [项目介绍与运行手册](docs/project-guide.md)
2. [文档编写与 AI 协作规范](docs/content-authoring-guide.md)
3. 对应空间的 `space.yml`、祖先目录 `_index.md` 和相邻文章

内容只能通过 `spaces/` 下的 Markdown/MDX、`assets/` 和 `components/` 文件维护。不要手工编辑 `src/generated/`、`public/content/` 或 `dist/`，不要为新增文章注册路由或增加页面编辑器。

新增普通文章至少运行 `npm run check`；新增 MDX、Demo、媒体或图表时运行 `npm run build`，并在浏览器实际检查页面。任务完成后说明修改文件、使用的已支持语法和验证结果。
