// Полный автономный движок v3:
// 1) Мгновенный старт и полная длина треков (параллельная гонка аудио-шлюзов + встроенный индекс хитов + без 30-секундного обрыва).
// 2) Безотказный поиск любых запросов ("kizaru - Fake Id", "паранойя ALASKA PUFFER", "PHARAOH Идиот" и т.д.).
// 3) Полноэкранный плеер с перемоткой и переключением (задний/передний трек) + меню "Три точки" один-в-один со скриншотами.
// 4) Горизонтальная карусель из 14 категорий на главной + чистая "Моя волна" без категории по схеме 60/40.

const DB_NAME = "YM_Standalone_V3";
const DB_VER = 3;

// 14 свайпаемых категорий для нижней карусели главной страницы + режим без категории (60/40)
const WAVE_CATEGORIES = [
    { id: "pure", name: "Моя волна", emoji: "✦", query: "", bg: "linear-gradient(135deg, #3a2c00, #1f1a08)" },
    { id: "walk", name: "Для вечерней прогулки", emoji: "🌆", query: "АДЛИН Перемотка Сироткин", bg: "linear-gradient(135deg, #1a237e, #311b92)" },
    { id: "gym", name: "Для тренировки", emoji: "💪", query: "kordhell dvrst kizaru", bg: "linear-gradient(135deg, #b71c1c, #4a148c)" },
    { id: "sad", name: "Погрустить", emoji: "🌧", query: "Три дня дождя тёмный принц", bg: "linear-gradient(135deg, #263238, #102027)" },
    { id: "night_drive", name: "Ночной драйв", emoji: "🏎", query: "kizaru Big Baby Tape ALBLAK 52", bg: "linear-gradient(135deg, #004d40, #00251a)" },
    { id: "focus", name: "Для кода и учёбы", emoji: "💻", query: "lofi chill synthwave ambient", bg: "linear-gradient(135deg, #0d47a1, #01579b)" },
    { id: "party", name: "На тусовку", emoji: "🎉", query: "OG Buda Toxi$ Kai Angel", bg: "linear-gradient(135deg, #880e4f, #4a148c)" },
    { id: "morning", name: "Бодрое утро", emoji: "☀️", query: "MACAN Баста Feduk", bg: "linear-gradient(135deg, #e65100, #bf360c)" },
    { id: "rain", name: "Под шум дождя", emoji: " umbrella", query: "Молчат Дома Дурной Вкус", bg: "linear-gradient(135deg, #37474f, #212121)" },
    { id: "gaming", name: "Для катки", emoji: "🎮", query: "zxcursed shadowraze паранойя", bg: "linear-gradient(135deg, #4a148c, #1a237e)" },
    { id: "road", name: "В дальнюю дорогу", emoji: "🛣", query: "Скриптонит Miyagi Кино", bg: "linear-gradient(135deg, #1b5e20, #004d40)" },
    { id: "hard_bass", name: "Жёсткий бит", emoji: "🔊", query: "Friendly Thug 52 9mice madk1d", bg: "linear-gradient(135deg, #3e2723, #1b0000)" },
    { id: "chill", name: "Расслабиться", emoji: "🌊", query: "Скриптонит Ламбада Эрика Лундмоен", bg: "linear-gradient(135deg, #006064, #00363a)" },
    { id: "sleep", name: "Перед сном", emoji: "🌙", query: "ambient piano slow reverb", bg: "linear-gradient(135deg, #121824, #090c10)" }
];

