import { useRef, useState } from 'react';
import { Box, Button, Chip, Slider, Stack, Typography } from '@mui/material';

// count lives inside this function. Each returned object retains its own state.
function createCounter() {
  let count = 0;
  return { increment: (step: number) => { count += step; return count; } };
}

export default function ClosureCounter() {
  const counter = useRef<ReturnType<typeof createCounter> | null>(null);
  if (!counter.current) counter.current = createCounter();
  const [value, setValue] = useState(0);
  const [step, setStep] = useState(1);
  return <Stack spacing={3}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
      <Box><Typography variant="body2" color="text.secondary">闭包保存的 count</Typography><Typography variant="h3" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{value}</Typography></Box>
      <Chip label="同一个词法环境" color="primary" variant="outlined" />
    </Stack>
    <Box sx={{ px: 1 }}><Typography id="closure-step-label" variant="body2">每次变化：{step}</Typography><Slider aria-labelledby="closure-step-label" value={step} min={1} max={5} marks step={1} valueLabelDisplay="auto" onChange={(_, next) => setStep(Number(next))} /></Box>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => setValue(counter.current!.increment(-step))}>减少 {step}</Button>
      <Button variant="contained" sx={{ minHeight: 44 }} onClick={() => setValue(counter.current!.increment(step))}>增加 {step}</Button>
    </Stack>
    <Typography variant="body2" color="text.secondary">每次点击都调用同一个闭包。右上角的重置按钮会创建一个全新的计数器。</Typography>
  </Stack>;
}
