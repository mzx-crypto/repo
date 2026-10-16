// Автономный движок: прямые HTML5 Audio потоки, IndexedDB для офлайн-работы без ПК,
// и акустический рекомендательный граф (75% по звучанию/жанру + 25% новые открытия).

const DB_NAME = "YM_Standalone_Storage";
const DB_VERSION = 1;

// Встроенный стартовый пул акустических профилей и жанровых кластеров для поиска в открытых API
const ACOUSTIC_CLUSTERS = {
    rusrap: {
        label: "Русский рэп / бит",
        queries: ["русский рэп бит", "miyagi тип бит", "скриптонит стиль", "новый русский хип хоп", "андерграунд рэп"],
        bpmRange: [82, 105],
        energy: 0.78
    },
    phonk: {
        label: "Фонк / перегруз",
        queries: ["drift phonk", "memphis cowbell phonk", "russian phonk bass", "aggressive phonk"],
        bpmRange: [115, 145],
        energy: 0.94
    },
    indie: {
        label: "Пост-панк / инди",
        queries: ["russian post punk", "doomer wave", "sovietwave synth", "инди рок россия"],
        bpmRange: [110, 135],
        energy: 0.65
    },
    electro: {
        label: "Электроника / синт",
        queries: ["dark synthwave", "deep house bass", "electronic chillwave", "ambient techno"],
        bpmRange: [120, 130],
        energy: 0.80
    },
    wildcard: {
        label: "Новое звучание",
        queries: ["neo classical piano", "japanese jazz fusion", "lo-fi chillhop beats", "cumbia digital", "alt metal riff"],
        bpmRange: [70, 160],
        energy: 0.55
    }
};

let dbInstance = null;
let audioEl = document.getElementById("audio-engine");
let waveQueue = [];
let currentTrack = null;
let activeFilter = "all";
let likedMap = new Map();
let offlineMap = new Map();
let heardTrackIds = new Set(JSON.parse(localStorage.getItem("ym_heard_ids") || "[]"));
let genreWeights = JSON.parse(localStorage.getItem("ym_genre_weights") || JSON.stringify({
    rusrap: 3,
    phonk: 1,
    indie: 1,
    electro: 1
}));

// 1. Инициализация локальной базы внутри телефона (IndexedDB)
function openLocalDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("offline_tracks")) {
                db.createObjectStore("offline_tracks", { keyPath: "track_id" });
            }
            if (!db.objectStoreNames.contains("liked_tracks")) {
                db.createObjectStore("liked_tracks", { keyPath: "track_id" });
            }
        };
        req.onsuccess = () => {
            dbInstance = req.result;
            resolve(dbInstance);
        };
        req.onerror = () => reject(req.error);
    });
}

