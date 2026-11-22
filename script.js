const home = document.getElementById("home");

// ==========================================
// CONFIGURACIÓN
// ==========================================

const SPOTIFY_CLIENT_ID = "3ce620f139c44fc89e91d3b925dbc6fd";

const SPOTIFY_REDIRECT_URI =
    "https://23kabelen.github.io/hogwarts-sorting-hat-spotify/";

const LASTFM_API_KEY = "e88580827bb5305a91cec4bda4ac1a9e";
const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";

const SPOTIFY_LIMIT = 10;
const LASTFM_DELAY = 450;
const MAX_GENRES = 10;

let famousArtistCache = [];
let hatMessageInterval = null;

// ==========================================
// ARTISTAS FAMOSOS PARA EL FONDO
// ==========================================

const FAMOUS_ARTISTS = [
    "Taylor Swift", "The Weeknd", "Bad Bunny",
    "Billie Eilish", "Dua Lipa", "Drake",
    "Ariana Grande", "Harry Styles", "Rihanna",
    "Bruno Mars", "Beyoncé", "Justin Bieber",
    "Queen", "Coldplay", "Eminem", "Shakira",
    "Ed Sheeran", "Olivia Rodrigo", "Lana Del Rey",
    "Lady Gaga", "Kendrick Lamar", "Post Malone",
    "Miley Cyrus", "Travis Scott", "Karol G",
    "SZA", "Linkin Park", "Metallica",
    "Arctic Monkeys", "ABBA"
];

async function getFamousArtists(accessToken, limit) {
    const results = [];

    for (const name of FAMOUS_ARTISTS) {
        if (results.length >= limit) break;

        try {
            const response = await fetch(
                "https://api.spotify.com/v1/search?" +
                new URLSearchParams({
                    q: `artist:"${name}"`,
                    type: "artist",
                    limit: "1"
                }),
                {
                    headers: {
                        Authorization: "Bearer " + accessToken
                    }
                }
            );

            if (!response.ok) continue;

            const data = await response.json();
            const artist = data.artists?.items?.[0];

            if (!artist?.images?.[0]?.url) continue;

            const alreadyExists = results.some(
                existing => existing.name.toLowerCase() === artist.name.toLowerCase()
            );

            if (alreadyExists) continue;

            results.push({
                name: artist.name,
                image: artist.images[0].url
            });

        } catch (error) {
            console.warn("No se pudo cargar " + name, error);
        }
    }

    return results;
}

// ==========================================
// RASGOS DE LAS CASAS
// ==========================================

const primaryHouseTraits = {
    Gryffindor: ["trap", "alternative", "rock"],
    Slytherin: ["rap", "heavy metal"],
    Ravenclaw: ["indie", "folk"],
    Hufflepuff: ["pop", "romantic"]
};

const secondaryHouseTraits = {
    Gryffindor: [
        "punk", "energetic", "cumbia",
        "folklore", "cuarteto", "electronic"
    ],
    Slytherin: [
        "trap", "urbano", "intense",
        "dark", "reggaeton", "rkt"
    ],
    Ravenclaw: [
        "experimental", "funk", "pop", "acoustic"
    ],
    Hufflepuff: [
        "acoustic", "k-pop", "salsa", "folk", "reggae"
    ]
};

// ==========================================
// NORMALIZAR Y CLASIFICAR ETIQUETAS
// ==========================================

