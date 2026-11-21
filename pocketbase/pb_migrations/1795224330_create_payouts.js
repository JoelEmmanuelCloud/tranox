migrate((app) => {
  const milestones = app.findCollectionByNameOrId("milestones");
  const jobs = app.findCollectionByNameOrId("jobs");
  const freelancers = app.findCollectionByNameOrId("freelancers");
  const collection = new Collection({
    type: "base",
    name: "payouts",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "milestone", type: "relation", collectionId: milestones.id, maxSelect: 1, cascadeDelete: false },
      { name: "job", type: "relation", collectionId: jobs.id, maxSelect: 1, cascadeDelete: false },
      { name: "freelancer", type: "relation", collectionId: freelancers.id, maxSelect: 1, cascadeDelete: false },
      { name: "source", type: "text", max: 20 },
      { name: "freelancer_wallet", type: "text", required: true, pattern: "^0x[0-9a-fA-F]{40}$" },
      { name: "currency", type: "select", required: true, maxSelect: 1, values: ["cNGN", "IDRX", "wARS", "wBRL", "wMXN", "wCOP"] },
      { name: "amount_usdt", type: "number", required: true, min: 0.01 },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["queued", "processing", "paid", "failed"] },
      { name: "started_block", type: "number", onlyInt: true, min: 0 },
      { name: "rfq_id", type: "text", max: 100 },
      { name: "approval_tx", type: "text", max: 66 },
      { name: "swap_tx", type: "text", max: 66 },
      { name: "payout_tx", type: "text", max: 66 },
      { name: "received_units", type: "text", max: 80 },
      { name: "error", type: "text", max: 2000 },
      { name: "paid_at", type: "date" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_payouts_milestone ON payouts (milestone) WHERE milestone != ''",
      "CREATE INDEX idx_payouts_status ON payouts (status)",
    ],
  });
  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("payouts"));
});
