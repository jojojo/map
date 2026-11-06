/** Only successful GitLab review deployments attached to an open MR become desks. */
function buildSnapshot(mrs, environments, previous = {}, now = new Date().toISOString()) {
    const capacity = 15;
    const byIid = new Map(mrs.map((mr) => [mr.iid, mr]));
    const candidates = new Map();
    for (const env of environments) {
        if (env.state !== "available" || !env.name?.startsWith("review/")) continue;
        const deployment = env.last_deployment;
        if (deployment?.status !== "success") continue;
        const match = /^refs\/merge-requests\/(\d+)\/head$/.exec(deployment.ref || "");
        const mr = match
            ? byIid.get(Number(match[1]))
            : mrs.find((item) => item.source_branch === deployment.ref);
        if (!mr || mr.state !== "opened") continue;
        if (typeof env.external_url !== "string" || !/^https:\/\/review-[a-z0-9-]+\.application-airmes\.eu\/?$/.test(env.external_url)) continue;
        candidates.set(mr.iid, {
            iid: mr.iid, title: mr.title, branch: mr.source_branch, draft: Boolean(mr.draft),
            reviewUrl: env.external_url.replace(/\/$/, ""), mrUrl: `https://gitlab.eoloa.eu/airmes/airmes/-/merge_requests/${mr.iid}`,
            deployedAt: deployment.updated_at || deployment.created_at || null,
            current: deployment.sha === mr.sha,
            labels: (Array.isArray(mr.labels) ? mr.labels : []).filter(label => label === "Test OK" || label === "Review OK"),
        });
    }
    const used = new Set();
    const reviews = [...candidates.values()].sort((a, b) => a.iid - b.iid);
    for (const review of reviews) {
        const slot = previous.reviews?.find((old) => old.iid === review.iid)?.slot;
        if (Number.isInteger(slot) && slot >= 0 && slot < capacity && !used.has(slot)) {
            review.slot = slot;
            used.add(slot);
        }
    }
    const priority = review => review.current
        ? (review.labels.includes("Test OK") && review.labels.includes("Review OK") ? 2 : 0)
        : 1;
    for (const review of [...reviews].sort((a, b) => priority(a) - priority(b) || a.iid - b.iid)) {
        if (review.slot !== undefined) continue;
        const slot = Array.from({ length: capacity }, (_, i) => i).find((i) => !used.has(i));
        if (slot === undefined) break;
        review.slot = slot;
        used.add(slot);
    }
    return { version: 1, updatedAt: now, totalOpen: mrs.length,
        available: reviews.length, overflow: Math.max(0, reviews.length - capacity),
        reviews: reviews.filter((review) => review.slot !== undefined) };
}

module.exports = { buildSnapshot };
