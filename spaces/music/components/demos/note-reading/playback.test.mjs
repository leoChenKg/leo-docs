import assert from 'node:assert/strict';
import test from 'node:test';
import { NotePlayer, NOTE_PITCHES } from './playback.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class FakeParam {
  events = [];
  setValueAtTime(value, at) { this.events.push({ type: 'set', value, at }); }
  linearRampToValueAtTime(value, at) { this.events.push({ type: 'linear', value, at }); }
  exponentialRampToValueAtTime(value, at) { this.events.push({ type: 'exponential', value, at }); }
}

class FakeNode {
  disconnected = false;
  connect(target) { this.target = target; }
  disconnect() { this.disconnected = true; this.target = null; }
}

class FakeOscillator extends FakeNode {
  frequency = new FakeParam();
  onended = null;
  stopCalls = [];
  start(at) { this.startAt = at; }
  stop(at) { this.stopCalls.push(at); }
  end() { this.onended?.(); }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeAudioContext extends EventTarget {
  state = 'running';
  currentTime = 10;
  destination = {};
  oscillators = [];
  gains = [];
  closeCalls = 0;
  resume = async () => { this.state = 'running'; };
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  async close() { this.closeCalls += 1; this.state = 'closed'; }
}

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const context = new FakeAudioContext();
  const indices = [];
  const player = new NotePlayer((index) => indices.push(index), () => context);
  t.after(() => player.dispose());
  return { context, indices, player };
}

function assertReleased(context) {
  assert.ok(context.oscillators.every((node) => node.disconnected && node.onended === null));
  assert.ok(context.gains.every((node) => node.disconnected));
}

