import test from 'node:test';
import assert from 'node:assert/strict';
import { readLinkTarget, writeLinkTarget } from '../lib/navigation/share-link.ts';

test('links open a line with its direction or a station', () => {
  assert.deepEqual(readLinkTarget('?linha=0.110&sentido=1'), { line: '0.110', direction: 1 });
  assert.deepEqual(readLinkTarget('?linha=147.2'), { line: '147.2' });
  assert.deepEqual(readLinkTarget('?estacao=ctl'), { station: 'CTL' });
  assert.deepEqual(readLinkTarget(''), {});
});

test('malformed or hostile values are ignored', () => {
  assert.deepEqual(readLinkTarget('?linha=<script>&estacao=CTL'), { station: 'CTL' });
  assert.deepEqual(readLinkTarget('?linha=0.110&sentido=7'), { line: '0.110' });
  assert.deepEqual(readLinkTarget('?estacao=../../x'), {});
});

test('links are written back the same way', () => {
  assert.equal(writeLinkTarget({ line: '0.110', direction: 1 }), '?linha=0.110&sentido=1');
  assert.equal(writeLinkTarget({ line: '0.110', direction: 0 }), '?linha=0.110');
  assert.equal(writeLinkTarget({ station: 'CTL' }), '?estacao=CTL');
  assert.equal(writeLinkTarget({}), '');
  for (const search of ['?linha=0.110&sentido=1', '?estacao=GAL']) assert.equal(writeLinkTarget(readLinkTarget(search)), search);
});