function getAllFromStore(storeName) {
    return new Promise((resolve) => {
        const tx = dbInstance.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

function putToStore(storeName, obj) {
    return new Promise((resolve, reject) => {
        const tx = dbInstance.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(obj);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function deleteFromStore(storeName, key) {
    return new Promise((resolve) => {
        const tx = dbInstance.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => resolve();
    });
}

// 2. Классификатор акустического профиля трека по метаданным и жанровым дескрипторам
function inferAcousticCluster(genreStr, title, artist) {
    const raw = `${genreStr} ${title} ${artist}`.toLowerCase();
    if (/(рэп|хип-хоп|hip-hop|rap|trap|бит|скриптонит|macan|баста|miyagi|kizaru|гуф)/.test(raw)) return "rusrap";
    if (/(phonk|фонк|cowbell|drift|memphis|lxst|kordhell)/.test(raw)) return "phonk";
    if (/(пост-панк|инди|рок|post-punk|indie|rock|кино|молчат дома|перемотка)/.test(raw)) return "indie";
    if (/(electro|house|synth|techno|dance|электро|синт)/.test(raw)) return "electro";
    return "wildcard";
}

// 3. Прямой клиент к открытому музыкальному каталогу с прямыми аудиопотоками (CORS-friendly)
async function queryPublicAudioCatalog(term, forcedCluster = null, isDiscovery = false) {
    if (!navigator.onLine) return [];
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=25&country=RU`;
    try {
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const data = await resp.json();
        const items = data.results || [];
        return items
            .filter(it => it.previewUrl && it.trackId)
            .map(it => {
                const cluster = forcedCluster || inferAcousticCluster(it.primaryGenreName || "", it.trackName || "", it.artistName || "");
                const clusterMeta = ACOUSTIC_CLUSTERS[cluster] || ACOUSTIC_CLUSTERS.wildcard;
                return {
                    track_id: String(it.trackId),
                    title: it.trackName || "Без названия",
                    artist: it.artistName || "Неизвестен",
                    cover_url: (it.artworkUrl100 || "").replace("100x100bb", "400x400bb"),
                    stream_url: it.previewUrl,
                    genre_cluster: cluster,
                    genre_label: isDiscovery ? "Новое открытие" : clusterMeta.label,
                    is_discovery: isDiscovery,
                    energy: clusterMeta.energy
                };
            });
    } catch (_) {
        return [];
    }
}

// 4. Генератор «Моей волны»:
// - Если офлайн: крутит только скачанные в телефон треки из IndexedDB
// - Если онлайн: 75% подбирает по весам любимых жанров/звучания, 25% подмешивает абсолютно новые жанры и неслышанные треки
async function rebuildWaveQueue() {
    await syncMapsFromDB();

    if (!navigator.onLine) {
        const offlineList = Array.from(offlineMap.values());
        waveQueue = shuffleArray(offlineList);
        renderAllViews();
        return;
    }

    let targetCluster = activeFilter;
    if (targetCluster === "all") {
        targetCluster = pickWeightedCluster();
    }

    const clusterObj = ACOUSTIC_CLUSTERS[targetCluster] || ACOUSTIC_CLUSTERS.rusrap;
    const mainQuery = randomItem(clusterObj.queries);

    // Выбираем контрастный жанр для 25% не похожих открытий
    const otherClusters = Object.keys(ACOUSTIC_CLUSTERS).filter(k => k !== targetCluster);
    const discoveryClusterKey = randomItem(otherClusters);
    const discoveryQuery = randomItem(ACOUSTIC_CLUSTERS[discoveryClusterKey].queries);

    const [similarTracks, discoveryTracks] = await Promise.all([
        queryPublicAudioCatalog(mainQuery, targetCluster, false),
        queryPublicAudioCatalog(discoveryQuery, discoveryClusterKey, true)
    ]);

    // Фильтруем так, чтобы в приоритете шли треки, которые пользователь ещё ни разу не слышал
    const freshSimilar = similarTracks.filter(t => !heardTrackIds.has(t.track_id));
    const poolSimilar = freshSimilar.length >= 6 ? freshSimilar : similarTracks;

    const freshDiscovery = discoveryTracks.filter(t => !heardTrackIds.has(t.track_id));
    const poolDiscovery = freshDiscovery.length >= 3 ? freshDiscovery : discoveryTracks;

    const pickedMain = shuffleArray(poolSimilar).slice(0, 9);
    const pickedWildcard = shuffleArray(poolDiscovery).slice(0, 3);

    // Смешиваем 75% похожих по звучанию + 25% новых открытий
    waveQueue = shuffleArray([...pickedMain, ...pickedWildcard]);
    renderAllViews();
}

function pickWeightedCluster() {
    const entries = Object.entries(genreWeights);
    const total = entries.reduce((acc, [, w]) => acc + Math.max(1, w), 0);
    let r = Math.random() * total;
    for (const [cluster, weight] of entries) {
        r -= Math.max(1, weight);
        if (r <= 0) return cluster;
    }
    return "rusrap";
}

// 5. Мгновенное воспроизведение через HTML5 Audio (с поддержкой локальных Blob из памяти телефона)
async function playTrackObject(track) {
    if (!track) return;
    currentTrack = track;

    // Отмечаем трек как услышанный
    heardTrackIds.add(track.track_id);
    localStorage.setItem("ym_heard_ids", JSON.stringify(Array.from(heardTrackIds).slice(-500)));

    document.getElementById("p-title").textContent = track.title;
    document.getElementById("p-artist").textContent = `${track.artist} • ${track.genre_label || ""}`;
    document.getElementById("p-cover").src = track.cover_url || "https://music.yandex.ru/blocks/meta/i/og-image.png";
    document.getElementById("wave-sub").textContent = `${track.artist} — ${track.title} [${track.genre_label}]`;

    const savedOffline = offlineMap.get(track.track_id);
    if (savedOffline && savedOffline.audio_blob) {
        const blobUrl = URL.createObjectURL(savedOffline.audio_blob);
        audioEl.src = blobUrl;
    } else if (navigator.onLine && track.stream_url) {
        audioEl.src = track.stream_url;
    } else {
        document.getElementById("wave-sub").textContent = "Нет сети: выбери скачанный трек";
        return;
    }

    try {
        await audioEl.play();
        setPlayingUI(true);
    } catch (err) {
        setPlayingUI(false);
    }
    renderAllViews();
}

function toggleAudio() {
    if (!currentTrack) {
        togglePlayWave();
        return;
    }
    if (audioEl.paused) {
        audioEl.play().then(() => setPlayingUI(true)).catch(() => {});
    } else {
        audioEl.pause();
        setPlayingUI(false);
    }
}

async function togglePlayWave() {
    if (!currentTrack) {
        if (waveQueue.length === 0) await rebuildWaveQueue();
        if (waveQueue.length > 0) {
            await playTrackObject(waveQueue.shift());
        }
        return;
    }
    toggleAudio();
}

async function playNextInQueue() {
    if (waveQueue.length < 3 && navigator.onLine) {
        await rebuildWaveQueue();
    }
    if (waveQueue.length > 0) {
        const next = waveQueue.shift();
        await playTrackObject(next);
    } else if (offlineMap.size > 0) {
        const arr = Array.from(offlineMap.values());
        await playTrackObject(randomItem(arr));
    }
}

function setPlayingUI(isPlaying) {
    const orb = document.getElementById("orb");
    const playBtn = document.getElementById("p-play-btn");
    const heroIcon = document.getElementById("hero-play-icon");
    if (isPlaying) {
        orb.classList.add("playing");
        playBtn.textContent = "⏸";
        heroIcon.textContent = "⏸";
    } else {
        orb.classList.remove("playing");
        playBtn.textContent = "▶";
        heroIcon.textContent = "▶";
    }
}

// 6. Скачивание аудиофайла прямо в память телефона (IndexedDB Blob) для работы без интернета
async function downloadTrackToPhone(track, ev) {
    if (ev) ev.stopPropagation();
    if (offlineMap.has(track.track_id)) {
        await deleteFromStore("offline_tracks", track.track_id);
        await syncMapsFromDB();
        renderAllViews();
        return;
    }
    if (!navigator.onLine || !track.stream_url) return;

    try {
        const resp = await fetch(track.stream_url);
        const blob = await resp.blob();
        const record = { ...track, audio_blob: blob, saved_at: Date.now() };
        await putToStore("offline_tracks", record);
        await syncMapsFromDB();
        renderAllViews();
    } catch (_) {}
}

async function downloadCurrentTrack() {
    if (currentTrack) {
        await downloadTrackToPhone(currentTrack, null);
    }
}

// 7. Лайк трека -> усиливает вес акустического кластера (например, rusrap) для «Моей волны»
async function toggleLikeTrack(track, ev) {
    if (ev) ev.stopPropagation();
    const id = track.track_id;
    const cluster = track.genre_cluster || "rusrap";

    if (likedMap.has(id)) {
        await deleteFromStore("liked_tracks", id);
        genreWeights[cluster] = Math.max(1, (genreWeights[cluster] || 2) - 1);
    } else {
        await putToStore("liked_tracks", track);
        genreWeights[cluster] = (genreWeights[cluster] || 1) + 3;
    }
    localStorage.setItem("ym_genre_weights", JSON.stringify(genreWeights));
    await syncMapsFromDB();
    renderAllViews();
}

async function handleSearch(e) {
    e.preventDefault();
    const q = document.getElementById("search-input").value.trim();
    if (!q) return;
    const results = await queryPublicAudioCatalog(q, null, false);
    renderTrackList("search-list", results);
}

function selectAcousticFilter(filterKey, btn) {
    activeFilter = filterKey;
    document.querySelectorAll(".chips .chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    rebuildWaveQueue();
}

function switchView(name, btn) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById("view-" + name).classList.add("active");
    document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderAllViews();
}

async function syncMapsFromDB() {
    const [offList, likeList] = await Promise.all([
        getAllFromStore("offline_tracks"),
        getAllFromStore("liked_tracks")
    ]);
    offlineMap = new Map(offList.map(i => [i.track_id, i]));
    likedMap = new Map(likeList.map(i => [i.track_id, i]));
}

function renderTrackList(containerId, tracks) {
    const box = document.getElementById(containerId);
    if (!box) return;
    if (!tracks || tracks.length === 0) {
        box.innerHTML = `<div style="color:#777;padding:14px 4px;font-size:13px;">Список пуст</div>`;
        return;
    }
    box.innerHTML = tracks.map(t => {
        const isCurrent = currentTrack && currentTrack.track_id === t.track_id;
        const isLiked = likedMap.has(t.track_id);
        const isOffline = offlineMap.has(t.track_id);
        const payload = encodeURIComponent(JSON.stringify({
            track_id: t.track_id,
            title: t.title,
            artist: t.artist,
            cover_url: t.cover_url,
            stream_url: t.stream_url,
            genre_cluster: t.genre_cluster,
            genre_label: t.genre_label,
            is_discovery: t.is_discovery
        }));
        return `
        <div class="track-card ${isCurrent ? 'active' : ''}" onclick="playEncoded('${payload}')">
            <img class="track-cover" src="${escapeHtml(t.cover_url)}" loading="lazy" alt="">
            <div class="track-meta">
                <div class="track-title">
                    ${escapeHtml(t.title)}
                    <span class="tag-pill ${t.is_discovery ? 'discovery' : ''}">${escapeHtml(t.genre_label || 'Поток')}</span>
                </div>
                <div class="track-artist">${escapeHtml(t.artist)}</div>
            </div>
            <button class="icon-btn ${isOffline ? 'saved' : ''}" onclick="dlEncoded('${payload}', event)" title="Скачать офлайн">
                ${isOffline ? '✔' : '⬇'}
            </button>
            <button class="icon-btn ${isLiked ? 'liked' : ''}" onclick="likeEncoded('${payload}', event)" title="Вкусовой лайк">
                ${isLiked ? '♥' : '♡'}
            </button>
        </div>`;
    }).join("");
}

function renderAllViews() {
    renderTrackList("wave-list", waveQueue);
    renderTrackList("offline-list", Array.from(offlineMap.values()));
    renderTrackList("liked-list", Array.from(likedMap.values()));

    const topCluster = pickWeightedCluster();
    const label = (ACOUSTIC_CLUSTERS[topCluster] || ACOUSTIC_CLUSTERS.rusrap).label;
    const summaryEl = document.getElementById("profile-summary");
    if (summaryEl) {
        summaryEl.textContent = `Ядро вкуса: ${label} (75%) + 25% новые жанры`;
    }
}

window.playEncoded = (str) => playTrackObject(JSON.parse(decodeURIComponent(str)));
window.dlEncoded = (str, ev) => downloadTrackToPhone(JSON.parse(decodeURIComponent(str)), ev);
window.likeEncoded = (str, ev) => toggleLikeTrack(JSON.parse(decodeURIComponent(str)), ev);

// Прогресс-бар и автопереключение треков
audioEl.addEventListener("timeupdate", () => {
    const cur = audioEl.currentTime || 0;
    const dur = audioEl.duration || 0;
    document.getElementById("t-cur").textContent = formatSec(cur);
    document.getElementById("t-dur").textContent = formatSec(dur);
    if (dur > 0) {
        document.getElementById("t-seek").value = String(Math.floor((cur / dur) * 100));
    }
});

audioEl.addEventListener("ended", () => {
    playNextInQueue();
});

function seekAudio(val) {
    const dur = audioEl.duration || 0;
    if (dur > 0) {
        audioEl.currentTime = (Number(val) / 100) * dur;
    }
}

function formatSec(s) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

function updateNetworkBadge() {
    const badge = document.getElementById("net-status");
    if (navigator.onLine) {
        badge.textContent = "● ОНЛАЙН";
        badge.className = "net-pill online";
    } else {
        badge.textContent = "● ОФЛАЙН (ТОЛЬКО СКАЧАННЫЕ)";
        badge.className = "net-pill offline";
    }
    rebuildWaveQueue();
}

function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

window.addEventListener("online", updateNetworkBadge);
window.addEventListener("offline", updateNetworkBadge);

window.addEventListener("DOMContentLoaded", async () => {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    await openLocalDB();
    await syncMapsFromDB();
    updateNetworkBadge();
});
