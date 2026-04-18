const state = {
  manifest: null,
  activeLeague: "all",
  activeSeasonKey: "",
  currentPage: 1,
  pageSize: 10,
  query: "",
};

const elements = {
  archiveCount: document.querySelector("#archive-count"),
  backToTop: document.querySelector("#back-to-top"),
  canonical: document.querySelector('link[rel="canonical"]'),
  leagueCount: document.querySelector("#league-count"),
  metaDescription: document.querySelector('meta[name="description"]'),
  ogDescription: document.querySelector('meta[property="og:description"]'),
  ogTitle: document.querySelector('meta[property="og:title"]'),
  ogUrl: document.querySelector('meta[property="og:url"]'),
  pagination: document.querySelector("#pagination"),
  seasonCount: document.querySelector("#season-count"),
  structuredData: document.querySelector("#structured-data"),
  tabs: document.querySelector("#league-tabs"),
  twitterDescription: document.querySelector('meta[name="twitter:description"]'),
  twitterTitle: document.querySelector('meta[name="twitter:title"]'),
  grid: document.querySelector("#season-grid"),
  search: document.querySelector("#season-search"),
  readerLeague: document.querySelector("#reader-league"),
  readerMeta: document.querySelector("#reader-meta"),
  readerTitle: document.querySelector("#reader-title"),
  readerSummary: document.querySelector("#reader-summary"),
  readingProgress: document.querySelector("#reading-progress"),
  copyLink: document.querySelector("#copy-link"),
  story: document.querySelector("#story"),
};

init();

async function init() {
  try {
    state.manifest = await loadManifest();
    hydrateFromUrl();
    updateSeoMetadata();
    renderArchive();

    const firstSeason = getFilteredSeasons()[0] || getAllSeasons()[0];
    if (state.activeSeasonKey) {
      await loadSeasonByKey(state.activeSeasonKey, false);
    } else if (firstSeason) {
      await loadSeason(firstSeason, false);
    }
  } catch (error) {
    elements.grid.innerHTML = `<p class="error-state">The archive is not available right now.</p>`;
    elements.story.innerHTML = `<p class="error-state">Please refresh the page and try again.</p>`;
  }
}

async function loadManifest() {
  if (window.__FOOTBALL_ARCHIVE__?.manifest) {
    return window.__FOOTBALL_ARCHIVE__.manifest;
  }

  const response = await fetch("data/seasons.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Archive unavailable");
  }

  return response.json();
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const league = params.get("league");
  const season = params.get("season");

  if (league && state.manifest.leagues.some((item) => item.slug === league)) {
    state.activeLeague = league;
  }

  if (league && season) {
    state.activeSeasonKey = `${league}/${season}`;
  }
}

function renderArchive() {
  elements.leagueCount.textContent = state.manifest.leagues.length;
  elements.seasonCount.textContent = state.manifest.seasons.length;
  renderTabs();
  renderSeasonGrid();

  elements.search.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    state.currentPage = 1;
    renderSeasonGrid();
  });

  window.addEventListener("popstate", async () => {
    hydrateFromUrl();
    renderTabs();
    renderSeasonGrid();
    if (state.activeSeasonKey) {
      await loadSeasonByKey(state.activeSeasonKey, false);
    }
  });

  elements.copyLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      elements.copyLink.textContent = "Copied";
    } catch {
      elements.copyLink.textContent = "Copy unavailable";
    }

    window.setTimeout(() => {
      elements.copyLink.textContent = "Copy link";
    }, 1400);
  });

  elements.backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateReadingProgress, { passive: true });
  updateReadingProgress();
}

function renderTabs() {
  const tabs = [
    { slug: "all", name: "All leagues", count: state.manifest.seasons.length },
    ...state.manifest.leagues,
  ];

  elements.tabs.innerHTML = tabs
    .map((league) => {
      const selected = state.activeLeague === league.slug;
      return `<button class="league-tab" type="button" role="tab" aria-selected="${selected}" data-league="${league.slug}">
        ${escapeHtml(league.name)} <span class="tab-count">${league.count}</span>
      </button>`;
    })
    .join("");

  elements.tabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeLeague = button.dataset.league;
      state.currentPage = 1;
      renderTabs();
      renderSeasonGrid();
    });
  });
}

