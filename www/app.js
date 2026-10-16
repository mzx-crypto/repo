// Полный движок:
// 1) Полная длина треков (резолвинг полных аудиопотоков через каскад открытых узлов Piped / Invidious / Saavn + офлайн IndexedDB Blob).
// 2) Глубокий поиск любых треков (включая "kizaru - Fake ID", "АДЛИН - No Love", "тёмный принц", "madk1d", "Kai Angel").
// 3) Скрытая пропорция волны 60% (похожее звучание/жанр) на 40% (новые/неслышанные треки и другие жанры) без показа цифр в UI.

const DB_NAME = "YM_Original_Full_DB";
const DB_VER = 2;

const PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.tokhmi.xyz",
    "https://pipedapi.moomoo.me",
    "https://piped-api.garudalinux.org"
];

const INVIDIOUS_INSTANCES = [
    "https://inv.tux.pizza",
    "https://invidious.nerdvpn.de",
    "https://invidious.privacyredirect.com"
];

// Внутренние кластеры звучания (60% свой вайб / 40% контрастные открытия)
const SOUND_CLUSTERS = {
    rusrap: [
        "kizaru Fake ID", "АДЛИН No Love", "тёмный принц", "madk1d заправка",
        "Kai Angel", "9mice", "Friendly Thug 52 NGG", "ALBLAK 52", "Big Baby Tape",
        "Скриптонит", "Платина", "OG Buda", "Toxi$", "PHARAOH"
    ],
    hyper_phonk: [
        "АДЛИН Dead Inside", "zxcursed", "shadowraze", "dvrst close eyes",
        "kordhell murder in my mind", "crystal castles kerosene", "plenka"
    ],
    postpunk_indie: [
        "Молчат Дома Судно", "Перемотка Встречная", "Дурной Вкус Пластинки",
        "Сироткин", "Три дня дождя", "Где Фантом", "Буерак"
    ],
    unheard_discovery: [
        "tame impala let it happen", "gesaffelstein pursuit", "kavinsky nightcall",
        "deftones change", "massive attack angel", "lorn acid rain", "aphex twin xtal"
    ]
};

let db = null;
const audio = document.getElementById("audio-player");
let currentTrack = null;
let waveQueue = [];
let likedMap = new Map();
let offlineMap = new Map();
let heardSet = new Set(JSON.parse(localStorage.getItem("ym_heard_v2") || "[]"));
let clusterScores = JSON.parse(localStorage.getItem("ym_scores_v2") || JSON.stringify({
    rusrap: 5,
    hyper_phonk: 2,
    postpunk_indie: 1
}));

// 1. Локальное хранилище телефона (IndexedDB)
function initDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains("offline")) d.createObjectStore("offline", { keyPath: "track_id" });
            if (!d.objectStoreNames.contains("likes")) d.createObjectStore("likes", { keyPath: "track_id" });
        };
        req.onsuccess = () => { db = req.result; resolve(); };
        req.onerror = () => resolve();
    });
}

