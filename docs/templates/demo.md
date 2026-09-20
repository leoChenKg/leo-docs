# Demo 接入模板

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
      <Typography>当前值：{value}</Typography>
      <Button variant="contained" onClick={() => setValue((current) => current + 1)}>
        增加
      </Button>
    </Stack>
  );
}
~~~

在 MDX 中：

~~~mdx
<Demo name="<demo-name>" title="在线体验" />
~~~

在 Markdown 中：

~~~md
{{"demo":"<demo-name>"}}
~~~

Demo 应只验证一个概念，使用 MUI 组件，支持键盘和窄屏，并提供清晰的失败说明。完成后运行 `npm run build` 并在浏览器中点击预览、源码和重置。