function renderSeasonGrid() {
  const seasons = getFilteredSeasons();
  const suffix = seasons.length === 1 ? "season" : "seasons";
  const totalPages = Math.max(Math.ceil(seasons.length / state.pageSize), 1);

  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }

  if (!seasons.length) {
    elements.grid.innerHTML = `<p class="empty-state">No seasons match this search.</p>`;
    elements.archiveCount.textContent = "No seasons match this search";
    renderPagination(0);
    return;
  }

  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, seasons.length);
  const visibleSeasons = seasons.slice(startIndex, endIndex);

  elements.archiveCount.textContent = `Showing ${startIndex + 1}-${endIndex} of ${seasons.length} ${suffix}`;
  elements.grid.innerHTML = visibleSeasons
    .map((season) => {
      const key = getSeasonKey(season);
      const activeClass = state.activeSeasonKey === key ? " is-active" : "";
      return `<a class="season-card${activeClass}" href="?league=${encodeURIComponent(season.leagueSlug)}&season=${encodeURIComponent(season.season)}#reader" data-key="${escapeHtml(key)}">
        <span>
          <small>${escapeHtml(season.leagueName)}</small>
          <h3>${escapeHtml(season.title)}</h3>
        </span>
        <small>Read the season story</small>
      </a>`;
    })
    .join("");

  elements.grid.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await loadSeasonByKey(link.dataset.key, true);
      document.querySelector("#reader").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  if (!elements.pagination) {
    return;
  }

  if (totalPages <= 1) {
    elements.pagination.innerHTML = "";
    return;
  }

  const pageButtons = Array.from({ length: totalPages }, (_, index) => index + 1)
    .map((page) => {
      const current = page === state.currentPage;
      return `<button type="button" class="page-button" data-page="${page}" aria-current="${current ? "page" : "false"}">${page}</button>`;
    })
    .join("");

  elements.pagination.innerHTML = `
    <button type="button" class="page-button" data-page="${state.currentPage - 1}" ${state.currentPage === 1 ? "disabled" : ""}>Previous</button>
    <span class="page-list">${pageButtons}</span>
    <button type="button" class="page-button" data-page="${state.currentPage + 1}" ${state.currentPage === totalPages ? "disabled" : ""}>Next</button>
  `;

  elements.pagination.querySelectorAll("button[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.page);
      if (!Number.isFinite(nextPage) || nextPage < 1 || nextPage > totalPages) {
        return;
      }

      state.currentPage = nextPage;
      renderSeasonGrid();
      document.querySelector("#archive").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function loadSeasonByKey(key, pushUrl) {
  const season = state.manifest.seasons.find((item) => getSeasonKey(item) === key);
  if (season) {
    await loadSeason(season, pushUrl);
  }
}

async function loadSeason(season, pushUrl) {
  state.activeSeasonKey = getSeasonKey(season);
  state.activeLeague = season.leagueSlug;
  setPageForSeason(season);
  renderTabs();
  renderSeasonGrid();

  elements.readerLeague.textContent = season.leagueName;
  elements.readerTitle.textContent = season.title;
  elements.readerSummary.textContent = season.description;
  elements.readerMeta.hidden = false;
  elements.readerMeta.innerHTML = `
    <span>${escapeHtml(season.season)}</span>
    <span>${escapeHtml(season.leagueName)}</span>
    <span>Long-form story</span>
  `;
  elements.copyLink.hidden = false;
  elements.story.innerHTML = `<p class="empty-state">Loading narrative...</p>`;

  if (pushUrl) {
    const nextUrl = `?league=${encodeURIComponent(season.leagueSlug)}&season=${encodeURIComponent(season.season)}#reader`;
    window.history.pushState({}, "", nextUrl);
  }

  updateSeoMetadata(season);

  try {
    const text = await loadNarrative(season.path);
    elements.story.innerHTML = textToParagraphs(text);
    updateReadingProgress();
  } catch (error) {
    elements.story.innerHTML = `<p class="error-state">This season story is not available right now.</p>`;
  }
}

function setPageForSeason(season) {
  const seasons = getFilteredSeasons();
  const index = seasons.findIndex((item) => getSeasonKey(item) === getSeasonKey(season));

  if (index >= 0) {
    state.currentPage = Math.floor(index / state.pageSize) + 1;
  }
}

async function loadNarrative(path) {
  const embeddedText = window.__FOOTBALL_ARCHIVE__?.narratives?.[path];
  if (typeof embeddedText === "string") {
    return embeddedText;
  }

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error("Season story unavailable");
  }

  return response.text();
}