test('all seven numerals play C4–B4 in equal temperament, with a fresh voice for repeats', async (t) => {
  const { context, indices, player } = setup(t);
  await player.play([1, 2, 3, 4, 5, 6, 7, 7]);

  assert.deepEqual(NOTE_PITCHES.map(({ name }) => name), ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']);
  const expectedHz = [261.626, 293.665, 329.628, 349.228, 391.995, 440, 493.883, 493.883];
  assert.equal(context.oscillators.length, expectedHz.length);
  context.oscillators.forEach((oscillator, index) => {
    assert.ok(Math.abs(oscillator.frequency.events[0].value - expectedHz[index]) < 0.001);
    const gain = context.gains[index];
    assert.equal(gain.gain.events[0].value, 0);
    assert.equal(gain.gain.events.at(-1).value, 0);
    assert.ok(gain.gain.events.every(({ value }) => value >= 0 && value <= 0.2));
    assert.ok(oscillator.stopCalls[0] > oscillator.startAt);
    if (index) assert.ok(oscillator.startAt > context.oscillators[index - 1].stopCalls[0]);
    context.currentTime = oscillator.startAt + 0.01;
    t.mock.timers.tick(25);
    assert.equal(indices.at(-1), index);
    if (index < expectedHz.length - 1) {
      oscillator.end();
      assert.equal(indices.at(-1), index, 'short gaps must not report that the sequence has ended');
    }
  });
  context.oscillators.at(-1).end();
  assert.equal(indices.at(-1), null);
  assertReleased(context);
  const finished = [...indices];
  t.mock.timers.tick(60_000);
  assert.deepEqual(indices, finished, 'completion cancels all future highlight callbacks');
});

test('highlight follows the audio clock rather than elapsed JavaScript timer time', async (t) => {
  const { context, indices, player } = setup(t);
  await player.play([1, 2, 3]);
  context.currentTime = context.oscillators[0].startAt + 0.01;
  t.mock.timers.tick(25);
  assert.deepEqual(indices, [0]);
  t.mock.timers.tick(2_000);
  assert.deepEqual(indices, [0]);
  context.currentTime = context.oscillators[2].startAt + 0.01;
  t.mock.timers.tick(25);
  assert.deepEqual(indices, [0, 2], 'a delayed UI frame catches up instead of replaying old highlights');
  player.stop();
  assertReleased(context);
  assert.ok(context.oscillators.every((node) => node.stopCalls.at(-1) === undefined));
  const stopped = [...indices];
  t.mock.timers.tick(60_000);
  assert.deepEqual(indices, stopped);
});

test('stop settles a pending resume and a late completion cannot start audio', async (t) => {
  const { context, indices, player } = setup(t);
  const resume = deferred();
  context.state = 'suspended';
  context.resume = () => resume.promise;
  const starting = player.play([1, 2]);
  player.stop();
  await starting;
  context.state = 'running';
  resume.resolve();
  await Promise.resolve();
  t.mock.timers.tick(1_000);
  assert.equal(context.oscillators.length, 0);
  assert.deepEqual(indices, []);
});

test('a replaced resume failure neither rejects the old request nor stops newer audio', async (t) => {
  const { context, indices, player } = setup(t);
  const first = deferred();
  const second = deferred();
  let calls = 0;
  context.state = 'suspended';
  context.resume = () => (++calls === 1 ? first.promise : second.promise);
  const oldPlayback = player.play([1, 2]);
  const newPlayback = player.play([6]);
  context.state = 'running';
  second.resolve();
  await newPlayback;
  await oldPlayback;
  context.currentTime = context.oscillators[0].startAt + 0.01;
  t.mock.timers.tick(25);
  first.reject(new Error('stale startup failure'));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(indices, [0]);
  assert.equal(context.oscillators.length, 1);
  assert.equal(context.oscillators[0].frequency.events[0].value, 440);
  assert.equal(context.oscillators[0].disconnected, false);
});

test('replacing scheduled playback silences and disconnects all previous voices', async (t) => {
  const { context, indices, player } = setup(t);
  await player.play([1, 3, 5]);
  const previous = [...context.oscillators];
  const staleEnd = previous.at(-1).onended;
  await player.play([7]);
  assert.ok(previous.every((voice) => voice.disconnected && voice.onended === null && voice.stopCalls.at(-1) === undefined));
  staleEnd();
  assert.equal(context.oscillators.at(-1).disconnected, false);
  context.currentTime = context.oscillators.at(-1).startAt + 0.01;
  t.mock.timers.tick(25);
  assert.equal(indices.at(-1), 0);
});

test('an audio interruption cancels scheduled notes rather than resuming the old answer later', async (t) => {
  const { context, indices, player } = setup(t);
  for (const state of ['suspended', 'interrupted', 'closed']) {
    context.state = 'running';
    await player.play([1, 2, 3]);
    assert.equal(indices.at(-1), 0, 'startup exposes an active note immediately');
    context.state = state;
    context.dispatchEvent(new Event('statechange'));
    assert.equal(indices.at(-1), null);
    assertReleased(context);
    const afterInterruption = [...indices];
    context.state = 'running';
    context.dispatchEvent(new Event('statechange'));
    t.mock.timers.tick(5_000);
    assert.deepEqual(indices, afterInterruption);
  }
});

test('dispose cancels startup, closes once, and rejects further use', async (t) => {
  const { context, indices, player } = setup(t);
  const resume = deferred();
  context.state = 'suspended';
  context.resume = () => resume.promise;
  const starting = player.play([1]);
  player.dispose();
  player.dispose();
  await starting;
  resume.reject(new Error('context closed during startup'));
  await Promise.resolve();
  assert.equal(context.closeCalls, 1);
  assert.equal(context.oscillators.length, 0);
  assert.deepEqual(indices, []);
  await assert.rejects(player.play([1]), /播放器已关闭/);
});

test('startup and partial scheduling failures reject and release any created audio', async (t) => {
  const { context, player } = setup(t);
  context.state = 'suspended';
  context.resume = async () => { throw new Error('audio blocked'); };
  await assert.rejects(player.play([1]), /audio blocked/);
  assert.equal(context.oscillators.length, 0);
  context.state = 'running';
  const createOscillator = context.createOscillator.bind(context);
  context.createOscillator = () => {
    if (context.oscillators.length) throw new Error('audio unavailable');
    return createOscillator();
  };
  await assert.rejects(player.play([1, 2]), /audio unavailable/);
  assertReleased(context);
});

test('empty or invalid answers do not acquire an audio context', async () => {
  let calls = 0;
  const player = new NotePlayer(() => {}, () => { calls += 1; throw new Error('unsupported'); });
  await player.play([]);
  await assert.rejects(player.play([0]), /1～7/);
  await assert.rejects(player.play([NaN]), /1～7/);
  assert.equal(calls, 0);
  await assert.rejects(player.play([1]), /unsupported/);
  assert.equal(calls, 1);
  player.dispose();
});
