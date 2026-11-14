import test from 'node:test';
import assert from 'node:assert/strict';
import { humanize, toLocalDateTime, money, dateTime } from '../src/utils/format.js';

test('humanize formats snake-case statuses for readable labels', () => {
  assert.equal(humanize('pickup_scheduled'), 'Pickup Scheduled');
  assert.equal(humanize(''), '');
});

test('date-time helper handles absent and invalid inputs safely', () => {
  assert.equal(dateTime(''), '—');
  assert.equal(dateTime('not-a-date'), '—');
  assert.notEqual(dateTime('2026-10-13T10:00:00Z'), '—');
});

test('money helper produces INR formatting for numeric values', () => {
  assert.match(money(75), /75/);
  assert.match(money(0), /0/);
});

test('local datetime helper produces a valid datetime-local value', () => {
  const value = toLocalDateTime('2026-10-13T10:15:00Z');
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(toLocalDateTime('invalid').length, 16);
});