function updateSeoMetadata(season) {
  const canonicalUrl = getCanonicalUrl();
  const title = season
    ? `${season.title} ${season.leagueName} Story | Football League Storytelling`
    : "Football League Storytelling | Season-by-Season Football Narratives";
  const description = season
    ? `Read the ${season.season} ${season.leagueName} season story, with table movement, match-day turning points, title race context, and campaign narrative.`
    : "Read long-form football league season narratives, historical table races, match-by-match momentum shifts, and campaign stories from English football and beyond.";

  document.title = title;
  setContent(elements.metaDescription, description);
  setContent(elements.ogTitle, title);
  setContent(elements.ogDescription, description);
  setContent(elements.ogUrl, canonicalUrl);
  setContent(elements.twitterTitle, title);
  setContent(elements.twitterDescription, description);

  if (elements.canonical) {
    elements.canonical.href = canonicalUrl;
  }

  updateStructuredData(season, canonicalUrl, title, description);
}

function updateStructuredData(season, canonicalUrl, title, description) {
  if (!elements.structuredData) {
    return;
  }

  const data = season
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        url: canonicalUrl,
        inLanguage: "en",
        about: ["football history", "football league", season.leagueName, season.season],
        isPartOf: {
          "@type": "WebSite",
          name: "Football League Storytelling",
        },
      }
    : {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Football League Storytelling",
        url: canonicalUrl,
        description,
        inLanguage: "en",
        sameAs: [
          "https://www.facebook.com/profile.php?id=61587747857525",
          "https://www.youtube.com/@FootballLeagueTimeline",
          "https://www.tiktok.com/@ftbl.league.timeline",
          "https://x.com/FtblLeagueTime",
        ],
      };

  elements.structuredData.textContent = JSON.stringify(data, null, 2);
}

function getCanonicalUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.href;
}

function setContent(element, value) {
  if (element) {
    element.setAttribute("content", value);
  }
}

function updateReadingProgress() {
  const storyRect = elements.story.getBoundingClientRect();
  const storyTop = window.scrollY + storyRect.top;
  const storyHeight = elements.story.offsetHeight - window.innerHeight;
  const distance = window.scrollY - storyTop;
  const progress = storyHeight > 0 ? Math.min(Math.max(distance / storyHeight, 0), 1) : 0;

  if (elements.readingProgress) {
    elements.readingProgress.style.transform = `scaleX(${progress})`;
  }

  document.body.classList.toggle("show-back-to-top", window.scrollY > 560);
}

function getFilteredSeasons() {
  return getAllSeasons().filter((season) => {
    const matchesLeague = state.activeLeague === "all" || season.leagueSlug === state.activeLeague;
    const haystack = `${season.leagueName} ${season.title} ${season.season}`.toLowerCase();
    return matchesLeague && (!state.query || haystack.includes(state.query));
  });
}

function getAllSeasons() {
  return [...state.manifest.seasons].sort((a, b) => {
    if (a.leagueName !== b.leagueName) {
      return a.leagueName.localeCompare(b.leagueName);
    }
    return a.season.localeCompare(b.season);
  });
}

function getSeasonKey(season) {
  return `${season.leagueSlug}/${season.season}`;
}

function textToParagraphs(text) {
  return text
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
