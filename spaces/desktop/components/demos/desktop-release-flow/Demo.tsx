import { useId, useState } from 'react';
import {
  Alert, Box, Button, Chip, FormControl, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Typography,
} from '@mui/material';
import { canAdvance, getExample, getSnapshot, getSteps, phases, type Arch, type GateResult } from './flow';

function Value({ label, value }: { label: string; value: string }) {
  return <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
  </Box>;
}

export default function DesktopReleaseFlowDemo() {
  const [arch, setArch] = useState<Arch>('arm64');
  const [position, setPosition] = useState(0);
  const [result, setResult] = useState<GateResult>('pending');
  const id = useId();
  const steps = getSteps(arch);
  const step = steps[position];
  const example = getExample(arch);
  const snapshot = getSnapshot(arch, position);
  const phaseIndex = phases.findIndex((item) => item.id === step.phase);
  const finished = position === steps.length - 1;
  const move = (next: number) => {
    setPosition(Math.max(0, Math.min(next, steps.length - 1)));
    setResult('pending');
  };
  const selectStyle = { '&& .MuiSelect-select': { whiteSpace: 'normal', overflowWrap: 'anywhere', height: 'auto' } };

  return <Stack spacing={2.5} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
    <Box>
      <Typography component="h3" variant="h6">跟着一个安装包走完发布流程</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        学生端 Mac 正式包 · 示意版本 0.0.2 / 构建号 90002。所有操作仅在本页模拟，不会发起真实构建或发布。
      </Typography>
    </Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
      <FormControl size="small" sx={{ minWidth: { sm: 220 } }} disabled={position > 0}>
        <InputLabel id={`${id}-arch-label`}>目标架构</InputLabel>
        <Select labelId={`${id}-arch-label`} id={`${id}-arch`} value={arch} label="目标架构"
          onChange={(event) => setArch(event.target.value as Arch)} sx={selectStyle}>
          <MenuItem value="arm64">Mac ARM64</MenuItem>
          <MenuItem value="x64">Mac x64</MenuItem>
        </Select>
      </FormControl>
      <Typography variant="body2" color="text.secondary">student · ONLINE · feature-electron12</Typography>
    </Stack>

    <Box component="ol" aria-label="构建与发布进度" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1,
      gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' } }}>
      {phases.map((phase, index) => <Box component="li" key={phase.id}
        aria-current={phase.id === step.phase ? 'step' : undefined}
        sx={{ p: 1.25, border: 1, borderRadius: 1.5, minWidth: 0,
          borderColor: index === phaseIndex ? 'primary.main' : 'divider',
          bgcolor: index === phaseIndex ? 'action.selected' : 'background.paper' }}>
        <Typography variant="caption" color={index <= phaseIndex ? 'primary.main' : 'text.secondary'}>
          {index + 1} · {index < phaseIndex || finished ? '已完成' : index === phaseIndex ? '进行中' : '待开始'}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: index === phaseIndex ? 700 : 400 }}>{phase.label}</Typography>
      </Box>)}
    </Box>

    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}>
      <Stack spacing={1.75}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <Chip size="small" color={finished ? 'success' : 'primary'} label={finished ? '演示完成' : `第 ${position + 1} / ${steps.length - 1} 步`} />
          <Typography variant="caption" color="text.secondary">{step.owner}</Typography>
        </Stack>
        <Box role="status" aria-live="polite" aria-atomic="true">
          <Typography component="h4" variant="h6">{step.title}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>{step.explanation}</Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Value label="从哪里拿到什么" value={step.input} />
          <Value label={finished ? '最终结果' : '执行这一步后得到什么'} value={step.output} />
        </Box>
        {step.command && <Box component="pre" aria-label="当前步骤涉及的命令或数据"
          sx={{ m: 0, p: 1.5, borderRadius: 1, bgcolor: 'action.hover', fontSize: 12,
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'monospace', lineHeight: 1.7 }}>
          {step.command}
        </Box>}
        {step.gate && <>
          <FormControl fullWidth size="small">
            <InputLabel id={`${id}-gate-label`}>{step.gate}</InputLabel>
            <Select labelId={`${id}-gate-label`} id={`${id}-gate`} label={step.gate} value={result}
              onChange={(event) => setResult(event.target.value as GateResult)} sx={selectStyle}>
              <MenuItem value="pending">请选择结果</MenuItem>
              <MenuItem value="pass">通过，可以继续</MenuItem>
              <MenuItem value="fail">未通过，暂不继续</MenuItem>
            </Select>
          </FormControl>
          {result === 'fail' ? <Alert severity="warning">{step.blocked}</Alert> :
            <Typography variant="caption" color="text.secondary">这是人工确认步骤，请先选择结果；不是平台自动完成的检查。</Typography>}
        </>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {!finished && <Button variant="contained" disabled={!canAdvance(step, result)}
            onClick={() => move(position + 1)} sx={{ minHeight: 44 }}>{step.action}</Button>}
          <Button variant="outlined" disabled={position === 0} onClick={() => move(position - 1)} sx={{ minHeight: 44 }}>上一步</Button>
          <Button onClick={() => move(0)} sx={{ minHeight: 44 }}>重新开始</Button>
        </Stack>
      </Stack>
    </Paper>

    <Box>
      <Typography component="h4" variant="subtitle1" sx={{ mb: 1 }}>目前已经产生了什么</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
        <Paper variant="outlined" sx={{ p: 1.75, minWidth: 0 }}><Stack spacing={1.25}>
          <Typography component="h5" variant="subtitle2">Jenkins / 构建机</Typography>
          <Value label="主打包任务" value={snapshot.build} />
          <Value label="源码 Commit" value={snapshot.commit} />
          <Value label="本地产物" value={snapshot.file} />
        </Stack></Paper>
        <Paper variant="outlined" sx={{ p: 1.75, minWidth: 0 }}><Stack spacing={1.25}>
          <Typography component="h5" variant="subtitle2">AppHub / 公证</Typography>
          <Value label="制品记录" value={snapshot.apphub} />
          <Value label="独立公证任务" value={snapshot.notarize} />
        </Stack></Paper>
        <Paper variant="outlined" sx={{ p: 1.75, minWidth: 0 }}><Stack spacing={1.25}>
          <Typography component="h5" variant="subtitle2">Downton / 热更新</Typography>
          <Value label="发布文件" value={snapshot.cdn} />
          <Value label="热更新产物" value={snapshot.patch} />
        </Stack></Paper>
        <Paper variant="outlined" sx={{ p: 1.75, minWidth: 0 }}><Stack spacing={1.25}>
          <Typography component="h5" variant="subtitle2">Mars / 客户端</Typography>
          <Value label="版本记录" value={snapshot.mars} />
          <Typography variant="body2">{position < 12 ? '尚无灰度配置' : `当前灰度：${snapshot.gray}%`}</Typography>
          <LinearProgress variant="determinate" value={snapshot.gray} aria-label="当前灰度比例"
            sx={{ height: 8, borderRadius: 1 }} />
          <Value label="本例客户端版本" value={snapshot.client} />
          {position >= 12 && <Typography variant="caption" color="text.secondary">
            {example.buildField} = {example.build}；使用 {example.urlField}
          </Typography>}
        </Stack></Paper>
      </Box>
    </Box>
    {position > 0 && <Box>
      <Typography variant="caption" color="text.secondary">刚刚完成</Typography>
      <Typography variant="body2">{steps[position - 1].output}</Typography>
    </Box>}
  </Stack>;
}
