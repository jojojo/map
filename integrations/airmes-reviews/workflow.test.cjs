const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, 'workflow.json'), 'utf8'));
const code = workflow.nodes.find(node => node.name === 'Mémoriser les postes').parameters.jsCode;
const run = new Function('$input', '$getWorkflowStaticData', '$', code);
const mr = { iid: 42, title: 'Sample MR', source_branch: 'feature', state: 'opened', sha: 'head', labels: ['Test OK', 'Review OK'] };
const environment = { name: 'review/feature', state: 'available',
    external_url: 'https://review-42.application-airmes.eu',
    last_deployment: { status: 'success', ref: 'refs/merge-requests/42/head', sha: 'head' } };

function execute(mrs, environments, state = {}) {
    return run({ all: () => environments.map(body => ({ json: { body } })) }, () => state,
        name => { assert.equal(name, 'MR ouvertes'); return { all: () => [{ json: { body: mrs } }] }; });
}

test('export is inactive and contains no credential bindings', () => {
    assert.equal(workflow.active, false);
    assert.ok(workflow.nodes.every(node => !node.credentials));
});

test('exported Code node selects a valid deployed MR', () => {
    const state = {};
    const output = execute([mr], [environment], state);
    assert.equal(output[0].json.available, 1);
    assert.equal(state.snapshot.reviews[0].iid, 42);
    assert.equal(state.snapshot.reviews[0].slot, 0);
    assert.deepEqual(state.snapshot.reviews[0].labels, ['Test OK', 'Review OK']);
});

test('malformed MR input fails before replacing the saved snapshot', () => {
    const state = { snapshot: { marker: 'previous snapshot' } };
    assert.throws(() => execute([{ title: 'Missing ID' }], [environment], state), /Invalid GitLab MR response/);
    assert.deepEqual(state.snapshot, { marker: 'previous snapshot' });
});

test('duplicate environments and repeated scans keep one station for the MR', () => {
    const state = {};
    execute([mr], [environment, environment], state);
    assert.equal(state.snapshot.reviews.length, 1);
    const firstSlot = state.snapshot.reviews[0].slot;
    execute([mr], [environment, environment], state);
    assert.equal(state.snapshot.reviews.length, 1);
    assert.equal(state.snapshot.reviews[0].slot, firstSlot);
    execute([], [], state);
    assert.equal(state.snapshot.reviews.length, 0);
});
