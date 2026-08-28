import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc,
  onSnapshot, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* ---------------- Firebase setup ---------------- */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const LABS = ["Lab11", "Lab1", "Lab2", "MB Lab"];
const studentsCol = collection(db, "students");
const labStatusCol = collection(db, "labStatus");
const labLogsCol = collection(db, "labLogs");

/* ---------------- Local state ---------------- */
const NAME_KEY = "labledger_myname";
let myName = localStorage.getItem(NAME_KEY) || null;

let labStatusData = {};   // { labName: {status, currentHolder, openedBy, openedAt, lastUpdated} }
let studentsData = [];    // [name, ...]
let logsData = [];        // [{labName, action, studentName, relatedStudent, timestamp}]
let handoverSelection = {}; // { labName: selectedTargetName }

/* ---------------- Helpers ---------------- */
function nowStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function showToast(msg, ms = 2600) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden"), ms);
}

/* ---------------- Seed lab docs ---------------- */
async function seedLabs() {
  for (const lab of LABS) {
    const ref = doc(labStatusCol, lab);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        status: "Closed",
        currentHolder: null,
        openedBy: null,
        openedAt: null,
        lastUpdated: nowStr()
      });
    }
  }
}

/* ---------------- Firestore actions ---------------- */
async function registerNewProfile(name) {
  name = name.trim();
  if (!name) return { ok: false, msg: "Please enter your name." };
  const exists = studentsData.some((s) => s.toLowerCase() === name.toLowerCase());
  if (exists) return { ok: false, msg: `"${name}" is already registered. Use "Select existing name" below.` };
  await addDoc(studentsCol, { name, createdAt: nowStr() });
  return { ok: true };
}

async function openLabAction(labName) {
  const status = labStatusData[labName];
  if (!status || status.status === "Open") {
    showToast(`${labName} is already open${status?.currentHolder ? " (held by " + status.currentHolder + ")" : ""}.`);
    return;
  }
  const ts = nowStr();
  await updateDoc(doc(labStatusCol, labName), {
    status: "Open", currentHolder: myName, openedBy: myName, openedAt: ts, lastUpdated: ts
  });
  await addDoc(labLogsCol, { labName, action: "OPEN", studentName: myName, relatedStudent: null, timestamp: ts });
  showToast(`${labName} opened.`);
}

async function handoverLabAction(labName, toName) {
  const status = labStatusData[labName];
  if (!status || status.status !== "Open" || status.currentHolder !== myName) {
    showToast(`You aren't currently holding ${labName}.`);
    return;
  }
  if (!toName) { showToast("Pick a student to hand over to."); return; }
  if (toName === myName) { showToast("Choose someone other than yourself."); return; }
  const ts = nowStr();
  await updateDoc(doc(labStatusCol, labName), { currentHolder: toName, lastUpdated: ts });
  await addDoc(labLogsCol, { labName, action: "HANDOVER", studentName: myName, relatedStudent: toName, timestamp: ts });
  showToast(`${labName} handed over to ${toName}.`);
  delete handoverSelection[labName];
}

async function closeLabAction(labName) {
  const status = labStatusData[labName];
  if (!status || status.status !== "Open") {
    showToast(`${labName} is already closed.`);
    return;
  }
  const ts = nowStr();
  await updateDoc(doc(labStatusCol, labName), {
    status: "Closed", currentHolder: null, openedBy: null, openedAt: null, lastUpdated: ts
  });
  await addDoc(labLogsCol, { labName, action: "CLOSE", studentName: myName, relatedStudent: null, timestamp: ts });
  showToast(`${labName} closed.`);
}

/* ---------------- Rendering ---------------- */
function renderWhoAmI() {
  document.getElementById("whoami-name").textContent = myName || "—";
  document.getElementById("open-as-name").textContent = myName || "—";
  document.getElementById("handover-as-name").textContent = myName || "—";
  document.getElementById("close-as-name").textContent = myName || "—";
}

