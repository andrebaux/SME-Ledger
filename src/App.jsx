import React, { useState, useEffect, useMemo } from "react";
import {
  Fuel, Home as HomeIcon, Zap, Users, Package, Wrench, ShieldCheck, Megaphone,
  Scale, Landmark, Receipt, MoreHorizontal, Plus, ArrowLeft, Trash2,
  TrendingUp, TrendingDown, Wallet, BookOpen, ChevronRight, AlertTriangle,
  Minus, Link2, CalendarDays, Layers, LogOut, Mail, Lock
} from "lucide-react";
import {
  getSession, onAuthStateChange, signInWithPassword, signUpWithPassword,
  signInWithMagicLink, signOut, loadData, saveData,
} from "./supabase.js";

const CURRENCIES = ["$", "€", "£", "₦", "₹", "R", "KSh"];

const EXPENSE_CATEGORIES = [
  { id: "fuel", label: "Fuel & transport", icon: Fuel, hint: "Petrol, diesel, mileage, parking, tolls" },
  { id: "rent", label: "Rent & premises", icon: HomeIcon, hint: "Shop, office, storage or venue hire" },
  { id: "utilities", label: "Utilities", icon: Zap, hint: "Electricity, water, gas, internet, phone" },
  { id: "wages", label: "Salaries & wages", icon: Users, hint: "Staff pay, contractors, casual labour" },
  { id: "supplies", label: "Supplies & inventory", icon: Package, hint: "Stock, raw materials, packaging, food" },
  { id: "maintenance", label: "Equipment & maintenance", icon: Wrench, hint: "Repairs, tools, servicing" },
  { id: "insurance", label: "Insurance", icon: ShieldCheck, hint: "Business, vehicle or liability cover" },
  { id: "marketing", label: "Marketing & advertising", icon: Megaphone, hint: "Ads, flyers, social promotion" },
  { id: "fees", label: "Professional & legal fees", icon: Scale, hint: "Accountant, lawyer, consultant" },
  { id: "bank", label: "Bank & loan charges", icon: Landmark, hint: "Interest, transfer fees, repayments" },
  { id: "taxes", label: "Taxes & licenses", icon: Receipt, hint: "VAT, permits, registration fees" },
  { id: "other", label: "Other overhead", icon: MoreHorizontal, hint: "Anything that doesn't fit above" },
];

const PAYMENTS = ["Cash", "Card", "Transfer", "Mobile money"];
const UNITS = ["pcs", "kg", "g", "L", "ml", "box", "pack"];

