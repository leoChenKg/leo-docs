# Demo 接入模板

先阅读 [内容与目录组织规范](../content-organization-guide.md)。只有读者通过操作参数、观察状态或比较结果，能比静态代码和图示更清楚地理解概念时才使用 Demo；文章不要求一律配 Demo。

复制时替换下列脚手架及示例说明，删除不适用内容。先明确要验证的一个问题和可观察结果，再编写组件；保留完整的“操作 → 观察 → 解释”。

目录：

~~~text
spaces/<space-slug>/components/demos/<demo-name>/
├── Demo.tsx
└── fallback.md
~~~

## Demo.tsx

~~~tsx
import { useState } from 'react';
import { Button, Stack, Typography } from '@mui/material';

export default function ExampleDemo() {
  const [value, setValue] = useState(0);
  return (
    <Stack spacing={2}>
      <Typography component="p" aria-live="polite">
        当前值：{value}，允许范围：0 到 3
      </Typography>
      <Button
        variant="contained"
        disabled={value === 3}
        onClick={() => setValue((current) => Math.min(3, current + 1))}
      >
        增加
      </Button>
      <Button
        variant="outlined"
        disabled={value === 0}
        onClick={() => setValue((current) => Math.max(0, current - 1))}
      >
        减少
      </Button>
    </Stack>
  );
}
~~~

这是“有界状态变化”的脚手架，不代表所有主题都需要计数器。示例正文可以写：

> 连续点击“增加”，观察值到 3 时按钮禁用，再点击“减少”。禁用状态向读者提示边界；更新函数中的限制保证状态保持在 0 到 3。使用 Demo 容器的重置按钮回到初始状态。

## fallback.md

文字回退应能独立解释结论，不能只写“加载失败，请刷新”。例如：

~~~md
这个演示说明如何约束状态范围。初始值为 0，增加时依次变为 1、2、3；
到 3 后“增加”不可用。减少到 0 后“减少”不可用。重置回到 0。
界面提示和更新函数共同维持边界；核心代码和解释见本文的状态更新示例。
~~~

当前运行时会在已找到 Demo 组件后的加载或渲染错误中显示此文件；未找到组件时显示固定提示。事件处理器或异步操作的错误需要组件自行处理。正文仍须独立说明关键结论和预期输出，不能用 fallback.md 代替。

## 文章接入与验证

在 MDX 中：

~~~mdx
<Demo name="<demo-name>" title="在线体验" />
~~~

在 Markdown 中：

~~~md
{{"demo":"<demo-name>"}}
~~~

Demo 默认导出 React 组件并使用 MUI。预览、源码和重置由项目的 Demo 容器提供，无需重复实现通用外壳。组件应能回到确定的初始状态，并在卸载时清理定时器、监听等资源。

交付前检查：

- 正文交代输入、操作、预期观察和原因，核心知识不只存在于交互界面中。
- 覆盖与主题有关的空输入、上下限、失败等边界；不要为凑数量添加无关控件。
- 若用浏览器模拟文件、线程、网络或其他运行环境，写明模拟范围与真实行为的区别；需要真实环境才能验证的结论，提供相应实验路径。
- 使用可聚焦、有清晰名称的控件，支持键盘；检查窄屏、深浅色以及回退文字，避免只通过颜色传达状态。
- 不依赖外部服务或不可控全局状态；运行 `npm run build`，在浏览器实际验证操作、预览、源码、重置及相关边界。
