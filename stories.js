// Add a bedtime story by adding an entry here, then drop the matching
// audio file into the /audio folder using the src path you set below.
// You can add as many stories as you like — a button is created for each one automatically.
const STORIES = {
  story1: {
    emoji: "🌙",
    label: "Cinderella",
    src: "audio/story1.mp4",
  },
  story2: {
    emoji: "🍃",
    label: "Rapunzel",
    src: "audio/story2.mp4",
  },
  story3: {
    emoji: "☁️",
    label: "The Cloud Who Couldn't Sleep",
    src: "audio/story3.mp4",
  },
};

const storyOptions = document.getElementById("story-options");
const pickerCard = document.getElementById("story-picker-card");
const playerCard = document.getElementById("story-player-card");
const storyTitle = document.getElementById("story-title");
const storyAudio = document.getElementById("story-audio");
const storyBackBtn = document.getElementById("story-back-btn");

Object.entries(STORIES).forEach(([key, story]) => {
  const btn = document.createElement("button");
  btn.className = "story-btn";
  btn.dataset.story = key;
  btn.innerHTML = `
    <span class="story-emoji">${story.emoji}</span>
    <span class="mood-label">${story.label}</span>
  `;
  btn.addEventListener("click", () => showStory(key));
  storyOptions.appendChild(btn);
});

storyBackBtn.addEventListener("click", () => {
  showPicker();
});

function showStory(key) {
  const entry = STORIES[key];
  if (!entry) return;

  storyTitle.textContent = entry.label;
  storyAudio.src = entry.src;

  pickerCard.classList.add("is-leaving");
  setTimeout(() => {
    pickerCard.style.display = "none";
    pickerCard.classList.remove("is-leaving");

    playerCard.classList.add("is-entering");
    playerCard.style.display = "block";

    storyAudio.currentTime = 0;
    storyAudio.play().catch(() => {
      // Autoplay might be blocked; that's fine, she can press play herself.
    });
  }, 350);
}

function showPicker() {
  storyAudio.pause();
  storyAudio.removeAttribute("src");
  storyAudio.load();

  playerCard.classList.remove("is-entering");
  playerCard.style.display = "none";

  pickerCard.style.display = "block";
  pickerCard.classList.add("is-entering");
  setTimeout(() => pickerCard.classList.remove("is-entering"), 500);
}
