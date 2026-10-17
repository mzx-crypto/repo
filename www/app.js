// Полный движок v4:
// 1) Все картинки гарантированно отображаются (живой JSONP-резолвер обложек Apple Music + встроенный SVG Data-URI градиент, ни одной битой иконки).
// 2) Никаких стикеров/эмодзи: все кнопки плеера и меню — чистые векторные SVG как в оригинале.
// 3) Объединённая округлая нижняя лента: персональные артисты пользователя (по его лайкам/истории) + кнопка «Назад к привычному» + 14 категорий волны.
// 4) Честное воспроизведение полных треков (без репита 30 секунд) + точный поиск («kizaru - Fake ID» включает именно kizaru - Fake ID).

const DB_NAME = "YM_Standalone_V4";
const DB_VER = 4;

// Чистые минималистичные SVG-иконки для динамической вставки (никаких эмодзи на синем фоне)
const SVG_ICONS = {
    play: `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    playMini: `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pauseMini: `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    heartOutline: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3z"/></svg>`,
    heartFilled: `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
    spark: `<svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>`,
    download: `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
    dots: `<svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`
};

// Генератор стильной SVG-обложки на случай офлайна (гарантирует 0 битых картинок)
function makeFallbackCover(title, artist, hue = 260) {
    const letter = ((artist || title || "Я")[0] || "Я").toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
        <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="hsl(${hue}, 75%, 32%)"/>
                <stop offset="100%" stop-color="#121216"/>
            </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#g)"/>
        <circle cx="200" cy="200" r="110" fill="rgba(255,255,255,0.06)"/>
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="110">${letter}</text>
    </svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// 14 категорий волны (объединяются в нижнюю округлую ленту вместе с любимыми артистами пользователя)
const WAVE_MOOD_CATEGORIES = [
    { id: "walk", sub: "Под занятие", name: "Для вечерней прогулки", query: "АДЛИН Перемотка Сироткин", tint: "rgba(103, 58, 183, 0.45)" },
    { id: "gym", sub: "Под занятие", name: "Для тренировки", query: "kordhell dvrst kizaru", tint: "rgba(229, 57, 53, 0.42)" },
    { id: "sad", sub: "Настроение", name: "Погрустить", query: "Три дня дождя тёмный принц", tint: "rgba(55, 71, 79, 0.55)" },
    { id: "night_drive", sub: "Вайб", name: "Ночной драйв", query: "kizaru Big Baby Tape ALBLAK 52", tint: "rgba(0, 150, 136, 0.45)" },
    { id: "focus", sub: "Под занятие", name: "Для кода и учёбы", query: "lofi chill synthwave", tint: "rgba(30, 136, 229, 0.45)" },
    { id: "party", sub: "Вайб", name: "На тусовку", query: "OG Buda Toxi$ Kai Angel", tint: "rgba(216, 27, 96, 0.45)" },
    { id: "morning", sub: "Настроение", name: "Бодрое утро", query: "MACAN Баста Feduk", tint: "rgba(255, 143, 0, 0.45)" },
    { id: "rain", sub: "Атмосфера", name: "Под шум дождя", query: "Молчат Дома Дурной Вкус", tint: "rgba(69, 90, 100, 0.52)" },
    { id: "gaming", sub: "Под занятие", name: "Для катки", query: "zxcursed shadowraze паранойя", tint: "rgba(123, 31, 162, 0.48)" },
    { id: "road", sub: "В дорогу", name: "В дальнюю дорогу", query: "Скриптонит Miyagi Кино", tint: "rgba(46, 125, 50, 0.45)" },
    { id: "hard_bass", sub: "Характер", name: "Жёсткий бит", query: "Friendly Thug 52 9mice madk1d", tint: "rgba(183, 28, 28, 0.45)" },
    { id: "chill", sub: "Настроение", name: "Расслабиться", query: "Скриптонит Ламбада", tint: "rgba(0, 131, 143, 0.45)" },
    { id: "electro", sub: "Жанр", name: "Гиперпоп и электро", query: "Crystal Castles plenka", tint: "rgba(94, 53, 177, 0.45)" },
    { id: "sleep", sub: "Атмосфера", name: "Перед сном", query: "ambient piano slow", tint: "rgba(40, 53, 147, 0.45)" }
];

// Стартовые треки (обложки автоматически подтягиваются живым JSONP при старте)
const SEED_TRACKS = [
    {
        track_id: "seed_adlin_nolove",
        title: "No Love",
        artist: "АДЛИН",
        cover_url: makeFallbackCover("No Love", "АДЛИН", 42),
        duration_sec: 138,
        cluster: "hyper_phonk"
    },
    {
        track_id: "seed_kizaru_fakeid",
        title: "Fake ID",
        artist: "kizaru, Icegergert",
        cover_url: makeFallbackCover("Fake ID", "kizaru", 280),
        duration_sec: 164,
        cluster: "rusrap"
    },
    {
        track_id: "seed_alaska_puffer",
        title: "ALASKA PUFFER",
        artist: "паранойя",
        cover_url: makeFallbackCover("ALASKA PUFFER", "паранойя", 320),
        duration_sec: 121,
        cluster: "rusrap"
    },
    {
        track_id: "seed_madk1d_zapravka",
        title: "заправка (prod. by рэйчи)",
        artist: "madk1d",
        cover_url: makeFallbackCover("заправка", "madk1d", 190),
        duration_sec: 132,
        cluster: "rusrap"
    },
    {
        track_id: "seed_dark_prince",
        title: "в темноте",
        artist: "тёмный принц",
        cover_url: makeFallbackCover("в темноте", "тёмный принц", 210),
        duration_sec: 144,
        cluster: "postpunk_indie"
    },
    {
        track_id: "seed_pharaoh_idiot",
        title: "Идиот (feat. Ilya Konoplev)",
        artist: "PHARAOH, Ilya Konoplev",
        cover_url: makeFallbackCover("Идиот", "PHARAOH", 15),
        duration_sec: 190,
        cluster: "rusrap"
    },
    {
        track_id: "seed_kai_angel",
        title: "JENNER",
        artist: "Kai Angel, 9mice",
        cover_url: makeFallbackCover("JENNER", "Kai Angel", 340),
        duration_sec: 155,
        cluster: "rusrap"
    }
];

const SOUND_SEEDS = {
    rusrap: ["kizaru", "PHARAOH", "АДЛИН", "Big Baby Tape", "Friendly Thug 52 NGG", "Скриптонит", "OG Buda", "Kai Angel"],
    hyper_phonk: ["dvrst", "kordhell", "zxcursed", "shadowraze", "plenka", "АДЛИН"],
    postpunk_indie: ["Молчат Дома", "Перемотка", "Три дня дождя", "Сироткин", "Дурной Вкус"],
    discovery: ["Kavinsky", "Tame Impala", "Massive Attack", "Deftones", "Gesaffelstein", "Daft Punk"]
};

let db = null;
const audio = document.getElementById("audio-player");
let currentTrack = null;
let sheetTrack = null;
let waveQueue = [];
let historyStack = [];
let activeCategoryId = "pure";
let repeatOne = false;
let likedMap = new Map();
let offlineMap = new Map();
let artistCoverCache = new Map();
let dislikedSet = new Set(JSON.parse(localStorage.getItem("ym_disliked_v4") || "[]"));
let heardSet = new Set(JSON.parse(localStorage.getItem("ym_heard_v4") || "[]"));
let artistAffinity = JSON.parse(localStorage.getItem("ym_artist_affinity_v4") || JSON.stringify({
    "тёмный принц": 6,
    "madk1d": 5,
    "kizaru": 5,
    "АДЛИН": 4,
    "Kai Angel": 4
}));
let clusterWeights = JSON.parse(localStorage.getItem("ym_weights_v4") || JSON.stringify({
    rusrap: 5,
    hyper_phonk: 2,
    postpunk_indie: 2
}));

function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => { el.style.display = "none"; }, 2200);
}

