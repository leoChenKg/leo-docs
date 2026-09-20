# Leo Learn · UI Design v1

> 状态：已按最新反馈修订（移除左侧连线，校正 MUI 浅深色配色）
> 适用范围：文档阅读页、空间导航、顶部 Header、右侧文章目录
> 还原基准：上一版深色 MUI Docs 风格预览图

## 1. 还原原则

这份规格是实现页面的唯一视觉基准。实现时只能使用这里定义的尺寸、颜色、间距、层级和数据；未定义的视觉行为必须先补充到本文件再实现。

- 使用 MUI 组件承载交互和无障碍行为，不重新发明 Button、Select、Drawer、Tooltip、Tabs 等基础组件。
- 左侧目录使用 MUI `ListItemButton` 构成层级导航；不绘制额外的连线或圆点，层级通过缩进、文件夹/文档图标和当前项状态表达。
- Header 必须是半透明磨砂层，不能替换为纯色实心栏。
- 桌面端保留左导航、正文、右侧目录三列；移动端只折叠导航和右侧目录，不改变正文信息层级。
- 预览中的中文文案、目录顺序、选中状态和代码内容作为验收数据，不得随意替换。

## 2. 画布与布局

### 2.1 桌面基准

设计基准画布为 `1600 × 900 px`。

| 区域 | 固定值 | 说明 |
| --- | ---: | --- |
| Header 高度 | `68 px` | 固定在顶部，覆盖内容滚动层 |
| 左侧导航宽度 | `348 px` | 包含右侧分割线 |
| 右侧目录宽度 | `316 px` | 包含左侧分割线 |
| 正文可读宽度 | `880 px` | 正文内容最大宽度 |
| 正文左内边距 | `42 px` | 从正文列起始位置计算 |
| 正文右内边距 | `42 px` | 与右侧目录保持呼吸空间 |
| 页面最小宽度 | `320 px` | 小于此宽度允许页面横向滚动 |
| 栏间分割线 | `1 px` | 使用 `divider` 色 |

页面结构：

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header 68px（半透明 + blur）                                                 │
├───────────────348px──────────────┬──────────────880px──────────────┬─316px─┤
│ 左侧树形导航                       │ 正文阅读区                      │ 本页目录 │
│                                   │                                │         │
└───────────────────────────────────┴────────────────────────────────┴─────────┘
```

### 2.2 移动端

| 断点 | 行为 |
| --- | --- |
| `< 900 px` | 左侧导航变为 MUI `Drawer variant="temporary"`；Header 显示菜单按钮 |
| `< 720 px` | Header 隐藏桌面空间 Select，空间 Select 放入 Drawer 顶部 |
| `< 600 px` | Header 搜索变为图标按钮并打开 MUI `Dialog`；正文水平内边距 `16 px` |
| `< 480 px` | 正文标题最大字号 `32 px`；代码块、表格和公式容器允许内部横向滚动 |

移动端不显示右侧“本页目录”，目录内容通过正文内的标题和 Drawer 访问。

## 3. 颜色 Token

颜色与 MUI 文档仓库的 `brandingTheme` 保持一致。浅色和深色均由 `createDocsTheme(mode)` 提供，组件通过 MUI theme 和 `sx` 使用这些 Token。

```ts
export const brandingThemeTokens = {
  light: {
    canvas: '#fff', primary: 'hsl(210, 100%, 45%)', textPrimary: 'hsl(215, 15%, 12%)',
    textSecondary: 'hsl(215, 15%, 22%)', divider: 'hsl(215, 15%, 92%)',
  },
  dark: {
    canvas: 'hsl(210, 14%, 7%)', primary: 'hsl(210, 100%, 60%)', textPrimary: '#fff',
    textSecondary: 'hsl(215, 15%, 75%)', divider: 'hsla(210, 14%, 28%, 0.3)',
  },
  codeBackground: 'hsl(210, 25%, 9%)',
  codeBorder: 'hsl(210, 14%, 13%)',
  codeText: 'hsl(60, 30%, 96%)',
};
```

Header 使用：

```ts
bgcolor: alpha(theme.palette.background.default, 0.6),
backdropFilter: 'blur(8px)',
borderBottom: 1,
borderColor: 'divider',
```

Header 不允许使用完全不透明的 `background: #10161E` 替代。

## 4. 字体与间距

```ts
fontFamily: 'Inter, "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
```