const BACK_TARGET = {
  ledger: "home", sales: "home", inventory: "home", expenses: "home", events: "home",
  addSale: "sales", addDailyTotal: "sales", addExpense: "expenses", addItem: "inventory",
  addEvent: "events", eventDetail: "events",
  addEventIncome: "eventDetail", addEventExpense: "eventDetail",
};

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [booting, setBooting] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [events, setEvents] = useState([]);
  const [currency, setCurrency] = useState("$");
  const [view, setView] = useState("home");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
    const sub = onAuthStateChange(setSession);
    return () => sub?.unsubscribe();
  }, []);

  const userId = session?.user?.id || null;

  useEffect(() => {
    if (session === undefined) return; // still checking on load
    if (!userId) { setBooting(false); setLoaded(false); return; }
    (async () => {
      setBooting(true);
      const data = await loadData(userId);
      setTransactions(data?.transactions || []);
      setInventory(data?.inventory || []);
      setEvents(data?.events || []);
      setCurrency(data?.currency || "$");
      setLoaded(true);
      setBooting(false);
    })();
  }, [userId, session]);

  useEffect(() => {
    if (!loaded || !userId) return;
    const t = setTimeout(() => {
      saveData(userId, { transactions, inventory, events, currency });
    }, 400); // debounce so rapid edits don't spam the database
    return () => clearTimeout(t);
  }, [transactions, inventory, events, currency, loaded, userId]);

  async function handleSignOut() {
    setLoaded(false);
    setView("home");
    await signOut();
  }

  const totals = useMemo(() => {
    let sales = 0, expenses = 0;
    const byCategory = {};
    for (const t of transactions) {
      if (t.type === "sale") sales += t.amount;
      else { expenses += t.amount; byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; }
    }
    return { sales, expenses, net: sales - expenses, byCategory };
  }, [transactions]);

  const lowStockItems = useMemo(
    () => inventory.filter((i) => i.lowStock != null && i.quantity <= i.lowStock),
    [inventory]
  );

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;
  const eventTxns = selectedEvent ? transactions.filter((t) => t.eventId === selectedEvent.id) : [];

  function addTransaction(tx) { setTransactions((prev) => [{ ...tx, id: uid() }, ...prev]); }
  function deleteTransaction(id) { setTransactions((prev) => prev.filter((t) => t.id !== id)); }
  function addInventoryItem(item) { setInventory((prev) => [{ ...item, id: uid() }, ...prev]); }
  function deleteInventoryItem(id) { setInventory((prev) => prev.filter((i) => i.id !== id)); }
  function adjustStock(id, delta) {
    setInventory((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(0, +(i.quantity + delta).toFixed(3)) } : i));
  }
  function addEvent(ev) {
    const id = uid();
    setEvents((prev) => [{ ...ev, id }, ...prev]);
    setSelectedEventId(id);
    setView("eventDetail");
  }
  function deleteEvent(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setView("events");
  }

  const fmt = (n) => `${currency}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (session === undefined) {
    return (
      <div style={styles.phone}>
        <div style={styles.bootWrap}>
          <BookOpen size={26} color="#B08D57" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (booting) {
    return (
      <div style={styles.phone}>
        <div style={styles.bootWrap}>
          <BookOpen size={26} color="#B08D57" />
          <div style={styles.bootText}>Loading your ledger…</div>
        </div>
      </div>
    );
  }

  const titles = {
    home: "Workspace", ledger: "Ledger", sales: "Sales", inventory: "Inventory", expenses: "Expenses",
    events: "Events", addSale: "New sale", addDailyTotal: "Day's total sales", addExpense: "New expense",
    addItem: "New item", addEvent: "New event", eventDetail: selectedEvent?.name || "Event",
    addEventIncome: "Event income", addEventExpense: "Event cost",
  };

  return (
    <div style={styles.phone}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .ledger-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <Header
        view={view}
        title={titles[view]}
        currency={currency}
        setCurrency={setCurrency}
        onBack={() => setView(BACK_TARGET[view] || "home")}
      />

      <div className="ledger-scroll" style={styles.body}>
        {view === "home" && (
          <HomeGrid setView={setView} lowStockCount={lowStockItems.length} eventsCount={events.length} totals={totals} fmt={fmt} email={session.user.email} onSignOut={handleSignOut} />
        )}
        {view === "ledger" && (
          <Ledger totals={totals} fmt={fmt} transactions={transactions} lowStockItems={lowStockItems} setView={setView} />
        )}
        {view === "sales" && (
          <SalesList transactions={transactions} fmt={fmt} onDelete={deleteTransaction} setView={setView} />
        )}
        {view === "expenses" && (
          <ExpensesList transactions={transactions} fmt={fmt} onDelete={deleteTransaction} setView={setView} />
        )}
        {view === "inventory" && (
          <InventoryList inventory={inventory} fmt={fmt} setView={setView} onAdjust={adjustStock} onDelete={deleteInventoryItem} />
        )}
        {view === "events" && (
          <EventsList events={events} transactions={transactions} fmt={fmt} setView={setView}
            onOpen={(id) => { setSelectedEventId(id); setView("eventDetail"); }} />
        )}
        {view === "eventDetail" && selectedEvent && (
          <EventDetail event={selectedEvent} transactions={eventTxns} fmt={fmt} setView={setView}
            onDeleteTxn={deleteTransaction} onDeleteEvent={() => deleteEvent(selectedEvent.id)} />
        )}
        {view === "addSale" && (
          <AddSale inventory={inventory} onSave={(tx, stockDelta) => {
            addTransaction(tx); if (stockDelta) adjustStock(stockDelta.id, stockDelta.delta); setView("sales");
          }} />
        )}
        {view === "addDailyTotal" && (
          <AddDailyTotal onSave={(tx) => { addTransaction(tx); setView("sales"); }} />
        )}
        {view === "addExpense" && (
          <AddExpense onSave={(tx) => { addTransaction(tx); setView("expenses"); }} />
        )}
        {view === "addItem" && (
          <AddInventoryItem onSave={(item) => { addInventoryItem(item); setView("inventory"); }} />
        )}
        {view === "addEvent" && (
          <AddEvent onSave={addEvent} />
        )}
        {view === "addEventIncome" && selectedEvent && (
          <AddSale inventory={inventory} eventContext={selectedEvent} onSave={(tx, stockDelta) => {
            addTransaction(tx); if (stockDelta) adjustStock(stockDelta.id, stockDelta.delta); setView("eventDetail");
          }} />
        )}
        {view === "addEventExpense" && selectedEvent && (
          <AddExpense eventContext={selectedEvent} onSave={(tx) => { addTransaction(tx); setView("eventDetail"); }} />
        )}
      </div>
    </div>
  );
}

function AuthScreen() {
  const [method, setMethod] = useState("password"); // password | magic
  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handlePasswordSubmit() {
    setError(""); setInfo("");
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusy(true);
    const fn = authMode === "signin" ? signInWithPassword : signUpWithPassword;
    const { data, error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) { setError(error.message); return; }
    if (authMode === "signup" && !data.session) {
      setInfo("Check your email to confirm your account, then sign in.");
    }
    // On success with a session, onAuthStateChange in App picks it up automatically.
  }

  async function handleMagicLink() {
    setError(""); setInfo("");
    if (!email.trim()) { setError("Enter your email."); return; }
    setBusy(true);
    const { error } = await signInWithMagicLink(email.trim());
    setBusy(false);
    if (error) { setError(error.message); return; }
    setInfo("Check your email for a sign-in link.");
  }

  return (
    <div style={styles.phone}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
      `}</style>
      <div style={styles.onboardWrap}>
        <div style={styles.brandLarge}><BookOpen size={26} color="#B08D57" /></div>
        <div style={styles.onboardTitle}>Ledger</div>
        <div style={styles.onboardSub}>Simple bookkeeping for small businesses — sales, expenses, stock and events, all in one place. Your data is private to your account.</div>

        <div style={styles.methodToggle}>
          <button
            style={{ ...styles.methodBtn, ...(method === "password" ? styles.methodBtnActive : {}) }}
            onClick={() => { setMethod("password"); setError(""); setInfo(""); }}
          >
            Password
          </button>
          <button
            style={{ ...styles.methodBtn, ...(method === "magic" ? styles.methodBtnActive : {}) }}
            onClick={() => { setMethod("magic"); setError(""); setInfo(""); }}
          >
            Magic link
          </button>
        </div>

        <div style={{ width: "100%", marginTop: 18 }}>
          <div style={{ position: "relative" }}>
            <Mail size={14} color="#8B8B7F" style={styles.inputIcon} />
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com" style={{ ...styles.input, paddingLeft: 34, marginBottom: 10 }}
            />
          </div>

          {method === "password" && (
            <div style={{ position: "relative" }}>
              <Lock size={14} color="#8B8B7F" style={styles.inputIcon} />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" style={{ ...styles.input, paddingLeft: 34, marginBottom: 10 }}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              />
            </div>
          )}

          {error && <div style={styles.errorText}>{error}</div>}
          {info && <div style={styles.infoText}>{info}</div>}

          {method === "password" ? (
            <>
              <button style={{ ...styles.saveBtn, background: "#2F6B4F", marginTop: 6 }} onClick={handlePasswordSubmit} disabled={busy}>
                {authMode === "signin" ? "Sign in" : "Create account"}
              </button>
              <button style={styles.onboardLink} onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }}>
                {authMode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
              </button>
            </>
          ) : (
            <button style={{ ...styles.saveBtn, background: "#2F6B4F", marginTop: 6 }} onClick={handleMagicLink} disabled={busy}>
              Send magic link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ view, title, currency, setCurrency, onBack }) {
  const isHome = view === "home";
  return (
    <div style={styles.header}>
      {isHome ? (
        <div style={styles.brand}><BookOpen size={18} color="#B08D57" /></div>
      ) : (
        <button style={styles.iconBtn} onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} color="#F7F8F1" />
        </button>
      )}
      <div style={styles.headerTitle}>{title}</div>
      {isHome ? (
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={styles.currencySelect} aria-label="Currency">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <div style={{ width: 32 }} />
      )}
    </div>
  );
}