function normalizeTag(rawTag) {
    return String(rawTag)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function capitalizeFirst(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function isMusicGenre(rawTag) {
    const tag = normalizeTag(rawTag);

    if (!tag || tag.length < 2) return false;

    const excludedTags = [
        "latin", "american", "argentina", "argentinian",
        "spanish", "english", "female vocalists",
        "male vocalists", "singer songwriter",
        "singer-songwriter", "beautiful", "sexy",
        "boring", "cringe", "flop", "bad music",
        "good music", "music", "favorites", "favourites",
        "favorite", "favourite", "seen live",
        "under 2000 listeners", "under 1000 listeners"
    ];

    if (excludedTags.includes(tag)) return false;
    if (/^(19|20)\d{2}$/.test(tag)) return false;

    const keywords = [
        "rock", "punk", "metal", "pop", "rap",
        "hip hop", "hip-hop", "hiphop", "r&b", "rnb",
        "rhythm and blues", "trap", "indie",
        "alternative", "experimental", "electronic",
        "electronica", "electro", "techno", "house",
        "edm", "synth", "trance", "rave", "hardcore",
        "folk", "folklore", "acoustic", "acustico",
        "cumbia", "cuarteto", "reggaeton", "regueton",
        "reggae", "salsa", "funk", "jazz", "blues",
        "soul", "disco", "dance", "ambient", "lo-fi",
        "lofi", "country", "classical", "clásica",
        "samba", "bossa nova", "merengue", "bachata",
        "flamenco", "dubstep", "drum and bass",
        "drum & bass", "dnb", "garage", "grime",
        "grunge", "shoegaze", "dream pop", "new wave",
        "darkwave", "post-rock", "post rock",
        "post-punk", "post punk", "synthwave",
        "synthpop", "electropop", "dancehall",
        "bolero", "tango", "milonga", "rkt", "urbano",
        "k-pop", "kpop", "j-pop", "jpop", "city pop",
        "trap latino", "trap argentino", "latin trap",
        "latin funk", "latin jazz", "latin pop",
        "latin rock", "indie pop", "indie rock",
        "indie folk", "pop rock", "pop punk",
        "alternative rnb", "alternative r&b",
        "alternative rock", "alternative pop",
        "hard rock", "soft rock", "progressive rock",
        "psychedelic rock", "heavy metal", "nu metal",
        "death metal", "black metal", "power metal",
        "metalcore", "hyperpop", "art pop", "bedroom pop",
        "dance pop", "electro pop", "funk pop",
        "country pop", "folk rock", "folk pop",
        "indietronica", "acid jazz", "jazz fusion",
        "hip house", "deep house", "tech house",
        "progressive house", "minimal techno",
        "hard techno", "industrial"
    ];

    return keywords.some(keyword => tag.includes(keyword));
}

function classifyTags(tags = []) {
    const traits = new Set();

    tags.forEach(rawTag => {
        const tag = normalizeTag(rawTag);
        if (!tag) return;

        if (
            tag.includes("rock") ||
            tag.includes("post punk") ||
            tag.includes("garage rock") ||
            tag.includes("grunge")
        ) traits.add("rock");

        if (tag.includes("punk")) traits.add("punk");

        if (
            tag.includes("alternative") ||
            tag.includes("alternativo")
        ) traits.add("alternative");

        if (
            tag.includes("rap") ||
            tag.includes("hip hop") ||
            tag.includes("hip-hop") ||
            tag.includes("hiphop")
        ) traits.add("rap");

        if (tag.includes("trap")) traits.add("trap");
        if (tag.includes("indie")) traits.add("indie");

        if (
            tag.includes("experimental") ||
            tag.includes("avant garde") ||
            tag.includes("avant-garde")
        ) traits.add("experimental");

        if (
            tag.includes("electronic") ||
            tag.includes("electronica") ||
            tag.includes("techno") ||
            tag.includes("house music") ||
            tag === "house" ||
            tag.includes("edm") ||
            tag.includes("synthwave") ||
            tag.includes("electropop") ||
            tag.includes("electro")
        ) traits.add("electronic");

        if (
            tag.includes("pop") &&
            !tag.includes("k-pop") &&
            !tag.includes("kpop") &&
            !tag.includes("korean pop")
        ) traits.add("pop");

        if (
            tag.includes("k-pop") ||
            tag.includes("kpop") ||
            tag.includes("korean pop")
        ) traits.add("k-pop");

        if (
            tag.includes("folklore") ||
            tag.includes("folclore") ||
            tag.includes("folk argentino") ||
            tag.includes("argentine folk") ||
            tag.includes("argentinian folk")
        ) {
            traits.add("folklore");
        } else if (tag.includes("folk")) {
            traits.add("folk");
        }

        if (
            tag.includes("acoustic") ||
            tag.includes("acustico")
        ) traits.add("acoustic");

        if (tag.includes("cumbia")) traits.add("cumbia");
        if (tag.includes("cuarteto")) traits.add("cuarteto");

        if (
            tag.includes("reggaeton") ||
            tag.includes("regueton")
        ) traits.add("reggaeton");

        if (
            tag.includes("urbano") ||
            tag.includes("urban music") ||
            tag === "urban"
        ) traits.add("urbano");

        if (tag.includes("rkt")) traits.add("rkt");
        if (tag.includes("salsa")) traits.add("salsa");
        if (tag.includes("reggae")) traits.add("reggae");

        if (
            tag.includes("heavy metal") ||
            tag.includes("metal")
        ) traits.add("heavy metal");

        if (tag.includes("funk")) traits.add("funk");

        if (
            tag.includes("dark") ||
            tag.includes("darkwave")
        ) traits.add("dark");

        if (
            tag.includes("romantic") ||
            tag.includes("romantico")
        ) traits.add("romantic");

        if (
            tag.includes("energetic") ||
            tag.includes("energy") ||
            tag.includes("high energy")
        ) traits.add("energetic");

        if (
            tag.includes("intense") ||
            tag.includes("intenso")
        ) traits.add("intense");
    });

    return [...traits];
}

// ==========================================
// LAST.FM
// ==========================================

function requestLastFM(method, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName =
            "lastFmCallback_" +
            Date.now() +
            "_" +
            Math.random().toString(36).slice(2);

        const query = new URLSearchParams({
            method,
            api_key: LASTFM_API_KEY,
            format: "json",
            callback: callbackName,
            autocorrect: "1",
            ...params
        });

        const script = document.createElement("script");
        let finished = false;

        const timeout = setTimeout(() => {
            finish(new Error("Last.fm tardó demasiado en responder."));
        }, 12000);

        function finish(error, data) {
            if (finished) return;

            finished = true;
            clearTimeout(timeout);
            delete window[callbackName];
            script.remove();

            if (error) reject(error);
            else resolve(data);
        }

        window[callbackName] = data => {
            if (data && data.error) {
                finish(new Error(
                    data.message || "Error de Last.fm: " + data.error
                ));
                return;
            }

            finish(null, data);
        };

        script.onerror = () => {
            finish(new Error("No se pudo contactar con Last.fm."));
        };

        script.src = LASTFM_API_URL + "?" + query.toString();
        document.head.appendChild(script);
    });
}

function extractLastFMTags(data) {
    const rawTags = data?.toptags?.tag;
    if (!rawTags) return [];

    const tagArray = Array.isArray(rawTags) ? rawTags : [rawTags];

    return tagArray
        .map(tag => {
            if (typeof tag === "string") return tag;
            return tag.name || tag["#text"] || "";
        })
        .filter(Boolean);
}

async function getArtistGenres(artist) {
    try {
        const data = await requestLastFM(
            "artist.getTopTags",
            { artist: artist.name }
        );
        return extractLastFMTags(data);
    } catch (error) {
        console.warn("No se pudieron obtener etiquetas de " + artist.name, error);
        return [];
    }
}

async function getTrackGenres(track) {
    if (!track.artists?.length) return [];

    try {
        const data = await requestLastFM(
            "track.getTopTags",
            {
                artist: track.artists[0].name,
                track: track.name
            }
        );
        return extractLastFMTags(data);
    } catch (error) {
        console.warn("No se pudieron obtener etiquetas de " + track.name, error);
        return [];
    }
}

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

// ==========================================
// IMÁGENES DE CANCIONES
// ==========================================

