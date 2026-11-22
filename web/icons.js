const NS = "http://www.w3.org/2000/svg";

const ICONS = {
  check: ["path:M20 6 9 17l-5-5"],
  clock: ["circle:12,12,10", "path:M12 6v6l4 2"],
  wallet: ["path:M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1", "path:M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"],
  arrow: ["path:M5 12h14", "path:m12 5 7 7-7 7"],
  up: ["path:M7 17 17 7", "path:M8 7h9v9"],
  shield: ["path:M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", "path:m9 12 2 2 4-4"],
  external: ["path:M15 3h6v6", "path:M10 14 21 3", "path:M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  pen: ["path:M12 20h9", "path:M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"],
  alert: ["circle:12,12,10", "path:M12 8v4", "path:M12 16h.01"],
  swap: ["path:m17 2 4 4-4 4", "path:M3 11v-1a4 4 0 0 1 4-4h14", "path:m7 22-4-4 4-4", "path:M21 13v1a4 4 0 0 1-4 4H3"],
  send: ["path:M14.5 21.7a.5.5 0 0 0 .9 0l6.5-19a.5.5 0 0 0-.6-.6l-19 6.5a.5.5 0 0 0 0 .9l7.9 3.2a2 2 0 0 1 1.1 1.1z", "path:m21.9 2.1-11 11"],
  zap: ["path:M4 14a1 1 0 0 1-.8-1.6l9.9-10.2a.5.5 0 0 1 .9.5l-1.9 6A1 1 0 0 0 13 10h7a1 1 0 0 1 .8 1.6l-9.9 10.2a.5.5 0 0 1-.9-.5l1.9-6A1 1 0 0 0 11 14z"],
  globe: ["circle:12,12,10", "path:M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", "path:M2 12h20"],
  user: ["path:M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "circle:12,7,4"],
  lock: ["rect:3,11,18,11,2", "path:M7 11V7a5 5 0 0 1 10 0v4"],
  receipt: ["path:M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", "path:M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8", "path:M12 17.5v-11"],
  coins: ["circle:8,8,6", "path:M18.1 10.4A6 6 0 1 1 10.3 18", "path:M7 6h1v4", "path:m16.7 13.9.7.7-2.8 2.8"],
};

function shape(spec) {
  const [kind, data] = spec.split(":");
  const node = document.createElementNS(NS, kind);
  if (kind === "path") node.setAttribute("d", data);
  if (kind === "circle") {
    const [cx, cy, r] = data.split(",");
    node.setAttribute("cx", cx); node.setAttribute("cy", cy); node.setAttribute("r", r);
  }
  if (kind === "rect") {
    const [x, y, w, h, rx] = data.split(",");
    node.setAttribute("x", x); node.setAttribute("y", y); node.setAttribute("width", w); node.setAttribute("height", h); node.setAttribute("rx", rx);
  }
  return node;
}

export function icon(name, extraClass = "") {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", ("icon " + extraClass).trim());
  for (const spec of ICONS[name] || []) svg.append(shape(spec));
  return svg;
}

export function hydrateIcons(root = document) {
  for (const holder of root.querySelectorAll("[data-icon]")) {
    holder.replaceWith(icon(holder.dataset.icon, holder.dataset.iconClass || ""));
  }
}

if (document.querySelector("[data-icon]")) hydrateIcons();
