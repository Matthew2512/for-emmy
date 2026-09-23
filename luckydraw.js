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

const SEGMENT_COLORS = ["#FFD6E0", "#FFB6C1", "#FFF8F5", "#F7A1B8"];
const SPIN_DURATION_MS = 5000;

const canvas = document.getElementById("wheel");
const spinBtn = document.getElementById("spin-btn");
const monthEl = document.getElementById("luckydraw-month");
const resultEl = document.getElementById("luckydraw-result");
const statusEl = document.getElementById("luckydraw-status");
const historyEl = document.getElementById("luckydraw-history");

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
    resultEl.textContent = "";

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
    .filter((doc) => doc.id !== monthKey)
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