async function findTrackImage(track, accessToken) {
    const existingImage = track.album?.images?.[0]?.url;

    if (existingImage) return existingImage;

    try {
        const artistName = track.artists?.[0]?.name || "";

        const query = new URLSearchParams({
            q: `track:"${track.name}" artist:"${artistName}"`,
            type: "track",
            limit: "1"
        });

        const response = await fetch(
            "https://api.spotify.com/v1/search?" + query.toString(),
            {
                headers: {
                    Authorization: "Bearer " + accessToken
                }
            }
        );

        if (!response.ok) return "";

        const data = await response.json();

        return data.tracks?.items?.[0]?.album?.images?.[0]?.url || "";

    } catch (error) {
        console.warn("No se encontró portada para " + track.name, error);
        return "";
    }
}

// ==========================================
// GÉNEROS MÁS FRECUENTES
// ==========================================

function getMostFrequentTags(artists, tracks) {
    const tagCounts = new Map();

    function addTags(tags) {
        const uniqueTags = new Map();

        tags.forEach(tag => {
            const normalized = normalizeTag(tag);

            if (!normalized || !isMusicGenre(normalized)) return;

            if (!uniqueTags.has(normalized)) {
                uniqueTags.set(normalized, capitalizeFirst(tag));
            }
        });

        uniqueTags.forEach((displayName, normalized) => {
            if (!tagCounts.has(normalized)) {
                tagCounts.set(normalized, {
                    name: displayName,
                    count: 0
                });
            }

            tagCounts.get(normalized).count++;
        });
    }

    artists.forEach(artist => {
        addTags([...artist.tags, ...artist.spotifyTags]);
    });

    tracks.forEach(track => addTags(track.tags));

    return [...tagCounts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_GENRES);
}

// ==========================================
// ICONOS DE GÉNEROS
// ==========================================

function getGenreIcon(genre) {
    const tag = normalizeTag(genre);

    if (tag.includes("rock") || tag.includes("metal") || tag.includes("punk")) return "🎸";
    if (tag.includes("pop")) return "🎤";
    if (tag.includes("rap") || tag.includes("hip hop") || tag.includes("trap")) return "🎙️";
    if (tag.includes("electronic") || tag.includes("techno") || tag.includes("house") || tag.includes("edm")) return "🎧";
    if (tag.includes("folk") || tag.includes("folklore") || tag.includes("country")) return "🪕";
    if (tag.includes("jazz")) return "🎷";
    if (tag.includes("blues")) return "🎺";
    if (tag.includes("reggae")) return "🌴";
    if (tag.includes("cumbia") || tag.includes("salsa") || tag.includes("bachata")) return "🥁";
    if (tag.includes("funk") || tag.includes("soul") || tag.includes("r&b")) return "🎹";
    if (tag.includes("classical") || tag.includes("clásica")) return "🎻";
    if (tag.includes("acoustic")) return "🎼";
    if (tag.includes("indie") || tag.includes("alternative")) return "🎶";

    return "♫";
}

// ==========================================
// FRASES DEL SOMBRERO
// ==========================================

function getHatMessages(artists, tracks, genres) {
    const artistNames = artists.map(artist => artist.name);
    const firstArtist = artistNames[0] || "tus artistas favoritos";
    const secondArtist = artistNames[1] || firstArtist;

    const genreNames = genres.map(genre => genre.name.toLowerCase());

    const messages = [
        `Mmm... veo mucha curiosidad en tu personalidad. ${firstArtist} parece ser una de tus pistas...`,
        `Interesante... tus gustos musicales tienen una personalidad bastante marcada. No se me escapa nada.`,
        `Vaya, vaya... ${secondArtist} también aparece entre tus favoritos. Esto se está poniendo interesante...`
    ];

    if (
        genreNames.some(genre =>
            ["indie", "experimental", "alternative", "folk"].some(word =>
                genre.includes(word)
            )
        )
    ) {
        messages.push(
            `Mmm... te gusta explorar sonidos nuevos y salir de lo habitual. Hay mucha curiosidad en vos...`
        );
    }

    if (
        genreNames.some(genre =>
            ["trap", "rap", "rock", "metal"].some(word =>
                genre.includes(word)
            )
        )
    ) {
        messages.push(
            `Veo carácter, energía y una personalidad que no pasa desapercibida. Tus elecciones hablan bastante...`
        );
    }

    if (
        genreNames.some(genre =>
            ["pop", "romantic", "acoustic"].some(word =>
                genre.includes(word)
            )
        )
    ) {
        messages.push(
            `También hay sensibilidad en tus gustos. Parece que algunas canciones significan mucho más que música para vos...`
        );
    }

    messages.push(
        `Creo que ya estoy empezando a entenderte... aunque todavía necesito un momento.`,
        `Qué combinación tan peculiar... No todos los días encuentro gustos musicales como estos.`,
        `Un poco más de paciencia... la decisión que tome será importante.`
    );

    return messages;
}

function startHatMessages(artists, tracks) {
    const messages = getHatMessages(
        artists,
        tracks,
        []
    );

    const messageElement = document.getElementById("hat-message");

    if (!messageElement) return;

    let index = 0;

    messageElement.textContent = `«${messages[index]}»`;

    if (hatMessageInterval) {
        clearInterval(hatMessageInterval);
    }

    hatMessageInterval = setInterval(() => {
        index = (index + 1) % messages.length;

        const currentMessage = document.getElementById("hat-message");
        if (!currentMessage) return;

        currentMessage.classList.add("message-changing");

        setTimeout(() => {
            const element = document.getElementById("hat-message");
            if (!element) return;

            element.textContent = `«${messages[index]}»`;
            element.classList.remove("message-changing");
        }, 350);

    }, 4200);
}

// ==========================================
// ANALIZAR MÚSICA
// ==========================================

