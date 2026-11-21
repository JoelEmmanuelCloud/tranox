migrate((app) => {
  const jobs = app.findCollectionByNameOrId("jobs");
  const collection = new Collection({
    type: "base",
    name: "milestones",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "job", type: "relation", required: true, collectionId: jobs.id, maxSelect: 1, cascadeDelete: false },
      { name: "title", type: "text", required: true, max: 200 },
      { name: "amount_usdt", type: "number", required: true, min: 0.01 },
      { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "approved"] },
      { name: "approved_at", type: "date" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("milestones"));
});
