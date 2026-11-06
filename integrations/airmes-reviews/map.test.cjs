const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../src/reviews.js'), 'utf8');

test('live map renders stations, opens the selected review, removes closed MRs and expires offline data', async () => {
    let now = Date.now();
    const review = { iid: 42, slot: 0, title: 'Test MR', branch: 'feature', current: true,
        reviewUrl: 'https://review-42.application-airmes.eu', mrUrl: 'https://gitlab.eoloa.eu/airmes/airmes/-/merge_requests/42' };
    let payload = { version: 1, updatedAt: new Date(now).toISOString(), totalOpen: 1, available: 1, reviews: [review] };
    let offline = false;
    let scheduled;
    let tiles;
    let popup;
    let closed = 0;
    const opened = [];
    const events = new Map();
    const subscriptions = [];
    const context = {
        URL, AbortSignal, Date: class extends Date { static now() { return now; } },
        fetch: async () => { if (offline) throw new Error('offline'); return { ok: true, json: async () => payload }; },
        setTimeout: (callback) => { scheduled = callback; }, clearTimeout: () => {},
        window: { addEventListener: () => {} },
        WA: { onInit: async () => {}, room: { getTiledMap: async () => ({properties: [{name:'reviewsEndpoint',value:'https://example.test'}]}),
            setTiles: (value) => { tiles = value; }, area: Object.fromEntries(['onEnter','onLeave'].map(kind => [kind, name => ({subscribe: callback => {
                events.set(`${kind}:${name}`, callback); const sub = {unsubscribe(){}}; subscriptions.push(sub); return sub;
            }})])) }, nav: { openTab: url => opened.push(url) }, ui: {
                banner: { openBanner: value => assert.equal(value.id, 'airmes-reviews'), closeBanner(){} },
                openPopup: (target, message, buttons) => { popup = {target, message, buttons}; return {close: () => {closed++;}}; }
            } }
    };
    await vm.runInNewContext(source, context);
    assert.equal(tiles[0].tile, "airmes-review-current");
    events.get('onEnter:review-0')();
    assert.match(popup.message, /!42/);
    popup.buttons[0].callback();
    assert.equal(opened[0], review.reviewUrl);
    offline = true;
    now += 181000;
    await scheduled();
    assert.equal(tiles[0].tile, "airmes-review-stale");
    assert.equal(popup.buttons.length, 0);
    offline = false;
    payload = { version:1, updatedAt:new Date(now).toISOString(), totalOpen:0, available:0, reviews:[] };
    await scheduled();
    assert.equal(tiles[0].tile, null);
    assert.ok(closed >= 2);
});