async function analyzeMusic(artists, tracks, accessToken) {
    const analyzedArtists = [];
    const analyzedTracks = [];

    const total = artists.length + tracks.length;
    let completed = 0;

    const progress = document.getElementById("analysis-progress");

    async function updateProgress() {
        completed++;

        if (progress) {
            progress.textContent =
                "Analizando estilos musicales... " +
                completed + "/" + total;
        }
    }

    for (const artist of artists) {
        const lastFmTags = await getArtistGenres(artist);
        const spotifyTags = artist.genres || [];

        const traits = [
            ...new Set([
                ...classifyTags(spotifyTags),
                ...classifyTags(lastFmTags)
            ])
        ];

        analyzedArtists.push({
            name: artist.name,
            image: artist.images?.[0]?.url || "",
            traits,
            tags: lastFmTags,
            spotifyTags
        });

        await updateProgress();
        await delay(LASTFM_DELAY);
    }

    for (const track of tracks) {
        const lastFmTags = await getTrackGenres(track);
        const image = await findTrackImage(track, accessToken);

        analyzedTracks.push({
            name: track.name,
            artists: track.artists.map(artist => artist.name),
            image,
            traits: classifyTags(lastFmTags),
            tags: lastFmTags
        });

        await updateProgress();
        await delay(LASTFM_DELAY);
    }

    const allGenres = [
        ...analyzedArtists.flatMap(artist => artist.traits),
        ...analyzedTracks.flatMap(track => track.traits)
    ];

    return {
        artists: analyzedArtists,
        tracks: analyzedTracks,
        genres: [...new Set(allGenres)],
        mostFrequentTags: getMostFrequentTags(
            analyzedArtists,
            analyzedTracks
        )
    };
}

// ==========================================
// PUNTAJES
// ==========================================

function getTraitPoints(house, trait) {
    if (primaryHouseTraits[house].includes(trait)) return 3;
    if (secondaryHouseTraits[house].includes(trait)) return 1;
    return 0;
}

function sortIntoHouse(music) {
    const scores = {
        Gryffindor: 0,
        Slytherin: 0,
        Ravenclaw: 0,
        Hufflepuff: 0
    };

    function addTraits(traits, weight) {
        const uniqueTraits = [...new Set(traits)];
        if (!uniqueTraits.length) return;

        const pointsPerTrait = weight / uniqueTraits.length;

        uniqueTraits.forEach(trait => {
            Object.keys(scores).forEach(house => {
                scores[house] += pointsPerTrait *
                    getTraitPoints(house, trait);
            });
        });
    }

    music.artists.forEach(artist => addTraits(artist.traits, 2));
    music.tracks.forEach(track => addTraits(track.traits, 1));

    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const percentages = {};

    if (total === 0) {
        Object.keys(scores).forEach(house => percentages[house] = 0);
        return { winner: null, percentages, scores };
    }

    const exactPercentages = {};

    for (const house in scores) {
        exactPercentages[house] = scores[house] / total * 100;
        percentages[house] = Math.floor(exactPercentages[house]);
    }

    let remaining = 100 -
        Object.values(percentages).reduce((a, b) => a + b, 0);

    const sortedHouses = Object.keys(scores).sort(
        (a, b) =>
            (exactPercentages[b] - percentages[b]) -
            (exactPercentages[a] - percentages[a])
    );

    for (let i = 0; i < remaining; i++) {
        percentages[sortedHouses[i]]++;
    }

    const winner = Object.keys(scores).reduce((a, b) =>
        scores[a] >= scores[b] ? a : b
    );

    return { winner, percentages, scores };
}

// ==========================================
// SEGURIDAD PARA TEXTO HTML
// ==========================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// ==========================================
// PANTALLA INICIAL
// ==========================================

function showHome() {
    if (hatMessageInterval) {
        clearInterval(hatMessageInterval);
        hatMessageInterval = null;
    }

    home.innerHTML = `
        <div class="home-screen">
            <div class="ornament">✦ ✧ ✦</div>
            <p class="eyebrow">HOGWARTS · MUSICAL SORTING</p>
            <h1>Hogwarts Sorting Hat</h1>
            <p>Descubrí qué casa de Hogwarts representa tus gustos musicales.</p>
            <button id="start-button" class="magic-button">Comenzar</button>
            <div class="ornament bottom-ornament">✧ ✦ ✧</div>
        </div>
    `;

    document.getElementById("start-button")
        .addEventListener("click", showConnect);
}

// ==========================================
// CONEXIÓN
// ==========================================

function showConnect() {
    home.innerHTML = `
        <div class="home-screen">
            <div class="ornament">✦ ✧ ✦</div>
            <p class="eyebrow">EL GRAN COMEDOR TE ESPERA</p>
            <h1>Conectá tu Spotify</h1>
            <p>Descubramos qué casa representa tus gustos musicales.</p>
            <h3>¿Qué vamos a analizar?</h3>
            <p>Tus artistas y canciones más escuchados, junto con sus estilos musicales.</p>
            <button id="spotify-login" class="magic-button">Conectar con Spotify</button>
            <button id="back-button" class="secondary-button">Volver</button>
        </div>
    `;

    document.getElementById("back-button")
        .addEventListener("click", showHome);

    document.getElementById("spotify-login")
        .addEventListener("click", connectSpotify);
}

// ==========================================
// SPOTIFY OAUTH, EN UNA PESTAÑA NUEVA
// ==========================================

async function connectSpotify() {
    const currentOrigin = window.location.origin;
    const redirectOrigin = new URL(SPOTIFY_REDIRECT_URI).origin;

    if (currentOrigin !== redirectOrigin) {
        alert(
            "La página está abierta desde un dominio distinto al configurado para Spotify. Abrí directamente el enlace .codepen.dev de la aplicación."
        );
        return;
    }

    const spotifyWindow = window.open("about:blank", "_blank");

    if (!spotifyWindow) {
        alert("El navegador bloqueó la nueva pestaña. Permití las ventanas emergentes para CodePen.");
        return;
    }

    try {
        const randomBytes = crypto.getRandomValues(new Uint8Array(64));

        const verifier = Array.from(randomBytes)
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");

        const hash = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(verifier)
        );

        const challenge = btoa(
            String.fromCharCode(...new Uint8Array(hash))
        )
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        const state = crypto.randomUUID();

        spotifyWindow.sessionStorage.setItem(
            "spotify_verifier_" + state,
            verifier
        );

        const params = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            response_type: "code",
            redirect_uri: SPOTIFY_REDIRECT_URI,
            scope: "user-top-read",
            code_challenge_method: "S256",
            code_challenge: challenge,
            state
        });

        spotifyWindow.location.href =
            "https://accounts.spotify.com/authorize?" + params.toString();

    } catch (error) {
        spotifyWindow.close();
        console.error(error);
        alert("No se pudo iniciar la conexión con Spotify.");
    }
}

