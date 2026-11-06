const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSnapshot } = require('./snapshot.cjs');
const mr = (iid, sha = 'head') => ({ iid, sha, title: `MR ${iid}`, source_branch: `branch-${iid}`, state: 'opened' });
const env = (iid, extra = {}) => ({ state: 'available', name: `review/branch-${iid}`,
    external_url: `https://review-${iid}.application-airmes.eu`,
    last_deployment: { status: 'success', ref: `refs/merge-requests/${iid}/head`, sha: 'head' }, ...extra });

test('only deployed open MRs appear; closed, stopped, failed and unsafe URLs are excluded', () => {
    const result = buildSnapshot([mr(1), mr(2), mr(3), mr(4), mr(5)], [env(1), env(9),
        env(2, { state: 'stopped' }), env(3, { external_url: 'https://attacker.example/' }),
        env(4, { last_deployment: { status: 'failed', ref: 'refs/merge-requests/4/head' } }),
        env(5, { external_url: 'https://secret@review-5.application-airmes.eu' })]);
    assert.deepEqual(result.reviews.map(r => r.iid), [1]);
    assert.equal(result.totalOpen, 5);
});
test('surviving reviews keep their stations, and removed stations can be reused', () => {
    const previous = buildSnapshot([mr(1), mr(2)], [env(1), env(2)]);
    const next = buildSnapshot([mr(2), mr(3)], [env(3), env(2)], previous);
    assert.equal(next.reviews.find(r => r.iid === 2).slot, 1);
    assert.equal(next.reviews.find(r => r.iid === 3).slot, 0);
    assert.equal(buildSnapshot([], [], next).reviews.length, 0);
});
test('older deployed revisions are marked separately and branch deployments are matched exactly', () => {
    const result = buildSnapshot([mr(1, 'new')], [env(1, { last_deployment: { status: 'success', ref: 'branch-1', sha: 'old' } })]);
    assert.equal(result.reviews[0].current, false);
});
test('capacity is bounded and overflow is explicit', () => {
    const mrs = Array.from({ length: 52 }, (_, i) => mr(i + 1));
    const result = buildSnapshot(mrs, mrs.map(m => env(m.iid)));
    assert.equal(result.reviews.length, 15);
    assert.equal(result.overflow, 37);
    assert.equal(new Set(result.reviews.map(r => r.slot)).size, 15);
});

test('free stations prioritize reviews awaiting validation without moving occupied stations', () => {
    const rows = [{ ...mr(1), labels: ['Test OK', 'Review OK'] }, mr(2)];
    const first = buildSnapshot(rows, [env(1), env(2)]);
    assert.equal(first.reviews.find(r => r.iid === 2).slot, 0);
    assert.equal(first.reviews.find(r => r.iid === 1).slot, 1);
    const next = buildSnapshot([...rows, mr(3)], [env(3), env(1), env(2)], first);
    assert.equal(next.reviews.find(r => r.iid === 1).slot, 1);
    assert.equal(next.reviews.find(r => r.iid === 3).slot, 2);
});

test('only explicit validation labels are exposed to the map', () => {
    const result = buildSnapshot([{ ...mr(1), labels: ['Test OK', 'Review OK', 'Internal unrelated label'] }], [env(1)]);
    assert.deepEqual(result.reviews[0].labels, ['Test OK', 'Review OK']);
    const unvalidated = buildSnapshot([{ ...mr(1), labels: ['Review OK'] }], [env(1)]);
    assert.deepEqual(unvalidated.reviews[0].labels, ['Review OK']);
});