function renderHome() {
  const wrap = document.getElementById("home-list");
  wrap.innerHTML = LABS.map((lab) => {
    const s = labStatusData[lab] || { status: "Closed" };
    const isOpen = s.status === "Open";
    const stampClass = isOpen ? "stamp-open" : "stamp-closed";
    const stampText = isOpen ? "Open" : "Closed";
    let meta;
    if (isOpen) {
      meta = `<p class="lab-meta">Held by <b>${esc(s.currentHolder)}</b></p>
              <p class="lab-meta">Opened by <b>${esc(s.openedBy)}</b> · ${esc(s.openedAt)}</p>`;
    } else {
      meta = `<p class="lab-meta">Not currently in use</p>`;
      if (s.lastUpdated) meta += `<p class="lab-meta">Last closed ${esc(s.lastUpdated)}</p>`;
    }
    return `
      <div class="stamp-card">
        <div class="stamp-card-top">
          <div>
            <p class="lab-name">${esc(lab)}</p>
            ${meta}
          </div>
          <span class="stamp ${stampClass}">${stampText}</span>
        </div>
      </div>`;
  }).join("");
}

function renderOpenView() {
  const closedLabs = LABS.filter((l) => !labStatusData[l] || labStatusData[l].status !== "Open");
  const wrap = document.getElementById("open-list");
  document.getElementById("open-empty").classList.toggle("hidden", closedLabs.length > 0);
  wrap.innerHTML = closedLabs.map((lab) => `
    <div class="option-row">
      <div>
        <div class="option-name">${esc(lab)}</div>
        <div class="option-sub">Currently closed</div>
      </div>
      <button class="btn btn-primary" data-action="open" data-lab="${esc(lab)}">Open</button>
    </div>
  `).join("");
}

function renderHandoverView() {
  const myLabs = LABS.filter((l) => labStatusData[l] && labStatusData[l].status === "Open" && labStatusData[l].currentHolder === myName);
  const wrap = document.getElementById("handover-list");
  document.getElementById("handover-empty").classList.toggle("hidden", myLabs.length > 0);
  wrap.innerHTML = myLabs.map((lab) => {
    const others = studentsData.filter((s) => s !== myName);
    const selected = handoverSelection[lab];
    const chips = others.map((s) => `
      <span class="chip ${s === selected ? "selected" : ""}" data-action="pick" data-lab="${esc(lab)}" data-student="${esc(s)}">${esc(s)}</span>
    `).join("");
    return `
      <div class="option-row" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="option-name">${esc(lab)}</div>
          <div class="option-sub">You hold this lab</div>
        </div>
        <div class="handover-targets">${chips || '<span class="option-sub">No other students registered yet.</span>'}</div>
        <button class="btn btn-primary btn-block" data-action="handover" data-lab="${esc(lab)}" ${selected ? "" : "disabled"}>
          ${selected ? "Hand over to " + esc(selected) : "Select a student above"}
        </button>
      </div>
    `;
  }).join("");
}

function renderCloseView() {
  const openLabs = LABS.filter((l) => labStatusData[l] && labStatusData[l].status === "Open");
  const wrap = document.getElementById("close-list");
  document.getElementById("close-empty").classList.toggle("hidden", openLabs.length > 0);
  wrap.innerHTML = openLabs.map((lab) => `
    <div class="option-row">
      <div>
        <div class="option-name">${esc(lab)}</div>
        <div class="option-sub">Held by ${esc(labStatusData[lab].currentHolder)}</div>
      </div>
      <button class="btn btn-danger" data-action="close" data-lab="${esc(lab)}">Close</button>
    </div>
  `).join("");
}

const ACTION_LABELS = { OPEN: "Opened", HANDOVER: "Handover", CLOSE: "Closed" };

function renderHistory() {
  const filter = document.getElementById("history-filter").value;
  const rows = logsData.filter((r) => filter === "All Labs" || r.labName === filter);
  document.getElementById("history-empty").classList.toggle("hidden", rows.length > 0);
  document.getElementById("history-list").innerHTML = rows.map((r) => `
    <div class="log-row">
      <span class="log-tag ${r.action}">${ACTION_LABELS[r.action] || r.action}</span>
      <div class="log-body">
        <div><span class="log-lab">${esc(r.labName)}</span> — ${esc(r.studentName)}${r.relatedStudent ? " → " + esc(r.relatedStudent) : ""}</div>
        <div class="log-time">${esc(r.timestamp)}</div>
      </div>
    </div>
  `).join("");
}