// ==========================================
// SOMBRERO SELECCIONADOR
// ==========================================

function getSortingHatSVG() {
    return `
        <svg
            class="sorting-hat-art"
            viewBox="0 0 300 230"
            role="img"
            aria-label="Sombrero Seleccionador"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="hatFabric" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#987047"/>
                    <stop offset="45%" stop-color="#68452e"/>
                    <stop offset="100%" stop-color="#302018"/>
                </linearGradient>

                <linearGradient id="hatBrim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#87613d"/>
                    <stop offset="100%" stop-color="#302018"/>
                </linearGradient>
            </defs>

            <path
                d="M35 168 C58 146 94 145 123 151 C160 141 207 144 242 158 C265 167 278 179 265 188 C242 202 202 196 174 194 C130 202 79 196 47 190 C27 186 21 177 35 168Z"
                fill="url(#hatBrim)"
                stroke="#24170f"
                stroke-width="5"
            />

            <path
                d="M82 157 C91 128 82 99 101 67 C112 47 133 26 151 17 C157 43 174 57 191 64 C209 72 219 88 207 105 C195 120 183 133 189 158 C158 169 113 169 82 157Z"
                fill="url(#hatFabric)"
                stroke="#24170f"
                stroke-width="5"
                stroke-linejoin="round"
            />

            <path d="M150 22 C137 57 143 89 127 120" fill="none" stroke="#b18a5b" stroke-width="5" opacity=".45"/>
            <path d="M189 67 C174 90 174 113 184 140" fill="none" stroke="#24170f" stroke-width="5" opacity=".7"/>
            <path d="M92 145 C120 134 159 139 187 147" fill="none" stroke="#24170f" stroke-width="4" opacity=".65"/>

            <path d="M111 111 C123 99 136 99 146 108" fill="none" stroke="#1d130f" stroke-width="7" stroke-linecap="round"/>
            <path d="M157 108 C169 99 182 101 191 111" fill="none" stroke="#1d130f" stroke-width="7" stroke-linecap="round"/>
            <path d="M119 132 C139 145 164 145 183 130" fill="none" stroke="#1b110e" stroke-width="6" stroke-linecap="round"/>

            <path d="M63 176 C93 163 113 168 135 174" fill="none" stroke="#c19b6a" stroke-width="3" opacity=".55"/>
            <path d="M211 178 C230 172 246 176 258 183" fill="none" stroke="#c19b6a" stroke-width="3" opacity=".5"/>
            <path d="M100 81 L111 75 M204 92 L215 88" stroke="#c19b6a" stroke-width="3" stroke-linecap="round" opacity=".6"/>
        </svg>
    `;
}

// ==========================================
// ARTISTAS FLOTANTES
// ==========================================

function addFloatingArtist(layer, artist, index, position) {
    const imageUrl = artist.image || artist.images?.[0]?.url;

    if (!imageUrl || !position) return;

    const image = document.createElement("img");

    image.className = "floating-artist";
    image.src = imageUrl;
    image.alt = artist.name || "";
    image.loading = "eager";

    image.style.top = position.top + "%";
    image.style.left = position.left + "%";
    image.style.right = "auto";
    image.style.bottom = "auto";
    image.style.setProperty("--artist-index", index);
    image.style.animationDelay = `${index * -0.7}s`;

    layer.appendChild(image);
}

const artistPositions = [
    { top: 5, left: 5 },
    { top: 12, left: 85 },
    { top: 78, left: 9 },
    { top: 75, left: 88 },
    { top: 42, left: 2 },
    { top: 43, left: 94 },
    { top: 3, left: 42 },
    { top: 88, left: 43 },
    { top: 23, left: 20 },
    { top: 65, left: 70 },
    { top: 18, left: 70 },
    { top: 18, left: 30 },
    { top: 65, left: 25 },
    { top: 65, left: 85 },
    { top: 4, left: 60 },
    { top: 86, left: 68 },
    { top: 34, left: 12 },
    { top: 34, left: 82 },
    { top: 53, left: 18 },
    { top: 53, left: 78 },
    { top: 8, left: 25 },
    { top: 83, left: 23 },
    { top: 28, left: 92 },
    { top: 72, left: 48 },
    { top: 20, left: 48 },
    { top: 90, left: 5 },
    { top: 5, left: 93 },
    { top: 90, left: 90 },
    { top: 48, left: 7 },
    { top: 48, left: 90 }
];

// ==========================================
// PANTALLA DE ANÁLISIS
// ==========================================

