// The one secret audio behind this page. Drop the file at audio/secret.mp3
// (or change SECRET_AUDIO_SRC below to match whatever you name it).
const PASSWORD = "foodieadventures";
const SECRET_AUDIO_SRC = "audio/secret.mp3";

const lockCard = document.getElementById("lock-card");
const secretCard = document.getElementById("secret-card");
const lockForm = document.getElementById("lock-form");
const lockInput = document.getElementById("lock-input");
const lockError = document.getElementById("lock-error");
const secretAudio = document.getElementById("secret-audio");

lockForm.addEventListener("submit", (e) => {
  e.preventDefault();

  if (lockInput.value !== PASSWORD) {
    lockError.hidden = false;
    lockInput.value = "";
    lockInput.focus();
    return;
  }

  lockError.hidden = true;
  secretAudio.src = SECRET_AUDIO_SRC;

  lockCard.classList.add("is-leaving");
  setTimeout(() => {
    lockCard.style.display = "none";
    lockCard.classList.remove("is-leaving");

    secretCard.classList.add("is-entering");
    secretCard.style.display = "block";

    secretAudio.play().catch(() => {
      // Autoplay might be blocked; that's fine, she can press play herself.
    });
  }, 350);
});
