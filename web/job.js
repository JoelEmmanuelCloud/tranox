import { api, busyButton, connect, el, errorText, icon, idFromQuery, money, notice, payUsdt, pill, short, signText, txLink, waitForReceipt } from "./app.js";
import { hydrateIcons } from "./icons.js";

const head = document.getElementById("head");
const app = document.getElementById("app");
const id = idFromQuery();
let job;
let busy = false;
let timer;

hydrateIcons();

async function pay(m, box, button) {
  busy = true;
  const restore = busyButton(button, "Waiting for wallet");
  try {
    const wallet = await connect(job.client_wallet);
    notice(box, "info", "Confirm the payment of " + money(m.amount_usdt) + " USD₮ in your wallet.");
    const hash = await payUsdt(wallet, job, m.amount_usdt);
    notice(box, "info", "Payment sent. Waiting for Celo to confirm it...");
    const receipt = await waitForReceipt(wallet.eth, hash);
    if (!receipt) notice(box, "warn", "Still confirming. Do not pay again. ", txLink(hash));
    else if (receipt.status === "0x1") {
      notice(box, "ok", m.status === "pending" ? "Paid. Approve the milestone once the work is done. " : "Paid. Tranox will convert and send it shortly. ", txLink(hash));
      button.remove();
      return;
    } else notice(box, "error", "The payment failed and no money moved. You can try again. ", txLink(hash));
    restore();
  } catch (e) {
    notice(box, "error", errorText(e));
    restore();
  } finally {
    busy = false;
  }
}

async function approve(m, box, button) {
  busy = true;
  const restore = busyButton(button, "Waiting for signature");
  try {
    const wallet = await connect(job.client_wallet);
    const challenge = await api("/api/milestones/" + m.id + "/challenge", {});
    notice(box, "info", "Sign the approval in your wallet. Signing is free and sends no money.");
    const signature = await signText(wallet, challenge.message);
    await api("/api/milestones/" + m.id + "/approve", { issued_at: challenge.issued_at, signature });
    notice(box, "ok", "Approved. " + job.freelancer.name + " is paid as soon as your payment for it has arrived.");
    button.remove();
    setTimeout(load, 1500);
  } catch (e) {
    notice(box, "error", errorText(e));
    restore();
  } finally {
    busy = false;
  }
}

function track(m) {
  const approved = m.status !== "pending";
  const paid = m.status === "paid";
  const states = [approved, paid, paid];
  const names = ["Approved", "Converted", "Sent"];
  return [
    el("div", { class: "track", "aria-hidden": "true" }, ...states.map((d) => el("span", { class: d ? "done" : "" }))),
    el("div", { class: "track-labels" }, ...names.map((n, i) => el("span", { class: states[i] ? "done" : "", text: (states[i] ? "✓ " : "") + n }))),
  ];
}

function milestoneCard(m, index) {
  const cur = job.freelancer.currency;
  const box = el("div", { class: "notice", "aria-live": "polite" });
  const local = m.payout && m.payout.received
    ? money(m.payout.received) + " " + cur + " received"
    : job.rate_per_usdt && cur ? "≈ " + money(m.amount_usdt * Number(job.rate_per_usdt), 0) + " " + cur : "";
  const buttons = [];
  if (m.status === "pending" || m.status === "waiting_funds") {
    const b = el("button", { class: "btn btn-accent", type: "button" }, icon("wallet"), "Pay " + money(m.amount_usdt) + " USD₮");
    b.addEventListener("click", () => pay(m, box, b));
    buttons.push(b);
  }
  if (m.status === "pending") {
    const b = el("button", { class: "btn btn-dark", type: "button" }, icon("pen"), "Approve");
    b.addEventListener("click", () => approve(m, box, b));
    buttons.push(b);
  }
  if (m.status === "waiting_funds") notice(box, "warn", "Approved. Tranox is waiting for your USD₮ for this milestone to arrive.");
  if (m.status === "failed") notice(box, "error", "This payout could not be completed. Contact the Tranox operator.");
  const links = m.payout && m.payout.payout_tx
    ? el("div", { class: "links" }, txLink(m.payout.swap_tx, "Conversion"), txLink(m.payout.payout_tx, "Payment"))
    : null;
  return el("article", { class: "ms fade-in", style: "animation-delay:" + index * 40 + "ms" },
    el("div", { class: "ms-top" },
      el("div", { class: "ms-main" }, el("div", { class: "ms-title", text: m.title }), pill(m.status)),
      el("div", { class: "ms-amt tnum" }, el("b", { text: money(m.amount_usdt) + " USD₮" }), el("span", { text: local })),
    ),
    ...track(m),
    buttons.length ? el("div", { class: "ms-actions" + (buttons.length === 1 ? " one" : "") }, ...buttons) : null,
    links,
    box,
  );
}