async function showAnalysis(artists, accessToken) {
    const userArtists = artists
        .filter(artist => artist.images?.[0]?.url)
        .slice(0, 10)
        .map(artist => ({
            name: artist.name,
            image: artist.images[0].url
        }));

    const uniqueUserArtists = userArtists.filter((artist, index, array) =>
        array.findIndex(
            other => other.name.toLowerCase() === artist.name.toLowerCase()
        ) === index
    );

    const remainingSlots = Math.max(0, 24 - uniqueUserArtists.length);

    const famousArtists = remainingSlots > 0
        ? await getFamousArtists(accessToken, remainingSlots + 10)
        : [];

    const existingNames = new Set(
        uniqueUserArtists.map(artist => artist.name.toLowerCase())
    );

    const additionalArtists = famousArtists
        .filter(artist => !existingNames.has(artist.name.toLowerCase()))
        .slice(0, remainingSlots);

    const allArtists = [
        ...uniqueUserArtists,
        ...additionalArtists
    ].slice(0, 24);

    home.innerHTML = `
        <section class="analysis-screen" id="analysis-screen">
            <div class="floating-artist-layer" id="floating-artists"></div>

            <div class="analysis-content">
                <div class="sorting-hat-container">
                    ${getSortingHatSVG()}
                </div>

                <p class="analysis-eyebrow">EL SOMBRERO SELECCIONADOR</p>
                <h2>Analizando tus gustos musicales</h2>

                <p id="hat-message" class="hat-message">
                    El Sombrero está escuchando...
                </p>

                <div class="analysis-progress">
                    <div id="analysis-progress-bar"></div>
                </div>

                <p id="analysis-progress">Preparando el análisis mágico...</p>
            </div>
        </section>
    `;

    const layer = document.getElementById("floating-artists");

    const positions = [
        { top: 8, left: 4 },
        { top: 72, left: 17 },
        { top: 5, left: 30 },
        { top: 82, left: 44 },
        { top: 8, left: 58 },
        { top: 75, left: 74 },
        { top: 13, left: 90 },
        { top: 52, left: 95 },
        { top: 43, left: 7 },
        { top: 27, left: 22 },
        { top: 57, left: 38 },
        { top: 34, left: 55 },
        { top: 19, left: 70 },
        { top: 45, left: 83 },
        { top: 88, left: 13 },
        { top: 87, left: 91 },
        { top: 68, left: 3 },
        { top: 91, left: 27 },
        { top: 14, left: 41 },
        { top: 91, left: 63 },
        { top: 4, left: 78 },
        { top: 30, left: 97 },
        { top: 4, left: 49 },
        { top: 43, left: 30 }
    ];

    allArtists.forEach((artist, index) => {
        addFloatingArtist(
            layer,
            artist,
            index,
            positions[index]
        );
    });

    console.log(
        `Artistas mostrados en la pantalla de carga: ${allArtists.length}`,
        allArtists.map(artist => artist.name)
    );

    startHatMessages([]);

    return allArtists;
}

// ==========================================
// ANIMACIÓN DE TRANSICIÓN
// ==========================================

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function playResultTransition() {
    if (hatMessageInterval) {
        clearInterval(hatMessageInterval);
        hatMessageInterval = null;
    }

    const screen = document.getElementById("analysis-screen");

    if (!screen) return;

    screen.classList.add("analysis-ending");

    const message = document.getElementById("hat-message");
    const heading = document.querySelector(".analysis-content h2");
    const progress = document.getElementById("analysis-progress");

    if (message) {
        message.textContent = "«Creo que ya sé dónde pertenecés...»";
    }

    if (heading) {
        heading.textContent = "El Sombrero ha decidido...";
    }

    if (progress) {
        progress.textContent = "Preparando la revelación...";
    }

    await wait(700);

    screen.classList.add("elements-rising");

    await wait(1500);
}

// ==========================================
// RECIBIR RESPUESTA DE SPOTIFY
// ==========================================

async function handleSpotifyCallback() {
    const params = new URLSearchParams(window.location.search);

    const code = params.get("code");
    const returnedState = params.get("state");
    const error = params.get("error");

    if (!code && !error) {
        showHome();
        return;
    }

    if (error) {
        home.innerHTML = `
            <div class="home-screen">
                <h1>No se pudo autorizar</h1>
                <p>Spotify devolvió este mensaje: ${escapeHTML(error)}</p>
                <button id="retry-button" class="magic-button">Volver a intentar</button>
            </div>
        `;

        document.getElementById("retry-button")
            .addEventListener("click", showHome);
        return;
    }

    const verifier = returnedState
        ? sessionStorage.getItem("spotify_verifier_" + returnedState)
        : null;

    if (!returnedState || !verifier) {
        home.innerHTML = `
            <div class="home-screen">
                <h1>Error de autorización</h1>
                <p>No pudimos verificar la respuesta de Spotify.</p>
                <button id="retry-button" class="magic-button">Volver a intentar</button>
            </div>
        `;

        document.getElementById("retry-button")
            .addEventListener("click", showHome);
        return;
    }

    home.innerHTML = `
        <div class="home-screen">
            <h1>Conectando con Spotify...</h1>
            <p>Estamos obteniendo tus gustos musicales.</p>
        </div>
    `;

    try {
        const tokenResponse = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    client_id: SPOTIFY_CLIENT_ID,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: SPOTIFY_REDIRECT_URI,
                    code_verifier: verifier
                })
            }
        );

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            throw new Error(
                tokenData.error_description ||
                tokenData.error ||
                "No se pudo obtener el token."
            );
        }

        sessionStorage.removeItem("spotify_verifier_" + returnedState);

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );

        const headers = {
            Authorization: "Bearer " + tokenData.access_token
        };

        const [artistsResponse, tracksResponse] = await Promise.all([
            fetch(
                "https://api.spotify.com/v1/me/top/artists?limit=" +
                SPOTIFY_LIMIT + "&time_range=medium_term",
                { headers }
            ),
            fetch(
                "https://api.spotify.com/v1/me/top/tracks?limit=" +
                SPOTIFY_LIMIT + "&time_range=medium_term",
                { headers }
            )
        ]);

        if (!artistsResponse.ok || !tracksResponse.ok) {
            throw new Error(
                "Spotify no pudo devolver tus artistas o canciones. Código: " +
                (!artistsResponse.ok
                    ? artistsResponse.status
                    : tracksResponse.status)
            );
        }

        const artistsData = await artistsResponse.json();
        const tracksData = await tracksResponse.json();

        const artists = artistsData.items || [];
        const tracks = tracksData.items || [];

        if (!artists.length && !tracks.length) {
            throw new Error("Spotify no devolvió artistas ni canciones.");
        }

        // La pantalla de análisis empieza mientras se procesan los datos.
        const analysisReady = showAnalysis(
            artists,
            tokenData.access_token
        );

        const music = await analyzeMusic(
            artists,
            tracks,
            tokenData.access_token
        );

        // Esperamos a que termine la carga de artistas del fondo.
        await analysisReady;

        // Actualizamos las frases con los géneros reales.
        const finalMessages = getHatMessages(
            music.artists,
            music.tracks,
            music.mostFrequentTags
        );

        if (hatMessageInterval) {
            clearInterval(hatMessageInterval);
            hatMessageInterval = null;
        }

        const messageElement = document.getElementById("hat-message");

        if (messageElement && finalMessages.length) {
            messageElement.textContent = `«${finalMessages[0]}»`;
        }

        await playResultTransition();

        showResult(music);

    } catch (error) {
        console.error("Error durante el análisis:", error);

        if (hatMessageInterval) {
            clearInterval(hatMessageInterval);
            hatMessageInterval = null;
        }

        home.innerHTML = `
            <div class="home-screen">
                <h1>Hubo un problema</h1>
                <p>${escapeHTML(error.message)}</p>
                <p>Podés volver e intentar conectar otra vez.</p>
                <button id="retry-button" class="magic-button">Volver al inicio</button>
            </div>
        `;

        document.getElementById("retry-button")
            .addEventListener("click", showHome);
    }
}