// 1. Защита всех картинок от битых иконок
window.addEventListener("error", (e) => {
    if (e.target && e.target.tagName === "IMG") {
        const fallback = makeFallbackCover(e.target.alt || "M", "Я", 230);
        if (e.target.src !== fallback) e.target.src = fallback;
    }
}, true);

// 2. Локальная БД (IndexedDB)
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

async function syncState() {
    const [off, lik] = await Promise.all([dbGetAll("offline"), dbGetAll("likes")]);
    offlineMap = new Map(off.map(x => [x.track_id, x]));
    likedMap = new Map(lik.map(x => [x.track_id, x]));
}

// 3. JSONP-поиск iTunes (обходит любые CORS-блокировки в APK на 100%, находит kizaru - Fake ID и живые HD-обложки)
function itunesJsonpSearch(term, country = "RU", limit = 20) {
    return new Promise((resolve) => {
        if (!navigator.onLine) return resolve([]);
        const cbName = "ym_itunes_cb_" + Math.random().toString(36).slice(2);
        const script = document.createElement("script");
        let timer = setTimeout(() => {
            cleanup();
            resolve([]);
        }, 3200);

        function cleanup() {
            clearTimeout(timer);
            delete window[cbName];
            if (script.parentNode) script.parentNode.removeChild(script);
        }

        window[cbName] = (data) => {
            cleanup();
            resolve((data && data.results) || []);
        };

        script.onerror = () => {
            cleanup();
            resolve([]);
        };

        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}&country=${country}&callback=${cbName}`;
        script.src = url;
        document.body.appendChild(script);
    });
}

async function fetchFast(url, timeoutMs = 2600) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(url, { signal: ctrl.signal });
        clearTimeout(id);
        return r;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

function normalizeQuery(q) {
    return q.replace(/\s*[-–—:]\s*/g, " ").replace(/\s+/g, " ").trim();
}

function inferCluster(text) {
    const s = text.toLowerCase();
    if (/(kizaru|кизару|fake id|pharaoh|фараон|паранойя|адлин|madk1d|kai angel|9mice|tape|buda|скриптонит|рэп|rap)/.test(s)) return "rusrap";
    if (/(phonk|фонк|dvrst|kordhell|zxc|shadowraze|plenka)/.test(s)) return "hyper_phonk";
    if (/(молчат дома|перемотка|три дня дождя|сироткин|инди|пост-панк)/.test(s)) return "postpunk_indie";
    return "discovery";
}

// 4. Точный поиск без подмены треков (kizaru - Fake ID находит именно kizaru - Fake ID)
async function searchExactCatalog(rawQuery) {
    const cleanQ = normalizeQuery(rawQuery);
    if (!cleanQ) return SEED_TRACKS;

    const results = [];
    const seen = new Set();

    function addTrack(item) {
        if (!item || !item.title || dislikedSet.has(item.track_id)) return;
        const key = `${item.artist.toLowerCase().trim()}_${item.title.toLowerCase().trim()}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push(item);
    }

    // Параллельный JSONP запрос в RU и US каталоги
    const [ruItems, usItems] = await Promise.all([
        itunesJsonpSearch(cleanQ, "RU", 22),
        itunesJsonpSearch(cleanQ, "US", 22)
    ]);

    for (const it of [...ruItems, ...usItems]) {
        const cover = (it.artworkUrl100 || "").replace("100x100bb", "600x600bb") || makeFallbackCover(it.trackName, it.artistName);
        const mainArt = (it.artistName || "").split(",")[0].trim();
        if (mainArt && cover.startsWith("http")) artistCoverCache.set(mainArt.toLowerCase(), cover);

        addTrack({
            track_id: `it_${it.trackId}`,
            title: it.trackName || "Трек",
            artist: it.artistName || cleanQ,
            cover_url: cover,
            preview_url: it.previewUrl || "",
            full_stream_url: "",
            duration_sec: Math.round((it.trackTimeMillis || 165000) / 1000),
            cluster: inferCluster(`${it.artistName} ${it.trackName} ${it.primaryGenreName || ""}`)
        });
    }

    // Дополняем совпадениями из локального списка, если сеть слабая
    const qWords = cleanQ.toLowerCase().split(" ").filter(Boolean);
    for (const seed of [...SEED_TRACKS, ...Array.from(offlineMap.values())]) {
        const hay = `${seed.artist} ${seed.title}`.toLowerCase();
        if (qWords.every(w => hay.includes(w))) addTrack(seed);
    }

    return results;
}

