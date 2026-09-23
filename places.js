// Shared list of date spots backed by Firebase Firestore (collection "places").
// Works the same way as the wishlist: photos are resized client-side and
// stored inline in the document.

const form = document.getElementById("places-form");
const nameInput = document.getElementById("places-name-input");
const noteInput = document.getElementById("places-note-input");
const linkInput = document.getElementById("places-link-input");
const imageInput = document.getElementById("places-image-input");
const imagePreview = document.getElementById("places-image-preview");
const statusEl = document.getElementById("places-status");
const gridEl = document.getElementById("places-grid");

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
  const placesRef = db.collection("places");

  placesRef.orderBy("createdAt", "desc").onSnapshot(
    (snapshot) => {
      statusEl.textContent = "Synced live ✓";
      renderPlaces(snapshot.docs);
    },
    (err) => {
      statusEl.textContent = "Couldn't connect — check your Firebase config and rules.";
      console.error(err);
    }
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;

    const link = normalizeLink(linkInput.value.trim());

    placesRef
      .add({
        name,
        note: noteInput.value.trim() || null,
        link: link || null,
        imageDataUrl: pendingImageDataUrl || null,
        visited: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .catch((err) => {
        statusEl.textContent = "Couldn't save that place — try again.";
        console.error(err);
      });

    nameInput.value = "";
    noteInput.value = "";
    linkInput.value = "";
    imageInput.value = "";
    pendingImageDataUrl = null;
    imagePreview.hidden = true;
    nameInput.focus();
  });

  function renderPlaces(docs) {
    gridEl.innerHTML = "";

    if (docs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "wishlist-empty";
      empty.textContent = "No places yet.";
      gridEl.appendChild(empty);
      return;
    }

    // Places we haven't been to yet come first.
    const sorted = [...docs].sort((a, b) => Number(!!a.data().visited) - Number(!!b.data().visited));
    sorted.forEach((doc) => gridEl.appendChild(buildPlaceCard(doc.id, doc.data())));
  }

  function buildPlaceCard(id, data) {
    const card = document.createElement("article");
    card.className = "place-card" + (data.visited ? " is-visited" : "");

    if (data.imageDataUrl) {
      const img = document.createElement("img");
      img.className = "place-card-image";
      img.src = data.imageDataUrl;
      img.alt = data.name;
      card.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "place-card-image place-card-image--empty";
      placeholder.textContent = "📍";
      card.appendChild(placeholder);
    }

    const body = document.createElement("div");
    body.className = "place-card-body";

    const title = document.createElement("h3");
    title.className = "place-card-title";
    title.textContent = data.name;
    body.appendChild(title);

    if (data.note) {
      const note = document.createElement("p");
      note.className = "place-card-note";
      note.textContent = data.note;
      body.appendChild(note);
    }

    if (data.link) {
      const link = document.createElement("a");
      link.className = "place-card-link";
      link.href = data.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open link ↗";
      body.appendChild(link);
    }

    const actions = document.createElement("div");
    actions.className = "place-card-actions";

    const visitedLabel = document.createElement("label");
    visitedLabel.className = "place-card-visited";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!data.visited;
    checkbox.addEventListener("change", () => {
      placesRef.doc(id).update({ visited: checkbox.checked }).catch((err) => console.error(err));
    });
    visitedLabel.appendChild(checkbox);
    visitedLabel.appendChild(document.createTextNode(" been here"));

    const removeBtn = document.createElement("button");
    removeBtn.className = "wishlist-remove";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => {
      placesRef.doc(id).delete().catch((err) => console.error(err));
    });

    actions.appendChild(visitedLabel);
    actions.appendChild(removeBtn);
    body.appendChild(actions);

    card.appendChild(body);
    return card;
  }
}

function normalizeLink(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return "https://" + value;
}
