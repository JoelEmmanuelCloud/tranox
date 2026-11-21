import { api, chip, el, errorText, idFromQuery, money, txLink } from "./app.js";

const app = document.getElementById("app");
const id = idFromQuery();
let timer;

function payoutCard(p, rate, currency) {
  const received = p.payout && p.payout.received;
  const amountText = received ? money(received) + " " + p.currency : money(p.amount_usdt) + " USD₮";
  const detail = received
    ? "From " + money(p.amount_usdt) + " USD₮"
    : rate && currency === p.currency
      ? "About " + money(p.amount_usdt * Number(rate)) + " " + p.currency + " at today's rate"
      : null;
  return el("section", { class: "card" },
    el("div", { class: "milestone-head" },
      el("div", {}, el("div", { class: "milestone-title", text: p.milestone || "Payout" }), p.job ? el("div", { class: "estimate", text: p.job }) : null),
      chip(p.status),
    ),
    el("div", { class: "amount", text: amountText }),
    detail ? el("div", { class: "estimate", text: detail }) : null,
    p.payout && p.payout.payout_tx ? el("p", { class: "note" }, txLink(p.payout.payout_tx, "Payment to your wallet"), " · ", txLink(p.payout.swap_tx, "Conversion")) : null,
  );
}

function render(data) {
  const f = data.freelancer;
  const paid = data.payouts.filter((p) => p.status === "paid");
  const totals = {};
  for (const p of paid) if (p.payout && p.payout.received) totals[p.currency] = (totals[p.currency] || 0) + Number(p.payout.received);
  const totalText = Object.entries(totals).map(([c, v]) => money(v) + " " + c).join(" + ") || "0 " + (f.currency || "");
  app.replaceChildren(
    el("section", { class: "card hero" },
      el("div", { class: "label", text: "Hi " + f.name + ", you have received" }),
      el("div", { class: "big", text: totalText }),
      el("div", { class: "meta", text: paid.length + " of " + data.payouts.length + " payouts paid" + (data.rate_per_usdt ? " · 1 USD₮ ≈ " + money(data.rate_per_usdt) + " " + f.currency + " today" : "") }),
    ),
    el("h2", { text: "Payouts" }),
    ...(data.payouts.length ? data.payouts.map((p) => payoutCard(p, data.rate_per_usdt, f.currency)) : [el("p", { class: "empty", text: "No payouts yet. They appear here when a client approves a milestone." })]),
  );
  clearTimeout(timer);
  if (data.payouts.some((p) => ["queued", "processing", "waiting_funds"].includes(p.status))) timer = setTimeout(load, 20000);
}

async function load() {
  try {
    render(await api("/api/freelancers/" + id));
  } catch (e) {
    app.replaceChildren(el("p", { class: "note error", text: errorText(e) }));
  }
}

if (id) load();
else app.replaceChildren(el("p", { class: "note error", text: "This link is not valid. Ask for a new one." }));
