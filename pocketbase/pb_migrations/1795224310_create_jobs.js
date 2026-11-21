migrate((app) => {
  const freelancers = app.findCollectionByNameOrId("freelancers");
  const collection = new Collection({
    type: "base",
    name: "jobs",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "title", type: "text", required: true, max: 200 },
      { name: "client", type: "text", required: true, max: 120 },
      { name: "freelancer", type: "relation", required: true, collectionId: freelancers.id, maxSelect: 1, cascadeDelete: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("jobs"));
});
