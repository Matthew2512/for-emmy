// Shared, live-syncing wishlist backed by Firebase Firestore.
// Needs firebase-config.js filled in with your real project keys first --
// see the setup instructions you were given for how to get them.

const form = document.getElementById("wishlist-form");
const textInput = document.getElementById("wishlist-input");
const linkInput = document.getElementById("wishlist-link-input");
const statusEl = document.getElementById("wishlist-status");
const itemsEl = document.getElementById("wishlist-items");

const isConfigured =
  typeof firebaseConfig !== "undefined" &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("PASTE_");

if (!isConfigured) {
  statusEl.textContent = "Not connected yet — add your Firebase config to firebase-config.js";
  form.querySelector("button").disabled = true;
} else {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const wishlistRef = db.collection("wishlist");

  wishlistRef.orderBy("createdAt", "asc").onSnapshot(
    (snapshot) => {
      statusEl.textContent = "Synced live ✓";
      renderItems(snapshot.docs);
    },
    (err) => {
      statusEl.textContent = "Couldn't connect — check your Firebase config and rules.";
      console.error(err);
    }
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (!text) return;

    const link = normalizeLink(linkInput.value.trim());

    wishlistRef
      .add({
        text,
        link: link || null,
        done: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .catch((err) => {
        statusEl.textContent = "Couldn't save that item — try again.";
        console.error(err);
      });

    textInput.value = "";
    linkInput.value = "";
    textInput.focus();
  });

  function renderItems(docs) {
    itemsEl.innerHTML = "";

    if (docs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "wishlist-empty";
      empty.textContent = "Nothing here yet.";
      itemsEl.appendChild(empty);
      return;
    }

    docs.forEach((doc) => {
      const data = doc.data();
      itemsEl.appendChild(buildItemRow(doc.id, data));
    });
  }

  function buildItemRow(id, data) {
    const row = document.createElement("div");
    row.className = "wishlist-item" + (data.done ? " is-done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!data.done;
    checkbox.addEventListener("change", () => {
      wishlistRef.doc(id).update({ done: checkbox.checked }).catch((err) => console.error(err));
    });

    const textSpan = document.createElement("span");
    textSpan.className = "wishlist-item-text";

    if (data.link) {
      const link = document.createElement("a");
      link.href = data.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = data.text;
      textSpan.appendChild(link);
    } else {
      textSpan.textContent = data.text;
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "wishlist-remove";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => {
      wishlistRef.doc(id).delete().catch((err) => console.error(err));
    });

    row.appendChild(checkbox);
    row.appendChild(textSpan);
    row.appendChild(removeBtn);
    return row;
  }
}

function normalizeLink(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return "https://" + value;
}
