import { getStore } from "@netlify/blobs";
const CODE = /^[A-Za-z0-9_-]{8,64}$/;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const json = (body, status = 200) =>
new Response(JSON.stringify(body), {
status,
headers: { "content-type": "application/json", "cache-control": "no-store" }
});
const daysIn = (ym) => {
const [y, m] = ym.split("-").map(Number);
return new Date(y, m, 0).getDate();
};
export default async (req) => {
const url = new URL(req.url);
const code = req.headers.get("x-household") || url.searchParams.get("hh") || "";
if (!CODE.test(code)) return json({ ok: false, error: "Missing or malformed household code." }, 400);
let bundle = null;
try {
const store = getStore({ name: "beit-budget", consistency: "strong" });
bundle = await store.get(code, { type: "json" });
} catch (e) {
return json({ ok: false, error: "Store unavailable: " + e.message }, 500);
}
if (!bundle || !bundle.model) return json({ ok: true, empty: true, note: "No budget stored for this code yet." });
const model = bundle.model;
const entries = Array.isArray(bundle.entries) ? bundle.entries : [];
const postings = bundle.postings || {};
const lines = Array.isArray(model.lines) ? model.lines : [];
const now = new Date();
const today = now.toISOString().slice(0, 10);
const thisMonth = today.slice(0, 7);
const month = url.searchParams.get("m") || thisMonth;
const off = postings[month] || {};
const started = month >= (model.startMonth || "1970-01");
const arrived = month <= thisMonth;
const posts = (l) => started && arrived && l.cls === "Fixed" && off[l.id] !== false;
const mine = entries.filter((e) => e.month === month);
const spentBy = {};
lines.forEach((l) => { if (posts(l)) spentBy[l.id] = (spentBy[l.id] || 0) + (Number(l.amount) || 0); });
mine.forEach((e) => { spentBy[e.lineId] = (spentBy[e.lineId] || 0) + (Number(e.amount) || 0); });
const income = (Number(model.income) || 0) + (Number(model.extraIncome) || 0);
const budget = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
const spent = Object.values(spentBy).reduce((a, b) => a + b, 0);
const unpaid = [];
lines.forEach((l) => {
if (!started || !arrived) return;
const paid = mine.some((e) => e.lineId === l.id);
if ((l.cls === "Giving" || l.cls === "Debt") && !paid) unpaid.push({ cat: l.cat, name: l.name, amount: r2(l.amount), why: l.cls === "Debt" ? "loan payment" : "giving" });
else if (l.cls === "Fixed" && off[l.id] === false) unpaid.push({ cat: l.cat, name: l.name, amount: r2(l.amount), why: "switched off this month" });
});
const committed = unpaid.reduce((s, u) => s + u.amount, 0);
const total = daysIn(month);
const elapsed = month === thisMonth ? now.getDate() : (arrived ? total : 0);
const logged = new Set(mine.map((e) => e.date)).size;
const factor = elapsed > 0 ? total / elapsed : 1;
const perLine = lines
.map((l) => {
const s = spentBy[l.id] || 0;
const b = Number(l.amount) || 0;
const projected = l.cls === "Variable" ? s * factor : Math.max(s, elapsed > 0 ? b : 0);
return { cat: l.cat, name: l.name, cls: l.cls, budget: r2(b), spent: r2(s), left: r2(b - s), projected: r2(projected) };
})
.filter((x) => x.budget > 0 || x.spent > 0);
return json({
ok: true,
month,
asOf: today,
daysElapsed: elapsed,
daysInMonth: total,
daysWithEntries: logged,
entryCount: mine.length,
income: r2(income),
budget: r2(budget),
spent: r2(spent),
committedUnpaid: r2(committed),
left: r2(budget - spent),
free: r2(budget - spent - committed),
projectedMonthEnd: r2(perLine.reduce((s, x) => s + x.projected, 0)),
lines: perLine,
unpaid,
overBudget: perLine.filter((x) => x.spent > x.budget).map((x) => ({ name: x.name, over: r2(x.spent - x.budget) })),
headingOver: perLine.filter((x) => x.cls === "Variable" && x.projected > x.budget + 1)
.sort((a, b) => (b.projected - b.budget) - (a.projected - a.budget))
.slice(0, 5).map((x) => ({ name: x.name, projected: x.projected, budget: x.budget })),
recent: mine.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12)
.map((e) => {
const l = lines.find((x) => x.id === e.lineId);
return { date: e.date, desc: e.desc || "", amount: r2(e.amount), line: l ? l.cat + ": " + l.name : "unassigned", by: e.by || "" };
})
});
};

