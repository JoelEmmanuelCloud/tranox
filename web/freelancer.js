import { api, el, errorText, icon, idFromQuery, money, notice, pill, STATUS, txLink } from "./app.js";
import { hydrateIcons } from "./icons.js";

const head = document.getElementById("head");
const app = document.getElementById("app");
const id = idFromQuery();
let timer;

hydrateIcons();

function payoutCard(p, rate, currency, index) {
  const received = p.payout && p.payout.received;
  const main = received ? money(received) + " " + p.currency : money(p.amount_usdt) + " USD₮";
  const sub = received
    ? "from " + money(p.amount_usdt) + " USD₮"
    : rate && currency === p.currency ? "≈ " + money(p.amount_usdt * Number(rate), 0) + " " + p.currency : "";
  const links = p.payout && p.payout.payout_tx
    ? el("div", { class: "links" }, txLink(p.payout.payout_tx, "Payment to you"), txLink(p.payout.swap_tx, "Conversion"))
    : null;
  let info = null;
  if (p.status === "waiting_funds") {
    info = el("div", { class: "notice" });
    notice(info, "warn", "Approved. Waiting for the client's payment to arrive.");
  }
  return el("article", { class: "ms fade-in", style: "animation-delay:" + index * 40 + "ms" },
    el("div", { class: "ms-top" },
      el("div", { class: "ms-icon " + p.status }, icon((STATUS[p.status] || STATUS.pending).icon, "icon-lg")),
      el("div", { class: "ms-main" },
        el("div", { class: "ms-title", text: p.milestone || "Payout" }),
        p.job ? el("div", { class: "ms-sub", text: p.job }) : null,
        pill(p.status),
      ),
      el("div", { class: "ms-amt tnum" }, el("b", { text: main }), el("span", { text: sub })),
    ),
    links,
    info,
  );
}

function render(data) {
  const f = data.freelancer;
  const paid = data.payouts.filter((p) => p.status === "paid");
  const totals = {};
  for (const p of paid) if (p.payout && p.payout.received) totals[p.currency] = (totals[p.currency] || 0) + Number(p.payout.received);
  const totalText = Object.entries(totals).map(([c, v]) => money(v) + " " + c).join(" + ") || "0 " + (f.currency || "");
  const pending = data.payouts.filter((p) => p.status !== "paid" && p.status !== "failed").reduce((s, p) => s + p.amount_usdt, 0);
  head.replaceChildren(
    el("section", { class: "balance fade-in", "aria-label": "Your earnings" },
      el("div", { class: "label" }, icon("user"), "Hi " + f.name + ", you have received"),
      el("div", { class: "big tnum", text: totalText }),
      el("div", { class: "sub", text: paid.length + " of " + data.payouts.length + " payouts paid" + (pending ? " · " + money(pending) + " USD₮ on the way" : "") }),
    ),
  );
  const fact = (ic, k, v) => el("div", { class: "fact" }, el("div", { class: "k" }, icon(ic), k), el("div", { class: "v tnum", text: v }));
  app.replaceChildren(
    el("section", { class: "panel facts fade-in", "aria-label": "Payout details" },
      fact("globe", "You are paid in", f.currency || "Not set"),
      fact("swap", "Today's rate", data.rate_per_usdt ? "1 USD₮ ≈ " + money(data.rate_per_usdt) + " " + f.currency : "Unavailable"),
    ),
    el("div", { class: "list-title" }, el("h2", { text: "Payouts" }), el("span", { text: data.payouts.length + " total" })),
    ...(data.payouts.length
      ? data.payouts.map((p, i) => payoutCard(p, data.rate_per_usdt, f.currency, i))
      : [el("div", { class: "empty-state", text: "No payouts yet. They appear here as soon as a client approves a milestone." })]),
  );
  clearTimeout(timer);
  if (data.payouts.some((p) => ["queued", "processing", "waiting_funds"].includes(p.status))) timer = setTimeout(load, 20000);
}

function fail(text) {
  head.replaceChildren();
  const box = el("div", { class: "notice" });
  notice(box, "error", text);
  app.replaceChildren(box);
}

async function load() {
  try {
    render(await api("/api/freelancers/" + id));
  } catch (e) {
    fail(errorText(e));
  }
}

if (id) load();
else fail("This link is not valid. Ask for a new one.");
