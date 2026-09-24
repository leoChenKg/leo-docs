# 文档编写与 AI 协作规范

这份规范面向维护者和负责生成内容的 AI，负责当前 Leo Learn 已支持的写法与接入流程。主题划分、文章拆合、去重和图文选型统一见[内容与目录组织规范](./content-organization-guide.md)。开始任务前先阅读本文件、project-guide.md 和该组织规范，再读取目标空间现有的 space.yml、祖先目录 _index.md 和相邻文章。

当前项目已移除开发用示例空间。下文的 frontend、closure-counter 等名称只是语法示例，不表示对应文件已经存在。首次创建内容时从 docs/templates/ 开始，创建自己的 space.yml、目录首页和文章；不要继续引用尚未创建的示例路径或 Demo。

## 1. 内容模型

Leo Learn 不把文章存在数据库中。文件系统就是内容模型：

~~~text
spaces/frontend/
├── space.yml
├── _index.md
├── basics/
│   ├── _index.md
│   └── closure.mdx
├── assets/
└── components/demos/<name>/Demo.tsx
~~~

创建、修改、移动或删除内容时，直接操作对应文件。不要为新增文章修改 src/App.tsx、手工注册路由或编辑 src/generated/。

每个空间目录必须有非空的 space.yml。空间文件夹名与 space.yml.slug 应保持一致：当前 Demo 查找会根据 slug 匹配实际空间目录，二者不一致时空间专属 Demo 可能找不到。

## 2. AI 接任务的固定流程

1. 读取 docs/project-guide.md，确认项目能力和边界。
2. 读取 docs/content-organization-guide.md，按学习目标判断内容归属、拆合与表达方式。
3. 读取 spaces/<slug>/space.yml，确认空间名称和简介。
4. 读取目标目录到空间根目录之间的全部 _index.md/_index.mdx，确认术语、顺序和已有范围。
5. 读取目标目录中 2–3 篇相邻文章，确认已有讲解与示例，沿用合适的术语、代码风格和链接写法。
6. 检查目标目录下是否已有 assets、空间根下是否已有 components，以及是否有可复用的图示或 Demo；按解释需要选择，避免重复创建。

不要只根据历史 PRD、截图或 URL 猜测功能。要以源代码和当前可运行页面为准。

| 需求 | 文件 |
| --- | --- |
| 目录介绍、模块目标、阅读顺序 | 该目录的 _index.md |
| 文字、代码、公式、媒体、提示块 | .md |
| 需要 MUI 组件或 JSX 交互 | .mdx |
| 可在页面内操作的示例 | components/demos/<name>/Demo.tsx 加 Demo |
| 图片、视频、音频 | 当前空间的 assets |

只有在确实需要 JSX 时才使用 MDX。普通文章不要因为“未来可能扩展”而使用 MDX。

新文件优先使用稳定、简短、全小写的 kebab-case 目录和文件名：

~~~text
spaces/frontend/browser-runtime/event-loop.md
spaces/frontend/browser-runtime/_index.md
~~~

建议不要使用中文空格、混合大小写、特殊字符、数字前缀或自定义 slug。生成器会清洗路径，但正文相对链接解析使用原始相对路径，复杂命名容易让 URL 和链接不一致。

## 3. Front Matter 写法

文章和目录说明都建议以 Front Matter 开始：

~~~~md
---
title: 事件循环：从任务队列到渲染时机
description: 用一个可运行的例子理解宏任务、微任务和浏览器渲染之间的关系。
type: doc
tags:
  - JavaScript
  - 浏览器
  - 异步
order: 20
date: 2026-09-19
---

# 事件循环：从任务队列到渲染时机
~~~~

规则：

- title 是读者会搜索的完整标题。
- description 只写一句摘要，说明读者会学会什么或解决什么问题。
- type 用于搜索筛选，推荐 doc、project、reference；不要假设它会在文章头部显示徽标。
- tags 保持 2–5 个稳定主题词，用数组写法。
- order 只负责同一目录内排序；先看相邻文章的取值再插入合适间隔。
- date 是内容元数据，可被搜索使用；页面“最后更新于”优先取文件修改时间，不是这个字段。
- draft: true 或 hidden: true 的文章不会进入导航和搜索。
- 新内容通常不要写 slug。自定义 slug 会增加链接维护成本，且目录关联、相对链接不一定自动同步。

首个正文 H1 建议与 title 完全一致。渲染器会隐藏这个重复 H1，保留元数据标题；如果两者不一致，页面可能出现两个标题。

