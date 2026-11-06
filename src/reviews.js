/* global WA */
(async () => {
    await WA.onInit();
    const map = await WA.room.getTiledMap();
    const properties = new Map((map.properties || []).map(property => [property.name, property.value]));
    const endpoint = properties.get("reviewsEndpoint");
    const validationLabels = [properties.get("reviewsTestLabel"), properties.get("reviewsReviewLabel")];
    const hasValidationRule = validationLabels.every(label => typeof label === "string" && label.length > 0);
    const objects = [];
    function collect(layers, x = 0, y = 0) {
        for (const layer of layers || []) {
            const offsetX = x + (layer.offsetx || 0);
            const offsetY = y + (layer.offsety || 0);
            for (const object of layer.objects || []) objects.push({ ...object, x: object.x + offsetX, y: object.y + offsetY });
            collect(layer.layers, offsetX, offsetY);
        }
    }
    collect(map.layers);
    const byName = new Map(objects.map(object => [object.name, object]));
    const screens = objects.filter(object => /^review-screen-\d+$/.test(object.name))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const office = screens.length > 0;
    const displays = [];
    const layout = office ? screens.map((screen, slot) => {
        const suffix = screen.name.slice("review-screen-".length);
        const zoneName = `review-zone-${suffix}`;
        const popupName = `review-popup-${suffix}`;
        if (!byName.has(zoneName) || !byName.has(popupName) || screen.width <= 0 || screen.height <= 0) {
            throw new Error(`Poste incomplet : ${screen.name}`);
        }
        const url = new URL(properties.get("reviewsScreenUrl") || "review-screen.html", WA.room.mapURL).href;
        const display = WA.room.website.create({ name: `review-display-${suffix}`, url: `${url}#stale`,
            position: { x: screen.x, y: screen.y, width: screen.width, height: screen.height },
            origin: "map", scale: 1, visible: true, allowApi: false });
        displays.push(display);
        return { slot, zoneName, popupName, display, url, state: "stale" };
    }) : Array.from({ length: 48 }, (_, slot) => ({ slot, zoneName: `review-${slot}`, popupName: `review-popup-${slot}` }));
    let snapshot;
    let assignments = new Map();
    let activeSlot = null;
    let popup;
    let popupKey;
    let stopped = false;
    let timer;
    const subscriptions = [];
    const stale = () => !snapshot || Date.now() - Date.parse(snapshot.updatedAt) > 180000;
    const validated = review => hasValidationRule && review.current && validationLabels.every(label => (review.labels || []).includes(label));
    function stateFor(review) {
        if (stale()) return "stale";
        if (!review) return "off";
        if (!review.current) return "pending";
        return validated(review) ? "validated" : "ready";
    }
    function closePopup() { popup?.close(); popup = undefined; popupKey = undefined; }
    function showReview(slot) {
        const review = assignments.get(slot);
        const unavailable = stale();
        const key = review ? JSON.stringify([slot, review, unavailable]) : undefined;
        if (key === popupKey) return;
        closePopup();
        if (!review) return;
        const status = unavailable ? "Données périmées : ouverture suspendue." :
            !review.current ? "Des commits plus récents restent à déployer : les validations précédentes ne suffisent plus." :
            validated(review) ? "Test OK + Review OK : review validée." : "Review disponible, à tester ou à valider.";
        popupKey = key;
        const canOpen = () => !stale() && assignments.get(slot)?.iid === review.iid
            && assignments.get(slot)?.reviewUrl === review.reviewUrl;
        popup = WA.ui.openPopup(layout[slot].popupName, `!${review.iid} — ${review.title}\n${review.branch}\n${status}`, unavailable ? [] : [
            { label: "Ouvrir Airmes", className: "primary", callback: () => { if (canOpen()) WA.nav.openTab(review.reviewUrl); } },
            { label: "Voir la MR", callback: () => { if (canOpen()) WA.nav.openTab(review.mrUrl); } },
        ]);
    }
    function assignReviews() {
        // Slots come from the shared n8n snapshot so all players see the same MR at the same screen.
        assignments = new Map(snapshot.reviews.filter(review => review.slot < layout.length)
            .map(review => [review.slot, review]));
    }
    function draw() {
        const expired = stale();
        if (office) {
            for (const item of layout) {
                const state = stateFor(assignments.get(item.slot));
                if (state !== item.state) { item.display.url = `${item.url}#${state}`; item.state = state; }
            }
        } else {
            WA.room.setTiles(layout.map(({ slot }) => {
                const review = assignments.get(slot);
                return { x: 4 + (slot % 8) * 6, y: 8 + Math.floor(slot / 8) * 6,
                    tile: review ? (expired ? "airmes-review-stale" : review.current ? "airmes-review-current" : "airmes-review-pending") : null, layer: "reviews" };
            }));
        }
        const others = snapshot ? Math.max(0, snapshot.available - assignments.size) : 0;
        const text = snapshot
            ? `${assignments.size} reviews affichées · ${snapshot.totalOpen} MR ouvertes${others ? ` · +${others} autres reviews` : ""}${expired ? " · Données périmées" : " · Approchez un écran"}`
            : "Reviews Airmes · Connexion à GitLab…";
        WA.ui.banner.openBanner({ id: "airmes-reviews", text,
            bgColor: expired ? "#92400e" : "#173547", textColor: "#ffffff", closable: false,
            link: { url: "https://gitlab.eoloa.eu/airmes/airmes/-/merge_requests?state=opened", label: "Toutes les MR" } });
    }
    for (const { slot, zoneName } of layout) {
        subscriptions.push(WA.room.area.onEnter(zoneName).subscribe(() => { activeSlot = slot; showReview(slot); }));
        subscriptions.push(WA.room.area.onLeave(zoneName).subscribe(() => {
            if (activeSlot === slot) { activeSlot = null; closePopup(); }
        }));
    }
    async function refresh() {
        try {
            const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15000), credentials: "omit" });
            if (!response.ok) throw new Error("Feed unavailable");
            const next = await response.json();
            if (next.version !== 1 || !Number.isFinite(Date.parse(next.updatedAt)) || Date.parse(next.updatedAt) > Date.now() + 60000
                || !Array.isArray(next.reviews) || !Number.isInteger(next.available) || next.available < next.reviews.length
                || !Number.isInteger(next.totalOpen) || next.totalOpen < 0) throw new Error("Invalid feed");
            const slots = new Set();
            const iids = new Set();
            for (const review of next.reviews) {
                const url = new URL(review.reviewUrl);
                if (!Number.isInteger(review.slot) || review.slot < 0 || review.slot >= 48 || slots.has(review.slot)
                    || !Number.isInteger(review.iid) || review.iid < 1 || iids.has(review.iid)
                    || typeof review.title !== "string" || typeof review.branch !== "string" || typeof review.current !== "boolean"
                    || (review.labels !== undefined && (!Array.isArray(review.labels) || review.labels.some(label => typeof label !== "string")))
                    || url.protocol !== "https:" || !/^review-[a-z0-9-]+\.application-airmes\.eu$/.test(url.hostname)
                    || url.origin !== review.reviewUrl || review.mrUrl !== `https://gitlab.eoloa.eu/airmes/airmes/-/merge_requests/${review.iid}`) throw new Error("Invalid review");
                slots.add(review.slot);
                iids.add(review.iid);
            }
            if (!stopped) { snapshot = next; assignReviews(); }
        } catch { /* Keep the last valid snapshot; visibly expire it after three minutes. */ }
        if (stopped) return;
        draw();
        if (activeSlot !== null) showReview(activeSlot);
        timer = setTimeout(refresh, 30000);
    }
    window.addEventListener("pagehide", () => {
        stopped = true;
        clearTimeout(timer);
        subscriptions.forEach(subscription => subscription.unsubscribe());
        for (const display of displays) WA.room.website.delete(display.name).catch(() => {});
        closePopup();
        WA.ui.banner.closeBanner();
    }, { once: true });
    draw();
    await refresh();
})().catch(() => {
    WA.ui.banner.openBanner({ id: "airmes-reviews", text: "Reviews indisponibles : configuration des postes à vérifier.",
        bgColor: "#92400e", textColor: "#ffffff", closable: false });
});