function renderAll() {
  renderWhoAmI();
  renderHome();
  renderOpenView();
  renderHandoverView();
  renderCloseView();
  renderHistory();
}

/* ---------------- Real-time listeners ---------------- */
function attachListeners() {
  onSnapshot(labStatusCol, (snap) => {
    const next = {};
    snap.forEach((d) => { next[d.id] = d.data(); });
    labStatusData = next;
    renderAll();
  });

  onSnapshot(studentsCol, (snap) => {
    studentsData = snap.docs.map((d) => d.data().name).sort((a, b) => a.localeCompare(b));
    renderExistingProfileSelect();
    renderAll();
  });

  const logsQuery = query(labLogsCol, orderBy("timestamp", "desc"), limit(300));
  onSnapshot(logsQuery, (snap) => {
    logsData = snap.docs.map((d) => d.data());
    renderHistory();
  });
}

/* ---------------- Profile overlay ---------------- */
function renderExistingProfileSelect() {
  const sel = document.getElementById("profile-existing-select");
  sel.innerHTML = studentsData.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  document.getElementById("profile-existing-wrap").classList.toggle("hidden", studentsData.length === 0);
}

function showProfileOverlay() {
  document.getElementById("profile-overlay").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
}

function hideProfileOverlay() {
  document.getElementById("profile-overlay").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

function initProfileOverlay() {
  const input = document.getElementById("profile-name-input");
  const errorEl = document.getElementById("profile-error");
  const createBtn = document.getElementById("profile-create-btn");
  const useExistingBtn = document.getElementById("profile-use-existing-btn");
  const existingSelect = document.getElementById("profile-existing-select");

  createBtn.addEventListener("click", async () => {
    errorEl.classList.add("hidden");
    createBtn.disabled = true;
    const res = await registerNewProfile(input.value);
    createBtn.disabled = false;
    if (!res.ok) {
      errorEl.textContent = res.msg;
      errorEl.classList.remove("hidden");
      return;
    }
    myName = input.value.trim();
    localStorage.setItem(NAME_KEY, myName);
    input.value = "";
    hideProfileOverlay();
    renderAll();
  });

  useExistingBtn.addEventListener("click", () => {
    if (!existingSelect.value) return;
    myName = existingSelect.value;
    localStorage.setItem(NAME_KEY, myName);
    hideProfileOverlay();
    renderAll();
  });
}

/* ---------------- Tab navigation ---------------- */
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
      btn.classList.add("active");
      document.getElementById(`view-${btn.dataset.view}`).classList.remove("hidden");
    });
  });
}

/* ---------------- Delegated action clicks ---------------- */
function initActionDelegation() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    const lab = el.dataset.lab;

    if (action === "open") openLabAction(lab);
    if (action === "close") closeLabAction(lab);
    if (action === "pick") {
      handoverSelection[lab] = el.dataset.student;
      renderHandoverView();
    }
    if (action === "handover") handoverLabAction(lab, handoverSelection[lab]);
  });

  document.getElementById("whoami-btn").addEventListener("click", () => {
    showProfileOverlay();
  });

  document.getElementById("history-filter").addEventListener("change", renderHistory);
}

function populateHistoryFilterOptions() {
  const sel = document.getElementById("history-filter");
  sel.innerHTML = `<option value="All Labs">All labs</option>` +
    LABS.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
}

/* ---------------- Boot ---------------- */
async function boot() {
  populateHistoryFilterOptions();
  initTabs();
  initActionDelegation();
  initProfileOverlay();

  await seedLabs();
  attachListeners();

  if (myName) {
    hideProfileOverlay();
  } else {
    showProfileOverlay();
  }
}

boot();
