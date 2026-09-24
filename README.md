# Leo Learn

Leo Learn 是一个由文件驱动的静态学习文档站，支持本地运行和 GitHub Pages 在线访问。内容直接维护在 `spaces/` 下的 Markdown/MDX、资源和 Demo 文件中；开发服务器会自动重新生成空间导航、目录页和搜索数据。

[在线访问](https://leochenkg.github.io/leo-docs/) · [部署工作流](https://github.com/leoChenKg/leo-docs/actions/workflows/pages.yml)

当前包含“桌面端 → 应用交付 → 发布流程”。新增空间可参考下方示例。

项目说明和长期维护规范：

- [项目介绍与运行手册](docs/project-guide.md)：架构、启动、构建、路由、浏览器状态和排错。
- [文档编写与 AI 协作规范](docs/content-authoring-guide.md)：Front Matter、Markdown/MDX、资源、Demo、模板和验收清单。
- [内容与目录组织规范](docs/content-organization-guide.md)：按学习目标划分主题、拆分与合并文章、去重，以及按需选用图示和交互 Demo。
- [目录总览模板](docs/templates/directory-index.md)、[文章模板](docs/templates/article.md)、[Demo 模板](docs/templates/demo.md)。

## 启动

```bash
npm install
npm run dev
```

然后打开 `http://localhost:5173`。生产构建使用 `npm run build`，构建结果位于 `dist/`。

## 在线发布

推送到 `master` 后，GitHub Actions 会运行测试、构建并发布到 GitHub Pages。文章链接支持直接打开和刷新。部署子路径由 `VITE_BASE_PATH` 指定，当前站点使用 `/leo-docs/`；完整配置和本地预览方式见[运行手册](docs/project-guide.md#github-pages)。

## 新增文档空间

```text
spaces/
└── my-space/
    ├── space.yml
    ├── _index.md
    ├── notes/
    │   ├── _index.md
    │   └── first-note.md
    └── assets/
```

`space.yml` 是空间配置；建议显式填写 `slug` 和 `title`，缺省时生成器会回退到空间目录名。目录可以任意嵌套，`_index.md` 会成为空间或目录首页。

目录节点只要包含子目录或文档，就会自动拥有一个目录总览地址。若目录中没有 `_index.md`，页面会展示该目录下的子内容，并提示创建 `spaces/<空间目录>/<目录路径>/_index.md`；创建后即可直接编辑标题、简介、正文和组件内容，作为该模块的统一说明。侧边栏中点击文件夹整行会打开目录总览并切换展开/收起状态；多级目录可以同时展开多个分支。

文档支持 `title`、`description`、`type`、`tags`、`date`、`order`、`draft` 等 Front Matter 字段。`tags` 用于文章分类和搜索筛选，支持字符串或数组，构建时会自动去重并忽略空值。例如：

```yaml
tags: [JavaScript, 异步]
```

图片使用标准 Markdown 图片语法；指向本地 MP4/WebM/OGV/MP3/WAV/M4A/OGG/FLAC 的 Markdown 链接会自动渲染为播放器。完整内容边界、链接规则和 AI 生成流程见上面的项目手册与内容规范。

## 内容块

```md
:::info 提示标题
这里是 MUI Alert 风格的提示。
:::

{{"demo":"my-demo"}}

:::chart bar 学习时间
阅读: 30
练习: 45
:::
```

提示块支持 `info`、`success`、`warning`、`error` 和 `tip`。公式使用 KaTeX 的 `$...$` 或 `$$...$$` 语法。

`.mdx` 文档还可以直接使用 `Alert`、`Tabs`、`Accordion`、`Figure`、`Video`、`Audio`、`Demo`、`Mermaid` 和 `Chart` 等组件。代码围栏使用 `mermaid` 或 `vega-lite` 语言标记即可渲染对应图表。

## 搜索

- 点击 Header 搜索或按 `Cmd/Ctrl + K` 打开即时搜索；上下键选择结果，回车打开，Esc 关闭。
- 支持中文、英文、不区分大小写的部分匹配；多个关键词用空格分隔，文档需要同时包含这些关键词（可以出现在不同字段）。
- 按标题、标签、章节标题、简介、目录、正文的优先级排序，也可按最近更新排序。正文和代码均可检索。
- 支持空间、标签、文档类型组合筛选；无关键词时可只用筛选条件浏览文档。
- 搜索结果显示空间/目录、标签与正文匹配片段，关键词高亮；匹配到章节标题时可直接定位该章节。
- 完整搜索页的关键词和筛选条件保存在 URL 中，可刷新、复制链接并通过浏览器前进/后退恢复。

搜索数据在启动、构建及内容变更时自动生成到 `src/generated/search.ts`，不需要手工维护。隐藏空间、`draft: true` 或 `hidden: true` 的文档以及自动生成的空目录不会进入索引；搜索不调用外部服务。

搜索逻辑和内容提取测试：`npm run test:search`（Node.js 22.18+ 或 24+）。

## 本地收藏

- 在文章标题下方点击“收藏”或“已收藏”，添加或取消收藏；Header 的书签图标进入“我的收藏”。
- 收藏页按收藏时间倒序显示，支持关键词和文档空间筛选，也可直接打开文章或取消收藏。
- 标题、简介和标签优先显示当前文档内容。修改文档路由后按源文件路径匹配；移动文件但保留原路由也可匹配。源文件和路由均变化时，旧收藏会显示“文档暂不可用”，不会自动删除。
- 数据仅保存在当前浏览器的网站存储中，不写入 Markdown，也不需要后台。不同浏览器、域名、端口间不共享；清除网站数据会移除收藏。同一网站的多个标签页会同步更新。
- 浏览器存储不可用或写入失败时会显示错误，收藏状态只在成功保存后更新。

收藏数据测试：`npm run test:bookmarks`。
