const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/reviews.js'), 'utf8');

const mr = (iid, extra = {}) => ({ iid, slot: iid - 1, title: `Review ${iid}`, branch: `branch-${iid}`,
    current: true, labels: [], reviewUrl: `https://review-${iid}.application-airmes.eu`,
    mrUrl: `https://gitlab.eoloa.eu/airmes/airmes/-/merge_requests/${iid}`, ...extra });

async function office(reviews, available = reviews.length) {
    const map = JSON.parse(fs.readFileSync(path.join(root, 'office-technique.tmj'), 'utf8'));
    const firstScreen = map.layers.find(layer => layer.name === 'floorLayer').objects.find(object => object.name === 'review-screen-01');
    firstScreen.x += 7;
    firstScreen.y += 3;
    let now = Date.now();
    const snapshot = rows => ({ version: 1, updatedAt: new Date(now).toISOString(), available, totalOpen: available, reviews: rows });
    let payload = snapshot(reviews);
    let offline = false;
    let timer;
    let banner;
    let popup;
    let closed = 0;
    let pagehide;
    const displays = [];
    const deleted = [];
    const opened = [];
    const events = new Map();
    const subs = [];
    const context = {
        URL, AbortSignal, Date: class extends Date { static now() { return now; } },
        fetch: async () => { if (offline) throw new Error('offline'); return { ok: true, json: async () => payload }; },
        setTimeout: callback => { timer = callback; }, clearTimeout: () => {},
        window: { addEventListener: (name, callback) => { assert.equal(name, 'pagehide'); pagehide = callback; } },
        WA: { onInit: async () => {},
            room: { mapURL: 'https://example.test/maps/office-technique.tmj', getTiledMap: async () => map,
                setTiles: () => { throw new Error('Office must preserve the drawn computer tiles'); },
                website: { create: spec => { const display = { ...spec }; displays.push(display); return display; },
                    delete: async name => { deleted.push(name); } },
                area: Object.fromEntries(['onEnter','onLeave'].map(kind => [kind, name => ({ subscribe: callback => {
                    events.set(`${kind}:${name}`, callback);
                    const sub = { removed: false, unsubscribe() { this.removed = true; } }; subs.push(sub); return sub;
                } })])) },
            nav: { openTab: url => opened.push(url) },
            ui: { banner: { openBanner: value => { banner = value; }, closeBanner() {} },
                openPopup: (target, text, buttons) => { popup = { target, text, buttons }; return { close: () => { closed++; } }; } }
        }
    };
    await vm.runInNewContext(source, context);
    return { displays, deleted, opened, events, subs, get banner() { return banner; }, get popup() { return popup; },
        get closed() { return closed; },
        async update(rows, count = rows.length) { available = count; payload = snapshot(rows); await timer(); },
        async invalid(value) { payload = value; await timer(); },
        async expire() { offline = true; now += 181000; await timer(); },
        cleanup() { pagehide(); },
        enter(n) { events.get(`onEnter:review-zone-${String(n).padStart(2, '0')}`)(); },
        leave(n) { events.get(`onLeave:review-zone-${String(n).padStart(2, '0')}`)(); } };
}

test('office reads all 15 screen rectangles and paints only their exact surfaces', async () => {
    const runtime = await office([mr(1)]);
    assert.equal(runtime.displays.length, 15);
    assert.equal(runtime.displays[0].position.x, 55);
    assert.equal(runtime.displays[0].position.y, 41);
    assert.equal(runtime.displays[0].position.width, 32);
    assert.equal(runtime.displays[0].position.height, 16);
    assert.match(runtime.displays[0].url, /#ready$/);
    assert.match(runtime.displays[1].url, /#off$/);
    assert.equal(runtime.displays[0].allowApi, false);
    runtime.enter(1);
    assert.equal(runtime.popup.target, 'review-popup-01');
    assert.match(runtime.popup.text, /!1 /);
    runtime.popup.buttons[0].callback();
    assert.equal(runtime.opened[0], mr(1).reviewUrl);
    runtime.leave(1);
    assert.ok(runtime.closed > 0);
});

test('both validation labels and a current deployment are needed for green', async () => {
    const runtime = await office([mr(1, { labels: ['Test OK'] })]);
    assert.match(runtime.displays[0].url, /#ready$/);
    await runtime.update([mr(1, { labels: ['Test OK', 'Review OK'] })]);
    assert.match(runtime.displays[0].url, /#validated$/);
    runtime.enter(1);
    assert.match(runtime.popup.text, /Test OK \+ Review OK/);
    await runtime.update([mr(1, { current: false, labels: ['Test OK', 'Review OK'] })]);
    assert.match(runtime.displays[0].url, /#pending$/);
});

test('station allocation follows shared backend slots and reports overflow beyond 15 reviews', async () => {
    const rows = Array.from({ length: 17 }, (_, i) => mr(i + 1));
    const runtime = await office(rows);
    assert.match(runtime.banner.text, /\+2 autres reviews/);
    await runtime.update(rows.filter(row => row.iid !== 1 && row.iid !== 17)
        .map(row => row.iid === 16 ? { ...row, slot: 0 } : row).reverse(), 16);
    runtime.enter(2);
    assert.match(runtime.popup.text, /!2 /);
    runtime.enter(1);
    assert.match(runtime.popup.text, /!16 /);
    assert.match(runtime.banner.text, /\+1 autres reviews/);
});

test('invalid feed preserves the last state; stale data disables opening and cleanup releases everything', async () => {
    const runtime = await office([mr(1)]);
    runtime.enter(1);
    const oldButton = runtime.popup.buttons[0];
    await runtime.invalid({ version: 1, reviews: [] });
    assert.match(runtime.displays[0].url, /#ready$/);
    await runtime.expire();
    assert.ok(runtime.displays.every(display => /#stale$/.test(display.url)));
    assert.equal(runtime.popup.buttons.length, 0);
    oldButton.callback();
    assert.equal(runtime.opened.length, 0);
    runtime.cleanup();
    assert.equal(runtime.deleted.length, 15);
    assert.ok(runtime.subs.every(subscription => subscription.removed));
});

test('removed MRs turn the screen off and an old popup cannot open their URL', async () => {
    const runtime = await office([mr(1)]);
    runtime.enter(1);
    const button = runtime.popup.buttons[0];
    await runtime.update([]);
    assert.match(runtime.displays[0].url, /#off$/);
    button.callback();
    assert.equal(runtime.opened.length, 0);
    assert.ok(runtime.closed > 0);
});
