# Leo Learn · UI Design v2 Review

状态：待审核。此版本只定义新的视觉与交互方案，不代表已经修改生产页面。

## 1. 目标

页面改为更接近 MUI 文档站的轻量阅读界面：导航使用可独立展开的 MUI 列表，正文保持最大可读宽度，右侧目录使用滚动跟随的平面高亮。去掉左侧树形连线、节点圆点和所有表单描边。

## 2. 桌面布局

设计基准：`1440 × 900 px`。

| 区域 | 规格 |
| --- | ---: |
| Header | `64 px`，固定，白色/深色半透明，`backdrop-filter: blur(8px)` |
| 左侧导航 | `300 px`，MUI `Drawer`，无连线、无圆点 |
| 正文 | `760 px` 最大宽度 |
| 右侧目录 | `220 px`，左侧一条 divider |
| 栏间距 | `40 px` |
| 页面圆角 | `8 px` |

桌面页面结构：

```text
Header 64px
┌──────────────300px──────────────┬────────────760px────────────┬────220px────┐
│ 可展开文档导航                  │ Breadcrumbs                │ 本页目录     │
│                                │ 标题 / 摘要 / 元信息       │ 当前项高亮   │
│                                │ Alert / 正文 / Code / Demo │             │
└────────────────────────────────┴────────────────────────────┴─────────────┘
```

## 3. 左侧导航

### 3.1 视觉

- 使用 `List`、`ListItemButton`、`ListItemIcon`、`ListItemText`、`Collapse`，不绘制 CSS 连线和圆点。
- 每个目录行高度 `44 px`，水平内边距 `12 px`，圆角 `8 px`。
- 子目录通过 `pl: 2` 逐层缩进，只有留白表达层级。
- 目录右侧显示 `ExpandMore` / `ExpandLess`，点击目录行只切换该目录，不影响其他目录。
- 选中项同时改变背景、文字和图标颜色：`primary.main` 文字与图标，背景为 `alpha(primary.main, .08)`，左侧增加 `3 px` 主色指示条。
- 未选中项使用 `text.secondary`；鼠标悬停使用 `action.hover`。

### 3.2 展开逻辑

目录使用 `Set<string>` 保存展开状态，允许同时展开多个目录。点击含有子项的文件夹行或右侧箭头只切换该目录，叶子目录仍然负责路由跳转。当前路由的祖先目录在进入页面时自动加入集合，但不会关闭用户已经展开的其他目录。

动画使用 MUI `Collapse`：

```tsx
<Collapse in={expanded.has(directory.route)} timeout={220} unmountOnExit>
  <List disablePadding>{children}</List>
</Collapse>
```

### 3.3 审核数据

进入 `/spaces/frontend/basics/closure` 时：

```json
{
  "expanded": ["/spaces/frontend/basics", "/spaces/frontend/projects"],
  "selected": "/spaces/frontend/basics/closure",
  "visibleChildren": {
    "/spaces/frontend/basics": [
      "JavaScript 简介",
      "闭包：让函数记住状态",
      "作用域与变量提升",
      "this 与执行上下文",
      "原型与原型链",
      "异步编程"
    ],
    "/spaces/frontend/projects": [
      "工程化配置",
      "组件开发实战",
      "状态管理",
      "调试与性能优化"
    ]
  }
}
```

## 4. Header 与表单

Header 从左到右：

1. `MenuBookOutlined` 与“文档”。
2. 文档空间选择器。
3. 填充式搜索框，右侧显示 `⌘ K`。
4. `LightModeOutlined` / `DarkModeOutlined`。
5. `AccountCircleOutlined` 或当前用户占位头像。

空间选择器和搜索框使用 MUI `FilledInput` / `TextField variant="filled"`：

- 不显示 outline 和 underline：`disableUnderline: true`。
- 浅色背景为 `grey[50]`，深色背景为 `primaryDark[800]`。
- 聚焦只提高填充背景对比度，不出现边框。
- 所有可点击区域至少 `44 × 44 px`。

## 5. 右侧“本页目录”

- 外层固定宽度 `220 px`，`position: sticky`，顶部距离 Header `88 px`。
- 不显示圆点、时间线或多级连接线，只保留一条 `1 px divider`。
- 每个条目最小高度 `32 px`，水平内边距 `12 px`，圆角 `6 px`。
- 当前可见标题由 `IntersectionObserver` 驱动，并设置 `aria-current="location"`。
- 当前项使用与左侧导航一致的填充背景和 `primary.main` 文字，不再显示左侧指示条。
- 点击后滚动到对应标题，标题统一使用 `scroll-margin-top: 88px`。

## 6. 响应式规则

| 宽度 | 行为 |
| --- | --- |
| `≥ 1200 px` | 左导航 permanent，右侧目录显示 |
| `900–1199 px` | 首先隐藏左导航，改为 temporary Drawer；右侧目录仍显示 |
| `< 900 px` | 右侧目录隐藏；正文使用单列 |
| `< 600 px` | Header 搜索变为按钮并打开 Dialog；正文左右内边距 `16 px` |

这保证页面变窄时最先让出空间的是左侧导航，而不是文章右侧目录。

## 7. 颜色与组件

继续使用当前 `src/theme.ts` 中与 MUI docs brandingTheme 对齐的 palette：

- 浅色背景 `#fff`，正文 `hsl(215, 15%, 12%)`，主色 `hsl(210, 100%, 45%)`。
- 深色背景 `hsl(210, 14%, 7%)`，正文 `#fff`，主色 `hsl(210, 100%, 60%)`。
- 代码面板两种模式统一使用 `hsl(210, 25%, 9%)` Okaidia 配色。
- 提示框继续使用 MUI `Alert`，状态颜色沿用 MUI docs 的 info / success / warning / error 语义。

图标全部来自 `@mui/icons-material`，不再使用自绘或临时字符图标：

| 用途 | 图标 |
| --- | --- |
| 文档品牌 | `MenuBookOutlined` |
| 概览 | `HomeOutlined` |
| 目录 | `FolderOutlined` |
| 文档 | `ArticleOutlined` |
| 展开/收起 | `ExpandMore` / `ExpandLess` |
| 搜索 | `Search` |
| 主题 | `LightModeOutlined` / `DarkModeOutlined` |
| 用户 | `AccountCircleOutlined` |

## 8. 验收条件

1. 左侧可同时展开 `基础语法与运行时` 和 `项目实践`，两者互不影响，并有平滑展开/收起动画。
2. 选中文档的文字和图标明确变为主色。
3. 右侧目录随滚动更新当前项，点击条目后高亮与滚动位置一致。
4. 搜索框、空间选择器等表单控件没有 outline 或 underline。
5. 页面变窄时先隐藏左侧导航，右侧目录后隐藏。
6. 所有图标均来自 MUI icons，且移动端触控区域不小于 `44 px`。
