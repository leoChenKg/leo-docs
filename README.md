# Leo Learn

本地使用的静态学习文档站。内容只来自 `spaces/` 下的 Markdown/MDX 文件，保存文件后开发服务器会自动重新生成空间导航。

## 启动

```bash
npm install
npm run dev
```

然后打开 `http://localhost:5173`。生产构建使用 `npm run build`，构建结果位于 `dist/`。

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

`space.yml` 至少需要 `slug` 和 `title`。目录可以任意嵌套，`_index.md` 会成为空间或目录首页。

文档支持 `title`、`description`、`type`、`tags`、`date`、`order`、`draft` 等 Front Matter 字段。图片使用标准 Markdown 图片语法；指向本地 MP4/WebM/MP3/WAV 的 Markdown 链接会自动渲染为播放器。

## 内容块

```md
:::info 提示标题
这里是 MUI Alert 风格的提示。
:::

{{"demo":"closure-counter"}}

:::chart bar 学习时间
阅读: 30
练习: 45
:::
```

提示块支持 `info`、`success`、`warning`、`error` 和 `tip`。公式使用 KaTeX 的 `$...$` 或 `$$...$$` 语法。

`.mdx` 文档还可以直接使用 `Alert`、`Tabs`、`Accordion`、`Figure`、`Video`、`Audio`、`Demo`、`Mermaid` 和 `Chart` 等组件。代码围栏使用 `mermaid` 或 `vega-lite` 语言标记即可渲染对应图表。
