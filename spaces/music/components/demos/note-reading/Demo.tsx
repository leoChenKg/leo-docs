import { useId, useState } from 'react';
import {
  Box, Button, FormControl, FormControlLabel, InputLabel, MenuItem,
  Paper, Select, Stack, Switch, ToggleButton, Typography,
} from '@mui/material';

const solfege = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'] as const;
const allNotes = [1, 2, 3, 4, 5, 6, 7];
const lengths = [4, 8, 12, 16, 24, 32];

type Settings = { notes: number[]; length: number; allowRepeat: boolean };

function generateNotes(settings: Settings) {
  const result: number[] = [];
  for (let index = 0; index < settings.length; index += 1) {
    const candidates = settings.allowRepeat || settings.notes.length === 1
      ? settings.notes
      : settings.notes.filter((note) => note !== result[index - 1]);
    result.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }
  return result;
}

function createExercise() {
  const settings: Settings = { notes: allNotes, length: 8, allowRepeat: true };
  return { settings, question: generateNotes(settings), revealed: false, round: 1 };
}

export default function NoteReadingDemo() {
  const [exercise, setExercise] = useState(createExercise);
  const id = useId();
  const { settings, question, revealed, round } = exercise;
  const singleNote = settings.notes.length === 1;

  function newQuestion(nextSettings = settings) {
    // A single selected note necessarily repeats; keep the control consistent.
    const normalized = nextSettings.notes.length === 1
      ? { ...nextSettings, allowRepeat: true }
      : nextSettings;
    setExercise({
      settings: normalized,
      question: generateNotes(normalized),
      revealed: false,
      round: round + 1,
    });
  }

  function toggleNote(note: number) {
    const selected = settings.notes.includes(note);
    if (selected && singleNote) return;
    const notes = selected
      ? settings.notes.filter((value) => value !== note)
      : [...settings.notes, note].sort((a, b) => a - b);
    newQuestion({ ...settings, notes });
  }

  return <Stack spacing={3} sx={{ minWidth: 0 }}>
    <Box>
      <Typography component="h2" variant="h6">看数字，读唱名</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        按顺序自己读一遍，再展开答案逐个核对。
      </Typography>
    </Box>

    <Stack spacing={2}>
      <Box role="group" aria-labelledby={`${id}-range-label`} aria-describedby={`${id}-range-help`}>
        <Typography component="div" id={`${id}-range-label`} variant="subtitle2" sx={{ mb: 1 }}>练习数字</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {allNotes.map((note) => <ToggleButton
            key={note}
            value={note}
            selected={settings.notes.includes(note)}
            disabled={singleNote && settings.notes.includes(note)}
            aria-label={`数字 ${note}`}
            onChange={() => toggleNote(note)}
            color="primary"
            sx={{ width: 44, height: 44, fontSize: 18, fontWeight: 600 }}
          >{note}</ToggleButton>)}
        </Box>
        <Typography id={`${id}-range-help`} variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          至少选一个数字。刚开始可以只练 1、2、3。
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
        <FormControl size="small" variant="filled" sx={{ minWidth: { sm: 160 } }}>
          <InputLabel id={`${id}-length-label`}>每组长度</InputLabel>
          <Select labelId={`${id}-length-label`} id={`${id}-length`} value={settings.length}
            onChange={(event) => newQuestion({ ...settings, length: Number(event.target.value) })}>
            {lengths.map((length) => <MenuItem value={length} key={length}>{length} 个音符</MenuItem>)}
          </Select>
        </FormControl>
        <FormControlLabel
          sx={{ ml: 0, mr: 0 }}
          control={<Switch checked={settings.allowRepeat} disabled={singleNote}
            onChange={(_, allowRepeat) => newQuestion({ ...settings, allowRepeat })} />}
          label={<Typography variant="body2">允许连续重复</Typography>}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {singleNote ? '只选择一个数字时会连续重复。' : '关闭连续重复后，相邻两个数字不会相同。'}
        {' '}修改设置会立即生成新题。
      </Typography>
    </Stack>

    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0, bgcolor: 'action.hover' }}>
      <Stack spacing={2.5}>
        <Box role="status" aria-live="polite" aria-atomic="true">
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>第 {round} 组 · {question.length} 个音符</Typography>
          <Typography variant="body2" color="text.secondary">
            {revealed ? '答案已展开，唱名在对应数字下方。' : '答案已隐藏，先按从左到右、从上到下的顺序读。'}
          </Typography>
        </Box>

        <Box id={`${id}-question`} role="list" aria-label={`第 ${round} 组练习`}
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(48px, 1fr))', gap: { xs: 1, sm: 1.5 } }}>
          {question.map((note, index) => <Box key={index} role="listitem"
            aria-label={`第 ${index + 1} 个：${note}${revealed ? `，唱名 ${solfege[note - 1]}` : ''}`}
            sx={{ minWidth: 0, py: 1.5, px: 0.5, textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper' }}>
            <Typography aria-hidden="true" sx={{ fontSize: { xs: 32, sm: 40 }, fontWeight: 600, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{note}</Typography>
            <Typography aria-hidden="true" variant="body2" color={revealed ? 'primary.main' : 'text.disabled'}
              sx={{ mt: 1, fontWeight: 600, minHeight: '1.5em' }}>
              {revealed ? solfege[note - 1] : '· · ·'}
            </Typography>
          </Box>)}
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant={revealed ? 'outlined' : 'contained'} aria-expanded={revealed} aria-controls={`${id}-question`}
            onClick={() => setExercise((current) => ({ ...current, revealed: !current.revealed }))}
            sx={{ minHeight: 44 }}>
            {revealed ? '隐藏答案，再读一遍' : '查看答案'}
          </Button>
          <Button variant={revealed ? 'contained' : 'outlined'} onClick={() => newQuestion()} sx={{ minHeight: 44 }}>生成新题</Button>
        </Stack>
      </Stack>
    </Paper>
  </Stack>;
}
