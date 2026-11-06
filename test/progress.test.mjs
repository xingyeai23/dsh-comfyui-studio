import assert from 'node:assert/strict';
import test from 'node:test';
import { createProgressTracker, reduceProgress } from '../lib/progress.js';

test('reduceProgress follows execution, progress and completion messages', () => {
  let state = reduceProgress(null, { type: 'execution_start', data: { prompt_id: 'p1' } });
  assert.equal(state.status, 'running');
  assert.equal(state.promptId, 'p1');
  assert.equal(state.percent, 0);

  state = reduceProgress(state, { type: 'progress', data: { value: 3, max: 12, prompt_id: 'p1', node: '5' } });
  assert.equal(state.percent, 25);
  assert.equal(state.node, '5');
  assert.equal(state.value, 3);
  assert.equal(state.max, 12);

  state = reduceProgress(state, { type: 'executing', data: { node: null, prompt_id: 'p1' } });
  assert.equal(state.status, 'completed');
  assert.equal(state.percent, 100);

  const failed = reduceProgress(state, { type: 'execution_error', data: { prompt_id: 'p1', exception_message: 'CUDA OOM' } });
  assert.equal(failed.status, 'error');
  assert.equal(failed.error, 'CUDA OOM');

  const interrupted = reduceProgress(state, { type: 'execution_interrupted', data: { prompt_id: 'p1' } });
  assert.equal(interrupted.status, 'interrupted');

  assert.equal(reduceProgress(state, { type: 'status', data: {} }), state);
});

test('reduceProgress keeps Crystools GPU utilization when reported', () => {
  const state = reduceProgress({ status: 'idle', promptId: null, node: null, value: 0, max: 0, percent: 0, error: null, gpuUtilization: null }, {
    type: 'crystools.monitor',
    data: { gpus: [{ gpu_utilization: 63 }] },
  });
  assert.equal(state.gpuUtilization, 63);
});

/** Minimal WebSocket stand-in for the tracker. */
class FakeWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  emit(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  close() {
    this.emit('close', {});
  }
}

test('the tracker keeps a stable client id and exposes the latest progress', () => {
  FakeWebSocket.instances = [];
  const tracker = createProgressTracker({ WebSocketImpl: FakeWebSocket, reconnectMs: 5 });
  const clientId = tracker.clientIdFor('http://127.0.0.1:8188');
  assert.ok(clientId.startsWith('dsh-comfy-'));
  assert.equal(tracker.clientIdFor('http://127.0.0.1:8188'), clientId);
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.match(FakeWebSocket.instances[0].url, /^ws:\/\/127\.0\.0\.1:8188\/ws\?clientId=/);

  const socket = FakeWebSocket.instances[0];
  socket.emit('open');
  socket.emit('message', { data: JSON.stringify({ type: 'execution_start', data: { prompt_id: 'p9' } }) });
  socket.emit('message', { data: JSON.stringify({ type: 'progress', data: { value: 6, max: 8, prompt_id: 'p9', node: '3' } }) });
  const state = tracker.snapshot('http://127.0.0.1:8188');
  assert.equal(state.percent, 75);
  assert.equal(state.promptId, 'p9');

  tracker.ensure('http://127.0.0.1:8188');
  assert.equal(FakeWebSocket.instances.length, 1, 'ensure must not open a second socket');
  tracker.close();
});

test('reduceProgress tracks executed and cached nodes for the graph preview', () => {
  let state = reduceProgress(null, { type: 'execution_start', data: { prompt_id: 'p2' } });
  assert.deepEqual(state.doneNodes, []);
  state = reduceProgress(state, { type: 'execution_cached', data: { prompt_id: 'p2', nodes: ['1', '4'] } });
  assert.deepEqual(state.doneNodes.sort(), ['1', '4']);
  state = reduceProgress(state, { type: 'executing', data: { prompt_id: 'p2', node: '5' } });
  state = reduceProgress(state, { type: 'progress', data: { prompt_id: 'p2', value: 1, max: 5, node: '5' } });
  state = reduceProgress(state, { type: 'executing', data: { prompt_id: 'p2', node: '6' } });
  assert.ok(state.doneNodes.includes('5'));
  assert.equal(state.node, '6');
  state = reduceProgress(state, { type: 'executed', data: { prompt_id: 'p2', node: '6' } });
  assert.ok(state.doneNodes.includes('6'));
  assert.equal(state.status, 'running');
  state = reduceProgress(state, { type: 'execution_success', data: { prompt_id: 'p2' } });
  assert.equal(state.status, 'completed');
});