## 4. 内容组织与模板

目录与文章的职责、何时拆分或合并、如何保留完整示例，统一遵循[内容与目录组织规范](./content-organization-guide.md)。章节按主题需要选择，不按字数或行数分篇，也不要求每篇套用相同的小节。

- [目录总览模板](./templates/directory-index.md)：说明主题边界、文章分工和阅读路线。
- [文章模板](./templates/article.md)：围绕读者问题建立概念、示例、解释与边界。
- [Demo 模板](./templates/demo.md)：在交互有明确学习收益时说明接入、操作与验证。

复制模板时删除作者注释、不适用的小节和占位内容；替换标题、日期和链接。图示、表格、媒体与 Demo 都按解释需要选用，不是模板的必填项。

标题从 ## 开始递进，不要跳过层级。使用具体标题，例如“微任务为什么先于定时器执行”，不要使用“详解”“其他”“补充”等无法检索的标题。

## 5. Markdown 和 MDX 的准确边界

### 5.1 普通 Markdown

.md 支持标题、段落、列表、GFM 表格、任务列表、引用、删除线、脚注、链接、图片、代码围栏和数学公式。代码围栏会提供语法高亮和复制按钮。

公式使用 KaTeX：

~~~md
行内公式：$f(x)=x^2$。

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
~~~

图片使用相对资源路径：

~~~md
![事件循环示意图](../assets/event-loop.svg "事件循环")
~~~

### 5.2 .md 专用指令

以下简写由自定义解析器处理，只在普通 .md 中使用：

~~~md
:::warning 注意边界
这里是提示内容，内部仍可写 Markdown。
:::

:::chart bar 学习时间
阅读: 30
练习: 45
:::

{{"demo":"closure-counter"}}
~~~

提示类型：info、success、warning、error、tip。每个块必须有单独的结束行 :::，不要放在代码围栏内部。tip 实际按 info Alert 渲染。

:::chart line 当前仍使用水平条形图渲染，只是使用另一种颜色；它不是真正的折线图。需要折线、坐标轴、图例或复杂数据时使用 Vega-Lite。简易图表每行必须是“标签: 数字”；负数不会画成负轴。

### 5.3 .mdx 组件

.mdx 页面可以直接使用项目提供的组件，不需要重复 import：

Alert、AlertTitle、Tabs、Tab、Accordion、AccordionSummary、AccordionDetails、Chip、Tag、Tooltip、Box、Stack、Typography、Paper、Button、Divider、Table 系列、CodeBlock、Figure、Video、Audio、ReferenceList、GlossaryTerm、Demo、Mermaid、Chart。

~~~mdx
<Alert severity="info">
  <AlertTitle>关键点</AlertTitle>
  组件内容使用 JSX，但正文仍然可以继续写 Markdown。
</Alert>

<Figure src="../assets/diagram.svg" alt="模块关系图" caption="模块关系" />
<Demo name="closure-counter" title="在线体验" />
~~~

不要凭空创造未注入的组件名称；确需新组件时先修改运行时并补充本手册。

### 5.4 Mermaid 和 Vega-Lite

~~~~md
~~~mermaid
flowchart LR
  A[读取文件] --> B[生成索引]
  B --> C[渲染页面]
~~~
~~~~

~~~~md
~~~vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": {"values": [{"name": "阅读", "value": 30}]},
  "mark": "bar",
  "encoding": {
    "x": {"field": "name", "type": "nominal"},
    "y": {"field": "value", "type": "quantitative"}
  }
}
~~~
~~~~

语言标记为 vega 时当前也按 Vega-Lite JSON 渲染；为了避免误解，统一使用 vega-lite。图表错误会在页面内提示，仍需在浏览器实际检查。

## 6. 资源、链接与 Demo

