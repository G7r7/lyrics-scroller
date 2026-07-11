const STORAGE_KEY = 'lyrics-scroller-songs';

let songs = loadSongs();
let selectedSongId = null;
let selectedSong = null;
let animationFrameId = null;
let isPlaying = false;
let playbackStartTime = 0;
let elapsedPlaybackSeconds = 0;
let offsetY = 0;
let pendingPause = 0;
let scrollPixels = 0;
let lastFrameTime = 0;

const songForm = document.getElementById('songForm');
const songListEl = document.getElementById('songList');
const lyricsTrack = document.getElementById('lyricsTrack');
const formPanel = document.getElementById('formPanel');
const addSongBtn = document.getElementById('addSongBtn');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const songIdInput = document.getElementById('songId');
const playerMeta = document.getElementById('playerMeta');
const playerStatus = document.getElementById('playerStatus');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const speedDownBtn = document.getElementById('speedDownBtn');
const speedUpBtn = document.getElementById('speedUpBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const appLayout = document.getElementById('appLayout');
const prompterPanel = document.getElementById('prompterPanel');
const appHeader = document.getElementById('appHeader');
const speedValue = document.getElementById('speedValue');
const pauseValue = document.getElementById('pauseValue');
const countdownOverlay = document.getElementById('countdownOverlay');
const pauseBanner = document.getElementById('pauseBanner');
const pauseDownBtn = document.getElementById('pauseDownBtn');
const pauseUpBtn = document.getElementById('pauseUpBtn');
const playerControls = document.querySelector('.player-controls');
const playerScreen = document.querySelector('.player-screen');
let controlsHideTimer = null;
let speedPulseTimer = null;

init();

function init() {
  renderSongList();
  bindEvents();
  hideSongForm();
  resetSongForm();
  if (songs.length) {
    selectedSongId = songs[0].id;
    selectedSong = songs[0];
    renderSongList();
    updatePlayerMeta();
    resetPlayback();
    exitFullscreenMode();
  } else {
    selectedSongId = null;
    selectedSong = null;
    updatePlayerMeta();
    resetPlayback();
    exitFullscreenMode();
  }
}

function bindEvents() {
  songForm.addEventListener('submit', handleSubmit);
  addSongBtn.addEventListener('click', () => {
    showSongForm();
    resetSongForm();
  });
  cancelEditBtn.addEventListener('click', () => {
    resetSongForm();
    hideSongForm();
  });
  playBtn.addEventListener('click', startPlayback);
  pauseBtn.addEventListener('click', pausePlayback);
  resetBtn.addEventListener('click', resetPlayback);
  speedDownBtn.addEventListener('click', () => changeSpeed(-1));
  speedUpBtn.addEventListener('click', () => changeSpeed(1));
  pauseDownBtn.addEventListener('click', () => changePause(-1));
  pauseUpBtn.addEventListener('click', () => changePause(1));
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', handleKeyboardShortcuts);

  if (playerScreen) {
    playerScreen.addEventListener('pointermove', () => {
      if (isPlaying) {
        showControls(true);
      }
    });
    playerScreen.addEventListener('pointerleave', () => {
      if (isPlaying) {
        hideControls();
      }
    });
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(songForm);
  const songId = formData.get('songId')?.toString().trim();
  const title = formData.get('title').toString().trim();
  const artist = formData.get('artist').toString().trim();
  const lyrics = formData.get('lyrics').toString().trim();
  const speed = Number(formData.get('speed'));
  const pause = Number(formData.get('pause'));

  if (!title || !lyrics) {
    return;
  }

  if (songId) {
    songs = songs.map((entry) => entry.id === songId ? { ...entry, title, artist, lyrics, speed, pause } : entry);
    persistSongs();
    renderSongList();
    const selected = songs.find((entry) => entry.id === songId);
    if (selected) {
      selectedSongId = songId;
      selectedSong = selected;
      updatePlayerMeta();
      resetPlayback();
      renderLyrics();
    }
    resetSongForm();
    hideSongForm();
    return;
  }

  const song = {
    id: crypto.randomUUID(),
    title,
    artist,
    lyrics,
    speed,
    pause,
  };

  songs = [song, ...songs];
  persistSongs();
  renderSongList();
  selectSong(song.id);
  resetSongForm();
  hideSongForm();
}

function renderSongList() {
  if (!songs.length) {
    songListEl.innerHTML = '<li class="song-item"><div><strong>Aucune chanson</strong><small>Ajoutez votre première chanson.</small></div></li>';
    return;
  }

  songListEl.innerHTML = songs
    .map((song) => {
      const activeClass = song.id === selectedSongId ? 'selected' : '';
      return `
        <li class="song-item ${activeClass}" data-song-id="${song.id}">
          <div>
            <strong>${escapeHtml(song.title)}</strong>
            <small>${escapeHtml(song.artist || 'Artiste inconnu')} • ${song.speed}px/s • pause ${song.pause}s</small>
          </div>
          <div class="song-actions">
            <button type="button" data-action="select" data-id="${song.id}">Choisir</button>
            <button type="button" data-action="edit" data-id="${song.id}">Éditer</button>
          </div>
        </li>`;
    })
    .join('');

  songListEl.querySelectorAll('[data-action="select"]').forEach((button) => {
    button.addEventListener('click', () => selectSong(button.getAttribute('data-id')));
  });

  songListEl.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => editSong(button.getAttribute('data-id')));
  });

  const firstSong = songListEl.querySelector('.song-item');
  if (firstSong && !selectedSongId && songs.length) {
    selectedSongId = firstSong.getAttribute('data-song-id');
  }
}