| 用途 | MUI 规格 | 颜色 | 行高 |
| --- | --- | --- | --- |
| Logo | `h6`, `700` | `textPrimary` | `1.2` |
| 正文页面标题 | `h3`, `800` | `textPrimary` | `1.2` |
| 正文副标题 | `h6`, `400` | `textSecondary` | `1.6` |
| 正文段落 | `body1`, `400` | `textSecondary` | `1.85` |
| 目录项 | `body2`, `500` | `textSecondary` | `1.5` |
| 当前目录项 | `body2`, `650` | `textPrimary` | `1.5` |
| 右侧目录 | `caption`, `500` | `textSecondary` | `1.5` |
| 代码 | `0.8125rem` | `textPrimary` | `1.7` |

基础间距只使用 `4 / 8 / 12 / 16 / 24 / 32 / 40 px`。

## 5. Header 设计

从左到右固定排列：

1. `Menu`：仅移动端显示，触控区域 `44 × 44 px`。
2. Logo 图标：MUI `Code`，颜色 `primary`，尺寸 `24 px`。
3. Logo 文案：`文档`，字号 `20 px`，字重 `700`。
4. 垂直分割线：高度 `28 px`，左右间距 `20 px`。
5. 空间 Select：标签 `文档空间`，宽度 `196 px`，高度 `44 px`。
6. 中央搜索框：宽度 `500 px`，高度 `44 px`，左侧 Search 图标，右侧显示 `⌘ K`。
7. 右侧主题按钮：MUI `IconButton`，触控区域 `44 × 44 px`。
8. 右侧用户占位圆：直径 `40 px`，文案 `F`，背景 `primary`。

搜索框和 Select 使用 MUI `OutlinedInput` / `Select`，边框颜色为 `divider`，悬停为 `text.secondary`，聚焦为 `primary.main`。

## 6. 左侧树形导航

### 6.1 固定层级结构

左侧导航内容区域内边距：顶部 `28 px`、左右 `20 px`。

- “概览”是一级入口，使用 MUI `HomeOutlined`，高度 `44 px`。
- “文档目录”是 `overline` 标签，顶部间距 `28 px`，底部间距 `12 px`。
- 目录项高度 `48 px`，圆角 `8 px`。
- 一级目录左侧起点 `20 px`。
- 每深入一级，左侧缩进 `16 px`。
- 当前项使用 MUI `selected` 状态和主题色背景，文字使用 `text.primary`。
- 当前路由及其祖先目录自动展开；切换到其他分支时，原分支自动收起。
- 目录图标使用 MUI `FolderOutlined`，文档图标使用 MUI `ArticleOutlined`。

### 6.2 MUI 组件映射

| 视觉对象 | MUI 组件 |
| --- | --- |
| 导航容器 | `Drawer` / `Box` |
| 导航条目 | `ListItemButton` |
| 图标 | `ListItemIcon` |
| 文案 | `ListItemText` |
| 展开收起 | 按当前路由条件渲染嵌套 `List` |
| 空间选择 | `FormControl` + `Select` |

目录层级通过 `List` 的嵌套缩进表达，条目本身必须使用 MUI `ListItemButton`。

## 7. 正文阅读区

正文区固定最大宽度 `880 px`，实际文章列最大宽度 `760 px`。

内容顺序：

1. Breadcrumbs：`文档空间 / 基础语法与运行时 / 闭包：让函数记住状态`
2. 页面标题
3. 页面摘要
4. 更新日期和 Tags
5. Divider
6. 正文内容
7. Demo / 图表 / 代码 / 媒体
8. 上一篇 / 下一篇

代码块：

- 背景 `codeBackground`。
- 边框 `codeBorder`。
- 圆角 `8 px`。
- 顶部语言栏高度 `36 px`。
- 右侧复制按钮触控区域 `44 × 44 px`。
- 代码区横向滚动，不允许撑破正文布局。

## 8. 右侧“本页目录”

- 宽度 `220 px`，顶部距离 Header `96 px`。
- 标题使用 `overline`，文案固定为 `本页目录`。
- 左侧竖线宽度 `1 px`，颜色 `divider`。
- 普通节点直径 `8 px`，浅色为 `grey[600]`，深色为 `grey[500]`。
- 当前节点直径 `12 px`，颜色 `primary`。
- 一级标题左侧缩进 `20 px`，二级标题左侧缩进 `36 px`。
- 点击目录使用 hash 锚点滚动，标题需要 `scroll-margin-top: 96px`。

## 9. 验收数据

以下数据必须作为第一版预览的固定内容。数据来自预览图中的页面，不允许改名、换序或减少节点。