// ==========================================
// PAPELITOS DE SORPRESA
// ==========================================

function launchConfetti() {
    const container = document.createElement("div");
    container.className = "result-confetti";

    const colors = [
        "#c5a45b", "#e6ce91", "#801e38",
        "#5b1025", "#f0e5cc"
    ];

    for (let i = 0; i < 65; i++) {
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        piece.style.left = Math.random() * 100 + "%";
        piece.style.backgroundColor =
            colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 1.5 + "s";
        piece.style.animationDuration = 2.5 + Math.random() * 2 + "s";
        piece.style.transform = `rotate(${Math.random() * 360}deg)`;
        container.appendChild(piece);
    }

    document.body.appendChild(container);

    setTimeout(() => container.remove(), 6000);
}

// ==========================================
// CONSTRUIR LOS TOP 10
// ==========================================


function createRanking(
    title,
    items,
    getName,
    getDetail,
    getImage,
    getIcon
) {
    if (!items.length) {
        return `
            <section class="ranking-section">
                <h2 class="ranking-title">${title}</h2>
                <p class="ranking-empty">No hay suficientes datos para mostrar este ranking.</p>
            </section>
        `;
    }

    const first = items[0];
    const firstImage = getImage ? getImage(first) : "";
    const firstIcon = getIcon ? getIcon(first) : "";

    const featuredImage = firstIcon
        ? `<div class="ranking-feature-symbol genre-icon">${firstIcon}</div>`
        : firstImage
            ? `<img class="ranking-feature-image" src="${escapeHTML(firstImage)}" alt="">`
            : `<div class="ranking-feature-symbol">✦</div>`;

    const detail = getDetail ? getDetail(first) : "";

    const remaining = items.slice(1, 10).map((item, index) => {
        const position = String(index + 2).padStart(2, "0");
        const name = escapeHTML(getName(item));
        const sub = getDetail ? getDetail(item) : "";
        const image = getImage ? getImage(item) : "";
        const icon = getIcon ? getIcon(item) : "";

        const rowImage = icon
            ? `<div class="ranking-row-image genre-icon">${icon}</div>`
            : image
                ? `<img class="ranking-row-image" src="${escapeHTML(image)}" alt="">`
                : `<div class="ranking-row-image ranking-row-placeholder">✦</div>`;

        const hiddenClass = index >= 4 ? "ranking-row-hidden" : "";

        return `
            <div class="ranking-row ${hiddenClass}">
                <span class="ranking-number">${position}</span>
                ${rowImage}
                <div class="ranking-row-info">
                    <span class="ranking-row-name">${name}</span>
                    ${sub ? `<span class="ranking-row-detail">${escapeHTML(sub)}</span>` : ""}
                </div>
                <span class="ranking-star">✧</span>
            </div>
        `;
    }).join("");

    const hasMore = items.length > 5;

    return `
        <section class="ranking-section">
            <h2 class="ranking-title">${title}</h2>

            <div class="ranking-feature">
                <div class="ranking-feature-number">01</div>
                ${featuredImage}
                <div class="ranking-feature-info">
                    <span class="ranking-first-label">TU NÚMERO UNO</span>
                    <h3>${escapeHTML(getName(first))}</h3>
                    ${detail ? `<p>${escapeHTML(detail)}</p>` : ""}
                </div>
            </div>

            <div class="ranking-list">
                ${remaining}
            </div>

            ${hasMore ? `
                <button class="ranking-show-more" type="button">
                    Ver más
                </button>
            ` : ""}
        </section>
    `;
}


// ==========================================
// RESULTADOS
// ==========================================
function getHouseCrestSVG(house, size = "large") {
    const crests = {
        Gryffindor: {
            bg: "#741b2b",
            animal: "🦁"
        },
        Slytherin: {
            bg: "#174c38",
            animal: "🐍"
        },
        Ravenclaw: {
            bg: "#18365f",
            animal: "🦅"
        },
        Hufflepuff: {
            bg: "#a47b18",
            animal: "🦡"
        }
    };

    const crest = crests[house];

    if (!crest) return "";

    return `
        <svg
            class="house-crest house-crest-${size}"
            viewBox="0 0 160 190"
            role="img"
            aria-label="Escudo de ${house}"
        >
            <path
                d="M15 12 L145 12 L145 112 Q137 151 80 180 Q23 151 15 112 Z"
                fill="#c5a45b"
                stroke="#e6ce91"
                stroke-width="5"
            />
            <path
                d="M23 20 L137 20 L137 110 Q130 145 80 169 Q30 145 23 110 Z"
                fill="${crest.bg}"
                stroke="#3b2114"
                stroke-width="3"
            />
            <path
                d="M31 28 L129 28 L129 108 Q123 139 80 160 Q37 139 31 108 Z"
                fill="none"
                stroke="#e6ce91"
                stroke-width="2"
            />
            <text
                x="80"
                y="111"
                text-anchor="middle"
                font-size="70"
                dominant-baseline="middle"
            >${crest.animal}</text>
            <path
                d="M48 139 L80 153 L112 139"
                fill="none"
                stroke="#e6ce91"
                stroke-width="2"
            />
        </svg>
    `;
}

