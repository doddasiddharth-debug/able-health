/* Visitor counts, via GoatCounter (goatcounter.com).

   No cookies, no personal data, nothing that identifies a visitor: only
   aggregate counts of pages, referrers, countries, browsers and screen sizes.
   One GoatCounter site covers every ABLE site, so every path is prefixed with
   the host (ableinitiatives.com/…, prep.…, business.…) to keep them apart.
   Visits from localhost aren't counted, so local testing doesn't show up.

   Load it with `defer`. Add `data-spa` on hash-routed apps (the course sites)
   so each view (#fl-lesson-2, #/bank …) counts as a page.

   window.ableTrack("quiz-pass/fl-3") records an interaction as an event.
   Clicks on email links and on links to other sites are recorded here.
   If the counter is blocked, everything here quietly does nothing. */
(() => {
  "use strict";
  const CODE = "siddo"; // the GoatCounter site code: <CODE>.goatcounter.com
  const me = document.currentScript;
  const spa = !!(me && me.hasAttribute("data-spa"));
  const host = location.host;

  const gc = (window.goatcounter = window.goatcounter || {});
  gc.endpoint = `https://${CODE}.goatcounter.com/count`;
  gc.path = (p) => host + p;
  if (spa) gc.no_onload = true;

  const queue = [];
  const send = (vars) => {
    if (typeof window.goatcounter.count === "function") window.goatcounter.count(vars);
    else queue.push(vars);
  };
  const view = () => send({ path: host + location.pathname + location.hash, title: document.title });
  const seen = new Set();

  // An interaction. `once` records it at most once per page load.
  window.ableTrack = (name, once) => {
    if (once) { if (seen.has(name)) return; seen.add(name); }
    send({ path: `${host}/${name}`, title: name, event: true });
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (/^mailto:/i.test(href)) { window.ableTrack(`email/${href.slice(7).split("?")[0]}`); return; }
    let u;
    try { u = new URL(a.href); } catch (err) { return; }
    if (/^https?:$/.test(u.protocol) && u.host !== host) window.ableTrack(`outbound/${u.host}${u.pathname === "/" ? "" : u.pathname}`);
  }, true);

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.onload = () => {
    if (spa) view();
    queue.splice(0).forEach(send);
  };
  document.head.append(s);
  if (spa) window.addEventListener("hashchange", view);
})();
