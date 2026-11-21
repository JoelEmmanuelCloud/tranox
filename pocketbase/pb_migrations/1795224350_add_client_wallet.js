migrate((app) => {
  const jobs = app.findCollectionByNameOrId("jobs");
  jobs.fields.add(new TextField({ name: "client_wallet", pattern: "^0x[0-9a-fA-F]{40}$" }));
  app.save(jobs);

  const payouts = app.findCollectionByNameOrId("payouts");
  payouts.fields.add(new TextField({ name: "client_wallet", pattern: "^0x[0-9a-f]{40}$" }));
  payouts.fields.add(new DateField({ name: "funded_since" }));
  payouts.fields.add(new DateField({ name: "funded_at" }));
  payouts.addIndex("idx_payouts_client_wallet", false, "client_wallet", "client_wallet != ''");
  app.save(payouts);
}, (app) => {
  const payouts = app.findCollectionByNameOrId("payouts");
  payouts.removeIndex("idx_payouts_client_wallet");
  payouts.fields.removeByName("client_wallet");
  payouts.fields.removeByName("funded_since");
  payouts.fields.removeByName("funded_at");
  app.save(payouts);

  const jobs = app.findCollectionByNameOrId("jobs");
  jobs.fields.removeByName("client_wallet");
  app.save(jobs);
});
