import { useId, useMemo, useState } from 'react';
import { Box, Paper, Stack, ToggleButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const PITCH_CLASSES = [
  { short: 'C', label: 'C' },
  { short: 'C♯/D♭', label: 'C♯ / D♭' },
  { short: 'D', label: 'D' },
  { short: 'D♯/E♭', label: 'D♯ / E♭' },
  { short: 'E', label: 'E' },
  { short: 'F', label: 'F' },
  { short: 'F♯/G♭', label: 'F♯ / G♭' },
  { short: 'G', label: 'G' },
  { short: 'G♯/A♭', label: 'G♯ / A♭' },
  { short: 'A', label: 'A' },
  { short: 'A♯/B♭', label: 'A♯ / B♭' },
  { short: 'B', label: 'B' },
] as const;

const SEMITONE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const SIZE = 560;
const CENTER = SIZE / 2;
const RADIUS = 216;
const NODE_RADIUS = 48;
const CENTER_RADIUS = 58;

function pointAt(semitones: number, radius = RADIUS) {
  const radians = (-90 + semitones * 30) * Math.PI / 180;
  return {
    x: CENTER + Math.cos(radians) * radius,
    y: CENTER + Math.sin(radians) * radius,
  };
}

export default function EqualTemperamentIntervalsDemo() {
  const [rootIndex, setRootIndex] = useState(0);
  const theme = useTheme();
  const selectorLabelId = useId();
  const diagramTitleId = useId();
  const diagramDescriptionId = useId();
  const root = PITCH_CLASSES[rootIndex];
  const relations = useMemo(() => SEMITONE_STEPS.map((semitones) => ({
    semitones,
    target: PITCH_CLASSES[(rootIndex + semitones) % PITCH_CLASSES.length],
  })), [rootIndex]);

  return <Stack spacing={2.5} sx={{ minWidth: 0 }}>
    <Box>
      <Typography component="h3" variant="h6">十二平均律半音距离图</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        选一个起音。外圈按上行半音数顺时针排列，辐射线只用来连接起音和目标音；音程大小请读节点内的“+半音数”。
      </Typography>
    </Box>

    <Box role="group" aria-labelledby={selectorLabelId}>
      <Typography id={selectorLabelId} component="div" variant="subtitle2" sx={{ mb: 1 }}>选择起音</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 1 }}>
        {PITCH_CLASSES.map((pitch, index) => <ToggleButton
          key={pitch.label}
          value={pitch.label}
          selected={rootIndex === index}
          aria-label={`以 ${pitch.label} 为起音`}
          onChange={() => setRootIndex(index)}
          color="primary"
          sx={{ minWidth: 0, minHeight: 44, px: 0.75, textTransform: 'none', fontWeight: 600 }}
        >{pitch.short}</ToggleButton>)}
      </Box>
    </Box>

    <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, minWidth: 0, bgcolor: 'action.hover' }}>
      <Box sx={{ display: { xs: 'none', sm: 'block' }, width: '100%', maxWidth: 640, mx: 'auto' }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width="100%"
          role="img"
          aria-labelledby={`${diagramTitleId} ${diagramDescriptionId}`}
          style={{ display: 'block', height: 'auto', fontFamily: theme.typography.fontFamily }}
        >
          <title id={diagramTitleId}>{root.label} 为起音的十二平均律半音距离图</title>
          <desc id={diagramDescriptionId}>
            {relations.map(({ semitones, target }) => (
              `${root.label} 向上到 ${target.label} 相隔 ${semitones} 个半音，${semitones * 100} 音分`
            )).join('；')}。
          </desc>

          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={theme.palette.text.secondary}
            strokeWidth={2}
          />

          {relations.map(({ semitones }) => {
            const radians = (-90 + semitones * 30) * Math.PI / 180;
            const start = {
              x: CENTER + Math.cos(radians) * CENTER_RADIUS,
              y: CENTER + Math.sin(radians) * CENTER_RADIUS,
            };
            const end = pointAt(semitones, RADIUS - NODE_RADIUS);
            return <line
              key={`line-${semitones}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={semitones === 12 ? theme.palette.primary.main : theme.palette.text.secondary}
              strokeWidth={semitones === 12 ? 3 : 2}
              strokeLinecap="round"
            />;
          })}

          {relations.map(({ semitones, target }) => {
            const point = pointAt(semitones);
            const octave = semitones === 12;
            return <g key={semitones} transform={`translate(${point.x} ${point.y})`}>
              <circle
                r={NODE_RADIUS}
                fill={theme.palette.background.paper}
                stroke={octave ? theme.palette.primary.main : theme.palette.text.secondary}
                strokeWidth={octave ? 3 : 2}
              />
              <text
                x={0}
                y={-9}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={theme.palette.text.primary}
                fontSize={22}
                fontWeight={700}
              >{target.short}</text>
              <text
                x={0}
                y={18}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={octave ? theme.palette.primary.main : theme.palette.text.secondary}
                fontSize={21}
                fontWeight={600}
              >+{semitones} 半音</text>
            </g>;
          })}

          <circle
            cx={CENTER}
            cy={CENTER}
            r={CENTER_RADIUS}
            fill={theme.palette.primary.main}
            stroke={theme.palette.background.paper}
            strokeWidth={4}
          />
          <text
            x={CENTER}
            y={CENTER - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={theme.palette.primary.contrastText}
            fontSize={28}
            fontWeight={700}
          >{root.short}</text>
          <text
            x={CENTER}
            y={CENTER + 23}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={theme.palette.primary.contrastText}
            fontSize={21}
            fontWeight={600}
          >0 半音</text>
        </svg>
      </Box>
      <Box
        role="list"
        aria-label={`${root.label} 为起音的十二个上行半音距离`}
        sx={{ display: { xs: 'grid', sm: 'none' }, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}
      >
        {relations.map(({ semitones, target }) => <Box
          key={semitones}
          role="listitem"
          sx={{ minWidth: 0, p: 1, textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 1.5,
            bgcolor: semitones === 12 ? 'action.selected' : 'background.paper' }}
        >
          <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>{target.short}</Typography>
          <Typography variant="body2" color={semitones === 12 ? 'primary.main' : 'text.secondary'} sx={{ mt: 0.5, fontWeight: 600 }}>
            +{semitones} 半音
          </Typography>
        </Box>)}
      </Box>
    </Paper>

    <Typography role="status" aria-live="polite" variant="body2" color="text.secondary">
      当前以 <strong>{root.label}</strong> 为起音：中心是 0 半音，外圈“+1”到“+12”表示向上的半音数，走完一圈到达高八度的同名音。
    </Typography>
  </Stack>;
}