function HomeGrid({ setView, lowStockCount, eventsCount, totals, fmt, email, onSignOut }) {
  const tiles = [
    { id: "ledger", label: "Ledger", icon: Wallet, bg: "#B08D57" },
    { id: "sales", label: "Sales", icon: TrendingUp, bg: "#2F6B4F" },
    { id: "inventory", label: "Inventory", icon: Package, bg: "#C98A2B", badge: lowStockCount },
    { id: "expenses", label: "Expenses", icon: TrendingDown, bg: "#A13D2E" },
    { id: "events", label: "Events", icon: CalendarDays, bg: "#4C5E8A", count: eventsCount },
  ];

  return (
    <div>
      <div style={styles.homeIntro}>
        <div style={styles.homeIntroLabel}>Net balance</div>
        <div style={{ ...styles.homeIntroAmount, color: totals.net >= 0 ? "#2F6B4F" : "#A13D2E" }}>
          {totals.net >= 0 ? "+" : "-"}{fmt(totals.net)}
        </div>
      </div>
      <div style={styles.homeGrid}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} style={styles.tile} onClick={() => setView(t.id)}>
              <div style={styles.tileIconWrap}>
                <div style={{ ...styles.tileIconBadge, background: t.bg }}>
                  <Icon size={22} color="#FBFAF3" />
                </div>
                {t.badge > 0 && <div style={styles.tileDot} />}
                {t.count > 0 && <div style={styles.tileCount}>{t.count}</div>}
              </div>
              <div style={styles.tileLabel}>{t.label}</div>
            </button>
          );
        })}
      </div>
      <div style={styles.accountRow}>
        <span style={styles.accountEmail}>{email}</span>
        <button style={styles.signOutBtn} onClick={onSignOut}>
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </div>
  );
}

