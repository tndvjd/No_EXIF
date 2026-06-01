import assert from 'node:assert/strict';
import test from 'node:test';

import { canvasToPngBytes } from './canvasUtils.js';

test('canvasToPngBytes resolves canvas blobs to Uint8Array', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  const canvas = {
    toBlob(callback, type) {
      assert.equal(type, 'image/png');
      callback({
        async arrayBuffer() {
          return bytes.buffer;
        },
      });
    },
  };

  const result = await canvasToPngBytes(canvas);
  assert.ok(result instanceof Uint8Array);
  assert.deepEqual([...result], [...bytes]);
});

test('canvasToPngBytes rejects when the browser cannot render a PNG blob', async () => {
  const canvas = {
    toBlob(callback) {
      callback(null);
    },
  };

  await assert.rejects(
    () => canvasToPngBytes(canvas),
    /PNG/,
  );
});