```json
{
  "space": {
    "slug": "frontend",
    "title": "前端工程",
    "selectorLabel": "文档空间"
  },
  "currentRoute": "/spaces/frontend/basics/closure",
  "breadcrumbs": [
    { "title": "前端工程", "route": "/spaces/frontend" },
    { "title": "基础语法与运行时", "route": "/spaces/frontend/basics" },
    { "title": "闭包：让函数记住状态", "route": "/spaces/frontend/basics/closure" }
  ],
  "navigation": [
    {
      "id": "basics",
      "kind": "directory",
      "title": "基础语法与运行时",
      "route": "/spaces/frontend/basics",
      "expanded": true,
      "children": [
        {
          "id": "javascript-intro",
          "kind": "document",
          "title": "JavaScript 简介",
          "route": "/spaces/frontend/basics/javascript-intro"
        },
        {
          "id": "closure",
          "kind": "document",
          "title": "闭包：让函数记住状态",
          "route": "/spaces/frontend/basics/closure",
          "selected": true
        },
        {
          "id": "scope",
          "kind": "document",
          "title": "作用域与变量提升",
          "route": "/spaces/frontend/basics/scope"
        },
        {
          "id": "this",
          "kind": "document",
          "title": "this 与执行上下文",
          "route": "/spaces/frontend/basics/this"
        },
        {
          "id": "prototype",
          "kind": "document",
          "title": "原型与原型链",
          "route": "/spaces/frontend/basics/prototype"
        },
        {
          "id": "async",
          "kind": "document",
          "title": "异步编程",
          "route": "/spaces/frontend/basics/async"
        }
      ]
    },
    {
      "id": "projects",
      "kind": "directory",
      "title": "项目实践",
      "route": "/spaces/frontend/projects",
      "expanded": true,
      "children": [
        { "id": "tooling", "kind": "document", "title": "工程化配置", "route": "/spaces/frontend/projects/tooling" },
        { "id": "components", "kind": "document", "title": "组件开发实战", "route": "/spaces/frontend/projects/components" },
        { "id": "state", "kind": "document", "title": "状态管理", "route": "/spaces/frontend/projects/state" },
        { "id": "performance", "kind": "document", "title": "调试与性能优化", "route": "/spaces/frontend/projects/performance" }
      ]
    },
    {
      "id": "faq",
      "kind": "directory",
      "title": "常见问题",
      "route": "/spaces/frontend/faq",
      "expanded": true,
      "children": [
        { "id": "interview", "kind": "document", "title": "面试题精选", "route": "/spaces/frontend/faq/interview" },
        { "id": "debugging", "kind": "document", "title": "错误与排查", "route": "/spaces/frontend/faq/debugging" },
        { "id": "best-practices", "kind": "document", "title": "最佳实践", "route": "/spaces/frontend/faq/best-practices" }
      ]
    }
  ],
  "onThisPage": [
    { "title": "什么是闭包？", "id": "what-is-closure", "active": true },
    { "title": "示例代码", "id": "example-code" },
    { "title": "在线体验", "id": "interactive-demo" },
    { "title": "闭包的应用场景", "id": "use-cases" },
    { "title": "注意事项", "id": "notes" },
    { "title": "小结", "id": "summary" }
  ]
}
```

## 10. 页面文案验收数据

预览图中的正文至少包含以下固定内容：

```json
{
  "title": "闭包：让函数记住状态",
  "description": "闭包是 JavaScript 中一个非常重要且常见的概念。通过闭包，函数可以“记住”并访问其创建时的词法作用域，即使函数在其词法作用域之外执行。",
  "alert": {
    "severity": "info",
    "title": "关键点",
    "body": "闭包并不是一个特殊的语法，而是一种由作用域规则自然产生的行为。任何函数只要引用了其外部作用域的变量，就会形成闭包。"
  },
  "code": {
    "language": "JavaScript",
    "lines": [
      "function createCounter() {",
      "  let count = 0;",
      "  return function () {",
      "    count += 1;",
      "    return count;",
      "  };",
      "}",
      "const counter = createCounter();"
    ]
  },
  "demo": {
    "title": "在线体验",
    "button": "点击 +1",
    "valueLabel": "当前计数：",
    "initialValue": 0
  }
}
```

## 11. 实现完成标准

- 在 `1600 × 900` 截图中，Header、左树、正文、右目录的边界与本规格一致。
- 左侧目录使用 MUI 条目缩进表达层级，当前路由及其祖先目录自动展开。
- 当前项只能有一个，且使用 MUI `selected` 状态和主题主色文字/背景。
- Header 背景可以看到下方内容的透出和模糊效果。
- 所有按钮、Select、Drawer、Dialog、Tabs 均来自 MUI。
- 在 `360 px` 宽度下不出现页面级横向溢出；代码、表格、公式只在自身容器内滚动。
- 导航数据、正文文案和右侧目录使用第 9、10 节的固定数据。