function Ledger({ totals, fmt, transactions, lowStockItems, setView }) {
  const recent = transactions.slice(0, 5);
  const catList = EXPENSE_CATEGORIES
    .map((c) => ({ ...c, total: totals.byCategory[c.id] || 0 }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxCat = catList.length ? catList[0].total : 1;

  return (
    <div>
      <LedgerTape totals={totals} fmt={fmt} />
      {lowStockItems.length > 0 && (
        <button style={styles.alertBanner} onClick={() => setView("inventory")}>
          <AlertTriangle size={15} color="#8A5A12" />
          <span>{lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} running low on stock</span>
          <ChevronRight size={14} color="#8A5A12" />
        </button>
      )}
      <SectionLabel text="Overhead breakdown" />
      {catList.length === 0 ? (
        <EmptyNote text="No overhead logged yet. Categories appear here once you record an expense." />
      ) : (
        <div style={styles.card}>
          {catList.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.id} style={styles.catRow}>
                <div style={styles.catIconWrap}><Icon size={15} color="#4B5A4E" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.catTopLine}>
                    <span style={styles.catLabel}>{c.label}</span>
                    <span style={styles.catAmount}>{fmt(c.total)}</span>
                  </div>
                  <div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${Math.max(6, (c.total / maxCat) * 100)}%` }} /></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <SectionLabel text="Recent entries" />
      {recent.length === 0 ? (
        <EmptyNote text="Nothing recorded yet. Head to Sales or Expenses to start your ledger." />
      ) : (
        <div style={styles.card}>{recent.map((t) => <TxnRow key={t.id} t={t} fmt={fmt} />)}</div>
      )}
    </div>
  );
}

function LedgerTape({ totals, fmt }) {
  return (
    <div style={styles.tapeWrap}>
      <div style={styles.tapeZigTop} />
      <div style={styles.tape}>
        <div style={styles.tapeRow}>
          <span style={styles.tapeLabel}>Total sales</span>
          <span style={{ ...styles.tapeAmount, color: "#2F6B4F" }}>+{fmt(totals.sales)}</span>
        </div>
        <div style={styles.tapeRow}>
          <span style={styles.tapeLabel}>Total expenses</span>
          <span style={{ ...styles.tapeAmount, color: "#A13D2E" }}>-{fmt(totals.expenses)}</span>
        </div>
        <div style={styles.tapeDivider} />
        <div style={styles.tapeRow}>
          <span style={{ ...styles.tapeLabel, fontWeight: 600, color: "#1F2A24" }}>Net balance</span>
          <span style={{ ...styles.tapeAmount, fontSize: 20, color: totals.net >= 0 ? "#2F6B4F" : "#A13D2E" }}>
            {totals.net >= 0 ? "+" : "-"}{fmt(totals.net)}
          </span>
        </div>
      </div>
      <div style={styles.tapeZigBottom} />
    </div>
  );
}

function TxnRow({ t, fmt, onDelete }) {
  const cat = EXPENSE_CATEGORIES.find((c) => c.id === t.category);
  const Icon = t.isDayTotal ? Layers : t.type === "sale" ? TrendingUp : cat ? cat.icon : TrendingDown;
  const tags = [fmtDate(t.date)];
  if (t.payment) tags.push(t.payment);
  if (t.itemName) tags.push(`${t.qty} ${t.itemName}`);
  if (t.isDayTotal) tags.push("Day total");
  if (t.eventName) tags.push(t.eventName);
  return (
    <div style={styles.txnRow}>
      <div style={{ ...styles.txnIconWrap, background: t.type === "sale" ? "#EAF1EC" : "#F6EAE7" }}>
        <Icon size={14} color={t.type === "sale" ? "#2F6B4F" : "#A13D2E"} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.txnDesc}>{t.description || (t.type === "sale" ? "Sale" : cat?.label || "Expense")}</div>
        <div style={styles.txnMeta}>{tags.join(" · ")}</div>
      </div>
      <div style={{ ...styles.txnAmount, color: t.type === "sale" ? "#2F6B4F" : "#A13D2E" }}>
        {t.type === "sale" ? "+" : "-"}{fmt(t.amount)}
      </div>
      {onDelete && (
        <button style={styles.deleteBtn} onClick={() => onDelete(t.id)} aria-label="Delete entry">
          <Trash2 size={14} color="#8B8B7F" />
        </button>
      )}
    </div>
  );
}

function SectionLabel({ text }) { return <div style={styles.sectionLabel}>{text}</div>; }
function EmptyNote({ text }) { return <div style={styles.emptyNote}>{text}</div>; }

function SalesList({ transactions, fmt, onDelete, setView }) {
  const sales = transactions.filter((t) => t.type === "sale");
  return (
    <div>
      <div style={styles.rowBtnPair}>
        <AddRowButton label="Add sale" tone="green" onClick={() => setView("addSale")} />
        <AddRowButton label="Log day total" tone="brass" icon={Layers} onClick={() => setView("addDailyTotal")} />
      </div>
      {sales.length === 0 ? (
        <EmptyNote text="No sales recorded yet. Add a single sale, or log the whole day's total if it's too busy to track one by one." />
      ) : (
        <div style={styles.card}>{sales.map((t) => <TxnRow key={t.id} t={t} fmt={fmt} onDelete={onDelete} />)}</div>
      )}
    </div>
  );
}

function ExpensesList({ transactions, fmt, onDelete, setView }) {
  const expenses = transactions.filter((t) => t.type === "expense");
  return (
    <div>
      <AddRowButton label="Add expense" tone="red" onClick={() => setView("addExpense")} full />
      {expenses.length === 0 ? (
        <EmptyNote text="No expenses recorded yet. Tap Add expense above to log your first one." />
      ) : (
        <div style={styles.card}>{expenses.map((t) => <TxnRow key={t.id} t={t} fmt={fmt} onDelete={onDelete} />)}</div>
      )}
    </div>
  );
}

function AddRowButton({ label, tone, onClick, icon, full }) {
  const colors = { green: "#2F6B4F", red: "#A13D2E", amber: "#B08D57", brass: "#8A6A2F", teal: "#3E6B67" };
  const bgs = { green: "#EAF1EC", red: "#F6EAE7", amber: "#F3E9D8", brass: "#F1EAD8", teal: "#E5EFED" };
  const color = colors[tone] || "#B08D57";
  const bg = bgs[tone] || "#F3E9D8";
  const Icon = icon || Plus;
  return (
    <button style={{ ...styles.quickBtn, ...(full ? { width: "100%" } : { flex: 1 }), background: bg, borderColor: color, marginBottom: 18 }} onClick={onClick}>
      <Icon size={15} color={color} /><span style={{ color, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function InventoryList({ inventory, fmt, setView, onAdjust, onDelete }) {
  const [adjustState, setAdjustState] = useState(null);
  const [qtyInput, setQtyInput] = useState("");

  function openAdjust(id, mode) { setAdjustState({ id, mode }); setQtyInput(""); }
  function confirmAdjust() {
    const n = parseFloat(qtyInput);
    if (!n || n <= 0) return;
    onAdjust(adjustState.id, adjustState.mode === "restock" ? n : -n);
    setAdjustState(null); setQtyInput("");
  }

  return (
    <div>
      <AddRowButton label="Add item" tone="amber" onClick={() => setView("addItem")} full />
      {inventory.length === 0 ? (
        <EmptyNote text="No stock items yet. Add items here to track quantity and link them to sales." />
      ) : (
        <div style={styles.card}>
          {inventory.map((item) => {
            const low = item.lowStock != null && item.quantity <= item.lowStock;
            const adjusting = adjustState?.id === item.id;
            return (
              <div key={item.id}>
                <div style={styles.invRow}>
                  <div style={{ ...styles.catIconWrap, background: low ? "#F6EAE7" : "#EEF0E4" }}>
                    <Package size={15} color={low ? "#A13D2E" : "#4B5A4E"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.txnDesc}>{item.name}</div>
                    <div style={styles.txnMeta}>
                      {item.quantity} {item.unit} on hand · sells {fmt(item.sellPrice)}/{item.unit}
                      {low && <span style={{ color: "#A13D2E", fontWeight: 600 }}> · low stock</span>}
                    </div>
                  </div>
                  <button style={styles.stockBtn} onClick={() => openAdjust(item.id, "restock")} aria-label="Restock">
                    <Plus size={13} color="#2F6B4F" />
                  </button>
                  <button style={styles.stockBtn} onClick={() => openAdjust(item.id, "waste")} aria-label="Log waste">
                    <Minus size={13} color="#A13D2E" />
                  </button>
                  <button style={styles.deleteBtn} onClick={() => onDelete(item.id)} aria-label="Delete item">
                    <Trash2 size={14} color="#8B8B7F" />
                  </button>
                </div>
                {adjusting && (
                  <div style={styles.adjustPanel}>
                    <div style={styles.fieldLabel}>
                      {adjustState.mode === "restock" ? `Add stock (${item.unit})` : `Log waste / spoilage (${item.unit})`}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="number" inputMode="decimal" value={qtyInput} autoFocus
                        onChange={(e) => setQtyInput(e.target.value)} placeholder="0" style={{ ...styles.input, flex: 1 }} />
                      <button style={{ ...styles.saveBtn, width: 90, margin: 0, padding: "0 0", background: adjustState.mode === "restock" ? "#2F6B4F" : "#A13D2E" }} onClick={confirmAdjust}>Save</button>
                      <button style={styles.cancelBtn} onClick={() => setAdjustState(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventsList({ events, transactions, fmt, setView, onOpen }) {
  function eventNet(ev) {
    const txns = transactions.filter((t) => t.eventId === ev.id);
    let income = 0, cost = 0;
    for (const t of txns) t.type === "sale" ? income += t.amount : cost += t.amount;
    return { income, cost, net: income - cost };
  }
  return (
    <div>
      <AddRowButton label="New event" tone="teal" icon={CalendarDays} onClick={() => setView("addEvent")} full />
      {events.length === 0 ? (
        <EmptyNote text="No events yet. Create one for a wedding, catering job, or market day, then log its costs and income to see if it was worth it." />
      ) : (
        <div style={styles.card}>
          {events.map((ev) => {
            const { income, cost, net } = eventNet(ev);
            return (
              <button key={ev.id} style={styles.eventRow} onClick={() => onOpen(ev.id)}>
                <div style={{ ...styles.catIconWrap, background: "#E5E8F1" }}>
                  <CalendarDays size={15} color="#4C5E8A" />
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={styles.txnDesc}>{ev.name}</div>
                  <div style={styles.txnMeta}>{fmtDate(ev.date)} · in {fmt(income)} · out {fmt(cost)}</div>
                </div>
                <div style={{ ...styles.txnAmount, color: net >= 0 ? "#2F6B4F" : "#A13D2E" }}>
                  {net >= 0 ? "+" : "-"}{fmt(net)}
                </div>
                <ChevronRight size={15} color="#8B8B7F" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EventDetail({ event, transactions, fmt, setView, onDeleteTxn, onDeleteEvent }) {
  let income = 0, cost = 0;
  for (const t of transactions) t.type === "sale" ? income += t.amount : cost += t.amount;
  const net = income - cost;
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div style={styles.tapeWrap}>
        <div style={styles.tapeZigTop} />
        <div style={styles.tape}>
          <div style={styles.tapeRow}><span style={styles.tapeLabel}>{fmtDate(event.date)}</span></div>
          <div style={styles.tapeRow}>
            <span style={styles.tapeLabel}>Income</span>
            <span style={{ ...styles.tapeAmount, color: "#2F6B4F" }}>+{fmt(income)}</span>
          </div>
          <div style={styles.tapeRow}>
            <span style={styles.tapeLabel}>Cost</span>
            <span style={{ ...styles.tapeAmount, color: "#A13D2E" }}>-{fmt(cost)}</span>
          </div>
          <div style={styles.tapeDivider} />
          <div style={styles.tapeRow}>
            <span style={{ ...styles.tapeLabel, fontWeight: 600, color: "#1F2A24" }}>Profit / loss</span>
            <span style={{ ...styles.tapeAmount, fontSize: 20, color: net >= 0 ? "#2F6B4F" : "#A13D2E" }}>
              {net >= 0 ? "+" : "-"}{fmt(net)}
            </span>
          </div>
        </div>
        <div style={styles.tapeZigBottom} />
      </div>

      <div style={styles.rowBtnPair}>
        <AddRowButton label="Add income" tone="green" onClick={() => setView("addEventIncome")} />
        <AddRowButton label="Add cost" tone="red" onClick={() => setView("addEventExpense")} />
      </div>

      <SectionLabel text="Entries" />
      {sorted.length === 0 ? (
        <EmptyNote text="No entries yet for this event. Add what it cost you and what it brought in." />
      ) : (
        <div style={styles.card}>{sorted.map((t) => <TxnRow key={t.id} t={t} fmt={fmt} onDelete={onDeleteTxn} />)}</div>
      )}

      <button style={styles.deleteEventBtn} onClick={onDeleteEvent}>
        <Trash2 size={13} color="#A13D2E" /> Delete event
      </button>
    </div>
  );
}

function AddSale({ onSave, inventory, eventContext }) {
  const [date, setDate] = useState(eventContext?.date || todayStr());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [linked, setLinked] = useState(false);
  const [itemId, setItemId] = useState(inventory[0]?.id || null);
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");

  const selectedItem = inventory.find((i) => i.id === itemId);

  useEffect(() => {
    if (linked && selectedItem && qty) {
      const n = parseFloat(qty);
      if (n > 0) setAmount((n * selectedItem.sellPrice).toFixed(2));
    }
  }, [qty, itemId, linked]);

  function handleSave() {
    const num = parseFloat(amount);
    if (!num || num <= 0) { setError("Enter an amount greater than zero."); return; }
    let stockDelta = null, itemName = null, qtyVal = null;
    if (linked && selectedItem) {
      const n = parseFloat(qty);
      if (!n || n <= 0) { setError("Enter a quantity sold."); return; }
      if (n > selectedItem.quantity) { setError(`Only ${selectedItem.quantity} ${selectedItem.unit} of ${selectedItem.name} left in stock.`); return; }
      stockDelta = { id: selectedItem.id, delta: -n };
      itemName = selectedItem.name; qtyVal = n;
    }
    onSave({
      type: "sale", date, description: description.trim() || (itemName || ""), amount: num, payment,
      itemName, qty: qtyVal,
      eventId: eventContext?.id || null, eventName: eventContext?.name || null,
    }, stockDelta);
  }

  return (
    <div>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} /></Field>
      {inventory.length > 0 && (
        <Field label="Link to inventory item (optional)">
          <div style={styles.chipRow}>
            <button onClick={() => setLinked((v) => !v)} style={{ ...styles.chip, display: "flex", alignItems: "center", gap: 5, borderColor: linked ? "#2F6B4F" : "#D9DCC9", background: linked ? "#EAF1EC" : "#F7F8F1", color: linked ? "#2F6B4F" : "#4B5A4E" }}>
              <Link2 size={12} /> {linked ? "Linked" : "Link an item"}
            </button>
          </div>
          {linked && (
            <div style={{ marginTop: 10 }}>
              <select value={itemId || ""} onChange={(e) => setItemId(e.target.value)} style={styles.input}>
                {inventory.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit} left)</option>)}
              </select>
              <div style={{ height: 8 }} />
              <input type="number" inputMode="decimal" value={qty} onChange={(e) => { setQty(e.target.value); setError(""); }} placeholder={`Quantity sold (${selectedItem?.unit || ""})`} style={styles.input} />
            </div>
          )}
        </Field>
      )}
      <Field label={eventContext ? "Description" : "Customer / description"}>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={eventContext ? "e.g. Table sales, deposit received" : "e.g. Walk-in customer, Invoice #204"} style={styles.input} />
      </Field>
      <Field label="Amount">
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} placeholder="0.00" style={styles.amountInput} />
        {error && <div style={styles.errorText}>{error}</div>}
      </Field>
      <Field label="Payment method"><ChipRow options={PAYMENTS} value={payment} onChange={setPayment} tone="green" /></Field>
      <button style={{ ...styles.saveBtn, background: "#2F6B4F" }} onClick={handleSave}>Save {eventContext ? "income" : "sale"}</button>
    </div>
  );
}

function AddDailyTotal({ onSave }) {
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [error, setError] = useState("");

  function handleSave() {
    const num = parseFloat(amount);
    if (!num || num <= 0) { setError("Enter an amount greater than zero."); return; }
    onSave({ type: "sale", date, description: note.trim() || "Day total (all sales)", amount: num, payment, isDayTotal: true });
  }

  return (
    <div>
      <EmptyNote text="Use this when it's too busy to log every sale. Enter one lump sum for everything sold today, no itemizing needed." />
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} /></Field>
      <Field label="Total sales for the day">
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} placeholder="0.00" style={styles.amountInput} />
        {error && <div style={styles.errorText}>{error}</div>}
      </Field>
      <Field label="Note (optional)">
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Till reading, market day" style={styles.input} />
      </Field>
      <Field label="Mostly received as"><ChipRow options={PAYMENTS} value={payment} onChange={setPayment} tone="green" /></Field>
      <button style={{ ...styles.saveBtn, background: "#8A6A2F" }} onClick={handleSave}>Save day total</button>
    </div>
  );
}

function AddExpense({ onSave, eventContext }) {
  const [date, setDate] = useState(eventContext?.date || todayStr());
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [error, setError] = useState("");

  function handleSave() {
    const num = parseFloat(amount);
    if (!category) { setError("Choose a category first."); return; }
    if (!num || num <= 0) { setError("Enter an amount greater than zero."); return; }
    onSave({
      type: "expense", date, category, description: description.trim(), amount: num, payment,
      eventId: eventContext?.id || null, eventName: eventContext?.name || null,
    });
  }

  const selectedCat = EXPENSE_CATEGORIES.find((c) => c.id === category);

  return (
    <div>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} /></Field>
      <Field label="Category">
        <div style={styles.catGrid}>
          {EXPENSE_CATEGORIES.map((c) => {
            const Icon = c.icon; const active = category === c.id;
            return (
              <button key={c.id} onClick={() => { setCategory(c.id); setError(""); }} style={{ ...styles.catTile, borderColor: active ? "#A13D2E" : "#D9DCC9", background: active ? "#F6EAE7" : "#F7F8F1" }}>
                <Icon size={16} color={active ? "#A13D2E" : "#4B5A4E"} />
                <span style={{ color: active ? "#A13D2E" : "#1F2A24" }}>{c.label}</span>
              </button>
            );
          })}
        </div>
        {selectedCat && <div style={styles.catHint}>{selectedCat.hint}</div>}
      </Field>
      <Field label="Description (optional)">
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={eventContext ? "e.g. Caterer deposit, tent hire" : "e.g. Diesel for delivery van"} style={styles.input} />
      </Field>
      <Field label="Amount">
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} placeholder="0.00" style={styles.amountInput} />
        {error && <div style={styles.errorText}>{error}</div>}
      </Field>
      <Field label="Payment method"><ChipRow options={PAYMENTS} value={payment} onChange={setPayment} tone="red" /></Field>
      <button style={{ ...styles.saveBtn, background: "#A13D2E" }} onClick={handleSave}>Save {eventContext ? "cost" : "expense"}</button>
    </div>
  );
}

function AddInventoryItem({ onSave }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [quantity, setQuantity] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [lowStock, setLowStock] = useState("");
  const [error, setError] = useState("");

  function handleSave() {
    if (!name.trim()) { setError("Give the item a name."); return; }
    const q = parseFloat(quantity) || 0;
    const sp = parseFloat(sellPrice);
    if (!sp || sp <= 0) { setError("Enter a sell price greater than zero."); return; }
    onSave({ name: name.trim(), unit, quantity: q, costPrice: parseFloat(costPrice) || 0, sellPrice: sp, lowStock: lowStock ? parseFloat(lowStock) : null });
  }

  return (
    <div>
      <Field label="Item name">
        <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Goat meat, Rice 5kg bag" style={styles.input} />
      </Field>
      <Field label="Unit">
        <div style={styles.chipRow}>
          {UNITS.map((u) => (
            <button key={u} onClick={() => setUnit(u)} style={{ ...styles.chip, borderColor: unit === u ? "#B08D57" : "#D9DCC9", background: unit === u ? "#F3E9D8" : "#F7F8F1", color: unit === u ? "#7A5B29" : "#4B5A4E" }}>{u}</button>
          ))}
        </div>
      </Field>
      <Field label={`Opening quantity (${unit})`}>
        <input type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" style={styles.input} />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Cost price / unit"><input type="number" inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" style={styles.input} /></Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Sell price / unit"><input type="number" inputMode="decimal" value={sellPrice} onChange={(e) => { setSellPrice(e.target.value); setError(""); }} placeholder="0.00" style={styles.input} /></Field>
        </div>
      </div>
      <Field label="Low stock warning below (optional)">
        <input type="number" inputMode="decimal" value={lowStock} onChange={(e) => setLowStock(e.target.value)} placeholder={`e.g. 2 ${unit}`} style={styles.input} />
      </Field>
      {error && <div style={styles.errorText}>{error}</div>}
      <button style={{ ...styles.saveBtn, background: "#B08D57" }} onClick={handleSave}>Save item</button>
    </div>
  );
}

function AddEvent({ onSave }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState("");

  function handleSave() {
    if (!name.trim()) { setError("Give the event a name."); return; }
    onSave({ name: name.trim(), date });
  }

  return (
    <div>
      <Field label="Event name">
        <input type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Smith wedding catering, Saturday market" style={styles.input} />
      </Field>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} /></Field>
      {error && <div style={styles.errorText}>{error}</div>}
      <button style={{ ...styles.saveBtn, background: "#4C5E8A" }} onClick={handleSave}>Create event</button>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={styles.field}><div style={styles.fieldLabel}>{label}</div>{children}</div>;
}

function ChipRow({ options, value, onChange, tone }) {
  const activeColor = tone === "green" ? "#2F6B4F" : "#A13D2E";
  const activeBg = tone === "green" ? "#EAF1EC" : "#F6EAE7";
  return (
    <div style={styles.chipRow}>
      {options.map((o) => {
        const active = value === o;
        return (
          <button key={o} onClick={() => onChange(o)} style={{ ...styles.chip, borderColor: active ? activeColor : "#D9DCC9", background: active ? activeBg : "#F7F8F1", color: active ? activeColor : "#4B5A4E" }}>{o}</button>
        );
      })}
    </div>
  );
}

const styles = {
  phone: { fontFamily: "'Inter', sans-serif", background: "#EEF0E4", maxWidth: 400, margin: "0 auto", minHeight: 660, display: "flex", flexDirection: "column", border: "1px solid #D9DCC9", borderRadius: 20, overflow: "hidden" },
  bootWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 },
  bootText: { fontSize: 13, color: "#6B7368" },
  onboardWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 28px", textAlign: "center" },
  brandLarge: { width: 56, height: 56, borderRadius: 14, background: "#1F2A24", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  onboardTitle: { fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: "#1F2A24", marginBottom: 8 },
  onboardSub: { fontSize: 13, color: "#6B7368", lineHeight: 1.5, maxWidth: 280 },
  onboardLink: { background: "transparent", border: "none", color: "#8A6A2F", fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginTop: 10, padding: 8 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 14px", background: "#1F2A24" },
  brand: { width: 32, height: 32, borderRadius: 8, background: "#2A3830", display: "flex", alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  headerTitle: { fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "#F7F8F1", letterSpacing: 0.2 },
  currencySelect: { background: "#2A3830", color: "#F7F8F1", border: "1px solid #3C4A3F", borderRadius: 8, padding: "6px 8px", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" },
  body: { flex: 1, padding: "16px 16px 24px", overflowY: "auto" },
  homeIntro: { marginBottom: 22, textAlign: "center" },
  homeIntroLabel: { fontSize: 12, color: "#8B8B7F", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  homeIntroAmount: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 30, fontWeight: 600 },
  homeGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "22px 10px" },
  tile: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0 },
  tileIconWrap: { position: "relative" },
  tileIconBadge: { width: 60, height: 60, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(31,42,36,0.12)" },
  tileDot: { position: "absolute", top: -3, right: -3, width: 12, height: 12, borderRadius: 6, background: "#A13D2E", border: "2px solid #EEF0E4" },
  tileCount: { position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, background: "#1F2A24", color: "#F7F8F1", fontSize: 10.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: "2px solid #EEF0E4" },
  tileLabel: { fontSize: 12.5, fontWeight: 500, color: "#1F2A24" },
  accountRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 26, padding: "10px 4px", borderTop: "1px solid #D9DCC9" },
  accountEmail: { fontSize: 11.5, color: "#8B8B7F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  signOutBtn: { display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "#A13D2E", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, padding: 4 },
  methodToggle: { display: "flex", gap: 6, marginTop: 24, background: "#F7F8F1", border: "1px solid #D9DCC9", borderRadius: 10, padding: 3, width: "100%" },
  methodBtn: { flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "transparent", color: "#6B7368", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  methodBtnActive: { background: "#1F2A24", color: "#F7F8F1" },
  inputIcon: { position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" },
  infoText: { fontSize: 12, color: "#2F6B4F", marginTop: 5, marginBottom: 8 },
  tapeWrap: { marginBottom: 16 },
  tape: { background: "#FBFAF3", border: "1px solid #D9DCC9", padding: "16px 18px" },
  tapeZigTop: { height: 8, background: "linear-gradient(135deg, transparent 50%, #EEF0E4 50%) 0 0/10px 10px, linear-gradient(-135deg, transparent 50%, #EEF0E4 50%) 0 0/10px 10px", backgroundColor: "#FBFAF3" },
  tapeZigBottom: { height: 8, background: "linear-gradient(45deg, transparent 50%, #EEF0E4 50%) 0 100%/10px 10px, linear-gradient(-45deg, transparent 50%, #EEF0E4 50%) 0 100%/10px 10px", backgroundColor: "#FBFAF3", backgroundRepeat: "repeat-x" },
  tapeRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "6px 0" },
  tapeLabel: { fontSize: 12.5, color: "#6B7368", letterSpacing: 0.3, textTransform: "uppercase" },
  tapeAmount: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 600 },
  tapeDivider: { borderTop: "1px dashed #C9CDB8", margin: "6px 0" },
  alertBanner: { display: "flex", alignItems: "center", gap: 7, width: "100%", background: "#FAEEDA", border: "1px solid #E8C98A", borderRadius: 10, padding: "9px 12px", marginBottom: 16, fontSize: 12.5, color: "#8A5A12", fontWeight: 500, cursor: "pointer" },
  rowBtnPair: { display: "flex", gap: 10 },
  quickBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 8px", borderRadius: 10, border: "1px solid", cursor: "pointer", fontSize: 13 },
  sectionLabel: { fontFamily: "'Fraunces', serif", fontSize: 13.5, fontWeight: 600, color: "#4B5A4E", textTransform: "uppercase", letterSpacing: 0.6, margin: "4px 0 8px" },
  card: { background: "#F7F8F1", border: "1px solid #D9DCC9", borderRadius: 12, marginBottom: 20, overflow: "hidden" },
  catRow: { display: "flex", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: "1px solid #E4E6D8" },
  catIconWrap: { width: 28, height: 28, borderRadius: 7, background: "#EEF0E4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  catTopLine: { display: "flex", justifyContent: "space-between", marginBottom: 5 },
  catLabel: { fontSize: 13, color: "#1F2A24", fontWeight: 500 },
  catAmount: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "#1F2A24", fontWeight: 600 },
  barTrack: { height: 5, background: "#E4E6D8", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", background: "#B08D57", borderRadius: 3 },
  txnRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid #E4E6D8" },
  invRow: { display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #E4E6D8" },
  eventRow: { display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: "1px solid #E4E6D8", background: "transparent", border: "none", width: "100%", cursor: "pointer" },
  txnIconWrap: { width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  txnDesc: { fontSize: 13, color: "#1F2A24", fontWeight: 500 },
  txnMeta: { fontSize: 11.5, color: "#8B8B7F", marginTop: 1 },
  txnAmount: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" },
  deleteBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 4, marginLeft: 2 },
  stockBtn: { width: 24, height: 24, borderRadius: 6, border: "1px solid #D9DCC9", background: "#F7F8F1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  adjustPanel: { padding: "10px 14px 14px", borderBottom: "1px solid #E4E6D8", background: "#F2F3E9" },
  cancelBtn: { border: "1px solid #D9DCC9", background: "transparent", color: "#6B7368", borderRadius: 9, fontSize: 12.5, padding: "0 12px", cursor: "pointer" },
  emptyNote: { fontSize: 12.5, color: "#8B8B7F", background: "#F7F8F1", border: "1px dashed #D9DCC9", borderRadius: 10, padding: "14px 16px", marginBottom: 20, lineHeight: 1.5 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 12.5, color: "#4B5A4E", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #D9DCC9", background: "#F7F8F1", fontSize: 14, color: "#1F2A24", fontFamily: "'Inter', sans-serif" },
  amountInput: { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #D9DCC9", background: "#F7F8F1", fontSize: 16, color: "#1F2A24", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 },
  errorText: { fontSize: 12, color: "#A13D2E", marginTop: 5, marginBottom: 8 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { padding: "7px 13px", borderRadius: 20, border: "1px solid", fontSize: 12.5, fontWeight: 500, cursor: "pointer" },
  catGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  catTile: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "10px 10px", borderRadius: 10, border: "1px solid", cursor: "pointer", fontSize: 11.5, fontWeight: 500, textAlign: "left", lineHeight: 1.25 },
  catHint: { fontSize: 12, color: "#6B7368", marginTop: 8, fontStyle: "italic" },
  saveBtn: { width: "100%", padding: "13px 0", borderRadius: 10, border: "none", color: "#FBFAF3", fontSize: 14.5, fontWeight: 600, cursor: "pointer", marginTop: 4, marginBottom: 20 },
  deleteEventBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", background: "transparent", border: "1px dashed #D9DCC9", color: "#A13D2E", borderRadius: 10, padding: "10px 0", fontSize: 12.5, fontWeight: 500, cursor: "pointer", marginBottom: 8 },
};
