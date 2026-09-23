// Monthly lucky draw wheel. One spin per calendar month, saved to Firestore
// (collection "luckydraw", one doc per month keyed like "2026-09") so both of
// us see the same result. The "_settings" doc in the same collection holds the
// prize list once it's been edited from the page.

// Used until prizes are edited from the page's edit panel.
const DEFAULT_PRIZES = [
  "Dinner date 🍝",
  "Movie night 🎬",
  "Massage 💆",
  "Surprise gift 🎁",
  "Breakfast in bed 🥞",
  "Shopping trip 🛍️",
  "Dessert run 🍰",
  "Picnic day 🧺",
];

// SHA-256 of the edit password, so the password itself isn't in the source.
const EDIT_PASSWORD_HASH = "b22439c6e0b62a7d05b8c7bc43035df71c0758124967ce0a3fdf6e137700bac3";
const SETTINGS_DOC_ID = "_settings";
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

const SEGMENT_COLORS = ["#FFD6E0", "#FFB6C1", "#FFF8F5", "#F7A1B8"];
const SPIN_DURATION_MS = 5000;

const canvas = document.getElementById("wheel");
const spinBtn = document.getElementById("spin-btn");
const monthEl = document.getElementById("luckydraw-month");
const resultEl = document.getElementById("luckydraw-result");
const statusEl = document.getElementById("luckydraw-status");
const historyEl = document.getElementById("luckydraw-history");
const editToggle = document.getElementById("edit-toggle");
const editLockForm = document.getElementById("edit-lock-form");
const editPasswordInput = document.getElementById("edit-password-input");
const editLockError = document.getElementById("edit-lock-error");
const editPanel = document.getElementById("edit-panel");
const prizesInput = document.getElementById("prizes-input");
const savePrizesBtn = document.getElementById("save-prizes-btn");
const resetSpinBtn = document.getElementById("reset-spin-btn");
const editStatus = document.getElementById("edit-status");

const now = new Date();
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
monthEl.textContent = formatMonth(monthKey);

let prizes = DEFAULT_PRIZES.slice();
let currentRotation = 0;
let spinning = false;
let latestDocs = [];

drawWheel();
// Redraw once Quicksand has loaded so the labels don't stay in the fallback font.
if (document.fonts) document.fonts.ready.then(drawWheel);