function render() {
  const f = job.freelancer;
  const total = job.milestones.reduce((s, m) => s + m.amount_usdt, 0);
  const paidUsdt = job.milestones.filter((m) => m.status === "paid").reduce((s, m) => s + m.amount_usdt, 0);
  const paidCount = job.milestones.filter((m) => m.status === "paid").length;
  const pct = total ? Math.round((paidUsdt / total) * 100) : 0;
  const fact = (ic, k, v) => el("div", { class: "fact" }, el("div", { class: "k" }, icon(ic), k), el("div", { class: "v tnum", text: v }));
  head.replaceChildren(
    el("section", { class: "balance frame fade-in", "aria-label": "Job summary" },
      el("div", { class: "label" }, icon("receipt"), job.job.client + " · " + job.job.title),
      el("div", { class: "big tnum", text: money(total) + " USD₮" }),
      el("div", { class: "sub", text: paidCount + " of " + job.milestones.length + " milestones paid to " + f.name + (f.country ? " in " + f.country : "") }),
      el("div", { class: "meter", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct), "aria-label": "Paid so far" }, el("span", { style: "width:" + pct + "%" })),
      el("div", { class: "meter-label tnum" }, el("span", { text: money(paidUsdt) + " USD₮ paid" }), el("span", { text: money(total - paidUsdt) + " USD₮ to go" })),
      el("div", { class: "facts", "aria-label": "Payment details" },
        fact("globe", "Freelancer is paid in", f.currency || "Not set"),
        fact("swap", "Today's rate", job.rate_per_usdt ? "1 USD₮ ≈ " + money(job.rate_per_usdt) + " " + f.currency : f.currency ? "Checking..." : "Unavailable"),
        fact("wallet", "Pay from", job.client_wallet ? short(job.client_wallet) : "No wallet set"),
        fact("shield", "Tranox agent", short(job.agent_wallet)),
      ),
    ),
  );
  app.replaceChildren(
    el("div", { class: "list-title" }, el("h2", { text: "Milestones" }), el("span", { text: job.milestones.length + " total" })),
    ...(job.milestones.length ? job.milestones.map(milestoneCard) : [el("div", { class: "empty-state", text: "No milestones yet." })]),
  );
  clearTimeout(timer);
  const tick = () => (busy ? (timer = setTimeout(tick, 20000)) : load());
  if (job.milestones.some((m) => ["queued", "processing", "waiting_funds"].includes(m.status))) timer = setTimeout(tick, 20000);
}

function fail(text) {
  head.replaceChildren();
  const box = el("div", { class: "notice" });
  notice(box, "error", text);
  app.replaceChildren(box);
}

async function fillRate() {
  const cur = job.freelancer.currency;
  if (job.rate_per_usdt || !cur) return;
  try {
    const r = await api("/api/rates/" + cur);
    if (r.rate_per_usdt && !busy && job.freelancer.currency === cur) {
      job.rate_per_usdt = r.rate_per_usdt;
      render();
    }
  } catch {}
}

async function load() {
  try {
    job = await api("/api/jobs/" + id);
    render();
    fillRate();
  } catch (e) {
    fail(errorText(e));
  }
}

if (id) load();
else fail("This job link is not valid. Ask for a new one.");