function showResult(music) {
    const result = sortIntoHouse(music);

    const houseThemes = {
        Gryffindor: {
            colors: ["#761b2b", "#b52e3b", "#e8bd68"],
            background: "#260e15",
            accent: "#e8bd68",
            symbol: "🦁",
        },
        Slytherin: {
            colors: ["#174c38", "#26734d", "#b9c9bd"],
            background: "#0b2119",
            accent: "#b9c9bd",
            symbol: "🐍",
        },
        Ravenclaw: {
            colors: ["#18365f", "#315c9b", "#c49a62"],
            background: "#0c1b31",
            accent: "#c49a62",
            symbol: "🦅",
        },
        Hufflepuff: {
            colors: ["#a47b18", "#d6a928", "#171717"],
            background: "#2a210d",
            accent: "#f0d47d",
            symbol: "🦡",
        }
    };

    if (!result.winner) {
        home.innerHTML = `
            <div class="home-screen">
                <h1>El Sombrero no pudo decidir</h1>
                <p>No encontramos suficientes géneros musicales para asignarte una casa.</p>
                <button id="back-button" class="magic-button">Volver al inicio</button>
            </div>
        `;

        document.getElementById("back-button")
            .addEventListener("click", showHome);
        return;
    }

    const theme = houseThemes[result.winner];

    const orderedHouses = Object.entries(result.percentages)
        .sort((a, b) => b[1] - a[1]);

    
const otherHousesHTML = orderedHouses
    .filter(([house]) => house !== result.winner)
    .map(([house, percentage]) => {
        const otherTheme = houseThemes[house];

        return `
            <div class="other-house">
                <span class="other-house-animal">
                    ${otherTheme.symbol}
                </span>

                <div class="other-house-info">
                    <div class="other-house-heading">
                        <span class="other-house-name">
                            ${escapeHTML(house)}
                        </span>
                        <strong>${percentage}%</strong>
                    </div>

                    <div class="house-bar">
                        <div
                            class="house-bar-fill"
                            style="width:${percentage}%; background:${otherTheme.colors[1]}"
                        ></div>
                    </div>
                </div>
            </div>
        `;
    }).join("");


    const artistRanking = createRanking(
        "TOP 10 ARTISTAS",
        music.artists,
        artist => artist.name,
        null,
        artist => artist.image
    );

    const trackRanking = createRanking(
        "TOP 10 CANCIONES",
        music.tracks,
        track => track.name,
        track => track.artists.join(", "),
        track => track.image
    );

    const genreRanking = createRanking(
        "TOP 10 GÉNEROS",
        music.mostFrequentTags,
        genre => capitalizeFirst(genre.name),
        genre => `${genre.count} apariciones`,
        null,
        genre => getGenreIcon(genre.name)
    );

    const resultStyles = `
        <style>
            .sorting-result {
                --house-bg: ${theme.background};
                --house-accent: ${theme.accent};
                --house-one: ${theme.colors[0]};
                --house-two: ${theme.colors[1]};
                --house-three: ${theme.colors[2]};
            }

            .ranking-row-placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--house-accent);
                border: 1px solid var(--house-accent);
            }
        </style>
    `;

    home.innerHTML = `
        ${resultStyles}

        <div class="sorting-result result-reveal">

            <div class="result-heading">
                <span>✧</span> ¡EL SOMBRERO HA DECIDIDO! <span>✧</span>
            </div>

            <section class="winner-section">

                <div class="winner-watermark" aria-hidden="true">
                    ${theme.symbol}
                </div>

                <div class="winner-crest-layout">
                    ${getHouseCrestSVG(result.winner)}

                    <div class="winner-copy">
                        <div class="winner-label">TU CASA ES</div>

                        <div class="winner-name">
                            ${escapeHTML(result.winner.toUpperCase())}
                        </div>

                        <div class="winner-percentage">
                            ${result.percentages[result.winner]}%
                        </div>

                        <div class="winner-bar">
                            <div
                                class="winner-bar-fill"
                                style="--winner-width:${result.percentages[result.winner]}%"
                            ></div>
                        </div>

                        <div class="winner-caption">CASA GANADORA</div>
                    </div>
                </div>
            </section>

            <section class="other-houses-section">
                <h3 class="other-houses-title">Afinidad con las demás casas</h3>
                ${otherHousesHTML}
            </section>

            <div class="music-details">
                ${artistRanking}
                ${trackRanking}
                ${genreRanking}

                <div class="result-explanation">
                    <p>
                        Los números de géneros indican en cuántos artistas y
                        canciones apareció cada etiqueta musical.
                    </p>
                    <p>
                        Los géneros principales aportan 3 puntos y los
                        secundarios 1 punto. Los artistas tienen un peso
                        de 2 y las canciones un peso de 1.
                    </p>
                </div>
            </div>

            <button id="back-button" class="result-button magic-button">
                Volver al inicio
            </button>
        </div>
    `;
// Botón para volver al inicio
const backButton = document.getElementById("back-button");

if (backButton) {
    backButton.addEventListener("click", showHome);
}
    // Botones "Ver más" de los rankings
    document.querySelectorAll(".ranking-show-more").forEach(button => {
    button.addEventListener("click", () => {
        const section = button.closest(".ranking-section");
        const hiddenRows = section.querySelectorAll(".ranking-row-hidden");
        const expanded = button.dataset.expanded === "true";

        hiddenRows.forEach(row => {
            row.classList.toggle("ranking-row-visible", !expanded);
        });

        button.dataset.expanded = expanded ? "false" : "true";
        button.textContent = expanded ? "Ver más" : "Ver menos";
    });
});
}

// ==========================================
// INICIAR
// ==========================================

handleSpotifyCallback();
