const CHAIN_ID = "0xa4ec";
const CELO = {
  chainId: CHAIN_ID,
  chainName: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: ["https://forno.celo.org"],
  blockExplorerUrls: ["https://celoscan.io"],
};

export const STATUS_TEXT = {
  pending: "Waiting for approval",
  waiting_funds: "Approved, waiting for client funds",
  queued: "Approved, in the queue",
  processing: "Converting and sending",
  paid: "Paid",
  failed: "Could not be paid",
};

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

export function idFromQuery() {
  const id = new URLSearchParams(location.search).get("id") || "";
  return /^[a-z0-9]{15}$/.test(id) ? id : null;
}

export async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export function short(a) {
  return a ? a.slice(0, 6) + "..." + a.slice(-4) : "";
}

export function money(n, max = 2) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: max }) : String(n);
}

export function txLink(hash, text) {
  return el("a", { href: "https://celoscan.io/tx/" + hash, target: "_blank", rel: "noopener", text: text || "View on Celoscan" });
}

export function chip(status) {
  return el("span", { class: "chip " + status, text: STATUS_TEXT[status] || status });
}

export function wallet() {
  if (!window.ethereum) throw new Error("No wallet found. Open this page in MiniPay or a browser with a Celo wallet.");
  return window.ethereum;
}

export async function connect(expected) {
  const eth = wallet();
  const [account] = await eth.request({ method: "eth_requestAccounts" });
  if ((await eth.request({ method: "eth_chainId" })) !== CHAIN_ID) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID }] });
    } catch (e) {
      if (e.code !== 4902) throw e;
      await eth.request({ method: "wallet_addEthereumChain", params: [CELO] });
    }
  }
  if (expected && (!account || account.toLowerCase() !== expected.toLowerCase())) {
    throw new Error("Connected wallet " + short(account || "none") + " is not the client wallet on this job (" + short(expected) + "). Switch wallets and try again.");
  }
  return { eth, account };
}

const pad = (hex) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");

function toUnits(amount, decimals) {
  const [whole, frac = ""] = String(amount).split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(frac) || frac.length > decimals) throw new Error("Unreadable amount " + amount);
  return BigInt(whole + frac.padEnd(decimals, "0"));
}

async function call(eth, to, data) {
  return BigInt(await eth.request({ method: "eth_call", params: [{ to, data }, "latest"] }));
}

export async function payUsdt({ eth, account }, job, amount) {
  const decimals = Number(await call(eth, job.usdt, "0x313ce567"));
  const units = toUnits(amount, decimals);
  if ((await call(eth, job.usdt, "0x70a08231" + pad(account))) < units) throw new Error("Not enough USD₮ in this wallet for " + amount + " USD₮.");
  const data = "0xa9059cbb" + pad(job.agent_wallet) + pad(units.toString(16)) + job.data_suffix.replace(/^0x/, "");
  return eth.request({ method: "eth_sendTransaction", params: [{ from: account, to: job.usdt, data }] });
}

export async function waitForReceipt(eth, hash) {
  for (let i = 0; i < 60; i++) {
    const r = await eth.request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (r) return r;
    await new Promise((ok) => setTimeout(ok, 3000));
  }
  return null;
}

export async function signText({ eth, account }, message) {
  const hex = "0x" + Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, "0")).join("");
  return eth.request({ method: "personal_sign", params: [hex, account] });
}

export function errorText(e) {
  if (e && e.code === 4001) return "Cancelled in the wallet.";
  return (e && e.message) || String(e);
}
