migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "worker_locks",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "name", type: "text", required: true, max: 60 },
      { name: "owner", type: "text", required: true, max: 200 },
      { name: "heartbeat_at", type: "date", required: true },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_worker_locks_name ON worker_locks (name)"],
  });
  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("worker_locks"));
});