function selectSong(songId) {
  const song = songs.find((entry) => entry.id === songId);
  if (!song) return;

  selectedSongId = songId;
  selectedSong = song;
  renderSongList();
  updatePlayerMeta();
  resetPlayback();
  enterFullscreenMode();
}

function editSong(songId) {
  const song = songs.find((entry) => entry.id === songId);
  if (!song) return;

  showSongForm();
  formTitle.textContent = 'Modifier une chanson';
  submitBtn.textContent = 'Enregistrer les modifications';
  cancelEditBtn.classList.remove('hidden');
  songIdInput.value = song.id;
  document.getElementById('title').value = song.title;
  document.getElementById('artist').value = song.artist || '';
  document.getElementById('lyrics').value = song.lyrics;
  document.getElementById('speed').value = song.speed;
  document.getElementById('pause').value = song.pause;
  document.getElementById('title').focus();
}

function showSongForm() {
  formPanel.classList.remove('hidden-panel');
}

function hideSongForm() {
  formPanel.classList.add('hidden-panel');
}

function resetSongForm() {
  songForm.reset();
  songIdInput.value = '';
  formTitle.textContent = 'Ajouter une chanson';
  submitBtn.textContent = 'Enregistrer la chanson';
  cancelEditBtn.classList.add('hidden');
  document.getElementById('speed').value = '90';
  document.getElementById('pause').value = '0';
}

function updatePlayerMeta() {
  if (!selectedSong) {
    playerMeta.innerHTML = '<h3>Aucune chanson sélectionnée</h3><p>Choisissez une chanson dans la liste.</p>';
    playerStatus.textContent = 'Sélectionnez une chanson pour commencer.';
    return;
  }

  playerMeta.innerHTML = `
    <h3>${escapeHtml(selectedSong.title)}</h3>
    <p>${escapeHtml(selectedSong.artist || 'Artiste inconnu')}</p>
    <p>Vitesse : ${selectedSong.speed}px/s • Pause : ${selectedSong.pause}s</p>
    <p>Raccourcis : + / - pour la vitesse, Echap pour quitter, espace pour pause.</p>
  `;
  playerStatus.textContent = `Prêt à défiler : ${selectedSong.title}`;
}

function startPlayback() {
  if (!selectedSong) return;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  isPlaying = true;
  lastFrameTime = performance.now();
  pendingPause = selectedSong.pause || 0;
  hideControls();
  renderLyrics();
  step();
}

function pausePlayback() {
  if (!isPlaying) return;
  cancelAnimationFrame(animationFrameId);
  isPlaying = false;
  showControls();
  playerStatus.textContent = 'Pause';
}

