// Map each emotion to its video file and the label shown above it.
// Drop your recorded videos into the /videos folder using these exact filenames,
// or change the paths below to match whatever you name them.
const MOOD_VIDEOS = {
  happy: {
    eyebrow: "for when you're feeling",
    label: "happy",
    src: "videos/happy.mp4",
  },
  sad: {
    eyebrow: "for when you're feeling",
    label: "sad",
    src: "videos/sad.mp4",
  },
  missing: {
    eyebrow: "for when you are",
    label: "missing me",
    src: "videos/missing.mp4",
  },
  stressed: {
    eyebrow: "for when you're feeling",
    label: "stressed",
    src: "videos/stressed.mp4",
  },
};

const moodCard = document.getElementById("mood-card");
const videoCard = document.getElementById("video-card");
const videoEyebrow = document.getElementById("video-eyebrow");
const videoTitle = document.getElementById("video-title");
const videoEl = document.getElementById("mood-video");
const backBtn = document.getElementById("back-btn");

document.querySelectorAll(".mood-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mood = btn.dataset.mood;
    showVideo(mood);
  });
});

backBtn.addEventListener("click", () => {
  showMoodPicker();
});

function showVideo(mood) {
  const entry = MOOD_VIDEOS[mood];
  if (!entry) return;

  videoEyebrow.textContent = entry.eyebrow;
  videoTitle.textContent = entry.label;
  videoEl.src = entry.src;

  moodCard.classList.add("is-leaving");
  setTimeout(() => {
    moodCard.style.display = "none";
    moodCard.classList.remove("is-leaving");

    videoCard.classList.add("is-entering");
    videoCard.style.display = "block";

    videoEl.currentTime = 0;
    videoEl.play().catch(() => {
      // Autoplay might be blocked; that's fine, she can press play herself.
    });
  }, 350);
}

function showMoodPicker() {
  videoEl.pause();
  videoEl.removeAttribute("src");
  videoEl.load();

  videoCard.classList.remove("is-entering");
  videoCard.style.display = "none";

  moodCard.style.display = "block";
  moodCard.classList.add("is-entering");
  setTimeout(() => moodCard.classList.remove("is-entering"), 500);
}