function drawWheel() {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 8;
  const segmentAngle = (Math.PI * 2) / prizes.length;

  ctx.clearRect(0, 0, size, size);

  prizes.forEach((prize, i) => {
    // Segment 0 starts at the top (12 o'clock) and goes clockwise.
    const start = -Math.PI / 2 + i * segmentAngle;
    const end = start + segmentAngle;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(start + segmentAngle / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5c4247";
    ctx.font = "600 24px Quicksand, sans-serif";
    ctx.fillText(prize, radius - 24, 0, radius - 70);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(center, center, 36, 0, Math.PI * 2);
  ctx.fillStyle = "#E8779A";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
}

// Rotates the wheel so the given prize ends up under the pointer at the top.
function spinTo(index) {
  const segmentDeg = 360 / prizes.length;
  const jitter = (Math.random() - 0.5) * segmentDeg * 0.7;
  const targetAngle = (index + 0.5) * segmentDeg + jitter;
  const base = currentRotation - (currentRotation % 360);
  currentRotation = base + 360 * 6 - targetAngle;

  canvas.style.transition = `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
  canvas.style.transform = `rotate(${currentRotation}deg)`;

  return new Promise((resolve) => setTimeout(resolve, SPIN_DURATION_MS));
}

function showPrizeInstantly(prize) {
  const index = prizes.indexOf(prize);
  if (index === -1) return;
  const segmentDeg = 360 / prizes.length;
  currentRotation = -(index + 0.5) * segmentDeg;
  canvas.style.transition = "none";
  canvas.style.transform = `rotate(${currentRotation}deg)`;
}

// --- edit panel (password protected) ---

editToggle.addEventListener("click", () => {
  editLockForm.hidden = !editLockForm.hidden;
  if (!editLockForm.hidden) editPasswordInput.focus();
});

editLockForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sha256(editPasswordInput.value).then((hash) => {
    if (hash !== EDIT_PASSWORD_HASH) {
      editLockError.hidden = false;
      editPasswordInput.value = "";
      editPasswordInput.focus();
      return;
    }
    editLockError.hidden = true;
    editLockForm.hidden = true;
    editToggle.hidden = true;
    editPanel.hidden = false;
    prizesInput.value = prizes.join("\n");
  });
});

function sha256(text) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// --- Firestore ---

const isConfigured =
  typeof firebaseConfig !== "undefined" &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("PASTE_");

if (!isConfigured) {
  statusEl.textContent = "Not connected yet — add your Firebase config to firebase-config.js";
} else {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const drawsRef = db.collection("luckydraw");
  let firstLoad = true;

  drawsRef.onSnapshot(
    (snapshot) => {
      statusEl.textContent = "Synced live ✓";
      latestDocs = snapshot.docs;
      applySettings();
      if (!spinning) render(firstLoad);
      firstLoad = false;
    },
    (err) => {
      statusEl.textContent = "Couldn't connect — check your Firebase config and rules.";
      console.error(err);
    }
  );

  spinBtn.addEventListener("click", () => {
    if (spinning) return;
    spinning = true;
    spinBtn.disabled = true;
    resultEl.textContent = "";

    const index = Math.floor(Math.random() * prizes.length);
    const prize = prizes[index];

    // Saved before the wheel stops so leaving mid-spin doesn't give a free re-spin.
    drawsRef
      .doc(monthKey)
      .set({ prize, spunAt: firebase.firestore.FieldValue.serverTimestamp() })
      .catch((err) => {
        statusEl.textContent = "Couldn't save the spin — try again.";
        console.error(err);
      });

    spinTo(index).then(() => {
      spinning = false;
      render(false);
    });
  });

  savePrizesBtn.addEventListener("click", () => {
    const newPrizes = prizesInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (newPrizes.length < 2) {
      editStatus.textContent = "Add at least 2 prizes.";
      return;
    }

    drawsRef
      .doc(SETTINGS_DOC_ID)
      .set({ prizes: newPrizes })
      .then(() => (editStatus.textContent = "Prizes saved ✓"))
      .catch((err) => {
        editStatus.textContent = "Couldn't save prizes — try again.";
        console.error(err);
      });
  });

  resetSpinBtn.addEventListener("click", () => {
    drawsRef
      .doc(monthKey)
      .delete()
      .then(() => (editStatus.textContent = "This month's spin was reset ✓"))
      .catch((err) => {
        editStatus.textContent = "Couldn't reset — try again.";
        console.error(err);
      });
  });
}

function applySettings() {
  const settings = latestDocs.find((doc) => doc.id === SETTINGS_DOC_ID);
  const saved = settings && settings.data().prizes;
  const next = Array.isArray(saved) && saved.length >= 2 ? saved : DEFAULT_PRIZES;

  if (next.join("\n") === prizes.join("\n")) return;
  prizes = next.slice();
  drawWheel();
}

function render(isFirstLoad) {
  const thisMonth = latestDocs.find((doc) => doc.id === monthKey);

  if (thisMonth) {
    const { prize } = thisMonth.data();
    spinBtn.disabled = true;
    spinBtn.textContent = "Come back next month 💗";
    resultEl.textContent = `This month you won: ${prize}`;
    if (isFirstLoad) showPrizeInstantly(prize);
  } else {
    spinBtn.disabled = false;
    spinBtn.textContent = "Spin!";
    resultEl.textContent = "";
  }

  renderHistory();
}

function renderHistory() {
  historyEl.innerHTML = "";

  const past = latestDocs
    .filter((doc) => MONTH_KEY_PATTERN.test(doc.id) && doc.id !== monthKey)
    .sort((a, b) => b.id.localeCompare(a.id));

  if (past.length === 0) return;

  const heading = document.createElement("p");
  heading.className = "eyebrow";
  heading.textContent = "past draws";
  historyEl.appendChild(heading);

  past.forEach((doc) => {
    const row = document.createElement("div");
    row.className = "luckydraw-history-row";

    const month = document.createElement("span");
    month.textContent = formatMonth(doc.id);

    const prize = document.createElement("span");
    prize.className = "luckydraw-history-prize";
    prize.textContent = doc.data().prize;

    row.appendChild(month);
    row.appendChild(prize);
    historyEl.appendChild(row);
  });
}

function formatMonth(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
