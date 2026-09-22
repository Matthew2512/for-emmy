// Shared, live-syncing wishlist backed by Firebase Firestore.
// Needs firebase-config.js filled in with your real project keys first --
// see the setup instructions you were given for how to get them.

const form = document.getElementById("wishlist-form");
const textInput = document.getElementById("wishlist-input");
const linkInput = document.getElementById("wishlist-link-input");
const imageInput = document.getElementById("wishlist-image-input");
const imagePreview = document.getElementById("wishlist-image-preview");
const statusEl = document.getElementById("wishlist-status");
const itemsEl = document.getElementById("wishlist-items");

const MAX_IMAGE_DIMENSION = 600;
let pendingImageDataUrl = null;

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  pendingImageDataUrl = null;
  imagePreview.hidden = true;

  if (!file) return;

  resizeImage(file, MAX_IMAGE_DIMENSION).then((dataUrl) => {
    pendingImageDataUrl = dataUrl;
    imagePreview.src = dataUrl;
    imagePreview.hidden = false;
  });
});

function resizeImage(file, maxDimension) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

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
        imageDataUrl: pendingImageDataUrl || null,
        done: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .catch((err) => {
        statusEl.textContent = "Couldn't save that item — try again.";
        console.error(err);
      });

    textInput.value = "";
    linkInput.value = "";
    imageInput.value = "";
    pendingImageDataUrl = null;
    imagePreview.hidden = true;
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

    if (data.imageDataUrl) {
      const thumb = document.createElement("img");
      thumb.className = "wishlist-item-thumb";
      thumb.src = data.imageDataUrl;
      thumb.alt = data.text;
      row.appendChild(thumb);
    }

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
