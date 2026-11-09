(() => {
  "use strict";

  const STORE_KEY = "stepBudget.v1";
  const THEME_KEY = "stepBudget.theme";
  const PALETTE = ["#1f5c45", "#7fb069", "#e6aa68", "#ca3c25", "#4c6ef5", "#9b5de5", "#00a6a6", "#f15bb5", "#8d6e63", "#5d6b65"];

  const DEFAULT_STATE = {
    currency: "AUD",
    categories: [
      { id: "rent", name: "Rent / Mortgage", budget: 2000, color: "#1f5c45" },
      { id: "groceries", name: "Groceries", budget: 600, color: "#7fb069" },
      { id: "transport", name: "Transport", budget: 250, color: "#4c6ef5" },
      { id: "bills", name: "Bills & Utilities", budget: 350, color: "#e6aa68" },
      { id: "dining", name: "Eating Out", budget: 250, color: "#ca3c25" },
      { id: "fun", name: "Entertainment", budget: 150, color: "#9b5de5" },
    ],
    transactions: [],
  };

  // ---------- State ----------
  const load = () => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.categories) && Array.isArray(s.transactions)) return s;
      }
    } catch (_) { /* ignore */ }
    return structuredClone(DEFAULT_STATE);
  };
  let state = load();
  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) { /* storage unavailable */ }
  };

  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth(); // 0-11

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const pad = (n) => String(n).padStart(2, "0");
  const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
  const isoToday = () => `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n, opts = {}) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: state.currency, maximumFractionDigits: opts.cents ? 2 : 0, minimumFractionDigits: opts.cents ? 2 : 0 }).format(n);
  const catById = (id) => state.categories.find((c) => c.id === id);
  const txInMonth = (y, m) => state.transactions.filter((t) => t.date.slice(0, 7) === monthKey(y, m));
  const fmtDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  const monthName = (y, m, style = "long") => new Date(y, m, 1).toLocaleDateString(undefined, { month: style, year: style === "long" ? "numeric" : undefined });

  const totals = (y, m) => {
    const tx = txInMonth(y, m);
    const income = tx.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const spent = tx.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
    return { tx, income, spent };
  };

  // ---------- Render ----------
  function render() {
    const { tx, income, spent } = totals(viewYear, viewMonth);
    const budget = state.categories.reduce((a, c) => a + Number(c.budget || 0), 0);
    const left = budget - spent;
    const net = income - spent;

    $("#monthLabel").textContent = monthName(viewYear, viewMonth);
    const leftEl = $("#leftToSpend");
    leftEl.textContent = money(left);
    leftEl.classList.toggle("neg", left < 0);

    const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
    const bar = $("#overallBar");
    bar.style.width = pct + "%";
    bar.classList.toggle("over", spent > budget && budget > 0);
    $("#overallCaption").textContent = budget
      ? `${money(spent)} of ${money(budget)} spent · ${Math.round((spent / budget) * 100)}%`
      : "Add a category budget to get started";

    $("#statIncome").textContent = money(income);
    $("#statSpent").textContent = money(spent);
    $("#statBudget").textContent = money(budget);
    const netEl = $("#statNet");
    netEl.textContent = money(net);

    renderDonut(tx);
    renderTrend();
    renderBudgets(tx);
    renderTransactions(tx);
    renderCategoryOptions();
  }

  function spentByCategory(tx) {
    const map = new Map();
    tx.filter((t) => t.type === "expense").forEach((t) => map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount));
    return map;
  }

  function renderDonut(tx) {
    const svg = $("#donut");
    const map = spentByCategory(tx);
    const items = [...map.entries()]
      .map(([id, amt]) => ({ cat: catById(id) || { name: "Uncategorised", color: "#9aaba3" }, amt }))
      .sort((a, b) => b.amt - a.amt);
    const total = items.reduce((a, i) => a + i.amt, 0);
    const r = 78, c = 2 * Math.PI * r;
    let offset = 0;
    let arcs = `<circle cx="100" cy="100" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="22"/>`;
    if (total > 0) {
      items.forEach(({ cat, amt }) => {
        const len = (amt / total) * c;
        arcs += `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${esc(cat.color)}" stroke-width="22"
          stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"><title>${esc(cat.name)}: ${money(amt)}</title></circle>`;
        offset += len;
      });
    }
    arcs += `<text x="100" y="94" text-anchor="middle" class="center-label">SPENT</text>
             <text x="100" y="118" text-anchor="middle" class="center-value">${money(total)}</text>`;
    svg.innerHTML = arcs;

    $("#legend").innerHTML = items.length
      ? items.map(({ cat, amt }) => `<li><span class="dot" style="background:${esc(cat.color)}"></span>${esc(cat.name)}<span class="amt">${money(amt)} · ${Math.round((amt / total) * 100)}%</span></li>`).join("")
      : `<li class="muted">No spending yet this month.</li>`;
  }

  function renderTrend() {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth(), ...totals(d.getFullYear(), d.getMonth()) });
    }
    const max = Math.max(1, ...months.flatMap((x) => [x.income, x.spent]));
    $("#trend").innerHTML = months
      .map((x, i) => `<div class="trend-col ${i === 5 ? "current" : ""}">
          <div class="trend-bars">
            <span class="inc" style="height:${(x.income / max) * 100}%" title="Income ${money(x.income)}"></span>
            <span class="exp" style="height:${(x.spent / max) * 100}%" title="Spent ${money(x.spent)}"></span>
          </div>
          <small>${monthName(x.y, x.m, "short")}</small>
        </div>`)
      .join("");
  }

  function renderBudgets(tx) {
    const map = spentByCategory(tx);
    const grid = $("#budgetGrid");
    if (!state.categories.length) {
      grid.innerHTML = `<p class="muted">No categories yet. Create one to start budgeting.</p>`;
      return;
    }
    grid.innerHTML = state.categories
      .map((c) => {
        const spent = map.get(c.id) || 0;
        const b = Number(c.budget) || 0;
        const ratio = b ? spent / b : spent > 0 ? 1.01 : 0;
        const cls = ratio > 1 ? "over" : ratio > 0.85 ? "warn" : "";
        const remaining = b - spent;
        return `<button class="budget" data-cat="${esc(c.id)}" title="Edit ${esc(c.name)}">
          <div class="budget-top">
            <span class="swatch" style="background:${esc(c.color)}"></span>
            <strong>${esc(c.name)}</strong>
            <span class="pct ${ratio > 1 ? "over" : ""}">${b ? Math.round(ratio * 100) + "%" : "—"}</span>
          </div>
          <div class="bar"><span class="${cls}" style="width:${Math.min(100, ratio * 100)}%;${cls ? "" : `background:${esc(c.color)}`}"></span></div>
          <div class="budget-nums"><span><b>${money(spent)}</b> of ${money(b)}</span><span class="${remaining < 0 ? "neg" : ""}">${remaining < 0 ? money(-remaining) + " over" : money(remaining) + " left"}</span></div>
        </button>`;
      })
      .join("");
  }

  function renderTransactions(tx) {
    const q = $("#search").value.trim().toLowerCase();
    const f = $("#filterCat").value;
    const rows = tx
      .filter((t) => (!q || t.desc.toLowerCase().includes(q)) && (!f || (f === "__income" ? t.type === "income" : t.categoryId === f)))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    $("#txBody").innerHTML = rows
      .map((t) => {
        const cat = t.type === "income" ? { name: "Income", color: "#d9f26b" } : catById(t.categoryId) || { name: "Uncategorised", color: "#9aaba3" };
        const sign = t.type === "income" ? "+" : "−";
        return `<tr>
          <td class="date">${fmtDate(t.date)}</td>
          <td>${esc(t.desc)}</td>
          <td><span class="chip"><i style="background:${esc(cat.color)}"></i>${esc(cat.name)}</span></td>
          <td class="num ${t.type === "income" ? "pos" : ""}">${sign}${money(t.amount, { cents: true })}</td>
          <td class="row-actions"><button data-edit="${esc(t.id)}" aria-label="Edit">✎</button><button data-del="${esc(t.id)}" aria-label="Delete">✕</button></td>
        </tr>`;
      })
      .join("");
    $("#txEmpty").hidden = rows.length > 0;
    $("#txEmpty").textContent = tx.length ? "No transactions match your filters." : "No transactions this month yet. Add your first one ✦";
  }

  function renderCategoryOptions() {
    const opts = state.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    const filter = $("#filterCat");
    const cur = filter.value;
    filter.innerHTML = `<option value="">All categories</option><option value="__income">Income</option>${opts}`;
    filter.value = [...filter.options].some((o) => o.value === cur) ? cur : "";
    $("#txForm").categoryId.innerHTML = opts || `<option value="">(no categories)</option>`;
  }

  // ---------- Dialogs ----------
  const txDialog = $("#txDialog");
  const catDialog = $("#catDialog");
  const settingsDialog = $("#settingsDialog");

  function openTx(t) {
    const f = $("#txForm");
    f.reset();
    $("#txTitle").textContent = t ? "Edit transaction" : "Add transaction";
    f.id.value = t ? t.id : "";
    f.amount.value = t ? t.amount : "";
    f.desc.value = t ? t.desc : "";
    // default date: today if viewing current month, else 1st of viewed month
    const viewingCurrent = viewYear === today.getFullYear() && viewMonth === today.getMonth();
    f.date.value = t ? t.date : viewingCurrent ? isoToday() : `${monthKey(viewYear, viewMonth)}-01`;
    f.querySelector(`[name=type][value=${t ? t.type : "expense"}]`).checked = true;
    if (t && t.categoryId) f.categoryId.value = t.categoryId;
    syncTypeField();
    txDialog.showModal();
    f.amount.focus();
  }
  function syncTypeField() {
    const isIncome = $("#txForm").querySelector("[name=type]:checked").value === "income";
    $("#txForm .cat-field").hidden = isIncome;
  }

  function openCat(c) {
    const f = $("#catForm");
    f.reset();
    $("#catTitle").textContent = c ? "Edit category" : "New category";
    f.id.value = c ? c.id : "";
    f.name.value = c ? c.name : "";
    f.budget.value = c ? c.budget : "";
    f.color.value = c ? c.color : PALETTE[state.categories.length % PALETTE.length];
    $("#deleteCat").hidden = !c;
    catDialog.showModal();
    f.name.focus();
  }

  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open]");
    if (opener) {
      if (opener.dataset.open === "txDialog") openTx();
      if (opener.dataset.open === "catDialog") openCat();
    }
    if (e.target.closest("[data-close]")) e.target.closest("dialog").close();
    const budget = e.target.closest("[data-cat]");
    if (budget) openCat(catById(budget.dataset.cat));
    const edit = e.target.closest("[data-edit]");
    if (edit) openTx(state.transactions.find((t) => t.id === edit.dataset.edit));
    const del = e.target.closest("[data-del]");
    if (del && confirm("Delete this transaction?")) {
      state.transactions = state.transactions.filter((t) => t.id !== del.dataset.del);
      save(); render();
    }
  });
  // click on backdrop closes
  [txDialog, catDialog, settingsDialog].forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  $("#txForm").addEventListener("change", (e) => { if (e.target.name === "type") syncTypeField(); });
  $("#txForm").addEventListener("submit", (e) => {
    const f = e.target;
    const type = f.querySelector("[name=type]:checked").value;
    if (type === "expense" && !f.categoryId.value) {
      e.preventDefault();
      alert("Create a category first.");
      return;
    }
    const data = {
      id: f.id.value || uid(),
      type,
      amount: Math.round(parseFloat(f.amount.value) * 100) / 100,
      desc: f.desc.value.trim(),
      categoryId: type === "expense" ? f.categoryId.value : null,
      date: f.date.value,
    };
    const i = state.transactions.findIndex((t) => t.id === data.id);
    if (i >= 0) state.transactions[i] = data; else state.transactions.push(data);
    // jump to the month of the saved transaction
    const [y, m] = data.date.split("-").map(Number);
    viewYear = y; viewMonth = m - 1;
    save(); render();
  });

  $("#catForm").addEventListener("submit", (e) => {
    const f = e.target;
    const data = { id: f.id.value || uid(), name: f.name.value.trim(), budget: Math.max(0, Number(f.budget.value) || 0), color: f.color.value };
    const i = state.categories.findIndex((c) => c.id === data.id);
    if (i >= 0) state.categories[i] = data; else state.categories.push(data);
    save(); render();
  });
  $("#deleteCat").addEventListener("click", () => {
    const id = $("#catForm").id.value;
    const used = state.transactions.filter((t) => t.categoryId === id).length;
    const msg = used ? `Delete this category? ${used} transaction(s) will become "Uncategorised".` : "Delete this category?";
    if (!confirm(msg)) return;
    state.categories = state.categories.filter((c) => c.id !== id);
    save(); catDialog.close(); render();
  });

  // ---------- Month nav ----------
  const shiftMonth = (d) => {
    const dt = new Date(viewYear, viewMonth + d, 1);
    viewYear = dt.getFullYear(); viewMonth = dt.getMonth();
    render();
  };
  $("#prevMonth").addEventListener("click", () => shiftMonth(-1));
  $("#nextMonth").addEventListener("click", () => shiftMonth(1));
  $("#search").addEventListener("input", () => renderTransactions(txInMonth(viewYear, viewMonth)));
  $("#filterCat").addEventListener("change", () => renderTransactions(txInMonth(viewYear, viewMonth)));

  // ---------- Settings ----------
  $("#settingsBtn").addEventListener("click", () => {
    $("#settingsForm").currency.value = state.currency;
    settingsDialog.showModal();
  });
  $("#settingsForm").addEventListener("submit", (e) => {
    state.currency = e.target.currency.value;
    save(); render();
  });

  const download = (name, content, type) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#exportJson").addEventListener("click", () => download(`step-budget-backup-${isoToday()}.json`, JSON.stringify(state, null, 2), "application/json"));
  $("#exportCsv").addEventListener("click", () => {
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [["Date", "Type", "Description", "Category", "Amount"].join(",")];
    [...state.transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => {
      const cat = t.type === "income" ? "Income" : (catById(t.categoryId) || { name: "Uncategorised" }).name;
      lines.push([t.date, t.type, q(t.desc), q(cat), t.amount.toFixed(2)].join(","));
    });
    download(`step-budget-transactions-${isoToday()}.csv`, lines.join("\n"), "text/csv");
  });
  $("#importJson").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const s = JSON.parse(await file.text());
      if (!Array.isArray(s.categories) || !Array.isArray(s.transactions)) throw new Error("bad");
      if (!confirm("Replace all current data with this backup?")) return;
      state = { currency: s.currency || "AUD", categories: s.categories, transactions: s.transactions };
      save(); render(); settingsDialog.close();
    } catch (_) {
      alert("That file doesn't look like a Step Budget backup.");
    } finally {
      e.target.value = "";
    }
  });
  $("#resetAll").addEventListener("click", () => {
    if (!confirm("Erase all categories and transactions? This can't be undone.")) return;
    state = structuredClone(DEFAULT_STATE);
    save(); render(); settingsDialog.close();
  });

  // ---------- Theme ----------
  const applyTheme = (t) => document.documentElement.setAttribute("data-theme", t);
  let theme;
  try { theme = localStorage.getItem(THEME_KEY); } catch (_) {}
  applyTheme(theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
  });

  render();
})();