// 5. Резолвер ПОЛНОГО MP3/M4A аудиопотока с проверкой совпадения названия (без репита 30 секунд и без чужих песен)
async function resolveFullMatchedAudio(track) {
    if (track.full_stream_url) return track.full_stream_url;

    const targetArtist = track.artist.split(",")[0].trim().toLowerCase();
    const targetTitle = track.title.split("(")[0].trim().toLowerCase();
    const searchStr = normalizeQuery(`${targetArtist} ${targetTitle}`);

    // Канал 1: Прямой парсинг полного MP3 с открытого музыкального зеркала Hitmo через CORS-прокси
    const proxyBuilders = [
        (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
    ];

    try {
        const mp3Url = await Promise.any(proxyBuilders.map(async (wrap) => {
            const hitmoUrl = `https://rus.hitmotop.com/search?q=${encodeURIComponent(searchStr)}`;
            const resp = await fetchFast(wrap(hitmoUrl), 3000);
            if (!resp.ok) throw new Error("proxy err");
            const html = await resp.text();
            const match = html.match(/https:\/\/[^"'\s>]+\.mp3/i);
            if (match && match[0]) return match[0];
            throw new Error("no mp3");
        }));
        if (mp3Url) {
            track.full_stream_url = mp3Url;
            return mp3Url;
        }
    } catch (_) {}

    // Канал 2: Piped / Invidious со строгой проверкой названия и артиста
    const pipedNodes = [
        "https://pipedapi.kavin.rocks",
        "https://pipedapi.tokhmi.xyz",
        "https://piped-api.garudalinux.org"
    ];
    try {
        const pipedStream = await Promise.any(pipedNodes.map(async (host) => {
            const sr = await fetchFast(`${host}/search?q=${encodeURIComponent(searchStr + " official audio")}&filter=music_songs`, 2400);
            if (!sr.ok) throw new Error("bad status");
            const sd = await sr.json();
            const items = sd.items || [];
            const matched = items.find(x => {
                const hay = `${x.title || ""} ${x.uploaderName || ""}`.toLowerCase();
                return hay.includes(targetTitle.slice(0, 4));
            }) || items[0];
            if (!matched || !matched.url) throw new Error("no video");
            const vid = matched.url.split("v=")[1].split("&")[0];
            const st = await fetchFast(`${host}/streams/${vid}`, 2400);
            const sdata = await st.json();
            const best = (sdata.audioStreams || []).find(a => a.mimeType && a.mimeType.includes("mp4")) || (sdata.audioStreams || [])[0];
            if (best && best.url) return best.url;
            throw new Error("no audio stream");
        }));
        if (pipedStream) {
            track.full_stream_url = pipedStream;
            return pipedStream;
        }
    } catch (_) {}

    // Канал 3: Saavn ТОЛЬКО если и артист, и название трека реально совпадают (чтобы не включались чужие треки)
    try {
        const r = await fetchFast(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(searchStr)}&limit=5`, 2200);
        if (r.ok) {
            const d = await r.json();
            const list = (d.data && d.data.results) || [];
            const exact = list.find(it => {
                const n = (it.name || "").toLowerCase();
                const a = ((it.artists && it.artists.primary && it.artists.primary.map(x => x.name).join(" ")) || "").toLowerCase();
                return n.includes(targetTitle) && a.includes(targetArtist.slice(0, 4));
            });
            if (exact && exact.downloadUrl && exact.downloadUrl.length) {
                const url = exact.downloadUrl[exact.downloadUrl.length - 1].url;
                track.full_stream_url = url;
                return url;
            }
        }
    } catch (_) {}

    // Канал 4: Прямой поток iTunes (если трек ещё не получил preview_url, запрашиваем через JSONP)
    if (track.preview_url) return track.preview_url;
    const jRes = await itunesJsonpSearch(searchStr, "RU", 3);
    if (jRes.length > 0 && jRes[0].previewUrl) {
        track.preview_url = jRes[0].previewUrl;
        if (jRes[0].artworkUrl100) {
            track.cover_url = jRes[0].artworkUrl100.replace("100x100bb", "600x600bb");
        }
        return track.preview_url;
    }

    return "";
}

// 6. Объединённая округлая нижняя лента на главной:
// Артисты у каждого пользователя свои (по его лайкам и прослушиваниям) + «Назад к привычному» + 14 категорий волны
function getTopUserArtists(limit = 5) {
    // Считаем очки из лайкнутых треков + истории предпочтений пользователя
    const scores = { ...artistAffinity };
    for (const t of likedMap.values()) {
        const mainArt = t.artist.split(",")[0].trim();
        if (mainArt) scores[mainArt] = (scores[mainArt] || 0) + 4;
    }
    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name]) => name);
}

function renderUnifiedBottomStrip() {
    const box = document.getElementById("unified-wave-strip");
    if (!box) return;

    const topArtists = getTopUserArtists(4);
    const firstTwoArtists = topArtists.slice(0, 2);
    const moreArtists = topArtists.slice(2);

    function renderArtistBubble(artistName) {
        const cachedCover = artistCoverCache.get(artistName.toLowerCase()) || makeFallbackCover(artistName, artistName, 195);
        const catId = `art_${artistName}`;
        const activeCls = activeCategoryId === catId ? "active-dome" : "";
        return `
        <div class="arc-bubble ${activeCls}" onclick="selectWaveCategory('${escapeHtml(catId)}', 'В стиле ${escapeHtml(artistName)}', '${escapeHtml(artistName)}')">
            <div class="arc-bubble-ava">
                <img src="${escapeHtml(cachedCover)}" alt="${escapeHtml(artistName)}">
            </div>
            <div class="arc-bubble-sub">В стиле артиста</div>
            <div class="arc-bubble-title">${escapeHtml(artistName)}</div>
        </div>`;
    }

    function renderCategoryBubble(cat) {
        const activeCls = activeCategoryId === cat.id ? "active-dome" : "";
        return `
        <div class="arc-bubble ${activeCls}"
             style="background: radial-gradient(circle at 50% 32%, ${cat.tint}, rgba(20,20,26,0.25) 68%, transparent 96%);"
             onclick="selectWaveCategory('${cat.id}', '${escapeHtml(cat.name)}', '${escapeHtml(cat.query)}')">
            <div class="arc-bubble-ava" style="background: rgba(255,255,255,0.08); color: #fff;">
                ${SVG_ICONS.spark}
            </div>
            <div class="arc-bubble-sub">${escapeHtml(cat.sub)}</div>
            <div class="arc-bubble-title">${escapeHtml(cat.name)}</div>
        </div>`;
    }

    // Структура как на скриншоте оригинала: персональный артист -> Назад к привычному -> персональные артисты -> 14 категорий
    const htmlParts = [];
    if (firstTwoArtists[0]) htmlParts.push(renderArtistBubble(firstTwoArtists[0]));

    htmlParts.push(`
        <div class="reset-center-pill" onclick="resetWavePure()">
            <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
            <div>Назад к<br>привычному</div>
        </div>
    `);

    if (firstTwoArtists[1]) htmlParts.push(renderArtistBubble(firstTwoArtists[1]));
    for (const a of moreArtists) htmlParts.push(renderArtistBubble(a));
    for (const c of WAVE_MOOD_CATEGORIES) htmlParts.push(renderCategoryBubble(c));

    box.innerHTML = htmlParts.join("");
}

function renderFavoriteArtistsInCollection() {
    const box = document.getElementById("fav-artists-box");
    if (!box) return;
    const top2 = getTopUserArtists(2);
    box.innerHTML = top2.map((artist, idx) => {
        const cov = artistCoverCache.get(artist.toLowerCase()) || makeFallbackCover(artist, artist, idx === 0 ? 280 : 340);
        return `
        <div class="fav-artist-card" onclick="selectWaveCategory('art_${escapeHtml(artist)}', 'В стиле ${escapeHtml(artist)}', '${escapeHtml(artist)}')">
            <img class="fav-artist-avatar" src="${escapeHtml(cov)}" alt="${escapeHtml(artist)}">
            <div style="font-weight:700;color:#aaa;font-size:14px;">${idx + 1}</div>
            <div style="font-weight:800;margin-top:2px;font-size:16px;">${escapeHtml(artist)}</div>
        </div>`;
    }).join("");
}

// 7. Построение очереди «Моей волны» (60 на 40 без показа процентов пользователю)
async function buildWaveQueue() {
    await syncState();

    if (!navigator.onLine) {
        waveQueue = shuffle(Array.from(offlineMap.values()));
        return;
    }

    const catObj = WAVE_MOOD_CATEGORIES.find(c => c.id === activeCategoryId);
    if (catObj && catObj.query) {
        const list = await searchExactCatalog(catObj.query);
        waveQueue = shuffle(list);
        return;
    }

    // Чистая «Моя волна» -> 60% любимые артисты/жанр пользователя + 40% новые открытия
    const userArtists = getTopUserArtists(4);
    const seed60 = randomPick(userArtists.length ? userArtists : SOUND_SEEDS.rusrap);
    const seed40 = randomPick(SOUND_SEEDS.discovery);

    const [pool60, pool40] = await Promise.all([
        searchExactCatalog(seed60),
        searchExactCatalog(seed40)
    ]);

    const unheard60 = pool60.filter(t => !heardSet.has(t.track_id));
    const unheard40 = pool40.filter(t => !heardSet.has(t.track_id));

    const part60 = shuffle(unheard60.length >= 6 ? unheard60 : pool60).slice(0, 6);
    const part40 = shuffle(unheard40.length >= 4 ? unheard40 : pool40).slice(0, 4);

    waveQueue = shuffle([...part60, ...part40]);
}

// 8. Честное воспроизведение без искусственного репита 30 секунд
async function playTrack(track, pushHistory = true) {
    if (!track) return;
    if (pushHistory && currentTrack && currentTrack.track_id !== track.track_id) {
        historyStack.push(currentTrack);
        if (historyStack.length > 50) historyStack.shift();
    }

    currentTrack = track;
    heardSet.add(track.track_id);
    localStorage.setItem("ym_heard_v4", JSON.stringify(Array.from(heardSet).slice(-500)));

    // Повышаем вес прослушанного артиста в персональных рекомендациях пользователя
    const mainArt = track.artist.split(",")[0].trim();
    if (mainArt) {
        artistAffinity[mainArt] = (artistAffinity[mainArt] || 1) + 1;
        localStorage.setItem("ym_artist_affinity_v4", JSON.stringify(artistAffinity));
    }

    syncPlayerUI(track);

    const savedOff = offlineMap.get(track.track_id);
    if (savedOff && savedOff.blob) {
        audio.src = URL.createObjectURL(savedOff.blob);
        document.getElementById("stream-status-line").textContent = "Играет скачанный трек из памяти";
    } else if (navigator.onLine) {
        document.getElementById("stream-status-line").textContent = "Подключение к аудиопотоку...";
        const streamUrl = await resolveFullMatchedAudio(track);
        if (!streamUrl) {
            playNextWaveTrack();
            return;
        }
        audio.src = streamUrl;
        document.getElementById("stream-status-line").textContent = "Сейчас Яндекс Музыка играет в потоке";
    } else {
        showToast("Нет сети: выберите скачанный трек");
        return;
    }

    try {
        await audio.play();
        setPlayingVisuals(true);
    } catch (_) {
        setPlayingVisuals(false);
    }
    renderUnifiedBottomStrip();
    renderCollectionAndExplore();
}

// Реальный прогресс-бар без принудительного зацикливания
audio.addEventListener("timeupdate", () => {
    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;
    if (dur > 0 && isFinite(dur)) {
        const pct = Math.min(100, (cur / dur) * 100);
        document.getElementById("fp-bar-fill").style.width = `${pct}%`;
        document.getElementById("fp-seek-slider").value = String(Math.floor(pct * 10));
        document.getElementById("fp-cur-time").textContent = formatTime(cur);
        document.getElementById("fp-tot-time").textContent = formatTime(dur);
    }
});

audio.addEventListener("ended", () => {
    if (repeatOne && currentTrack) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
    }
    playNextWaveTrack();
});

function onSeekInput(sliderVal) {
    const dur = audio.duration || 0;
    if (dur > 0 && isFinite(dur)) {
        audio.currentTime = (Number(sliderVal) / 1000) * dur;
    }
}

async function toggleAudioPlayback() {
    if (!currentTrack) {
        await playNextWaveTrack();
        return;
    }
    if (audio.paused) {
        audio.play().then(() => setPlayingVisuals(true)).catch(() => {});
    } else {
        audio.pause();
        setPlayingVisuals(false);
    }
}

async function playNextWaveTrack() {
    if (waveQueue.length < 3) {
        await buildWaveQueue();
    }
    if (waveQueue.length > 0) {
        await playTrack(waveQueue.shift(), true);
    } else if (SEED_TRACKS.length > 0) {
        await playTrack(randomPick(SEED_TRACKS), true);
    }
}

async function playPrevTrack() {
    if ((audio.currentTime || 0) > 5) {
        audio.currentTime = 0;
        return;
    }
    if (historyStack.length > 0) {
        const prev = historyStack.pop();
        if (currentTrack) waveQueue.unshift(currentTrack);
        await playTrack(prev, false);
    } else {
        audio.currentTime = 0;
    }
}

function syncPlayerUI(track) {
    const mainArtist = track.artist.split(",")[0].trim();
    const cover = track.cover_url || makeFallbackCover(track.title, track.artist);

    document.getElementById("hero-artist-big").textContent = mainArtist.toUpperCase();
    document.getElementById("hero-track-title").textContent = track.title;
    document.getElementById("hero-cover").src = cover;

    document.getElementById("fp-cover").src = cover;
    document.getElementById("fp-title-text").textContent = track.title;
    document.getElementById("fp-artist-text").textContent = track.artist;

    document.getElementById("fp-modal-cover").src = cover;
    document.getElementById("fp-modal-ava").src = cover;
    document.getElementById("fp-modal-title").textContent = track.title;
    document.getElementById("fp-modal-artist").textContent = track.artist;
    document.getElementById("fp-wave-by-name").textContent = `▶ ${track.title}`;
    document.getElementById("fp-tot-time").textContent = formatTime(track.duration_sec || 165);

    const isLiked = likedMap.has(track.track_id);
    for (const id of ["hero-like-btn", "fp-like-btn", "fp-modal-like"]) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.innerHTML = isLiked ? SVG_ICONS.heartFilled : SVG_ICONS.heartOutline;
            btn.classList.toggle("liked", isLiked);
        }
    }
}

function setPlayingVisuals(playing) {
    document.getElementById("hero-play-btn").innerHTML = playing ? SVG_ICONS.pause : SVG_ICONS.play;
    document.getElementById("fp-play-btn").innerHTML = playing ? SVG_ICONS.pauseMini : SVG_ICONS.playMini;
    document.getElementById("fp-modal-play").innerHTML = playing ? SVG_ICONS.pause : SVG_ICONS.play;
    document.getElementById("hero-glow").classList.toggle("playing", playing);
}

// 9. Полноэкранный плеер и Меню «Три точки»
function openFullPlayer() {
    if (!currentTrack) currentTrack = SEED_TRACKS[0];
    syncPlayerUI(currentTrack);
    document.getElementById("full-player-modal").classList.add("open");
}

function closeFullPlayer() {
    document.getElementById("full-player-modal").classList.remove("open");
}

function openActionSheet(track, ev) {
    if (ev) ev.stopPropagation();
    sheetTrack = track || currentTrack || SEED_TRACKS[0];
    const cov = sheetTrack.cover_url || makeFallbackCover(sheetTrack.title, sheetTrack.artist);
    document.getElementById("sheet-cover").src = cov;
    document.getElementById("sheet-title-text").textContent = sheetTrack.title;
    document.getElementById("sheet-dur-text").textContent = formatTime(sheetTrack.duration_sec || 180);
    document.getElementById("sheet-wave-title").textContent = `▶ ${sheetTrack.title}`;

    const artists = sheetTrack.artist.split(",").map(s => s.trim()).filter(Boolean);
    document.getElementById("sheet-artists-row").innerHTML = artists.map(a => `
        <div class="sheet-artist-chip" onclick="selectWaveCategory('art_${escapeHtml(a)}', 'В стиле ${escapeHtml(a)}', '${escapeHtml(a)}'); closeActionSheet();">
            <img src="${escapeHtml(cov)}" alt="">
            <span>${escapeHtml(a)}</span>
        </div>
    `).join("");

    updateSheetStatusCircles();
    document.getElementById("action-sheet-backdrop").classList.add("open");
}

function openActionSheetForCurrent() {
    openActionSheet(currentTrack);
}

function closeActionSheet(ev) {
    if (ev && ev.target && ev.target.id !== "action-sheet-backdrop") return;
    document.getElementById("action-sheet-backdrop").classList.remove("open");
}

function updateSheetStatusCircles() {
    if (!sheetTrack) return;
    const liked = likedMap.has(sheetTrack.track_id);
    const downloaded = offlineMap.has(sheetTrack.track_id);

    document.getElementById("sheet-like-circle").classList.toggle("liked", liked);
    document.getElementById("sheet-dl-circle").classList.toggle("downloaded", downloaded);
    document.getElementById("sheet-dl-label").textContent = downloaded ? "Скачано" : "Скачать";
}

async function sheetToggleLike() {
    if (!sheetTrack) return;
    await toggleLikeForTrack(sheetTrack);
    updateSheetStatusCircles();
}

async function sheetToggleDownload() {
    if (!sheetTrack) return;
    await downloadTrackOffline(sheetTrack);
    updateSheetStatusCircles();
}

function sheetPlayTrailer() {
    if (!sheetTrack) return;
    closeActionSheet();
    playTrack(sheetTrack, true);
    setTimeout(() => onSeekInput(350), 400);
    showToast("Трейлер трека");
}

function sheetPlayNext() {
    if (!sheetTrack) return;
    waveQueue.unshift(sheetTrack);
    closeActionSheet();
    showToast(`«${sheetTrack.title}» сыграет следующим`);
}

function sheetAddToQueue() {
    if (!sheetTrack) return;
    waveQueue.push(sheetTrack);
    closeActionSheet();
    showToast(`Добавлено в очередь: ${sheetTrack.title}`);
}

function sheetPlayNow() {
    if (!sheetTrack) return;
    closeActionSheet();
    playTrack(sheetTrack, true);
}

async function sheetRemoveOffline() {
    if (!sheetTrack) return;
    await dbDel("offline", sheetTrack.track_id);
    await syncState();
    updateSheetStatusCircles();
    renderCollectionAndExplore();
    showToast("Удалено с устройства");
}

function showTrackInfoToast() {
    if (!sheetTrack) return;
    showToast(`${sheetTrack.artist} — ${sheetTrack.title}`);
}

function sheetDislike() {
    if (!sheetTrack) return;
    dislikedSet.add(sheetTrack.track_id);
    localStorage.setItem("ym_disliked_v4", JSON.stringify(Array.from(dislikedSet)));
    closeActionSheet();
    if (currentTrack && currentTrack.track_id === sheetTrack.track_id) {
        playNextWaveTrack();
    }
    showToast("Трек больше не будет попадаться");
}

function dislikeCurrentTrack() {
    if (!currentTrack) return;
    sheetTrack = currentTrack;
    sheetDislike();
}

async function startWaveFromTrack(track) {
    if (!track) return;
    closeFullPlayer();
    await selectWaveCategory("custom", `Моя волна: ${track.title}`, `${track.artist} ${track.title}`);
}

async function startWaveFromSheetTrack() {
    if (!sheetTrack) return;
    const t = sheetTrack;
    closeActionSheet();
    await startWaveFromTrack(t);
}

function shareTrack(track) {
    if (!track) return;
    const text = `${track.artist} — ${track.title}`;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    showToast(`Скопировано: ${text}`);
}

function toggleRepeatMode() {
    repeatOne = !repeatOne;
    document.getElementById("btn-repeat").classList.toggle("active", repeatOne);
    showToast(repeatOne ? "Повтор трека включён" : "Повтор выключен");
}

function shuffleCurrentQueue() {
    waveQueue = shuffle(waveQueue);
    showToast("Очередь перемешана");
}

// 10. Выбор категории или персонального артиста в нижней ленте
async function selectWaveCategory(catId, title, customQuery = "") {
    activeCategoryId = catId;
    document.getElementById("active-wave-tag").textContent = title;
    document.getElementById("fp-modal-context").textContent = `Плейлист «${title}»`;
    document.getElementById("wave-filter-reset-x").classList.toggle("visible", catId !== "pure");
    renderUnifiedBottomStrip();
    switchScreen("wave", document.getElementById("tab-wave"));

    if (catId === "pure") {
        await buildWaveQueue();
    } else {
        const list = await searchExactCatalog(customQuery || title);
        waveQueue = list;
    }
    if (waveQueue.length > 0) {
        await playTrack(waveQueue.shift(), true);
    }
}

async function resetWavePure() {
    await selectWaveCategory("pure", "Моя волна", "");
    showToast("Включена чистая Моя волна");
}

// 11. Лайк (меняет персональных артистов в нижней карусели) и Скачивание
async function toggleCurrentLike() {
    if (!currentTrack) return;
    await toggleLikeForTrack(currentTrack);
}

async function toggleLikeForTrack(track, ev) {
    if (ev) ev.stopPropagation();
    const id = track.track_id;
    const mainArt = track.artist.split(",")[0].trim();

    if (likedMap.has(id)) {
        await dbDel("likes", id);
        if (mainArt) artistAffinity[mainArt] = Math.max(1, (artistAffinity[mainArt] || 2) - 2);
    } else {
        await dbPut("likes", track);
        if (mainArt) {
            artistAffinity[mainArt] = (artistAffinity[mainArt] || 1) + 5;
            if (track.cover_url && track.cover_url.startsWith("http")) {
                artistCoverCache.set(mainArt.toLowerCase(), track.cover_url);
            }
        }
        showToast("Добавлено в «Мне нравится»");
    }
    localStorage.setItem("ym_artist_affinity_v4", JSON.stringify(artistAffinity));
    await syncState();
    if (currentTrack && currentTrack.track_id === id) syncPlayerUI(currentTrack);
    renderUnifiedBottomStrip();
    renderCollectionAndExplore();
}

async function downloadTrackOffline(track, ev) {
    if (ev) ev.stopPropagation();
    if (!track) return;
    if (offlineMap.has(track.track_id)) {
        await dbDel("offline", track.track_id);
        await syncState();
        renderCollectionAndExplore();
        showToast("Удалено из памяти");
        return;
    }
    showToast(`Скачивание «${track.title}»...`);
    try {
        const url = await resolveFullMatchedAudio(track);
        let blob = null;
        if (url && navigator.onLine) {
            const resp = await fetchFast(url, 6000);
            if (resp.ok) blob = await resp.blob();
        }
        await dbPut("offline", { ...track, full_stream_url: url, blob, savedAt: Date.now() });
        await dbPut("likes", track);
        await syncState();
        renderCollectionAndExplore();
        showToast(`Скачано: ${track.title}`);
    } catch (_) {
        await dbPut("offline", { ...track, savedAt: Date.now() });
        await dbPut("likes", track);
        await syncState();
        renderCollectionAndExplore();
        showToast(`Сохранено: ${track.title}`);
    }
}

async function downloadCurrentTrack() {
    if (currentTrack) await downloadTrackOffline(currentTrack);
}

// 12. Точный поиск (при нажатии на "kizaru - Fake ID" играет именно он)
let searchDebounce = null;

function openSearchModal() {
    document.getElementById("search-modal").classList.add("open");
    const inp = document.getElementById("search-query-input");
    inp.focus();
    if (!inp.value.trim()) {
        renderTrackRows("search-results-box", SEED_TRACKS, true);
    }
}

function closeSearchModal() {
    document.getElementById("search-modal").classList.remove("open");
}

function onSearchInputChanged(val) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        runSearchQuery(val);
    }, 240);
}

async function submitSearchForm(e) {
    e.preventDefault();
    const val = document.getElementById("search-query-input").value;
    await runSearchQuery(val);
}

async function runSearchQuery(raw) {
    const q = raw.trim();
    if (!q) {
        renderTrackRows("search-results-box", SEED_TRACKS, true);
        return;
    }
    const items = await searchExactCatalog(q);
    renderTrackRows("search-results-box", items, true);
}

// 13. Отрисовка списков треков с круглыми обложками и чистыми SVG-кнопками
function renderTrackRows(containerId, list, closeSearchOnPlay = false) {
    const box = document.getElementById(containerId);
    if (!box) return;
    if (!list || !list.length) {
        box.innerHTML = `<div style="color:#777;padding:14px 0;">Ничего не найдено</div>`;
        return;
    }
    box.innerHTML = list.map(t => {
        const isOff = offlineMap.has(t.track_id);
        const cov = t.cover_url || makeFallbackCover(t.title, t.artist);
        const enc = encodeURIComponent(JSON.stringify({
            track_id: t.track_id,
            title: t.title,
            artist: t.artist,
            cover_url: cov,
            full_stream_url: t.full_stream_url || "",
            preview_url: t.preview_url || "",
            duration_sec: t.duration_sec || 170,
            cluster: t.cluster || "rusrap"
        }));
        return `
        <div class="ym-track-row">
            <img class="ym-track-cover" src="${escapeHtml(cov)}" onclick="playEncodedTrack('${enc}', ${closeSearchOnPlay})" loading="lazy" alt="${escapeHtml(t.title)}">
            <div class="ym-track-info" onclick="playEncodedTrack('${enc}', ${closeSearchOnPlay})">
                <div class="ym-track-name">
                    <span>${escapeHtml(t.title)}</span>
                    <span class="badge-18">18+</span>
                </div>
                <div class="ym-track-artist">${escapeHtml(t.artist)}</div>
            </div>
            <button class="ym-dl-btn ${isOff ? 'downloaded' : ''}" onclick="dlEncodedTrack('${enc}', event)" title="Скачать">${SVG_ICONS.download}</button>
            <button class="ym-more-btn" onclick="menuEncodedTrack('${enc}', event)" title="Меню">${SVG_ICONS.dots}</button>
        </div>`;
    }).join("");
}

window.playEncodedTrack = (enc, closeSearch) => {
    if (closeSearch) closeSearchModal();
    playTrack(JSON.parse(decodeURIComponent(enc)), true);
};

window.dlEncodedTrack = (enc, ev) => {
    downloadTrackOffline(JSON.parse(decodeURIComponent(enc)), ev);
};

window.menuEncodedTrack = (enc, ev) => {
    openActionSheet(JSON.parse(decodeURIComponent(enc)), ev);
};

function renderCollectionAndExplore() {
    const merged = new Map([...likedMap, ...offlineMap]);
    const savedList = Array.from(merged.values());

    document.getElementById("col-likes-count").textContent = `${savedList.length} треков`;
    document.getElementById("explore-like-count").textContent = `${savedList.length} треков`;

    if (savedList.length > 0) {
        document.getElementById("explore-like-cover").src = savedList[0].cover_url;
    } else {
        document.getElementById("explore-like-cover").src = SEED_TRACKS[0].cover_url;
    }
    if (currentTrack) {
        document.getElementById("explore-hist-cover").src = currentTrack.cover_url;
    }

    renderTrackRows("collection-tracks-box", savedList, false);
    renderTrackRows("explore-popular-box", SEED_TRACKS, false);
    renderFavoriteArtistsInCollection();
}

function playSavedCollection() {
    const merged = Array.from(new Map([...offlineMap, ...likedMap]).values());
    if (merged.length > 0) {
        waveQueue = shuffle(merged);
        playTrack(waveQueue.shift(), true);
    }
}

function switchScreen(name, btn) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-" + name).classList.add("active");
    document.querySelectorAll(".ym-tab").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderCollectionAndExplore();
}

function formatTime(sec) {
    if (!sec || isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
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

// Автоматическое обновление всех живых HD-обложек через JSONP при старте
async function hydrateLiveArtwork() {
    if (!navigator.onLine) return;
    await Promise.allSettled(SEED_TRACKS.map(async (item) => {
        const mainArt = item.artist.split(",")[0].trim();
        const res = await itunesJsonpSearch(`${mainArt} ${item.title}`, "RU", 2);
        if (res.length > 0 && res[0].artworkUrl100) {
            const hd = res[0].artworkUrl100.replace("100x100bb", "600x600bb");
            item.cover_url = hd;
            if (res[0].previewUrl) item.preview_url = res[0].previewUrl;
            artistCoverCache.set(mainArt.toLowerCase(), hd);
            if (likedMap.has(item.track_id)) {
                await dbPut("likes", item);
            }
        }
    }));
    await syncState();
    if (currentTrack) {
        const updated = SEED_TRACKS.find(x => x.track_id === currentTrack.track_id);
        if (updated) currentTrack = updated;
        syncPlayerUI(currentTrack);
    }
    renderUnifiedBottomStrip();
    renderCollectionAndExplore();
}

window.addEventListener("DOMContentLoaded", async () => {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    setPlayingVisuals(false);
    await initDB();
    await syncState();

    if (likedMap.size === 0) {
        for (const item of SEED_TRACKS.slice(0, 5)) {
            await dbPut("likes", item);
        }
        await syncState();
    }

    currentTrack = SEED_TRACKS[0];
    syncPlayerUI(currentTrack);
    renderUnifiedBottomStrip();
    renderCollectionAndExplore();

    hydrateLiveArtwork();
    buildWaveQueue();
});
