/* ABLE course sites (business., health., engineering.ableinitiatives.com …)

   One script for every branch's course site. What differs between sites (the
   branch name, colours, logo, domain, its courses) lives in the page, in
   <script type="application/json" id="site-config">, so this file is the
   same everywhere: copy it between the repos unchanged.

   Every view is already in index.html, so with no JS the page is every
   course top to bottom. This script turns it into an app like the SAT one:
   a router that shows one view at a time, a catalog of courses (#home),
   and for each course its dashboard, lessons, quiz grading and certificate,
   plus the shared calculators and glossary. Progress is kept per course in
   localStorage. Nothing leaves the browser.

   A course is a set of views carrying data-course="<id>":
     #<id>                 its dashboard       #<id>-lesson-N   lesson N
     #<id>-certificate     its certificate
   and an entry in the config's "courses".
*/
(() => {
  "use strict";
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const PASS = 4;
  // Anonymous interaction counts (analytics.js); a no-op if it isn't loaded.
  const track = (name, once) => window.ableTrack?.(name, once);

  const CFG = JSON.parse(document.getElementById("site-config").textContent);
  const SITE = CFG.site;
  const COURSES = CFG.courses;

  // Links from before there were several courses (and the old course page on
  // ableinitiatives.com, which forwards #lesson-N, #certificate, #dashboard).
  const alias = (id) => {
    if (CFG.aliases && CFG.aliases[id]) return CFG.aliases[id];
    const m = CFG.lessonAlias && /^lesson-(\d+)$/.exec(id);
    return m ? `${CFG.lessonAlias}-lesson-${m[1]}` : id;
  };

  const views = $$("[data-view]");
  const courses = Object.keys(COURSES).map((id) => {
    const c = { id, ...COURSES[id] };
    c.lessons = $$(`[data-view][data-course="${id}"] article.lesson[data-lesson]`);
    c.total = c.lessons.length;
    c.load = () => {
      try { return JSON.parse(localStorage.getItem(c.key)) || { passed: {}, best: {} }; }
      catch (e) { return { passed: {}, best: {} }; }
    };
    c.state = c.load();
    c.save = () => {
      try { localStorage.setItem(c.key, JSON.stringify(c.state)); } catch (e) { /* private mode: this visit only */ }
    };
    c.done = () => c.lessons.filter((l) => c.state.passed[l.dataset.lesson]).length;
    c.cert = $(`[data-course-cert="${id}"]`);
    return c;
  }).filter((c) => c.total);
  const byId = Object.fromEntries(courses.map((c) => [c.id, c]));

  // Progress carried over from the first course's old home on
  // ableinitiatives.com: its forwarding page passes what that browser had
  // saved as ?progress=… Merged, keeping the better result per lesson, then
  // the parameter is dropped from the address bar.
  (() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("progress");
    const c = byId[CFG.importProgressTo];
    if (!raw || !c) return;
    try {
      const old = JSON.parse(raw);
      if (old && typeof old === "object") {
        const s = c.state;
        Object.keys(old.passed || {}).forEach((k) => { if (/^[1-6]$/.test(k) && old.passed[k] === true) s.passed[k] = true; });
        Object.keys(old.best || {}).forEach((k) => {
          const v = Number(old.best[k]);
          if (/^[1-6]$/.test(k) && Number.isInteger(v) && v >= 0 && v <= 5) s.best[k] = Math.max(v, s.best[k] || 0);
        });
        if (typeof old.name === "string" && !s.name) s.name = old.name.slice(0, 60);
        if (Number.isFinite(old.completedAt) && !s.completedAt) s.completedAt = old.completedAt;
        c.save();
      }
    } catch (e) { /* malformed: ignore */ }
    params.delete("progress");
    const qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : "") + location.hash);
  })();

  // ---------- progress ----------
  const render = (c) => {
    const s = c.state, total = c.total, done = c.done();
    const scope = $$(`[data-course="${c.id}"]`);
    const each = (sel, fn) => scope.forEach((root) => {
      if (root.matches(sel)) fn(root);
      $$(sel, root).forEach(fn);
    });
    each("[data-done]", (el) => { el.textContent = done; });
    each("[data-ring]", (el) => { el.style.strokeDasharray = `${(done / total) * 100} 100`; });
    each("[data-bar]", (el) => { el.style.width = `${(done / total) * 100}%`; });
    each(".nav-lesson", (a) => a.classList.toggle("is-done", !!s.passed[a.dataset.route.split("-").pop()]));
    each("[data-lesson-row]", (row) => {
      const id = row.dataset.lessonRow, passed = !!s.passed[id];
      row.classList.toggle("is-done", passed);
      $(".status", row).textContent = passed ? "Completed ✓" : s.best[id] != null ? `Best ${s.best[id]}/5` : "Not started";
    });
    const next = c.lessons.find((l) => !s.passed[l.dataset.lesson]);
    each("[data-continue]", (a) => {
      if (done === 0) { a.textContent = "Start lesson 1"; a.href = `#${c.id}-lesson-1`; }
      else if (next) { a.textContent = `Continue: lesson ${next.dataset.lesson} →`; a.href = `#${c.id}-lesson-${next.dataset.lesson}`; }
      else { a.textContent = "Get your certificate →"; a.href = `#${c.id}-certificate`; }
    });
    each("[data-status]", (el) => {
      el.textContent = done === total ? "Certificate earned ✓" : done ? "In progress" : "Not started";
      el.classList.toggle("is-earned", done === total);
    });
    const right = Object.values(s.best).reduce((a, b) => a + b, 0);
    each("[data-stat-lessons]", (el) => { el.textContent = `${done}/${total}`; });
    each("[data-stat-right]", (el) => { el.textContent = `${right}/${total * 5}`; });
    each("[data-stat-cert]", (el) => { el.textContent = done === total ? "Ready" : "Locked"; });
    each(".card-stats", (el) => el.classList.toggle("is-cert", done === total));
    each("[data-count]", (el) => { el.textContent = `${done}/${total}`; });
    // The certificate's date: the day the last lesson was first passed.
    if (done === total && !s.completedAt) { s.completedAt = Date.now(); c.save(); track(`course-complete/${c.id}`); }
    renderCert(c, done);
  };
  const renderAll = () => courses.forEach(render);

  // ---------- certificates ----------
  const loadImg = (src) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });

  function renderCert(c, done) {
    const cert = c.cert;
    if (!cert) return;
    const complete = done === c.total;
    $("[data-cert-locked]", cert).hidden = complete;
    $("[data-cert-ready]", cert).hidden = !complete;
    const left = $("[data-cert-left]", cert);
    if (left) left.textContent = `${c.total - done} lesson${c.total - done === 1 ? "" : "s"}`;
    const nameIn = $("[data-cert-name]", cert);
    if (complete && nameIn && !nameIn.value) nameIn.value = c.state.name || courses.map((o) => o.state.name).find(Boolean) || "";
  }

  // Drawn on a canvas so it can be saved as an image or printed as-is. The
  // name is only ever drawn as canvas text, never inserted as HTML.
  // `sample` draws the preview shown before a student finishes: "Your Name",
  // no date, and a faint SAMPLE across it so it can't pass for the real thing.
  const drawCert = async (c, name, sample = false) => {
    const W = 2000, H = 1414;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    const GREEN = SITE.color, DEEP = SITE.deep, GOLD = "#E6B33F", INK = "#14143A", MUTED = "#5F6388";
    const SANS = '"DM Sans", "Inter", "Segoe UI", Arial, sans-serif', SERIF = '"Libre Baskerville", Georgia, serif';
    try {
      await Promise.all([`800 90px ${SANS}`, `600 40px ${SANS}`, `400 30px ${SANS}`, `italic 400 40px ${SERIF}`].map((f) => document.fonts.load(f)));
    } catch (e) { /* fall back to system fonts */ }
    const [able, biz] = await Promise.all([loadImg("assets/images/logo-main.png"), loadImg(SITE.logo)]);

    // Paper, a pale-green swoosh in two corners (clipped to the frame), the frame.
    x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, W, H);
    x.save();
    x.beginPath(); x.rect(57, 57, W - 114, H - 114); x.clip();
    x.fillStyle = SITE.pale;
    x.beginPath(); x.ellipse(W - 40, 20, 520, 340, -0.35, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(40, H - 20, 520, 340, -0.35, 0, Math.PI * 2); x.fill();
    x.restore();
    x.lineWidth = 22; x.strokeStyle = GREEN; x.strokeRect(46, 46, W - 92, H - 92);
    x.lineWidth = 4; x.strokeStyle = GOLD; x.strokeRect(84, 84, W - 168, H - 168);

    const center = (text, y, font, color, maxW) => {
      x.font = font; x.fillStyle = color; x.textAlign = "center"; x.textBaseline = "alphabetic";
      x.fillText(text, W / 2, y, maxW);
    };
    const spaced = (text, y, font, color, gap) => {
      x.font = font; x.fillStyle = color; x.textAlign = "left";
      const chars = [...text];
      const width = chars.reduce((w, ch) => w + x.measureText(ch).width, 0) + gap * (chars.length - 1);
      let cx = W / 2 - width / 2;
      chars.forEach((ch) => { x.fillText(ch, cx, y); cx += x.measureText(ch).width + gap; });
    };

    if (biz) x.drawImage(biz, W / 2 - 88, 150, 176, 176 * biz.height / biz.width);
    spaced(`ABLE INITIATIVES  ·  ${SITE.name.toUpperCase()}`, 400, `700 26px ${SANS}`, GREEN, 6);
    center("Certificate of Completion", 510, `800 96px ${SANS}`, INK);
    center("This certifies that", 600, `italic 400 38px ${SERIF}`, MUTED);

    // The name: as large as fits, up to 104px, on a gold rule.
    let size = 104;
    x.font = `italic 400 ${size}px ${SERIF}`;
    while (x.measureText(name).width > 1440 && size > 44) { size -= 4; x.font = `italic 400 ${size}px ${SERIF}`; }
    const ruleW = Math.min(1560, Math.max(1120, x.measureText(name).width + 120));
    center(name, 735, x.font, DEEP);
    x.fillStyle = GOLD; x.fillRect(W / 2 - ruleW / 2, 770, ruleW, 4);

    center("has completed the free, self-paced course", 850, `400 34px ${SANS}`, MUTED);
    center(c.certTitle || c.title, 945, `800 72px ${SANS}`, GREEN, 1700);
    center(c.topics[0], 1020, `400 28px ${SANS}`, INK, 1700);
    center(c.topics[1], 1062, `400 28px ${SANS}`, INK, 1700);
    center(`Awarded for passing all ${c.total === 6 ? "six" : c.total} lesson quizzes.`, 1118, `italic 400 26px ${SERIF}`, MUTED);

    // Footer: date left, ABLE seal centre, where right.
    const date = sample ? "The day you finish" : new Date(c.state.completedAt || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const foot = (label, value, cx) => {
      x.textAlign = "center";
      x.fillStyle = INK; x.font = `600 32px ${SANS}`; x.fillText(value, cx, 1232);
      x.fillStyle = "#C9C8CF"; x.fillRect(cx - 250, 1250, 500, 2);
      x.fillStyle = MUTED; x.font = `400 22px ${SANS}`; x.fillText(label, cx, 1284);
    };
    foot("Date completed", date, 470);
    foot("Online at", SITE.domain, W - 470);
    if (able) {
      x.fillStyle = "#FFFFFF"; x.beginPath(); x.arc(W / 2, 1230, 86, 0, Math.PI * 2); x.fill();
      x.lineWidth = 3; x.strokeStyle = GREEN; x.stroke();
      const s = 120; x.drawImage(able, W / 2 - s / 2, 1230 - (s * able.height / able.width) / 2 - 10, s, s * able.height / able.width); // lifted: the A looks low when box-centred
    }
    if (sample) {
      x.save();
      x.translate(W / 2, H / 2);
      x.rotate(-0.32);
      x.font = `800 300px ${SANS}`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillStyle = "rgba(20, 20, 58, 0.07)";
      x.fillText("SAMPLE", 0, 0);
      x.restore();
    }
    return cv;
  };

  // The sample certificate on each course's certificate view, drawn the
  // first time that view opens (a canvas this size isn't free to draw).
  const samples = {};
  const showSample = async (c) => {
    const fig = c.cert && $("[data-cert-sample]", c.cert);
    if (!fig || samples[c.id]) return;
    samples[c.id] = true;
    const cv = await drawCert(c, "Your Name", true);
    const img = $("img", fig);
    img.src = cv.toDataURL("image/png");
    img.alt = `Sample certificate for ${c.title}: your name and the date you finish go on yours`;
    fig.hidden = false;
  };

  courses.forEach((c) => {
    const cert = c.cert;
    if (!cert) return;
    const form = $("[data-cert-form]", cert), nameIn = $("[data-cert-name]", cert);
    const preview = $("[data-cert-preview]", cert), img = $("[data-cert-img]", cert);
    const actions = $("[data-cert-actions]", cert), dl = $("[data-cert-download]", cert);
    c.certURL = null;
    c.resetCert = () => {
      preview.hidden = true; actions.hidden = true; nameIn.value = "";
      const sample = $("[data-cert-sample]", cert);
      if (sample && samples[c.id]) sample.hidden = false;
    };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = nameIn.value.replace(/\s+/g, " ").trim().slice(0, 60);
      if (!name) { nameIn.focus(); return; }
      c.state.name = name;
      c.save();
      const cv = await drawCert(c, name);
      const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
      if (c.certURL) URL.revokeObjectURL(c.certURL);
      c.certURL = URL.createObjectURL(blob);
      img.src = c.certURL;
      img.alt = `Certificate of completion for ${name}, ${c.title}, ${SITE.name}`;
      dl.href = c.certURL;
      dl.download = `ABLE-${c.file}-certificate-${name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "student"}.png`;
      preview.hidden = false;
      actions.hidden = false;
      const sample = $("[data-cert-sample]", cert);
      if (sample) sample.hidden = true;
      preview.scrollIntoView({ block: "nearest", behavior: "smooth" });
      track(`certificate/${c.id}`);
    });

    dl.addEventListener("click", () => track(`certificate-download/${c.id}`));

    // Print just the certificate, landscape, edge to edge.
    $("[data-cert-print]", cert).addEventListener("click", () => {
      if (!c.certURL) return;
      track(`certificate-print/${c.id}`);
      const sheet = document.createElement("img");
      sheet.className = "cert-print-sheet";
      sheet.src = c.certURL;
      sheet.alt = "";
      const page = document.createElement("style");
      page.textContent = "@page { size: landscape; margin: 0; }";
      document.head.append(page);
      document.body.append(sheet);
      document.body.classList.add("is-printing-cert");
      const done = () => {
        document.body.classList.remove("is-printing-cert");
        sheet.remove();
        page.remove();
        window.removeEventListener("afterprint", done);
      };
      window.addEventListener("afterprint", done);
      const go = () => window.print();
      if (sheet.complete) go(); else sheet.onload = go;
    });
  });

  // ---------- routing: one view at a time ----------
  const sidebar = $("#sidebar"), toggle = $("#menu-toggle");
  const setMenu = (open) => { sidebar.classList.toggle("open", open); toggle?.setAttribute("aria-expanded", String(open)); };
  toggle?.addEventListener("click", () => setMenu(!sidebar.classList.contains("open")));
  // On a phone the sidebar is a drawer: a tap anywhere outside it closes it.
  document.addEventListener("click", (e) => {
    if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
  });

  const show = () => {
    const raw = decodeURIComponent(location.hash.slice(1));
    const id = alias(raw);
    if (id !== raw) { history.replaceState(null, "", `#${id}`); }
    // #tool-budget etc. live inside the calculators view.
    const target = id && document.getElementById(id);
    let view = target && target.matches("[data-view]") ? target : target && target.closest("[data-view]");
    if (!view) view = $("#home");
    views.forEach((v) => v.classList.toggle("is-current", v === view));
    $$(".nav-item").forEach((a) => {
      const on = a.dataset.route === view.id;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    // Calculators: one at a time, picked from the list (#tool-<name>).
    if (view.id === "tools") {
      const panels = $$("[data-calc]");
      const pick = target && target.matches("[data-calc]") ? target : panels.find((p) => p.classList.contains("is-active")) || panels[0];
      panels.forEach((p) => p.classList.toggle("is-active", p === pick));
      $$("[data-calc-link]").forEach((a) => a.classList.toggle("is-active", a.dataset.calcLink === pick?.dataset.calc));
    }
    // Only the open course's lessons are listed in the sidebar.
    const course = view.dataset.course || "";
    $$("[data-course-nav]").forEach((g) => g.classList.toggle("is-open", g.dataset.courseNav === course));
    document.title = `${view.dataset.title} · ${SITE.name}`;
    const certCourse = view.id.endsWith("-certificate") && byId[view.dataset.course];
    if (certCourse) showSample(certCourse);
    setMenu(false);
    if (target && target !== view && !(view.id === "tools" && window.innerWidth > 1100)) target.scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  };
  window.addEventListener("hashchange", show);
  show();

  // ---------- quizzes ----------
  courses.forEach((c) => c.lessons.forEach((lesson) => {
    const form = lesson.querySelector("form[data-quiz]");
    if (!form) return;
    const id = lesson.dataset.lesson;
    const qs = [...form.querySelectorAll("fieldset.quiz-q")];
    const result = form.querySelector(".quiz-result");

    const clear = (q) => {
      q.classList.remove("is-right", "is-wrong", "is-missing");
      q.querySelectorAll("label").forEach((l) => l.classList.remove("is-answer", "is-picked-wrong"));
    };
    qs.forEach((q) => q.addEventListener("change", () => clear(q)));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const missing = qs.filter((q) => !q.querySelector("input:checked"));
      qs.forEach(clear);
      if (missing.length) {
        missing.forEach((q) => q.classList.add("is-missing"));
        result.className = "quiz-result is-fail";
        result.textContent = `Answer all ${qs.length} questions first (${missing.length} left).`;
        missing[0].scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      let score = 0;
      qs.forEach((q) => {
        const picked = q.querySelector("input:checked");
        const right = picked.value === q.dataset.answer;
        if (right) score++;
        q.classList.add(right ? "is-right" : "is-wrong");
        q.querySelectorAll("input").forEach((input) => {
          if (input.value === q.dataset.answer) input.closest("label").classList.add("is-answer");
          else if (input === picked) input.closest("label").classList.add("is-picked-wrong");
        });
      });
      track(`quiz-${score >= PASS ? "pass" : "fail"}/${c.id}-${id}`);
      c.state.best[id] = Math.max(score, c.state.best[id] || 0);
      if (score >= PASS) c.state.passed[id] = true;
      c.save();
      render(c);
      const n = qs.length;
      if (score >= PASS) {
        const next = c.lessons[c.lessons.indexOf(lesson) + 1];
        result.className = "quiz-result is-pass";
        result.textContent = `${score} of ${n} — lesson complete!` + (next ? " On to the next one." : "");
        if (!next && c.done() === c.total) {
          result.append(" That's the whole course. ");
          const link = document.createElement("a");
          link.href = `#${c.id}-certificate`;
          link.textContent = "Get your certificate →";
          result.append(link);
        }
      } else {
        result.className = "quiz-result is-fail";
        result.textContent = `${score} of ${n}. Read the explanations, change your answers and check again. You need ${PASS} to complete the lesson.`;
      }
    });
  }));

  $("[data-reset]")?.addEventListener("click", () => {
    if (!window.confirm("Clear your progress on every course?")) return;
    courses.forEach((c) => { c.state = { passed: {}, best: {} }; c.save(); c.resetCert?.(); });
    renderAll();
  });

  // ---------- glossary: every lesson's key terms, A to Z ----------
  const gloss = $("[data-glossary]");
  if (gloss) {
    const terms = [];
    courses.forEach((c) => c.lessons.forEach((l) => $$(".lesson-terms dl > div", l).forEach((d) => {
      terms.push({ term: $("dt", d).textContent.trim(), def: $("dd", d).textContent.trim(), n: l.dataset.lesson, c });
    })));
    terms.sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
    const list = document.createElement("dl");
    list.className = "glossary-list";
    list.style.margin = "0";
    terms.forEach((t) => {
      const box = document.createElement("div");
      box.className = "gloss";
      const dt = document.createElement("dt");
      dt.append(t.term);
      const a = document.createElement("a");
      a.href = `#${t.c.id}-lesson-${t.n}`;
      a.textContent = `${t.c.short || t.c.title}, lesson ${t.n}`;
      dt.append(a);
      const dd = document.createElement("dd");
      dd.textContent = t.def;
      box.append(dt, dd);
      box.dataset.search = `${t.term} ${t.def}`.toLowerCase();
      list.append(box);
    });
    gloss.replaceWith(list);
    const empty = document.createElement("p");
    empty.className = "glossary-empty";
    empty.textContent = "No terms match that search.";
    empty.hidden = true;
    list.after(empty);
    $("[data-glossary-search]")?.addEventListener("input", (e) => {
      const needle = e.target.value.trim().toLowerCase();
      let shown = 0;
      $$(".gloss", list).forEach((b) => { const on = !needle || b.dataset.search.includes(needle); b.hidden = !on; shown += on; });
      empty.hidden = shown > 0;
    });
  }

  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  // ---------- calculators ----------
  const money = (x) => (x < 0 ? "−" : "") + "$" + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (el) => { if (el.type === "time") return el.value; const v = parseFloat(el.value); return Number.isFinite(v) && v >= 0 ? v : 0; };
  const round2 = (v) => Math.round(v * 100) / 100;
  // Fixed monthly payment on an amortizing loan, to the cent.
  const payment = (principal, apr, months) => {
    const r = apr / 100 / 12;
    if (!months) return 0;
    return round2(r === 0 ? principal / months : principal * r / (1 - Math.pow(1 + r, -months)));
  };

  const TOOLS = {
    budget(v, out) {
      out.needs = money(v.income * 0.5);
      out.wants = money(v.income * 0.3);
      out.savings = money(v.income * 0.2);
    },
    paycheck(v, out) {
      const gross = v.wage * v.hours * 2;
      const ss = gross * 0.062, medicare = gross * 0.0145, tax = gross * (v.withholding / 100);
      out.gross = money(gross);
      out.ss = money(ss);
      out.medicare = money(medicare);
      out.tax = money(tax);
      out.net = money(gross - ss - medicare - tax);
    },
    compound(v, out) {
      // Monthly compounding; each contribution lands at the end of its month.
      const r = v.rate / 100 / 12, months = Math.round(v.years * 12);
      let bal = v.start;
      for (let i = 0; i < months; i++) bal = bal * (1 + r) + v.monthly;
      const put = v.start + v.monthly * months;
      out.balance = money(bal);
      out.contributed = money(put);
      out.growth = money(bal - put);
    },
    payoff(v, out) {
      // Fixed payment every month, no new charges, interest = APR / 12 on the
      // balance, rounded to the cent (the method Foundations lesson 4 uses).
      const r = v.apr / 100 / 12;
      let bal = v.balance, months = 0, interest = 0;
      if (bal > 0 && v.payment <= bal * r) return { warn: "This payment doesn't even cover the monthly interest, so the balance never goes down." };
      if (bal > 0 && v.payment <= 0) return { warn: "Enter a monthly payment." };
      while (bal > 0.005 && months < 1200) {
        const i = Math.round(bal * r * 100) / 100;
        interest += i;
        bal = bal + i - Math.min(v.payment, bal + i);
        months++;
      }
      out.months = months >= 1200 ? "100+ years" : `${months} month${months === 1 ? "" : "s"}` + (months >= 12 ? ` (${(months / 12).toFixed(1)} yrs)` : "");
      out.interest = money(interest);
      out.paid = money(v.balance + interest);
    },
    breakeven(v, out) {
      const margin = v.price - v.cost;
      out.margin = money(margin);
      if (margin <= 0) return { warn: "Each sale loses money (or makes none), so no number of sales will cover the fixed costs. Raise the price or cut the cost per unit." };
      out.units = `${Math.ceil(v.fixed / margin - 1e-9)} units`;
      out.revenue = money(Math.ceil(v.fixed / margin - 1e-9) * v.price);
    },
    unitprice(v, out) {
      if (!v.sizeA || !v.sizeB) return { warn: "Enter a size for both options." };
      const a = v.priceA / v.sizeA, b = v.priceB / v.sizeB;
      // Cents, unless both round to the same cent; then a tenth of a cent.
      const d = a.toFixed(2) === b.toFixed(2) ? 3 : 2;
      const fmt = (u) => "$" + u.toFixed(d) + " per unit";
      out.unitA = fmt(a);
      out.unitB = fmt(b);
      if (Math.abs(a - b) < 1e-9) { out.better = "Same price per unit"; return; }
      const cheap = a < b ? "A" : "B", pct = (Math.abs(a - b) / Math.max(a, b)) * 100;
      out.better = `Option ${cheap}, ${pct.toFixed(1)}% less per unit`;
    },
    insurance(v, out) {
      // Simplified: premiums plus the part of the bills below the deductible.
      const cost = (prem, ded) => prem * 12 + Math.min(v.bills, ded);
      const a = cost(v.premA, v.dedA), b = cost(v.premB, v.dedB);
      out.costA = money(a);
      out.costB = money(b);
      out.better = Math.abs(a - b) < 0.005 ? "They cost the same" : `Plan ${a < b ? "A" : "B"}, by ${money(Math.abs(a - b))}`;
    },
    studentloan(v, out) {
      const n = Math.round(v.years * 12), pay = payment(v.amount, v.apr, n);
      out.monthly = money(pay);
      out.interest = money(pay * n - v.amount);
      out.total = money(pay * n);
    },
    carloan(v, out) {
      const borrowed = Math.max(0, v.price - v.down), n = Math.round(v.months), pay = payment(borrowed, v.apr, n);
      out.borrowed = money(borrowed);
      out.monthly = money(pay);
      out.interest = money(pay * n - borrowed);
      out.total = money(v.down + pay * n);
    },
  };

  // Health and engineering tools: shared by every site like the rest.
  const round = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };
  const fixed = (v) => (Number.isInteger(v) ? String(v) : String(round(v, 3)));
  Object.assign(TOOLS, {
    percenterror(v, out) {
      if (!v.accepted) return { warn: "Enter the accepted (true) value; it can't be zero." };
      const diff = Math.abs(v.measured - v.accepted);
      out.diff = fixed(round(diff, 4));
      out.error = `${round((diff / v.accepted) * 100, 2)}%`;
    },
    lever(v, out) {
      if (!v.effortDist) return { warn: "Enter how far the effort is from the fulcrum." };
      out.effort = fixed(round((v.load * v.loadDist) / v.effortDist, 3));
      out.advantage = v.loadDist ? `${fixed(round(v.effortDist / v.loadDist, 3))} : 1` : "—";
    },
    ohm(v, out) {
      if (!v.resistance) return { warn: "Resistance can't be zero: that's a short circuit." };
      const amps = v.voltage / v.resistance;
      out.amps = `${fixed(round(amps, 4))} A`;
      out.milliamps = `${fixed(round(amps * 1000, 2))} mA`;
      out.watts = `${fixed(round(v.voltage * amps, 4))} W`;
    },
    nutrition(v, out) {
      const k = v.eaten;
      out.calories = `${Math.round(v.calories * k * 10) / 10} calories`;
      out.sugars = `${Math.round(v.sugars * k * 10) / 10} g`;
      out.sodium = `${Math.round(v.sodium * k * 10) / 10} mg`;
      out.share = v.servings ? `${Math.round((k / v.servings) * 1000) / 10}% of the package` : "—";
    },
    sleep(v, out) {
      const m = /^(\d{1,2}):(\d{2})/.exec(v.wake || "");
      if (!m) return { warn: "Enter the time you need to wake up." };
      const wake = +m[1] * 60 + +m[2], mins = Math.round(v.hours * 60);
      const bed = (((wake - mins) % 1440) + 1440) % 1440;
      const fmt = (t) => { const h = Math.floor(t / 60), mm = t % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`; };
      out.bedtime = fmt(bed);
      out.range = v.hours >= 8 && v.hours <= 10 ? "Yes, within 8–10 hours" : v.hours < 8 ? "Less than the 8–10 hours teens need" : "More than 10 hours";
    },
    jobpay(v, out) {
      const gross = v.wage * v.hours, net = gross - v.commuteCost, time = v.hours + v.commuteTime;
      out.gross = money(gross);
      out.net = money(net);
      out.real = time ? `${money(net / time)} an hour` : "—";
      if (!v.hours) return { warn: "Enter the hours you'd work each week." };
    },
    campaign(v, out) {
      const pct = (a, b) => (b ? `${(Math.round((a / b) * 1000) / 10).toFixed(1)}%` : "—");
      out.response = pct(v.responded, v.reached);
      out.conversion = pct(v.bought, v.responded);
      if (!v.bought) return { warn: "No new customers yet, so there's no cost per customer to work out." };
      out.cost = money(v.spent / v.bought);
    },
    activity(v, out) {
      const days = Math.min(7, Math.round(v.days)), week = days * v.minutes;
      out.week = `${fixed(round(week, 1))} minutes`;
      out.average = `${(Math.round((week / 7) * 10) / 10).toFixed(1)} minutes`;
      out.meets = days === 7 && v.minutes >= 60 ? "Yes: 60+ minutes every day" : "Not yet: the goal is 60+ minutes every day";
      out.short = `${fixed(round(Math.max(0, 420 - week), 1))} minutes`;
    },
    speech(v, out) {
      if (!v.rate) return { warn: "Enter your speaking rate in words per minute." };
      const secs = Math.round((v.words / v.rate) * 60);
      out.time = `${Math.floor(secs / 60)} min ${secs % 60} sec`;
      out.fit = `${Math.round(v.limit * v.rate).toLocaleString("en-US")} words`;
    },
    pathway(v, out) {
      const years = v.untilGrad + v.training;
      out.age = `About ${fixed(round(v.age + years, 1))}`;
      out.years = `${fixed(round(years, 1))} years`;
    },
    glide(v, out) {
      if (!v.height || !v.distance) return { warn: "Enter the launch height and the distance it flew." };
      out.ratio = `${(v.distance / v.height).toFixed(1)} : 1`;
      out.angle = `${((Math.atan(v.height / v.distance) * 180) / Math.PI).toFixed(1)}°`;
    },
    lift(v, out) {
      const L = 0.5 * v.density * v.speed * v.speed * v.area * v.cl;
      out.lift = `${L.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} N`;
      out.mass = `${(L / 9.81).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
    },
    rocket(v, out) {
      if (!v.mass) return { warn: "Enter the rocket's mass at liftoff." };
      const w = v.mass * 9.81, net = v.thrust - w;
      out.weight = `${w.toFixed(1)} N`;
      out.twr = (v.thrust / w).toFixed(2);
      out.net = `${net.toFixed(1)} N`;
      out.accel = net > 0 ? `${(net / v.mass).toFixed(2)} m/s²` : "Won't lift off: thrust isn't more than weight";
    },
  });

  document.querySelectorAll(".lesson-tool[data-tool]").forEach((tool) => {
    const fn = TOOLS[tool.dataset.tool];
    if (!fn) return;
    const inputs = [...tool.querySelectorAll("[data-in]")];
    const warn = tool.querySelector(".tool-warn");
    const run = () => {
      const v = {};
      inputs.forEach((el) => { v[el.dataset.in] = num(el); });
      const out = {};
      const res = fn(v, out) || {};
      tool.querySelectorAll("[data-out]").forEach((el) => {
        el.textContent = res.warn && !(el.dataset.out in out) ? "—" : out[el.dataset.out] ?? "—";
      });
      if (warn) { warn.hidden = !res.warn; warn.textContent = res.warn || ""; }
    };
    inputs.forEach((el) => el.addEventListener("input", () => { run(); track(`calculator/${tool.dataset.tool}`, true); }));
    run();
  });

  renderAll();
})();