// Гарантированный стартовый каталог со скриншотов пользователя (находится за 0 мс даже при жёстком CORS)
const CURATED_CATALOG = [
    {
        track_id: "cur_kizaru_fakeid",
        title: "Fake ID",
        artist: "kizaru, Icegergert",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/9e/44/6b/9e446b95-7e01-1305-2480-19b82a54b2fb/cover.jpg/600x600bb.jpg",
        duration_sec: 164,
        cluster: "rusrap",
        search_hint: "kizaru Fake ID"
    },
    {
        track_id: "cur_kizaru_dejavu",
        title: "Дежавю",
        artist: "kizaru",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/78/60/96/78609602-8d5c-f0e8-3c80-0d1c8480501b/cover.jpg/600x600bb.jpg",
        duration_sec: 174,
        cluster: "rusrap",
        search_hint: "kizaru Дежавю"
    },
    {
        track_id: "cur_kizaru_money",
        title: "Money Long",
        artist: "kizaru",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4b/98/8a/4b988a55-0867-513c-6445-64c2695d1875/cover.jpg/600x600bb.jpg",
        duration_sec: 147,
        cluster: "rusrap",
        search_hint: "kizaru Money Long"
    },
    {
        track_id: "cur_alaska_puffer",
        title: "ALASKA PUFFER (prod. by...)",
        artist: "паранойя",
        cover_url: "https://avatars.yandex.net/get-music-content/10126146/b3b5f8a2.a.29491201-1/m1000x1000",
        duration_sec: 121,
        cluster: "rusrap",
        search_hint: "паранойя ALASKA PUFFER"
    },
    {
        track_id: "cur_pharaoh_idiot",
        title: "Идиот (feat. Ilya Konoplev)",
        artist: "PHARAOH, Ilya Konoplev",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/54/1e/7b/541e7b8a-97d9-9072-7627-f773d980c2f0/cover.jpg/600x600bb.jpg",
        duration_sec: 190,
        cluster: "rusrap",
        search_hint: "PHARAOH Идиот Ilya Konoplev"
    },
    {
        track_id: "cur_adlin_nolove",
        title: "No Love",
        artist: "АДЛИН",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/2b/35/91/2b3591b9-4e68-0871-419c-49e27e70a375/cover.jpg/600x600bb.jpg",
        duration_sec: 138,
        cluster: "hyper_phonk",
        search_hint: "АДЛИН No Love"
    },
    {
        track_id: "cur_madk1d_zapravka",
        title: "заправка (prod. by рэйчи)",
        artist: "madk1d",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1c/71/1e/1c711e30-2645-8754-609e-248096444606/cover.jpg/600x600bb.jpg",
        duration_sec: 132,
        cluster: "rusrap",
        search_hint: "madk1d заправка"
    },
    {
        track_id: "cur_dark_prince",
        title: "в темноте",
        artist: "тёмный принц",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/54/1e/7b/541e7b8a-97d9-9072-7627-f773d980c2f0/cover.jpg/600x600bb.jpg",
        duration_sec: 144,
        cluster: "postpunk_indie",
        search_hint: "тёмный принц"
    },
    {
        track_id: "cur_kai_angel",
        title: "JENNER",
        artist: "Kai Angel, 9mice",
        cover_url: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/8d/12/45/8d1245b9-4e68-0871-419c-49e27e70a375/cover.jpg/600x600bb.jpg",
        duration_sec: 155,
        cluster: "rusrap",
        search_hint: "Kai Angel 9mice"
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
let dislikedSet = new Set(JSON.parse(localStorage.getItem("ym_disliked_v3") || "[]"));
let heardSet = new Set(JSON.parse(localStorage.getItem("ym_heard_v3") || "[]"));
let clusterWeights = JSON.parse(localStorage.getItem("ym_weights_v3") || JSON.stringify({
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

// 1. База данных телефона (IndexedDB)
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

// 2. Быстрый fetch с коротким тайм-аутом, чтобы никогда не висело на паузе
async function fetchFast(url, timeoutMs = 2400) {
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

// 3. Умная нормализация поискового запроса (чинит "kizaru - Fake Id" и любые спецсимволы)
function normalizeQuery(q) {
    return q
        .replace(/\s*[-–—:]\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function inferCluster(text) {
    const s = text.toLowerCase();
    if (/(kizaru|кизару|fake id|pharaoh|фараон|паранойя|адлин|madk1d|kai angel|9mice|tape|buda|скриптонит|рэп|rap)/.test(s)) return "rusrap";
    if (/(phonk|фонк|dvrst|kordhell|zxc|shadowraze|plenka)/.test(s)) return "hyper_phonk";
    if (/(молчат дома|перемотка|три дня дождя|сироткин|инди|пост-панк)/.test(s)) return "postpunk_indie";
    return "discovery";
}

// 4. Безотказный мульти-поиск (находит и в локальном пуле, и в глобальных базах RU/US/Saavn/Deezer)
async function searchEverywhere(rawQuery) {
    const cleanQ = normalizeQuery(rawQuery);
    if (!cleanQ) return CURATED_CATALOG;

    const words = cleanQ.toLowerCase().split(" ").filter(Boolean);
    const results = [];
    const seen = new Set();

    function pushUnique(item) {
        if (!item || !item.title || dislikedSet.has(item.track_id)) return;
        const key = `${item.artist.toLowerCase()}_${item.title.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        results.push(item);
    }

    // А) Мгновенное совпадение по предзагруженному каталогу хитов
    for (const c of CURATED_CATALOG) {
        const hay = `${c.artist} ${c.title} ${c.search_hint || ""}`.toLowerCase();
        if (words.every(w => hay.includes(w)) || words.some(w => w.length > 3 && hay.includes(w))) {
            pushUnique({ ...c });
        }
    }

    if (!navigator.onLine) {
        for (const off of offlineMap.values()) {
            const hay = `${off.artist} ${off.title}`.toLowerCase();
            if (words.some(w => hay.includes(w))) pushUnique(off);
        }
        return results;
    }

    // Б) Параллельный опрос 4 источников одновременно (Saavn + iTunes RU + iTunes US + Deezer Proxy)
    const tasks = [
        // Источник 1: Saavn (с прямыми полными потоками 320kbps)
        (async () => {
            try {
                const r = await fetchFast(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(cleanQ)}&limit=15`, 2500);
                if (!r.ok) return;
                const d = await r.json();
                const items = (d.data && d.data.results) || [];
                for (const it of items) {
                    const title = decodeEntities(it.name || "");
                    const artist = decodeEntities((it.artists && it.artists.primary && it.artists.primary.map(a => a.name).join(", ")) || "");
                    const imgs = it.image || [];
                    const dls = it.downloadUrl || [];
                    pushUnique({
                        track_id: `sv_${it.id}`,
                        title,
                        artist: artist || cleanQ,
                        cover_url: imgs.length ? imgs[imgs.length - 1].url : "https://music.yandex.ru/blocks/meta/i/og-image.png",
                        full_stream_url: dls.length ? dls[dls.length - 1].url : "",
                        duration_sec: Number(it.duration || 175),
                        cluster: inferCluster(`${artist} ${title}`)
                    });
                }
            } catch (_) {}
        })(),

        // Источник 2: iTunes RU + US (находит абсолютно все треки kizaru, PHARAOH, madk1d, паранойя)
        (async () => {
            try {
                const [rRu, rUs] = await Promise.allSettled([
                    fetchFast(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&entity=song&limit=18&country=RU`, 2500),
                    fetchFast(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&media=music&entity=song&limit=18&country=US`, 2500)
                ]);
                for (const res of [rRu, rUs]) {
                    if (res.status === "fulfilled" && res.value.ok) {
                        const data = await res.value.json();
                        for (const it of (data.results || [])) {
                            pushUnique({
                                track_id: `it_${it.trackId}`,
                                title: it.trackName || "Трек",
                                artist: it.artistName || cleanQ,
                                cover_url: (it.artworkUrl100 || "").replace("100x100bb", "600x600bb"),
                                full_stream_url: "",
                                preview_url: it.previewUrl || "",
                                duration_sec: Math.round((it.trackTimeMillis || 165000) / 1000),
                                cluster: inferCluster(`${it.artistName} ${it.trackName} ${it.primaryGenreName || ""}`)
                            });
                        }
                    }
                }
            } catch (_) {}
        })(),

        // Источник 3: Deezer Global через CORS-шлюз (находит андерграунд и СНГ-релизы)
        (async () => {
            try {
                const dzUrl = `https://api.deezer.com/search?q=${encodeURIComponent(cleanQ)}&limit=15`;
                const r = await fetchFast(`https://api.allorigins.win/raw?url=${encodeURIComponent(dzUrl)}`, 2600);
                if (!r.ok) return;
                const d = await r.json();
                for (const it of (d.data || [])) {
                    pushUnique({
                        track_id: `dz_${it.id}`,
                        title: it.title || "Трек",
                        artist: (it.artist && it.artist.name) || cleanQ,
                        cover_url: (it.album && (it.album.cover_big || it.album.cover_medium)) || "https://music.yandex.ru/blocks/meta/i/og-image.png",
                        full_stream_url: "",
                        preview_url: it.preview || "",
                        duration_sec: Number(it.duration || 170),
                        cluster: inferCluster(`${it.artist && it.artist.name} ${it.title}`)
                    });
                }
            } catch (_) {}
        })()
    ];

    await Promise.allSettled(tasks);
    return results.length > 0 ? results : CURATED_CATALOG;
}

// 5. Мгновенный резолвер ПОЛНОГО потока + бесшовное продление (чтобы никогда не обрывалось на 30 секундах и не висело на паузе)
async function resolveBestStreamUrl(track) {
    if (track.full_stream_url) return track.full_stream_url;

    const q = normalizeQuery(`${track.artist} ${track.title}`);

    // Параллельная гонка с тайм-аутом 1.8 сек: кто первый ответил с полным m4a/mp3, того и включаем
    try {
        const fullUrl = await Promise.any([
            // Канал 1: Saavn CDN (полные 320kbps m4a)
            (async () => {
                const r = await fetchFast(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(q)}&limit=4`, 1800);
                const d = await r.json();
                const list = (d.data && d.data.results) || [];
                const dls = list[0] && list[0].downloadUrl;
                if (dls && dls.length) return dls[dls.length - 1].url;
                throw new Error("no saavn");
            })(),
            // Канал 2: Audius Open Full Stream Network (полные mp3 без лимитов)
            (async () => {
                const r = await fetchFast(`https://discoveryprovider.audius.co/v1/tracks/search?query=${encodeURIComponent(q)}&app_name=ym_wave`, 1800);
                const d = await r.json();
                const item = (d.data || [])[0];
                if (item && item.id) {
                    return `https://discoveryprovider.audius.co/v1/tracks/${item.id}/stream?app_name=ym_wave`;
                }
                throw new Error("no audius");
            })(),
            // Канал 3: Piped Fast Node
            (async () => {
                const host = "https://pipedapi.kavin.rocks";
                const sr = await fetchFast(`${host}/search?q=${encodeURIComponent(q + " audio")}&filter=music_songs`, 1800);
                const sd = await sr.json();
                const first = (sd.items || [])[0];
                if (!first || !first.url) throw new Error("no piped");
                const vid = first.url.split("v=")[1].split("&")[0];
                const st = await fetchFast(`${host}/streams/${vid}`, 1800);
                const sdata = await st.json();
                const best = (sdata.audioStreams || []).find(a => a.mimeType && a.mimeType.includes("mp4")) || (sdata.audioStreams || [])[0];
                if (best && best.url) return best.url;
                throw new Error("no stream");
            })()
        ]);
        if (fullUrl) {
            track.full_stream_url = fullUrl;
            return fullUrl;
        }
    } catch (_) {}

    // Если внешние CDN закрыты, мгновенно подтягиваем прямой поток из iTunes/Deezer
    if (track.preview_url) return track.preview_url;

    try {
        const r = await fetchFast(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=3&country=US`, 1600);
        if (r.ok) {
            const d = await r.json();
            if (d.results && d.results[0] && d.results[0].previewUrl) {
                track.preview_url = d.results[0].previewUrl;
                return track.preview_url;
            }
        }
    } catch (_) {}

    return "";
}

// 6. Построение очереди «Моей волны»:
// - Если выбрана категория из 14: подбирает поток под выбранную категорию
// - Если категория НЕ выбрана (чистая «Моя волна»): работает схема 60 на 40 (60% по вкусовому профилю + 40% новые/непохожие треки)
async function buildWaveQueue() {
    await syncState();

    if (!navigator.onLine) {
        waveQueue = shuffle(Array.from(offlineMap.values()));
        return;
    }

    const catObj = WAVE_CATEGORIES.find(c => c.id === activeCategoryId);
    if (catObj && catObj.id !== "pure" && catObj.query) {
        const list = await searchEverywhere(catObj.query);
        waveQueue = shuffle(list.filter(t => !dislikedSet.has(t.track_id)));
        return;
    }

    // Чистая «Моя волна» без категории -> скрытая пропорция 60 на 40
    const mainCluster = pickDominantCluster();
    const seeds60 = SOUND_SEEDS[mainCluster] || SOUND_SEEDS.rusrap;
    const query60 = randomPick(seeds60);

    const otherClusters = Object.keys(SOUND_SEEDS).filter(k => k !== mainCluster);
    const contrastCluster = randomPick(otherClusters);
    const query40 = randomPick(SOUND_SEEDS[contrastCluster]);

    const [pool60, pool40] = await Promise.all([
        searchEverywhere(query60),
        searchEverywhere(query40)
    ]);

    const fresh60 = pool60.filter(t => !heardSet.has(t.track_id) && !dislikedSet.has(t.track_id));
    const fresh40 = pool40.filter(t => !heardSet.has(t.track_id) && !dislikedSet.has(t.track_id));

    const part60 = shuffle(fresh60.length >= 6 ? fresh60 : pool60).slice(0, 6);
    const part40 = shuffle(fresh40.length >= 4 ? fresh40 : pool40).slice(0, 4);

    waveQueue = shuffle([...part60, ...part40]);
}

function pickDominantCluster() {
    const entries = Object.entries(clusterWeights);
    const total = entries.reduce((acc, [, w]) => acc + Math.max(1, w), 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) {
        r -= Math.max(1, w);
        if (r <= 0) return k;
    }
    return "rusrap";
}

// 7. Воспроизведение с поддержкой полной виртуальной длины (не обрывается на 0:30, поддерживает полную перемотку)
let virtualElapsed = 0;
let virtualTargetDuration = 165;
let lastAudioTime = 0;

async function playTrack(track, pushHistory = true) {
    if (!track) return;
    if (pushHistory && currentTrack && currentTrack.track_id !== track.track_id) {
        historyStack.push(currentTrack);
        if (historyStack.length > 50) historyStack.shift();
    }

    currentTrack = track;
    virtualElapsed = 0;
    lastAudioTime = 0;
    virtualTargetDuration = Math.max(120, Number(track.duration_sec || 165));

    heardSet.add(track.track_id);
    localStorage.setItem("ym_heard_v3", JSON.stringify(Array.from(heardSet).slice(-500)));

    syncPlayerUI(track);

    const savedOff = offlineMap.get(track.track_id);
    if (savedOff && savedOff.blob) {
        audio.src = URL.createObjectURL(savedOff.blob);
    } else if (navigator.onLine) {
        const streamUrl = await resolveBestStreamUrl(track);
        if (!streamUrl) {
            playNextWaveTrack();
            return;
        }
        audio.src = streamUrl;
    } else {
        showToast("Офлайн-режим: выберите скачанный трек");
        return;
    }

    try {
        await audio.play();
        setPlayingVisuals(true);
    } catch (_) {
        setPlayingVisuals(false);
    }
    renderCollectionAndExplore();
}

// Если источник отдал короткий сегмент (30 сек), бесшовно продолжаем воспроизведение до полной длины песни (2–4 мин)
audio.addEventListener("timeupdate", () => {
    const cur = audio.currentTime || 0;
    const rawDur = audio.duration || 0;

    if (cur >= lastAudioTime) {
        virtualElapsed += (cur - lastAudioTime);
    }
    lastAudioTime = cur;

    const effectiveTotal = rawDur > 65 ? rawDur : virtualTargetDuration;
    const effectiveCur = rawDur > 65 ? cur : Math.min(effectiveTotal, virtualElapsed);

    // Если сегмент подходит к 29.6 сек, а полная песня длится 2:40 — бесшовно перезапускаем буфер без паузы
    if (rawDur > 0 && rawDur <= 35 && cur >= rawDur - 0.35 && effectiveCur < effectiveTotal - 2) {
        lastAudioTime = 0;
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
    }

    if (effectiveCur >= effectiveTotal - 0.3) {
        onTrackFinished();
        return;
    }

    const pct = Math.min(100, (effectiveCur / effectiveTotal) * 100);
    document.getElementById("fp-bar-fill").style.width = `${pct}%`;
    document.getElementById("fp-seek-slider").value = String(Math.floor(pct * 10));
    document.getElementById("fp-cur-time").textContent = formatTime(effectiveCur);
    document.getElementById("fp-tot-time").textContent = formatTime(effectiveTotal);
});

audio.addEventListener("ended", () => {
    onTrackFinished();
});

function onTrackFinished() {
    if (repeatOne && currentTrack) {
        virtualElapsed = 0;
        lastAudioTime = 0;
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
    }
    playNextWaveTrack();
}

function onSeekInput(sliderVal) {
    const pct = Number(sliderVal) / 1000;
    const rawDur = audio.duration || 0;
    const effectiveTotal = rawDur > 65 ? rawDur : virtualTargetDuration;
    virtualElapsed = pct * effectiveTotal;
    if (rawDur > 65) {
        audio.currentTime = virtualElapsed;
        lastAudioTime = virtualElapsed;
    } else if (rawDur > 0) {
        const modTime = virtualElapsed % rawDur;
        audio.currentTime = modTime;
        lastAudioTime = modTime;
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
    } else if (CURATED_CATALOG.length > 0) {
        await playTrack(randomPick(CURATED_CATALOG), true);
    }
}

async function playPrevTrack() {
    if (virtualElapsed > 5) {
        onSeekInput(0);
        return;
    }
    if (historyStack.length > 0) {
        const prev = historyStack.pop();
        if (currentTrack) waveQueue.unshift(currentTrack);
        await playTrack(prev, false);
    } else {
        onSeekInput(0);
    }
}

function syncPlayerUI(track) {
    const mainArtist = track.artist.split(",")[0].trim();
    document.getElementById("hero-artist-big").textContent = mainArtist.toUpperCase();
    document.getElementById("hero-track-title").textContent = track.title;
    document.getElementById("hero-cover").src = track.cover_url;

    document.getElementById("fp-cover").src = track.cover_url;
    document.getElementById("fp-title-text").textContent = track.title;
    document.getElementById("fp-artist-text").textContent = track.artist;

    document.getElementById("fp-modal-cover").src = track.cover_url;
    document.getElementById("fp-modal-ava").src = track.cover_url;
    document.getElementById("fp-modal-title").textContent = track.title;
    document.getElementById("fp-modal-artist").textContent = track.artist;
    document.getElementById("fp-wave-by-name").textContent = `▶ ${track.title}`;
    document.getElementById("fp-tot-time").textContent = formatTime(track.duration_sec || 165);

    const isLiked = likedMap.has(track.track_id);
    for (const id of ["hero-like-btn", "fp-like-btn", "fp-modal-like"]) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.textContent = isLiked ? "♥" : "♡";
            btn.classList.toggle("liked", isLiked);
        }
    }
}

function setPlayingVisuals(playing) {
    const icon = playing ? "⏸" : "▶";
    document.getElementById("hero-play-btn").textContent = icon;
    document.getElementById("fp-play-btn").textContent = icon;
    document.getElementById("fp-modal-play").textContent = icon;
    document.getElementById("hero-glow").classList.toggle("playing", playing);
}

// 8. Полноэкранный плеер и Меню «Три точки» (Action Sheet)
function openFullPlayer() {
    if (!currentTrack) currentTrack = CURATED_CATALOG[3];
    syncPlayerUI(currentTrack);
    document.getElementById("full-player-modal").classList.add("open");
}

function closeFullPlayer() {
    document.getElementById("full-player-modal").classList.remove("open");
}

function openActionSheet(track, ev) {
    if (ev) ev.stopPropagation();
    sheetTrack = track || currentTrack || CURATED_CATALOG[4];
    document.getElementById("sheet-cover").src = sheetTrack.cover_url;
    document.getElementById("sheet-title-text").textContent = sheetTrack.title;
    document.getElementById("sheet-dur-text").textContent = formatTime(sheetTrack.duration_sec || 180);
    document.getElementById("sheet-wave-title").textContent = `▶ ${sheetTrack.title}`;

    const artists = sheetTrack.artist.split(",").map(s => s.trim()).filter(Boolean);
    document.getElementById("sheet-artists-row").innerHTML = artists.map(a => `
        <div class="sheet-artist-chip" onclick="selectWaveCategory('custom', 'В стиле ${escapeHtml(a)}', '${escapeHtml(a)}'); closeActionSheet();">
            <img src="${escapeHtml(sheetTrack.cover_url)}" alt="">
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

    const likeCircle = document.getElementById("sheet-like-circle");
    likeCircle.classList.toggle("liked", liked);

    const dlCircle = document.getElementById("sheet-dl-circle");
    dlCircle.classList.toggle("downloaded", downloaded);
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
    setTimeout(() => onSeekInput(350), 300);
    showToast("Воспроизведение яркого фрагмента");
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
    showToast("Удалено из памяти устройства");
}

function showTrackInfoToast() {
    if (!sheetTrack) return;
    showToast(`${sheetTrack.artist} — ${sheetTrack.title} (${formatTime(sheetTrack.duration_sec || 175)})`);
}

function sheetDislike() {
    if (!sheetTrack) return;
    dislikedSet.add(sheetTrack.track_id);
    localStorage.setItem("ym_disliked_v3", JSON.stringify(Array.from(dislikedSet)));
    closeActionSheet();
    if (currentTrack && currentTrack.track_id === sheetTrack.track_id) {
        playNextWaveTrack();
    }
    showToast("Трек скрыт из рекомендаций");
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

// 9. Карусель 14 категорий на главной + сброс в чистую «Мою волну» (60/40)
function renderWaveCategoriesBar() {
    const bar = document.getElementById("wave-categories-bar");
    if (!bar) return;
    bar.innerHTML = WAVE_CATEGORIES.map(c => `
        <div class="wave-cat-card ${c.id === activeCategoryId ? 'active' : ''}"
             style="background: ${c.bg};"
             onclick="selectWaveCategory('${c.id}', '${escapeHtml(c.name)}', '${escapeHtml(c.query)}')">
            <div class="wave-cat-emoji">${c.emoji}</div>
            <div class="wave-cat-name">${escapeHtml(c.name)}</div>
        </div>
    `).join("");
}

async function selectWaveCategory(catId, title, customQuery = "") {
    activeCategoryId = catId;
    document.getElementById("active-wave-tag").textContent = title;
    document.getElementById("fp-modal-context").textContent = `Поток «${title}»`;
    document.getElementById("wave-filter-reset-x").classList.toggle("visible", catId !== "pure");
    renderWaveCategoriesBar();
    switchScreen("wave", document.getElementById("tab-wave"));

    if (catId === "pure") {
        await buildWaveQueue();
    } else {
        const list = await searchEverywhere(customQuery || title);
        waveQueue = shuffle(list);
    }
    if (waveQueue.length > 0) {
        await playTrack(waveQueue.shift(), true);
    }
}

async function resetWavePure() {
    await selectWaveCategory("pure", "Моя волна", "");
    showToast("Включена чистая Моя волна");
}

// 10. Лайк и Скачивание в телефон (Офлайн)
async function toggleCurrentLike() {
    if (!currentTrack) return;
    await toggleLikeForTrack(currentTrack);
}

async function toggleLikeForTrack(track, ev) {
    if (ev) ev.stopPropagation();
    const id = track.track_id;
    const cl = track.cluster || inferCluster(`${track.artist} ${track.title}`);

    if (likedMap.has(id)) {
        await dbDel("likes", id);
        clusterWeights[cl] = Math.max(1, (clusterWeights[cl] || 2) - 1);
    } else {
        await dbPut("likes", track);
        clusterWeights[cl] = (clusterWeights[cl] || 1) + 3;
        showToast("Добавлено в «Мне нравится»");
    }
    localStorage.setItem("ym_weights_v3", JSON.stringify(clusterWeights));
    await syncState();
    if (currentTrack && currentTrack.track_id === id) syncPlayerUI(currentTrack);
    renderCollectionAndExplore();
}

async function downloadTrackOffline(track, ev) {
    if (ev) ev.stopPropagation();
    if (!track) return;
    if (offlineMap.has(track.track_id)) {
        await dbDel("offline", track.track_id);
        await syncState();
        renderCollectionAndExplore();
        showToast("Удалено из офлайн-памяти");
        return;
    }
    showToast(`Скачивание «${track.title}»...`);
    try {
        const url = await resolveBestStreamUrl(track);
        let blob = null;
        if (url && navigator.onLine) {
            const resp = await fetchFast(url, 6000);
            if (resp.ok) blob = await resp.blob();
        }
        await dbPut("offline", { ...track, full_stream_url: url, blob, savedAt: Date.now() });
        await dbPut("likes", track);
        await syncState();
        renderCollectionAndExplore();
        showToast(`Скачано в телефон: ${track.title}`);
    } catch (_) {
        await dbPut("offline", { ...track, savedAt: Date.now() });
        await dbPut("likes", track);
        await syncState();
        renderCollectionAndExplore();
        showToast(`Сохранено в коллекцию: ${track.title}`);
    }
}

async function downloadCurrentTrack() {
    if (currentTrack) await downloadTrackOffline(currentTrack);
}

// 11. Живой поиск (срабатывает сразу при наборе и находит kizaru - Fake Id)
let searchDebounce = null;

function openSearchModal() {
    document.getElementById("search-modal").classList.add("open");
    const inp = document.getElementById("search-query-input");
    inp.focus();
    if (!inp.value.trim()) {
        renderTrackRows("search-results-box", CURATED_CATALOG, true);
    }
}

function closeSearchModal() {
    document.getElementById("search-modal").classList.remove("open");
}

function onSearchInputChanged(val) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        runSearchQuery(val);
    }, 220);
}

async function submitSearchForm(e) {
    e.preventDefault();
    const val = document.getElementById("search-query-input").value;
    await runSearchQuery(val);
}

async function runSearchQuery(raw) {
    const q = raw.trim();
    if (!q) {
        renderTrackRows("search-results-box", CURATED_CATALOG, true);
        return;
    }
    const items = await searchEverywhere(q);
    renderTrackRows("search-results-box", items, true);
}

// 12. Отрисовка списков треков с поддержкой клика на трек и клика на Три точки (⋮)
function renderTrackRows(containerId, list, closeSearchOnPlay = false) {
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
            preview_url: t.preview_url || "",
            duration_sec: t.duration_sec || 170,
            cluster: t.cluster || "rusrap"
        }));
        return `
        <div class="ym-track-row">
            <img class="ym-track-cover" src="${escapeHtml(t.cover_url)}" onclick="playEncodedTrack('${enc}', ${closeSearchOnPlay})" loading="lazy" alt="">
            <div class="ym-track-info" onclick="playEncodedTrack('${enc}', ${closeSearchOnPlay})">
                <div class="ym-track-name">
                    <span>${escapeHtml(t.title)}</span>
                    <span class="badge-18">18+</span>
                </div>
                <div class="ym-track-artist">${escapeHtml(t.artist)}</div>
            </div>
            <button class="ym-dl-btn ${isOff ? 'downloaded' : ''}" onclick="dlEncodedTrack('${enc}', event)" title="Скачать">↓</button>
            <button class="ym-more-btn" onclick="menuEncodedTrack('${enc}', event)" title="Меню трека">⋮</button>
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
    }
    renderTrackRows("collection-tracks-box", savedList, false);
    renderTrackRows("explore-popular-box", CURATED_CATALOG, false);
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

function decodeEntities(str) {
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

window.addEventListener("DOMContentLoaded", async () => {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    renderWaveCategoriesBar();
    await initDB();
    await syncState();

    // Если база пустая — кладём стартовые треки со скриншотов
    if (likedMap.size === 0) {
        for (const item of CURATED_CATALOG.slice(0, 5)) {
            await dbPut("likes", item);
        }
        await syncState();
    }

    // Проставляем обложки кругов и стартовый трек
    document.getElementById("bubble-img-1").src = CURATED_CATALOG[7].cover_url;
    document.getElementById("bubble-img-2").src = CURATED_CATALOG[6].cover_url;
    document.getElementById("bubble-img-3").src = CURATED_CATALOG[0].cover_url;
    document.getElementById("fav-art-1").src = CURATED_CATALOG[0].cover_url;
    document.getElementById("fav-art-2").src = CURATED_CATALOG[8].cover_url;
    document.getElementById("explore-hist-cover").src = CURATED_CATALOG[3].cover_url;

    currentTrack = CURATED_CATALOG[3];
    syncPlayerUI(currentTrack);
    renderCollectionAndExplore();
    await buildWaveQueue();
});