function resetPlayback() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  isPlaying = false;
  elapsedPlaybackSeconds = 0;
  scrollPixels = 0;
  offsetY = 0;
  pendingPause = 0;
  lastFrameTime = 0;
  showControls();
  renderLyrics();
  playerStatus.textContent = selectedSong ? `Prêt à défiler : ${selectedSong.title}` : 'Sélectionnez une chanson pour commencer.';
}

function toggleFullscreen() {
  if (appLayout.classList.contains('fullscreen-mode')) {
    exitFullscreenMode();
  } else {
    enterFullscreenMode();
  }
}

function enterFullscreenMode() {
  appLayout.classList.add('fullscreen-mode');
  prompterPanel.classList.remove('hidden-panel');
  appHeader.classList.add('hidden-header');
  fullscreenBtn.textContent = 'Retour';
  document.body.style.overflow = 'hidden';
  showControls();
}

function exitFullscreenMode() {
  appLayout.classList.remove('fullscreen-mode');
  prompterPanel.classList.add('hidden-panel');
  appHeader.classList.remove('hidden-header');
  fullscreenBtn.textContent = 'Plein écran';
  document.body.style.overflow = '';
  showControls();
}

function showControls(temporary = false) {
  if (!playerControls) return;

  playerControls.classList.remove('is-hidden');
  playerControls.classList.add('is-visible');

  if (temporary && isPlaying) {
    clearTimeout(controlsHideTimer);
    controlsHideTimer = window.setTimeout(() => {
      if (isPlaying) {
        hideControls();
      }
    }, 1400);
  }
}

function hideControls() {
  if (!playerControls || !isPlaying) return;

  playerControls.classList.remove('is-visible');
  playerControls.classList.add('is-hidden');
  clearTimeout(controlsHideTimer);
}

function navigateSongList(direction) {
  const items = Array.from(songListEl.querySelectorAll('.song-item'));
  if (!items.length) return;

  const currentIndex = items.findIndex((item) => item.getAttribute('data-song-id') === selectedSongId);
  const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
  let nextIndex = fallbackIndex;

  if (direction === 'down') {
    nextIndex = fallbackIndex < items.length - 1 ? fallbackIndex + 1 : 0;
  }

  if (direction === 'up') {
    nextIndex = fallbackIndex > 0 ? fallbackIndex - 1 : items.length - 1;
  }

  const nextSongId = items[nextIndex].getAttribute('data-song-id');
  selectedSongId = nextSongId;
  const nextSong = songs.find((song) => song.id === nextSongId);
  if (nextSong) {
    selectedSong = nextSong;
  }
  renderSongList();
  updatePlayerMeta();
}

function changeSpeed(delta) {
  if (!selectedSong) return;

  const previousSpeed = selectedSong.speed;
  const nextSpeed = Math.min(400, Math.max(0, previousSpeed + delta));

  selectedSong.speed = nextSpeed;
  persistSongs();
  renderSongList();
  updatePlayerMeta();

  if (isPlaying && previousSpeed > 0) {
    offsetY = -scrollPixels;
  }

  renderLyrics();
  highlightSpeedValue();
  showControls(true);
}

function changePause(delta) {
  if (!selectedSong) return;

  const previousPause = selectedSong.pause;
  const nextPause = Math.min(30, Math.max(0, previousPause + delta));
  selectedSong.pause = nextPause;
  persistSongs();
  renderSongList();
  updatePlayerMeta();

  if (isPlaying) {
    if (pendingPause > 0) {
      pendingPause = Math.max(0, Math.min(nextPause, pendingPause));
    } else if (nextPause > 0) {
      pendingPause = nextPause;
    }
  }

  renderLyrics();
}