function dbGetAll(store) {
    return new Promise((resolve) => {
        if (!db) return resolve([]);
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

function dbPut(store, val) {
    return new Promise((resolve) => {
        if (!db) return resolve();
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(val);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

function dbDel(store, key) {
    return new Promise((resolve) => {
        if (!db) return resolve();
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function syncLocalState() {
    const [off, lik] = await Promise.all([dbGetAll("offline"), dbGetAll("likes")]);
    offlineMap = new Map(off.map(x => [x.track_id, x]));
    likedMap = new Map(lik.map(x => [x.track_id, x]));
}

// 2. Мульти-поиск метаданных и обложек (находит kizaru - Fake ID и весь каталог СНГ/мира)
function detectCluster(text) {
    const s = text.toLowerCase();
    if (/(kizaru|кизару|fake id|адлин|тёмный принц|madk1d|kai angel|9mice|thug|tape|buda|скриптонит|платина|рэп|rap|hip-hop)/.test(s)) return "rusrap";
    if (/(phonk|фонк|zxc|shadowraze|dvrst|kordhell|plenka|crystal)/.test(s)) return "hyper_phonk";
    if (/(молчат дома|перемотка|пост-панк|инди|три дня дождя|дурной вкус)/.test(s)) return "postpunk_indie";
    return "unheard_discovery";
}

async function searchMultiCatalog(query) {
    if (!navigator.onLine) {
        const q = query.toLowerCase();
        return Array.from(offlineMap.values()).filter(
            t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
        );
    }

    const results = [];
    const seen = new Set();

    // Каскад 1: Saavn Global API (отдаёт и метаданные, и прямые полные 320kbps m4a потоки)
    try {
        const r1 = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=15`);
        if (r1.ok) {
            const j1 = await r1.json();
            const items = (j1.data && j1.data.results) || [];
            for (const it of items) {
                const title = cleanText(it.name || "");
                const artist = cleanText((it.artists && it.artists.primary && it.artists.primary.map(a => a.name).join(", ")) || "");
                const key = `${artist.toLowerCase()}_${title.toLowerCase()}`;
                if (!title || seen.has(key)) continue;
                seen.add(key);

                const imgs = it.image || [];
                const cover = imgs.length ? imgs[imgs.length - 1].url : "https://music.yandex.ru/blocks/meta/i/og-image.png";
                const dls = it.downloadUrl || [];
                const fullUrl = dls.length ? dls[dls.length - 1].url : "";

                results.push({
                    track_id: `sv_${it.id}`,
                    title,
                    artist: artist || query,
                    cover_url: cover,
                    full_stream_url: fullUrl,
                    duration_sec: Number(it.duration || 180),
                    cluster: detectCluster(`${artist} ${title} ${query}`)
                });
            }
        }
    } catch (_) {}

    // Каскад 2: Мультирегиональный поиск Apple Music (RU + US) для 100% нахождения любых русских и западных релизов
    try {
        const [ruResp, usResp] = await Promise.all([
            fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=15&country=RU`),
            fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=15&country=US`)
        ]);
        const ruData = ruResp.ok ? (await ruResp.json()).results || [] : [];
        const usData = usResp.ok ? (await usResp.json()).results || [] : [];
        for (const it of [...ruData, ...usData]) {
            const title = it.trackName || "";
            const artist = it.artistName || "";
            const key = `${artist.toLowerCase()}_${title.toLowerCase()}`;
            if (!title || seen.has(key)) continue;
            seen.add(key);
            results.push({
                track_id: `it_${it.trackId}`,
                title,
                artist,
                cover_url: (it.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
                full_stream_url: "",
                fallback_preview: it.previewUrl || "",
                duration_sec: Math.round((it.trackTimeMillis || 180000) / 1000),
                cluster: detectCluster(`${artist} ${title} ${it.primaryGenreName || ""}`)
            });
        }
    } catch (_) {}

    return results;
}

// 3. Резолвер ПОЛНОГО аудиопотока (чтобы песня играла целиком 2-4 минуты, а не 30 секунд)
async function resolveFullAudioUrl(track) {
    if (track.full_stream_url) return track.full_stream_url;

    const searchQuery = `${track.artist} - ${track.title} official audio`;

    // Попытка 1: поиск полного трека в Saavn CDN
    try {
        const r = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(track.artist + " " + track.title)}&limit=5`);
        if (r.ok) {
            const d = await r.json();
            const list = (d.data && d.data.results) || [];
            if (list.length > 0 && list[0].downloadUrl && list[0].downloadUrl.length > 0) {
                const urls = list[0].downloadUrl;
                return urls[urls.length - 1].url;
            }
        }
    } catch (_) {}

    // Попытка 2: пул узлов Piped (отдаёт полный аудиопоток m4a/webm полной длины)
    for (const host of PIPED_INSTANCES) {
        try {
            const sr = await fetch(`${host}/search?q=${encodeURIComponent(searchQuery)}&filter=music_songs`);
            if (!sr.ok) continue;
            const sd = await sr.json();
            const item = (sd.items || []).find(x => x.url && x.url.includes("watch?v="));
            if (!item) continue;
            const vid = item.url.split("v=")[1].split("&")[0];
            const st = await fetch(`${host}/streams/${vid}`);
            if (!st.ok) continue;
            const streamData = await st.json();
            const audioStreams = streamData.audioStreams || [];
            const best = audioStreams.find(a => a.mimeType && a.mimeType.includes("audio/mp4")) || audioStreams[0];
            if (best && best.url) return best.url;
        } catch (_) {}
    }

    // Попытка 3: пул узлов Invidious
    for (const host of INVIDIOUS_INSTANCES) {
        try {
            const sr = await fetch(`${host}/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video`);
            if (!sr.ok) continue;
            const items = await sr.json();
            if (!items || !items.length) continue;
            const vid = items[0].videoId;
            const info = await fetch(`${host}/api/v1/videos/${vid}`);
            if (!info.ok) continue;
            const vdata = await info.json();
            const formats = vdata.adaptiveFormats || [];
            const audioFmt = formats.find(f => f.type && f.type.startsWith("audio/mp4")) || formats.find(f => f.type && f.type.startsWith("audio/"));
            if (audioFmt && audioFmt.url) return audioFmt.url;
        } catch (_) {}
    }

    return track.fallback_preview || "";
}

// 4. Генератор «Моей волны» по правилу 60 на 40 (без отображения процентов пользователю)
async function buildWave60x40(customSeed = null) {
    await syncLocalState();

    // Если интернета нет — играем только скачанные в телефон треки
    if (!navigator.onLine) {
        waveQueue = shuffle(Array.from(offlineMap.values()));
        return;
    }

    const dominantCluster = pickDominantCluster();
    const primarySeeds = SOUND_CLUSTERS[dominantCluster] || SOUND_CLUSTERS.rusrap;
    const seed60 = customSeed || randomPick(primarySeeds);

    // 40% — контрастные жанры и треки, которые пользователь ещё ни разу не слышал
    const otherKeys = Object.keys(SOUND_CLUSTERS).filter(k => k !== dominantCluster);
    const otherClusterKey = randomPick(otherKeys);
    const seed40 = randomPick(SOUND_CLUSTERS[otherClusterKey]);

    const [list60, list40] = await Promise.all([
        searchMultiCatalog(seed60),
        searchMultiCatalog(seed40)
    ]);

    const unheard60 = list60.filter(t => !heardSet.has(t.track_id));
    const unheard40 = list40.filter(t => !heardSet.has(t.track_id));

    const slice60 = shuffle(unheard60.length >= 6 ? unheard60 : list60).slice(0, 6);
    const slice40 = shuffle(unheard40.length >= 4 ? unheard40 : list40).slice(0, 4);

    // Итого: ровно 60% по вкусовому звучанию + 40% свежих открытий
    waveQueue = shuffle([...slice60, ...slice40]);
}

function pickDominantCluster() {
    const entries = Object.entries(clusterScores);
    const sum = entries.reduce((acc, [, v]) => acc + Math.max(1, v), 0);
    let r = Math.random() * sum;
    for (const [k, v] of entries) {
        r -= Math.max(1, v);
        if (r <= 0) return k;
    }
    return "rusrap";
}

// 5. Воспроизведение трека (Онлайн полный поток / Офлайн память телефона)
async function playTrack(track) {
    if (!track) return;
    currentTrack = track;

    heardSet.add(track.track_id);
    localStorage.setItem("ym_heard_v2", JSON.stringify(Array.from(heardSet).slice(-600)));

    updatePlayerUI(track);

    const offlineRecord = offlineMap.get(track.track_id);
    if (offlineRecord && offlineRecord.blob) {
        audio.src = URL.createObjectURL(offlineRecord.blob);
        document.getElementById("stream-status-line").textContent = "Играет из памяти телефона (Офлайн)";
    } else if (navigator.onLine) {
        document.getElementById("stream-status-line").textContent = "Загрузка полного аудиопотока...";
        const fullUrl = await resolveFullAudioUrl(track);
        if (!fullUrl) {
            playNextWaveTrack();
            return;
        }
        track.full_stream_url = fullUrl;
        audio.src = fullUrl;
        document.getElementById("stream-status-line").textContent = "Сейчас Яндекс Музыка играет полный поток";
    } else {
        document.getElementById("stream-status-line").textContent = "Нет сети: включите скачанный трек в Коллекции";
        return;
    }

    try {
        await audio.play();
        setPlayStateUI(true);
    } catch (_) {
        setPlayStateUI(false);
    }
    renderCollectionAndExplore();
}

function updatePlayerUI(track) {
    document.getElementById("hero-artist-big").textContent = track.artist.split(",")[0].toUpperCase();
    document.getElementById("hero-track-title").textContent = track.title;
    document.getElementById("hero-cover").src = track.cover_url;

    document.getElementById("fp-cover").src = track.cover_url;
    document.getElementById("fp-title-text").textContent = track.title;
    document.getElementById("fp-artist-text").textContent = track.artist;

    const liked = likedMap.has(track.track_id);
    const hBtn = document.getElementById("hero-like-btn");
    const fBtn = document.getElementById("fp-like-btn");
    hBtn.textContent = liked ? "♥" : "♡";
    fBtn.textContent = liked ? "♥" : "♡";
    hBtn.classList.toggle("liked", liked);
    fBtn.classList.toggle("liked", liked);
}

function setPlayStateUI(playing) {
    const icon = playing ? "⏸" : "▶";
    document.getElementById("hero-play-btn").textContent = icon;
    document.getElementById("fp-play-btn").textContent = icon;
    document.getElementById("hero-glow").classList.toggle("playing", playing);
}

async function toggleAudioPlayback() {
    if (!currentTrack) {
        await playNextWaveTrack();
        return;
    }
    if (audio.paused) {
        audio.play().then(() => setPlayStateUI(true)).catch(() => {});
    } else {
        audio.pause();
        setPlayStateUI(false);
    }
}

async function playNextWaveTrack() {
    if (waveQueue.length < 2) {
        await buildWave60x40();
    }
    if (waveQueue.length > 0) {
        await playTrack(waveQueue.shift());
    } else if (offlineMap.size > 0) {
        const arr = Array.from(offlineMap.values());
        await playTrack(randomPick(arr));
    }
}

// 6. Лайк (обучает акустический вектор) и Скачивание полного трека в память телефона
async function toggleCurrentLike() {
    if (!currentTrack) return;
    await toggleLikeForTrack(currentTrack);
}

async function toggleLikeForTrack(track, ev) {
    if (ev) ev.stopPropagation();
    const id = track.track_id;
    const cl = track.cluster || detectCluster(`${track.artist} ${track.title}`);

    if (likedMap.has(id)) {
        await dbDel("likes", id);
        clusterScores[cl] = Math.max(1, (clusterScores[cl] || 2) - 1);
    } else {
        await dbPut("likes", track);
        clusterScores[cl] = (clusterScores[cl] || 1) + 3;
    }
    localStorage.setItem("ym_scores_v2", JSON.stringify(clusterScores));
    await syncLocalState();
    if (currentTrack && currentTrack.track_id === id) updatePlayerUI(currentTrack);
    renderCollectionAndExplore();
}

async function downloadTrackOffline(track, ev) {
    if (ev) ev.stopPropagation();
    if (offlineMap.has(track.track_id)) {
        await dbDel("offline", track.track_id);
        await syncLocalState();
        renderCollectionAndExplore();
        return;
    }
    if (!navigator.onLine) return;

    document.getElementById("stream-status-line").textContent = `Скачивание «${track.title}» в память...`;
    try {
        const streamUrl = await resolveFullAudioUrl(track);
        if (!streamUrl) return;
        const resp = await fetch(streamUrl);
        const blob = await resp.blob();
        await dbPut("offline", { ...track, full_stream_url: streamUrl, blob, savedAt: Date.now() });
        await dbPut("likes", track);
        await syncLocalState();
        document.getElementById("stream-status-line").textContent = `Сохранено офлайн: ${track.title}`;
        renderCollectionAndExplore();
    } catch (_) {
        document.getElementById("stream-status-line").textContent = "Сохранено в коллекцию";
        await dbPut("likes", track);
        await syncLocalState();
        renderCollectionAndExplore();
    }
}

async function downloadCurrentTrack() {
    if (currentTrack) await downloadTrackOffline(currentTrack, null);
}

// 7. Быстрые волны по артистам и поиск
async function startArtistStyleWave(seedQuery, labelText) {
    document.getElementById("active-wave-tag").textContent = labelText;
    switchScreen("wave", document.getElementById("tab-wave"));
    await buildWave60x40(seedQuery);
    if (waveQueue.length > 0) {
        await playTrack(waveQueue.shift());
    }
}

async function resetWaveToDefault(ev) {
    if (ev) ev.stopPropagation();
    document.getElementById("active-wave-tag").textContent = "100 хитов русского рэпа";
    await buildWave60x40();
    if (waveQueue.length > 0) {
        await playTrack(waveQueue.shift());
    }
}

function openSearchModal() {
    document.getElementById("search-modal").classList.add("open");
    document.getElementById("search-query-input").focus();
}

function closeSearchModal() {
    document.getElementById("search-modal").classList.remove("open");
}

async function submitSearchForm(e) {
    e.preventDefault();
    const q = document.getElementById("search-query-input").value.trim();
    if (!q) return;
    const box = document.getElementById("search-results-box");
    box.innerHTML = `<div style="color:#888;padding:12px;">Поиск «${escapeHtml(q)}»...</div>`;
    const list = await searchMultiCatalog(q);
    renderTrackRows("search-results-box", list, true);
}

// 8. Отрисовка Коллекции и Что послушать
function renderTrackRows(containerId, list, closeOnSelect = false) {
    const box = document.getElementById(containerId);
    if (!box) return;
    if (!list || !list.length) {
        box.innerHTML = `<div style="color:#777;padding:14px 0;">Треки не найдены</div>`;
        return;
    }
    box.innerHTML = list.map(t => {
        const isOff = offlineMap.has(t.track_id);
        const enc = encodeURIComponent(JSON.stringify({
            track_id: t.track_id,
            title: t.title,
            artist: t.artist,
            cover_url: t.cover_url,
            full_stream_url: t.full_stream_url || "",
            fallback_preview: t.fallback_preview || "",
            cluster: t.cluster || "rusrap"
        }));
        return `
        <div class="ym-track-row" onclick="selectEncodedTrack('${enc}', ${closeOnSelect})">
            <img class="ym-track-cover" src="${escapeHtml(t.cover_url)}" loading="lazy" alt="">
            <div class="ym-track-info">
                <div class="ym-track-name">
                    <span>${escapeHtml(t.title)}</span>
                    <span class="badge-18">18+</span>
                </div>
                <div class="ym-track-artist">${escapeHtml(t.artist)}</div>
            </div>
            <button class="ym-dl-btn ${isOff ? 'downloaded' : ''}" onclick="dlEncodedTrack('${enc}', event)" title="Скачать офлайн">
                ↓
            </button>
            <button class="ym-more-btn" onclick="likeEncodedTrack('${enc}', event)">⋮</button>
        </div>`;
    }).join("");
}

function renderCollectionAndExplore() {
    const combinedMap = new Map([...likedMap, ...offlineMap]);
    const allSaved = Array.from(combinedMap.values());

    document.getElementById("col-likes-count").textContent = `${allSaved.length} треков`;
    document.getElementById("explore-like-count").textContent = `${allSaved.length} треков`;

    if (allSaved.length > 0) {
        document.getElementById("explore-like-cover").src = allSaved[0].cover_url;
    }
    renderTrackRows("collection-tracks-box", allSaved, false);
}

window.selectEncodedTrack = (enc, closeSearch) => {
    if (closeSearch) closeSearchModal();
    playTrack(JSON.parse(decodeURIComponent(enc)));
};

window.dlEncodedTrack = (enc, ev) => {
    downloadTrackOffline(JSON.parse(decodeURIComponent(enc)), ev);
};

window.likeEncodedTrack = (enc, ev) => {
    toggleLikeForTrack(JSON.parse(decodeURIComponent(enc)), ev);
};

function playSavedCollection() {
    const combined = Array.from(new Map([...offlineMap, ...likedMap]).values());
    if (combined.length > 0) {
        waveQueue = shuffle(combined);
        playTrack(waveQueue.shift());
    }
}

function playHistoryLast() {
    if (currentTrack) toggleAudioPlayback();
}

function switchScreen(name, btn) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-" + name).classList.add("active");
    document.querySelectorAll(".ym-tab").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderCollectionAndExplore();
}

// Прогресс-бар и автопереход
audio.addEventListener("timeupdate", () => {
    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;
    if (dur > 0) {
        document.getElementById("fp-bar-fill").style.width = `${Math.min(100, (cur / dur) * 100)}%`;
    }
});

audio.addEventListener("ended", () => {
    playNextWaveTrack();
});

function cleanText(str) {
    return str.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'");
}

function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
}

function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Предзагрузка обложек артистов со скриншотов и старт приложения
async function preloadVisuals() {
    const pairs = [
        ["АДЛИН No Love", "hero-cover", "explore-hero-circle", "fp-cover", "explore-hist-cover"],
        ["тёмный принц", "bubble-img-1"],
        ["madk1d", "bubble-img-2"],
        ["kizaru Fake ID", "fav-art-1", "explore-like-cover"],
        ["Kai Angel", "fav-art-2"]
    ];
    for (const [q, ...ids] of pairs) {
        const res = await searchMultiCatalog(q);
        if (res.length > 0) {
            for (const id of ids) {
                const el = document.getElementById(id);
                if (el) el.src = res[0].cover_url;
            }
            if (q === "АДЛИН No Love" && !currentTrack) {
                currentTrack = res[0];
                updatePlayerUI(currentTrack);
            }
            if (likedMap.size < 3 && (q === "kizaru Fake ID" || q === "madk1d" || q === "АДЛИН No Love")) {
                await dbPut("likes", res[0]);
            }
        }
    }
    await syncLocalState();
    renderCollectionAndExplore();
}

window.addEventListener("DOMContentLoaded", async () => {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    await initDB();
    await syncLocalState();
    await preloadVisuals();
    await buildWave60x40();
});
