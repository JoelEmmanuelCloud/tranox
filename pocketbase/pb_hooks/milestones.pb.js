onRecordCreate((e) => {
  if (e.record.getString("status") !== "pending") {
    throw new BadRequestError("New milestones must start as pending.");
  }
  e.next();
}, "milestones");

onRecordUpdate((e) => {
  const before = e.record.original();
  const wasApproved = before.getString("status") === "approved";
  const isApproved = e.record.getString("status") === "approved";

  if (wasApproved) {
    const locked = ["status", "amount_usdt", "job"].filter((f) => String(before.get(f)) !== String(e.record.get(f)));
    if (locked.length > 0) {
      throw new BadRequestError("An approved milestone cannot change: " + locked.join(", ") + ".");
    }
    return e.next();
  }
  if (!isApproved) return e.next();

  const job = e.app.findRecordById("jobs", e.record.getString("job"));
  const freelancer = e.app.findRecordById("freelancers", job.getString("freelancer"));
  const wallet = freelancer.getString("wallet_address");
  const currency = freelancer.getString("payout_currency");
  const amount = e.record.getFloat("amount_usdt");
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    throw new BadRequestError("Freelancer " + freelancer.id + " has no valid wallet_address.");
  }
  if (!currency) {
    throw new BadRequestError("Freelancer " + freelancer.id + " has no payout_currency.");
  }
  const clientWallet = job.getString("client_wallet").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(clientWallet)) {
    throw new BadRequestError("Job " + job.id + " has no valid client_wallet.");
  }
  if (clientWallet === wallet.toLowerCase()) {
    throw new BadRequestError("Job " + job.id + " client_wallet is the freelancer's own wallet.");
  }
  if (!(amount >= 1)) {
    throw new BadRequestError("Milestone amount_usdt must be at least 1 USDT, the smallest swap Textile FX quotes.");
  }

  e.record.set("approved_at", new Date().toISOString());

  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    e.next();
    const payout = new Record(txApp.findCollectionByNameOrId("payouts"));
    payout.set("milestone", e.record.id);
    payout.set("job", job.id);
    payout.set("freelancer", freelancer.id);
    payout.set("source", "milestone");
    payout.set("freelancer_wallet", wallet);
    payout.set("client_wallet", clientWallet);
    payout.set("funded_since", job.getDateTime("created"));
    payout.set("currency", currency);
    payout.set("amount_usdt", amount);
    payout.set("status", "queued");
    txApp.save(payout);
  });
}, "milestones");