function handleKeyboardShortcuts(event) {
  const target = event.target;
  const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

  if (!isTyping && appLayout.classList.contains('fullscreen-mode')) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      scrollPrompterBy(-140);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      scrollPrompterBy(140);
      return;
    }
  }

  if (!isTyping && !appLayout.classList.contains('fullscreen-mode')) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateSongList('down');
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateSongList('up');
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedSong) {
        selectSong(selectedSong.id);
      }
      return;
    }
  }

  if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    changeSpeed(1);
  }

  if (event.key === '-') {
    event.preventDefault();
    changeSpeed(-1);
  }

  if (event.key === ']') {
    event.preventDefault();
    changePause(1);
  }

  if (event.key === '[') {
    event.preventDefault();
    changePause(-1);
  }

  if (event.key === 'PageUp') {
    event.preventDefault();
    scrollPrompterBy(200);
  }

  if (event.key === 'PageDown') {
    event.preventDefault();
    scrollPrompterBy(-200);
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    resetPlayback();
  }

  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    if (isPlaying) {
      pausePlayback();
    } else if (selectedSong) {
      startPlayback();
    }
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    exitFullscreenMode();
  }
}

function step() {
  if (!selectedSong || !isPlaying) return;

  const now = performance.now();
  const delta = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  if (pendingPause > 0) {
    pendingPause = Math.max(0, pendingPause - delta);
    offsetY = 0;
    renderLyrics();
    animationFrameId = requestAnimationFrame(step);
    return;
  }

  scrollPixels += delta * selectedSong.speed;
  offsetY = -scrollPixels;
  renderLyrics();
  animationFrameId = requestAnimationFrame(step);
}

function scrollPrompterBy(delta) {
  if (!selectedSong) return;

  const viewport = document.getElementById('lyricsViewport');
  const viewportHeight = viewport.clientHeight;
  const trackHeight = lyricsTrack.scrollHeight;
  const maxOffset = Math.max(0, trackHeight - viewportHeight);
  const nextOffset = Math.min(0, Math.max(-maxOffset, offsetY + delta));
  offsetY = nextOffset;
  scrollPixels = Math.abs(offsetY);

  renderLyrics();
}

function highlightSpeedValue() {
  if (!speedValue) return;

  speedValue.classList.remove('is-highlighted');
  clearTimeout(speedPulseTimer);
  speedValue.classList.add('is-highlighted');
  speedPulseTimer = window.setTimeout(() => {
    speedValue.classList.remove('is-highlighted');
  }, 650);
}

function renderLyrics() {
  if (!selectedSong) return;

  if (speedValue) {
    speedValue.textContent = `Vitesse : ${selectedSong.speed} px/s`;
  }

  if (pauseValue) {
    pauseValue.textContent = `Pause : ${selectedSong.pause} s`;
  }

  const showCountdown = isPlaying && pendingPause > 0;
  if (countdownOverlay) {
    countdownOverlay.classList.toggle('hidden', !showCountdown);
    if (showCountdown) {
      countdownOverlay.textContent = `${pendingPause.toFixed(1)}s`;
    }
  }

  const showPauseBanner = !isPlaying && selectedSong && !showCountdown;
  if (pauseBanner) {
    pauseBanner.classList.toggle('hidden', !showPauseBanner);
    if (showPauseBanner) {
      pauseBanner.innerHTML = `
        <div class="pause-banner-content">
          <h3>${escapeHtml(selectedSong.title)}</h3>
          <p>${escapeHtml(selectedSong.artist || 'Artiste inconnu')}</p>
        </div>
      `;
    }
  }

  const lines = selectedSong.lyrics.split(/\n/);
  lyricsTrack.innerHTML = lines
    .map((line) => `<div>${escapeHtml(line || '&nbsp;')}</div>`)
    .join('');

  const viewport = document.getElementById('lyricsViewport');
  const trackHeight = lyricsTrack.scrollHeight;
  const viewportHeight = viewport.clientHeight;
  const maxOffset = Math.max(0, trackHeight - viewportHeight);
  const safeOffset = Math.min(Math.max(offsetY, -maxOffset), 0);
  lyricsTrack.style.transform = `translateY(${safeOffset}px)`;

  const previewText = isPlaying
    ? 'Défilement en cours…'
    : pendingPause > 0
      ? `Pause de démarrage : ${pendingPause.toFixed(1)}s`
      : 'Prêt à défiler';
  playerStatus.textContent = `${previewText} • ${selectedSong.title}`;
}

function persistSongs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}

function loadSongs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
