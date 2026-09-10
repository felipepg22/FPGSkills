import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeJobs } from './src/jobs.mjs';

test('rejects non-arrays', () => {
  for (const value of [null, undefined, {}, 'jobs', 2]) assert.throws(() => normalizeJobs(value), TypeError);
});
test('filters invalid and disabled entries without reserving names', () => {
  assert.deepEqual(normalizeJobs([null, [], 1, '', {}, { name: 1 }, { name: '  ' }, { name: 'a', enabled: false }, { name: ' a ' }]), [{ name: 'a', retries: 1 }]);
});
test('keeps first valid trimmed name, case and stable order', () => {
  assert.deepEqual(normalizeJobs([{ name: ' b ', retries: 2 }, { name: 'a' }, { name: 'b', retries: 3 }, { name: 'B', enabled: 0 }]), [{ name: 'b', retries: 2 }, { name: 'a', retries: 1 }, { name: 'B', retries: 1 }]);
});
test('clamps only integers and defaults all other values', () => {
  const inputs = [-5, 0, 2, 3, 9, 1.5, '2', NaN, Infinity, null, undefined];
  assert.deepEqual(normalizeJobs(inputs.map((retries, i) => ({ name: String(i), retries }))).map(x => x.retries), [0, 0, 2, 3, 3, 1, 1, 1, 1, 1, 1]);
});
test('does not mutate frozen inputs and returns only public keys', () => {
  const item = Object.freeze({ name: ' a ', retries: -1, internal: true });
  const input = Object.freeze([item]);
  const output = normalizeJobs(input);
  assert.deepEqual(output, [{ name: 'a', retries: 0 }]);
  assert.notEqual(output[0], item);
  assert.equal(item.name, ' a ');
});
