migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "freelancers",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "name", type: "text", required: true, max: 120 },
      { name: "handle", type: "text", max: 120 },
      { name: "country", type: "text", max: 60 },
      { name: "wallet_address", type: "text", required: true, pattern: "^0x[0-9a-fA-F]{40}$" },
      { name: "payout_currency", type: "select", required: true, maxSelect: 1, values: ["cNGN", "IDRX", "wARS", "wBRL", "wMXN", "wCOP"] },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("freelancers"));
});
