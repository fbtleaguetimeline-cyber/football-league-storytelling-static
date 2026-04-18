const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const leagueDir = path.join(rootDir, "league");
const dataDir = path.join(rootDir, "data");
const outputPath = path.join(dataDir, "seasons.json");
const archiveScriptPath = path.join(dataDir, "archive.js");
const indexPath = path.join(rootDir, "index.html");
const sitemapPath = path.join(rootDir, "sitemap.xml");

const leagueNames = {
  epl: "English Football League / Premier League",
};

function toTitleFromSlug(slug) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSeasonFromFile(fileName) {
  const match = fileName.match(/^(\d{4}-\d{4})/);
  return match ? match[1] : path.basename(fileName, path.extname(fileName));
}

function getDescription(leagueName, season) {
  return `${leagueName}, ${season} season narrative.`;
}

function buildManifest() {
  if (!fs.existsSync(leagueDir)) {
    throw new Error(`Missing league directory: ${leagueDir}`);
  }

  const leagueSlugs = fs
    .readdirSync(leagueDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const seasons = [];
  const leagues = leagueSlugs.map((slug) => {
    const dir = path.join(leagueDir, slug);
    const name = leagueNames[slug] || toTitleFromSlug(slug);
    const files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))
      .map((entry) => entry.name)
      .sort();

    files.forEach((fileName) => {
      const season = getSeasonFromFile(fileName);
      seasons.push({
        leagueSlug: slug,
        leagueName: name,
        season,
        title: `${season} Season`,
        fileName,
        path: `league/${slug}/${fileName}`,
        description: getDescription(name, season),
      });
    });

    return {
      slug,
      name,
      count: files.length,
    };
  });

  return {
    leagues,
    seasons,
  };
}

function buildArchive(manifest) {
  const narratives = {};

  manifest.seasons.forEach((season) => {
    narratives[season.path] = fs.readFileSync(path.join(rootDir, season.path), "utf8");
  });

  return {
    manifest,
    narratives,
  };
}

function buildSeasonLinks(manifest) {
  return manifest.seasons
    .map((season) => {
      const href = `?league=${encodeURIComponent(season.leagueSlug)}&season=${encodeURIComponent(season.season)}#reader`;
      return `        <a href="${href}" class="season-card">
          <span>
            <small>${escapeHtml(season.leagueName)}</small>
            <h3>${escapeHtml(season.title)}</h3>
          </span>
          <small>Read the season story</small>
        </a>`;
    })
    .join("\n");
}

function updateIndex(manifest) {
  if (!fs.existsSync(indexPath)) {
    return;
  }

  const start = "SEO_SEASON_LINKS_START";
  const end = "SEO_SEASON_LINKS_END";
  const seoPattern = new RegExp(`\\s*<!-- ${escapeRegExp(start)} -->[\\s\\S]*?\\s*<!-- ${escapeRegExp(end)} -->`);
  const seoReplacement = `\n        <!-- ${start} -->\n${buildSeasonLinks(manifest)}\n        <!-- ${end} -->`;
  const version = Date.now().toString();
  let html = fs.readFileSync(indexPath, "utf8");

  if (!seoPattern.test(html)) {
    throw new Error("Missing SEO season links markers in index.html");
  }

  html = html
    .replace(seoPattern, seoReplacement)
    .replace(/href="css\/style\.css(?:\?v=[^"]*)?"/, `href="css/style.css?v=${version}"`)
    .replace(/src="data\/archive\.js(?:\?v=[^"]*)?"/, `src="data/archive.js?v=${version}"`)
    .replace(/src="js\/app\.js(?:\?v=[^"]*)?"/, `src="js/app.js?v=${version}"`);

  fs.writeFileSync(indexPath, html);
}

function writeSitemap(manifest) {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    return false;
  }

  const baseUrl = siteUrl.replace(/\/+$/, "");
  const urls = [
    `${baseUrl}/`,
    ...manifest.seasons.map((season) => {
      const query = `league=${encodeURIComponent(season.leagueSlug)}&season=${encodeURIComponent(season.season)}`;
      return `${baseUrl}/?${query}`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join("\n")}\n</urlset>\n`;

  fs.writeFileSync(sitemapPath, xml);
  return true;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

fs.mkdirSync(dataDir, { recursive: true });
const manifest = buildManifest();
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(
  archiveScriptPath,
  `window.__FOOTBALL_ARCHIVE__ = ${JSON.stringify(buildArchive(manifest), null, 2)};\n`,
);
updateIndex(manifest);
const wroteSitemap = writeSitemap(manifest);
console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
console.log(`Wrote ${path.relative(rootDir, archiveScriptPath)}`);
console.log(`Updated ${path.relative(rootDir, indexPath)}`);
if (wroteSitemap) {
  console.log(`Wrote ${path.relative(rootDir, sitemapPath)}`);
}
