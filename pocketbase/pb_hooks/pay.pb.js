routerAdd("GET", "/api/tranox/pay/{id}", (e) => {
  const id = e.request.pathValue("id");
  if (!/^[a-z0-9]{15}$/.test(id)) {
    throw new BadRequestError("Invalid milestone id.");
  }

  const agentWallet = $os.getenv("TRANOX_AGENT_WALLET");
  const dataSuffix = $os.getenv("TRANOX_DATA_SUFFIX");
  if (!/^0x[0-9a-fA-F]{40}$/.test(agentWallet) || !/^0x[0-9a-fA-F]+$/.test(dataSuffix)) {
    throw new ApiError(503, "Payments are not open yet.");
  }

  let milestone;
  try {
    milestone = e.app.findRecordById("milestones", id);
  } catch (err) {
    throw new NotFoundError("Milestone not found.");
  }
  const job = e.app.findRecordById("jobs", milestone.getString("job"));
  const clientWallet = job.getString("client_wallet");
  if (!/^0x[0-9a-fA-F]{40}$/.test(clientWallet)) {
    throw new BadRequestError("This job has no client wallet yet.");
  }

  let payoutStatus = "";
  try {
    const payout = e.app.findFirstRecordByFilter("payouts", "milestone = {:m}", { m: milestone.id });
    payoutStatus = payout.getString("status");
  } catch (err) {
    payoutStatus = "";
  }

  return e.json(200, {
    milestone: milestone.id,
    title: milestone.getString("title"),
    job: job.getString("title"),
    amount_usdt: milestone.getFloat("amount_usdt"),
    status: milestone.getString("status"),
    payout_status: payoutStatus,
    client_wallet: clientWallet,
    agent_wallet: agentWallet,
    data_suffix: dataSuffix,
  });
});