是否需要图示或交互演示，先按[组织规范的选型原则](./content-organization-guide.md#6-主动选择有解释价值的图文表达)判断；本节只说明选定后的资源路径和接入方式。

资源原件放在当前空间的 assets 目录，生成器会复制它们：

~~~text
spaces/frontend/assets/
├── event-loop.svg
├── demo.mp4
└── explanation.mp3
~~~

支持图片、MP4/WebM/OGV 视频和 MP3/WAV/M4A/OGG/FLAC 音频：

~~~md
![流程图](../assets/event-loop.svg)
[观看录屏](../assets/demo.mp4)
[播放讲解](../assets/explanation.mp3)
~~~

不要引用 public/content 或 dist 中的生成路径；它们会被重建。相对路径以当前文档所在目录计算。

推荐新文件使用小写 kebab-case，并使用简单相对链接：

~~~md
[事件循环](./event-loop.md)
[父目录](../)
[闭包](../basics/closure.mdx)
~~~

渲染器会去掉链接中的 .md/.mdx 和 _index，但不会替你执行生成器对数字前缀、特殊字符或自定义 slug 的全部清洗。复杂路径先运行 npm run generate，从生成数据或实际页面确认最终 URL；移动文件后检查所有链接。

推荐 Demo 结构：

~~~text
spaces/frontend/components/demos/closure-counter/
├── Demo.tsx
└── fallback.md
~~~

Demo.tsx 必须默认导出 React 组件，并使用 MUI 组件。页面提供“交互预览 / 源码”页签和重置按钮；源码页签只展示 Demo.tsx，辅助文件如有必要应在正文另行说明，index.ts 不是接入要求：

~~~mdx
<Demo name="closure-counter" title="在线体验" />
~~~

或：

~~~md
{{"demo":"closure-counter"}}
~~~

Demo 名称只允许字母、数字、下划线、连字符和 /，不能包含 ..。查找顺序是当前空间的 components，再到根目录共享 components。fallback.md 可说明原理、操作方式和失败时的替代阅读路径。演示应只验证一个小概念，自适应窄屏，不依赖外部服务或不可控全局状态。

## 7. 搜索、阅读与可访问性

搜索覆盖标题、描述、标签、目录标题、章节标题、正文和代码文本。MDX 的导入语句、表达式、组件属性和 Demo 运行时生成文本不保证被索引。

为提高搜索质量：

- 首次出现写完整术语，例如“词法作用域（lexical scope）”。
- title 具体说明主题和问题。
- description 写读者收益，不复制整段正文。
- 标签保持稳定，通常 2–5 个。
- 用具体 h2/h3 标题；标题会成为右侧目录和章节搜索定位。
- 关键 API、命令和错误信息写在正文或代码中。

点击文章标签会打开搜索筛选。当前没有独立标签/专题索引页。

文章收藏和阅读位置只保存在当前浏览器来源。阅读记忆优先恢复标题锚点，再按滚动比例/位置恢复；带明确 #章节的链接优先。它们不需要在 Markdown 中增加字段。

## 8. 响应式与交付检查

- 1200px 以上左侧导航常驻；低于此宽度左侧改为抽屉。
- 767px 及以下隐藏右侧“本页目录”。
- 899px 及以下 Header 搜索输入框变为搜索按钮；600px 以下隐藏空间切换器。
- 表格、代码、Mermaid 和 KaTeX 长内容在自身区域横向滚动。
- 图片补充准确 alt；视频和音频提供 title；Demo 要能键盘操作。
- 浅色和深色模式都要检查，避免固定宽度和文字溢出。

完成内容后运行：

~~~bash
npm run check
npm run test:search
npm run test:bookmarks
npm run test:reading-memory
npm run build
~~~

只新增普通 .md 时至少运行 npm run check 并在浏览器打开页面；新增 MDX、Demo、媒体或图表时必须运行 build 并实际操作页面。tsconfig 只 include src，所以 Demo 仍需通过构建和浏览器验证。

## 9. 给 AI 的任务提示模板

~~~text
你正在维护 Leo Learn 本地静态文档站。请先阅读
docs/project-guide.md、docs/content-authoring-guide.md 和
docs/content-organization-guide.md，再读取目标空间的
space.yml、祖先目录 _index.md 和相邻文章。内容只能通过 spaces/ 下的
Markdown/MDX、assets 和 components 文件实现，不要修改 generated 文件，
不要新增页面编辑器。

任务：在 spaces/<space>/<directory>/ 下新增或修改 <文件名>。
目标读者：<读者>。
读者完成后应能：<能力>。
内容要求：<按主题确定必要的解释、示例和边界>。
按学习目标划分文章和目录，保留完整论证与可运行示例，不以字数或行数拆篇。
主动评估图示、表格和交互 Demo；只有能帮助理解时采用，不强行添加。
请使用项目已支持的组件和语法，提供准确 Front Matter、相对链接和可验证示例。
完成后运行 npm run check；如涉及 MDX、Demo 或资源，再运行 npm run build，
并说明验证结果。
~~~

任务完成后说明：修改了哪些文件、目录首页和普通文章的关系、使用了哪些已支持语法、运行了哪些检查、还有哪些需要人工在浏览器确认。
