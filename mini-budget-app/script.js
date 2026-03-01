// Mini Budget — localStorage-backed transactions + CSV export
(() => {
  const $ = (id) => document.getElementById(id);

  const incomeTotalEl = $("incomeTotal");
  const expenseTotalEl = $("expenseTotal");
  const balanceTotalEl = $("balanceTotal");

  const txForm = $("txForm");
  const descEl = $("desc");
  const amountEl = $("amount");
  const typeEl = $("type");
  const categoryEl = $("category");
  const dateEl = $("date");
  const formMsg = $("formMsg");

  const txBody = $("txBody");
  const emptyState = $("emptyState");

  const searchEl = $("search");
  const filterTypeEl = $("filterType");

  const exportBtn = $("exportBtn");
  const clearAllBtn = $("clearAllBtn");
  const themeBtn = $("themeBtn");

  const STORAGE_KEY = "mini_budget_v1";
  const THEME_KEY = "mini_budget_theme";

  // default date = today
  dateEl.valueAsDate = new Date();

  const lastTheme = localStorage.getItem(THEME_KEY);
  if (lastTheme) document.documentElement.dataset.theme = lastTheme;

  themeBtn.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  });

  /** @type {{id:string, desc:string, amount:number, type:'income'|'expense', category:string, date:string, createdAt:number}[]} */
  let txs = load();

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // basic validation
      return parsed.filter(t => t && typeof t.id === "string");
    }catch{
      return [];
    }
  }

  function save(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
  }

  function fmtMoney(n){
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    return sign + abs.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function sanitizeAmount(input){
    // allow digits, dot, comma, minus; convert commas; trim
    const cleaned = String(input).trim().replace(/,/g, "");
    if (!/^[-+]?\d*(?:\.\d{0,2})?$/.test(cleaned) || cleaned === "" || cleaned === "-" || cleaned === "+"){
      return null;
    }
    const value = Number(cleaned);
    if (!Number.isFinite(value)) return null;
    // keep two decimals max
    return Math.round(value * 100) / 100;
  }

  function uuid(){
    // lightweight id
    return (crypto?.randomUUID?.() || ("id-" + Math.random().toString(16).slice(2) + Date.now().toString(16)));
  }

  function setMsg(text){
    formMsg.textContent = text || "";
  }

  function addTx(tx){
    txs.unshift(tx); // newest on top
    save();
    render();
  }

  function deleteTx(id){
    txs = txs.filter(t => t.id !== id);
    save();
    render();
  }

  function totals(){
    let income = 0, expense = 0;
    for (const t of txs){
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }

  function matchesFilters(t){
    const q = (searchEl.value || "").trim().toLowerCase();
    const ft = filterTypeEl.value;

    if (ft !== "all" && t.type !== ft) return false;

    if (!q) return true;
    const hay = (t.desc + " " + t.category + " " + t.date + " " + t.type).toLowerCase();
    return hay.includes(q);
  }

  function sortForDisplay(list){
    // sort by date desc, then createdAt desc
    return [...list].sort((a,b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function render(){
    const { income, expense, balance } = totals();
    incomeTotalEl.textContent = fmtMoney(income);
    expenseTotalEl.textContent = fmtMoney(expense);
    balanceTotalEl.textContent = fmtMoney(balance);

    const filtered = sortForDisplay(txs.filter(matchesFilters));
    txBody.innerHTML = "";

    if (filtered.length === 0){
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
    }

    for (const t of filtered){
      const tr = document.createElement("tr");

      const tdDate = document.createElement("td");
      tdDate.textContent = t.date;

      const tdDesc = document.createElement("td");
      tdDesc.textContent = t.desc;

      const tdCat = document.createElement("td");
      tdCat.textContent = t.category;

      const tdAmt = document.createElement("td");
      tdAmt.className = "right";
      tdAmt.textContent = fmtMoney(t.type === "expense" ? -t.amount : t.amount).replace("-", "−"); // pretty minus

      const tdType = document.createElement("td");
      tdType.className = "right";
      const chip = document.createElement("span");
      chip.className = "chip " + t.type;
      chip.textContent = t.type === "income" ? "Income" : "Expense";
      tdType.appendChild(chip);

      const tdAct = document.createElement("td");
      tdAct.className = "right";
      const delBtn = document.createElement("button");
      delBtn.className = "icon-small";
      delBtn.type = "button";
      delBtn.title = "Delete";
      delBtn.ariaLabel = "Delete transaction";
      delBtn.textContent = "🗑️";
      delBtn.addEventListener("click", () => deleteTx(t.id));
      tdAct.appendChild(delBtn);

      tr.append(tdDate, tdDesc, tdCat, tdAmt, tdType, tdAct);
      txBody.appendChild(tr);
    }
  }

  txForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setMsg("");

    const desc = (descEl.value || "").trim();
    const amt = sanitizeAmount(amountEl.value);
    const type = typeEl.value;
    const category = (categoryEl.value || "General").trim();
    const date = dateEl.value;

    if (!desc){
      setMsg("Description is required.");
      descEl.focus();
      return;
    }
    if (amt === null || amt <= 0){
      setMsg("Amount must be a positive number (up to 2 decimals).");
      amountEl.focus();
      return;
    }
    if (!date){
      setMsg("Date is required.");
      dateEl.focus();
      return;
    }

    addTx({
      id: uuid(),
      desc,
      amount: amt,
      type: type === "income" ? "income" : "expense",
      category,
      date,
      createdAt: Date.now()
    });

    // reset some fields
    descEl.value = "";
    amountEl.value = "";
    typeEl.value = "expense";
    categoryEl.value = "General";
    dateEl.valueAsDate = new Date();
    descEl.focus();
    setMsg("Added.");
    setTimeout(() => setMsg(""), 1200);
  });

  // live filters
  searchEl.addEventListener("input", render);
  filterTypeEl.addEventListener("change", render);

  exportBtn.addEventListener("click", () => {
    const rows = [["Date","Description","Category","Type","Amount"]];
    for (const t of sortForDisplay(txs)){
      rows.push([t.date, t.desc, t.category, t.type, String(t.amount)]);
    }
    const csv = rows.map(r => r.map(cell => {
      const s = String(cell ?? "");
      // CSV escape
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    }).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0,10);
    a.download = "mini-budget-" + stamp + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  clearAllBtn.addEventListener("click", () => {
    const ok = confirm("Delete ALL transactions saved in this browser?");
    if (!ok) return;
    txs = [];
    save();
    render();
    setMsg("Cleared.");
    setTimeout(() => setMsg(""), 1200);
  });

  // initial render
  render();
})();
