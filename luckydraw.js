// Monthly lucky draw wheel. One spin per calendar month, saved to Firestore
// (collection "luckydraw", one doc per month keyed like "2026-09") so both of
// us see the same result.

// Edit these to change what's on the wheel.
const PRIZES = [
  "Dinner date 🍝",
  "Movie night 🎬",
  "Massage 💆",
  "Surprise gift 🎁",
  "Breakfast in bed 🥞",
  "Shopping trip 🛍️",
  "Dessert run 🍰",
  "Picnic day 🧺",
];

// SHA-256 of the password needed to reset a month's spin, so the password
// itself isn't in the source.
const RESET_PASSWORD_HASH = "b22439c6e0b62a7d05b8c7bc43035df71c0758124967ce0a3fdf6e137700bac3";
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

const SEGMENT_COLORS = ["#FFD6E0", "#FFB6C1", "#FFF8F5", "#F7A1B8"];
const SPIN_DURATION_MS = 5000;
// Label placement on the 600px canvas: text ends LABEL_OUTER px from the
// center and may be at most LABEL_MAX_WIDTH px long (clear of the hub).
const LABEL_OUTER = 262;
const LABEL_MAX_WIDTH = 190;

const canvas = document.getElementById("wheel");
const spinBtn = document.getElementById("spin-btn");
const monthEl = document.getElementById("luckydraw-month");
const prizeBox = document.getElementById("luckydraw-prize-box");
const prizeEl = document.getElementById("luckydraw-prize");
const statusEl = document.getElementById("luckydraw-status");
const historyEl = document.getElementById("luckydraw-history");
const resetSpinBtn = document.getElementById("reset-spin-btn");
const resetLockForm = document.getElementById("reset-lock-form");
const resetPasswordInput = document.getElementById("reset-password-input");
const resetStatus = document.getElementById("reset-status");

const now = new Date();
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
monthEl.textContent = formatMonth(monthKey);

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
  const segmentAngle = (Math.PI * 2) / PRIZES.length;

  ctx.clearRect(0, 0, size, size);

  PRIZES.forEach((prize, i) => {
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
    ctx.font = fitFont(ctx, prize, LABEL_MAX_WIDTH);
    ctx.fillText(prize, LABEL_OUTER, 0, LABEL_MAX_WIDTH);
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

// Largest font size (down to a minimum) at which the label fits in its slice.
function fitFont(ctx, text, maxWidth) {
  for (let size = 26; size > 12; size--) {
    ctx.font = `600 ${size}px Quicksand, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return ctx.font;
  }
  return "600 12px Quicksand, sans-serif";
}

// Rotates the wheel so the given prize ends up under the pointer at the top.
function spinTo(index) {
  const segmentDeg = 360 / PRIZES.length;
  const jitter = (Math.random() - 0.5) * segmentDeg * 0.7;
  const targetAngle = (index + 0.5) * segmentDeg + jitter;
  const base = currentRotation - (currentRotation % 360);
  currentRotation = base + 360 * 6 - targetAngle;

  canvas.style.transition = `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
  canvas.style.transform = `rotate(${currentRotation}deg)`;

  return new Promise((resolve) => setTimeout(resolve, SPIN_DURATION_MS));
}

function showPrizeInstantly(prize) {
  const index = PRIZES.indexOf(prize);
  if (index === -1) return;
  const segmentDeg = 360 / PRIZES.length;
  currentRotation = -(index + 0.5) * segmentDeg;
  canvas.style.transition = "none";
  canvas.style.transform = `rotate(${currentRotation}deg)`;
}

resetSpinBtn.addEventListener("click", () => {
  resetLockForm.hidden = !resetLockForm.hidden;
  resetStatus.textContent = "";
  if (!resetLockForm.hidden) resetPasswordInput.focus();
});

function sha256(text) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

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
    prizeBox.hidden = true;

    const index = Math.floor(Math.random() * PRIZES.length);
    const prize = PRIZES[index];

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

  resetLockForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sha256(resetPasswordInput.value).then((hash) => {
      resetPasswordInput.value = "";

      if (hash !== RESET_PASSWORD_HASH) {
        resetStatus.textContent = "That's not it — try again.";
        resetPasswordInput.focus();
        return;
      }

      resetLockForm.hidden = true;
      drawsRef
        .doc(monthKey)
        .delete()
        .then(() => (resetStatus.textContent = "This month's spin was reset ✓"))
        .catch((err) => {
          resetStatus.textContent = "Couldn't reset — try again.";
          console.error(err);
        });
    });
  });
}

function render(isFirstLoad) {
  const thisMonth = latestDocs.find((doc) => doc.id === monthKey);

  if (thisMonth) {
    const { prize } = thisMonth.data();
    spinBtn.disabled = true;
    spinBtn.textContent = "Come back next month 💗";
    prizeEl.textContent = prize;
    prizeBox.hidden = false;
    if (isFirstLoad) showPrizeInstantly(prize);
  } else {
    spinBtn.disabled = false;
    spinBtn.textContent = "Spin!";
    prizeBox.hidden = true;
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
