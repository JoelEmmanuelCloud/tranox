import { api, chip, connect, el, errorText, idFromQuery, money, payUsdt, short, signText, txLink, waitForReceipt } from "./app.js";

const app = document.getElementById("app");
const id = idFromQuery();
let job;
let busy = false;
let timer;

function note(box, text, cls = "") {
  box.className = "note " + cls;
  box.textContent = text;
}

function steps(m) {
  const approved = m.status !== "pending";
  const paid = m.status === "paid";
  return el("ol", { class: "steps" },
    el("li", { class: approved ? "done" : "", text: "Approved by the client" }),
    el("li", { class: paid ? "done" : "", text: "Converted to " + (job.freelancer.currency || "local currency") }),
    el("li", { class: paid ? "done" : "", text: "Sent to " + job.freelancer.name }),
  );
}

async function pay(m, box, button) {
  busy = true;
  button.disabled = true;
  try {
    const wallet = await connect(job.client_wallet);
    note(box, "Confirm the payment in your wallet.");
    const hash = await payUsdt(wallet, job, m.amount_usdt);
    note(box, "Payment sent. Waiting for Celo to confirm it...");
    const receipt = await waitForReceipt(wallet.eth, hash);
    if (!receipt) note(box, "Still waiting for confirmation. Do not pay again. ");
    else if (receipt.status === "0x1") note(box, "Paid. " + (m.status === "pending" ? "Approve the milestone when the work is done. " : ""), "ok");
    else note(box, "The payment failed and no money moved. You can try again. ", "error");
    box.append(txLink(hash));
  } catch (e) {
    note(box, errorText(e), "error");
    button.disabled = false;
  } finally {
    busy = false;
  }
}

async function approve(m, box, button) {
  busy = true;
  button.disabled = true;
  try {
    const wallet = await connect(job.client_wallet);
    const challenge = await api("/api/milestones/" + m.id + "/challenge", {});
    note(box, "Sign the approval in your wallet. Signing is free and sends no money.");
    const signature = await signText(wallet, challenge.message);
    await api("/api/milestones/" + m.id + "/approve", { issued_at: challenge.issued_at, signature });
    note(box, "Approved. Tranox pays " + job.freelancer.name + " once your payment for it has arrived.", "ok");
    setTimeout(load, 1500);
  } catch (e) {
    note(box, errorText(e), "error");
    button.disabled = false;
  } finally {
    busy = false;
  }
}

function milestoneCard(m) {
  const box = el("p", { class: "note" });
  const cur = job.freelancer.currency;
  const estimate = m.payout && m.payout.received
    ? el("div", { class: "estimate", text: job.freelancer.name + " received " + money(m.payout.received) + " " + cur })
    : job.rate_per_usdt && cur
      ? el("div", { class: "estimate", text: "About " + money(m.amount_usdt * Number(job.rate_per_usdt)) + " " + cur + " at today's rate" })
      : null;
  const actions = el("div", { class: "actions" });
  if (m.status !== "paid" && m.status !== "processing" && m.status !== "failed") {
    const payBtn = el("button", { class: m.status === "pending" ? "secondary" : "", text: "Pay " + money(m.amount_usdt) + " USD₮" });
    payBtn.addEventListener("click", () => pay(m, box, payBtn));
    actions.append(payBtn);
  }
  if (m.status === "pending") {
    const approveBtn = el("button", { text: "Approve milestone" });
    approveBtn.addEventListener("click", () => approve(m, box, approveBtn));
    actions.append(approveBtn);
  }
  const links = m.payout && m.payout.payout_tx
    ? el("p", { class: "note" }, txLink(m.payout.swap_tx, "Conversion"), " · ", txLink(m.payout.payout_tx, "Payment to " + job.freelancer.name))
    : null;
  if (m.status === "waiting_funds") note(box, "Tranox is waiting for your USD₮ for this milestone to arrive.");
  if (m.status === "failed") note(box, "This payout could not be completed. Contact the Tranox operator.", "error");
  return el("section", { class: "card" },
    el("div", { class: "milestone-head" }, el("div", { class: "milestone-title", text: m.title }), chip(m.status)),
    el("div", { class: "amount", text: money(m.amount_usdt) + " USD₮" }),
    estimate, steps(m), actions.childElementCount ? actions : null, links, box,
  );
}

function render() {
  const total = job.milestones.reduce((s, m) => s + m.amount_usdt, 0);
  const paid = job.milestones.filter((m) => m.status === "paid").length;
  const f = job.freelancer;
  app.replaceChildren(
    el("section", { class: "card hero" },
      el("div", { class: "label", text: job.job.client + " · " + job.job.title }),
      el("div", { class: "big", text: money(total) + " USD₮" }),
      el("div", { class: "meta", text: paid + " of " + job.milestones.length + " milestones paid to " + f.name + (f.country ? " in " + f.country : "") }),
    ),
    el("section", { class: "card" },
      el("div", { class: "row" }, el("span", { text: "Freelancer is paid in" }), el("span", { text: f.currency || "not set" })),
      job.rate_per_usdt ? el("div", { class: "row" }, el("span", { text: "Today's rate" }), el("span", { text: "1 USD₮ ≈ " + money(job.rate_per_usdt) + " " + f.currency })) : null,
      el("div", { class: "row" }, el("span", { text: "Pay from" }), el("span", { text: job.client_wallet ? short(job.client_wallet) : "no wallet set" })),
      el("div", { class: "row" }, el("span", { text: "Tranox agent" }), el("span", { text: short(job.agent_wallet) })),
    ),
    el("h2", { text: "Milestones" }),
    ...(job.milestones.length ? job.milestones.map(milestoneCard) : [el("p", { class: "empty", text: "No milestones yet." })]),
  );
  clearTimeout(timer);
  const tick = () => (busy ? (timer = setTimeout(tick, 20000)) : load());
  if (job.milestones.some((m) => ["queued", "processing", "waiting_funds"].includes(m.status))) timer = setTimeout(tick, 20000);
}

async function load() {
  try {
    job = await api("/api/jobs/" + id);
    render();
  } catch (e) {
    app.replaceChildren(el("p", { class: "note error", text: errorText(e) }));
  }
}

if (id) load();
else app.replaceChildren(el("p", { class: "note error", text: "This job link is not valid. Ask for a new one." }));
