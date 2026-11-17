#!/usr/bin/env node
/**
 * Sincronizza il catalogo ZAlight (brand, prodotti, settori, tipologie, news, referenze)
 * dalla REST API WordPress + scraping leggero delle pagine pubbliche di zalight.it.
 *
 * Output: src/data/zalight/*.json
 * Uso:    npm run sync:zalight
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../src/data/zalight');
const BASE = 'https://www.zalight.it';
const API = `${BASE}/wp-json/wp/v2`;
const UA = 'Mozilla/5.0 (compatible; ArtcontentSync/1.0; +https://www.artcontent.it)';
const CONCURRENCY = 6;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.text();
  } catch (err) {
    if (attempt >= 3) throw err;
    await sleep(500 * attempt);
    return fetchText(url, attempt + 1);
  }
}

async function fetchAllPages(endpoint, params) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${API}/${endpoint}?per_page=100&page=${page}&${params}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 400) break; // oltre l'ultima pagina
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...data);
    const total = Number(res.headers.get('X-WP-TotalPages') ?? 1);
    if (page >= total) break;
  }
  return out;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026', deg: '\u00b0',
  egrave: 'è', eacute: 'é', agrave: 'à', ograve: 'ò', ugrave: 'ù', igrave: 'ì',
  Egrave: 'È', Eacute: 'É', Agrave: 'À', Ograve: 'Ò', Ugrave: 'Ù', Igrave: 'Ì',
  copy: '©', reg: '®', trade: '™',
};

function decode(str = '') {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m);
}

function stripTags(html = '') {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Estrae i paragrafi (<p>) di un frammento HTML come array di stringhe pulite. */
function paragraphs(html = '') {
  const out = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = stripTags(m[1]);
    if (text) out.push(text);
  }
  return out;
}

function first(re, str, group = 1) {
  const m = re.exec(str);
  return m ? m[group] : undefined;
}

function slugFromUrl(url = '') {
  const parts = url.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1];
}

/** Rimuove i suffissi di ridimensionamento WordPress (es. -300x300). */
function fullSizeImage(url = '') {
  return url.replace(/-\d+x\d+(?=\.(?:png|jpe?g|webp|gif)$)/i, '');
}

/** Estrae il blocco <section> principale (dopo l'header, prima del footer). */
function mainMarkup(html) {
  const start = html.indexOf('<section');
  const end = html.indexOf('<footer');
  return html.slice(start < 0 ? 0 : start, end < 0 ? undefined : end);
}

/** Card prodotto (`.prodotto`) presenti in una pagina brand/tipologia/settore. */
function parseProductCards(html) {
  const cards = [];
  // Ogni card inizia con <div class='prodotto'>; alcune (es. Chauvet DJ) non hanno
  // link alla pagina prodotto ma solo il PDF della scheda tecnica.
  const chunks = html.split("<div class='prodotto'>").slice(1);
  for (const raw of chunks) {
    const block = raw.split("<div class='brand__tipologia'>")[0];
    const href = first(/<a class='link__prodotto' href='([^']+)'/, block);
    const name = stripTags(first(/<h4[^>]*>([\s\S]*?)<\/h4>/, block) ?? '');
    if (!name) continue;
    cards.push({
      slug: href ? slugFromUrl(href) : null,
      nameKey: normalizeName(name),
      url: href ?? null,
      isNew: /new__marker/.test(block),
      image: fullSizeImage(first(/class='prodotto__img'\s+src='([^']+)'/, block) ?? ''),
      name,
      shortDescription: stripTags(first(/<p class='brand__prodotto__text'>([\s\S]*?)<\/p>/, block) ?? ''),
      datasheet: first(/<a class='bts_sem' href='([^']+\.pdf[^']*)'/, block) ?? null,
    });
  }
  return cards;
}

function normalizeName(name = '') {
  return decode(name).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ---------------------------------------------------------------------------
// Tassonomie
// ---------------------------------------------------------------------------
async function syncTaxonomies() {
  const [settori, tipologie] = await Promise.all([
    fetchAllPages('settore', '_fields=id,name,slug,count,link'),
    fetchAllPages('tipologia', '_fields=id,name,slug,count,link'),
  ]);

  const settoriDetailed = await mapLimit(settori, CONCURRENCY, async (s) => {
    const html = mainMarkup(await fetchText(s.link));
    const textBlock = first(/<div[^>]+class="ct-text-block"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/, html) ?? '';
    const gallery = [...html.matchAll(/<a href="([^"]+)" data-fancybox="gallery">/g)].map((m) => m[1]);
    return {
      id: s.id,
      name: decode(s.name),
      slug: s.slug,
      count: s.count,
      zalightUrl: s.link,
      description: paragraphs(textBlock),
      gallery,
    };
  });

  return {
    settori: settoriDetailed.sort((a, b) => a.name.localeCompare(b.name, 'it')),
    tipologie: tipologie
      .map((t) => ({ id: t.id, name: decode(t.name), slug: t.slug, count: t.count, zalightUrl: t.link }))
      .sort((a, b) => a.name.localeCompare(b.name, 'it')),
  };
}

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------
async function syncBrands(homeHtml) {
  const brands = await fetchAllPages('brand', '_fields=id,name,slug,count,description,link');

  // Loghi dalla griglia brand della home (alt = nome brand)
  const homeLogos = new Map();
  for (const m of homeHtml.matchAll(/<div class='brand__content'>[\s\S]*?title='([^']+)'[\s\S]*?src='([^']+)'/g)) {
    homeLogos.set(decode(m[1]).toLowerCase(), m[2]);
  }

  const detailed = await mapLimit(brands, CONCURRENCY, async (b) => {
    const html = mainMarkup(await fetchText(b.link));
    const logo =
      first(/<img[^>]+id="image-\d+-\d+"[^>]+src="([^"]+)"[^>]*class="ct-image"/, html) ??
      homeLogos.get(decode(b.name).toLowerCase()) ??
      null;
    const textBlock = first(/<div[^>]+class="ct-text-block"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/, html) ?? '';
    const website = first(/<a[^>]+href="(https?:\/\/(?!www\.zalight\.it)[^"]+)"[^>]*>(?:(?!<\/a>)[\s\S])*?Visita il sito/i, html) ?? null;
    const cards = parseProductCards(html);
    return {
      id: b.id,
      name: decode(b.name),
      slug: b.slug,
      productCount: b.count,
      zalightUrl: b.link,
      website,
      logo,
      description: paragraphs(textBlock).length ? paragraphs(textBlock) : (b.description ? [stripTags(b.description)] : []),
      _cards: cards,
    };
  });

  return detailed.sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, 'it'));
}

// ---------------------------------------------------------------------------
// Prodotti
// ---------------------------------------------------------------------------
async function syncProducts(brands, taxonomies) {
  const raw = await fetchAllPages(
    'prodotto',
    '_embed=wp:featuredmedia&_fields=id,slug,link,title,date,modified,brand,settore,tipologia,_links,_embedded',
  );

  const brandById = new Map(brands.map((b) => [b.id, b]));
  const settoreById = new Map(taxonomies.settori.map((s) => [s.id, s]));
  const tipologiaById = new Map(taxonomies.tipologie.map((t) => [t.id, t]));
  const cardBySlug = new Map();
  const cardByName = new Map();
  for (const b of brands) {
    for (const c of b._cards) {
      if (c.slug) cardBySlug.set(c.slug, c);
      cardByName.set(`${b.slug}:${c.nameKey}`, c);
    }
  }

  const products = await mapLimit(raw, CONCURRENCY, async (p, i) => {
    if (i % 50 === 0) console.log(`  prodotti ${i}/${raw.length}`);
    let html = '';
    try {
      html = mainMarkup(await fetchText(p.link));
    } catch (err) {
      console.warn(`  ! impossibile leggere ${p.link}: ${err.message}`);
    }
    const brandOfProduct = brandById.get(p.brand?.[0]);
    const card =
      cardBySlug.get(p.slug) ??
      cardByName.get(`${brandOfProduct?.slug}:${normalizeName(stripTags(p.title.rendered))}`);
    const featured = p._embedded?.['wp:featuredmedia']?.[0];
    const textBlock = first(/<div[^>]+class="ct-text-block"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/, html) ?? '';
    const gallery = [...html.matchAll(/<a href="([^"]+)" data-fancybox="gallery">/g)].map((m) => m[1]);
    const datasheet =
      first(/<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>(?:(?!<\/a>)[\s\S])*?SCHEDA TECNICA/i, html) ??
      card?.datasheet ??
      null;
    const video = first(/data-src-cmplz="(https:\/\/www\.youtube\.com\/embed\/[^"?]+)/, html) ?? null;
    const relatedNews = [...html.matchAll(/<div class="oxy-post-container related-news">\s*<a class='oxy-post-link' href='([^']+)'>[\s\S]*?<p class='oxy-post-title'>([\s\S]*?)<\/p>/g)]
      .map((m) => ({ url: m[1], title: stripTags(m[2]) }));

    const image = card?.image || featured?.source_url || gallery[0] || null;
    const brandSlug = p.brand?.map((id) => brandById.get(id)?.slug).filter(Boolean)[0] ?? null;

    return {
      id: p.id,
      slug: p.slug,
      name: card?.name || stripTags(p.title.rendered),
      brand: brandSlug,
      settori: (p.settore ?? []).map((id) => settoreById.get(id)?.slug).filter(Boolean),
      tipologie: (p.tipologia ?? []).map((id) => tipologiaById.get(id)?.slug).filter(Boolean),
      shortDescription: card?.shortDescription ?? '',
      description: paragraphs(textBlock),
      image,
      imageAlt: featured?.alt_text || `${card?.name || stripTags(p.title.rendered)} - ${brandById.get(p.brand?.[0])?.name ?? 'ZAlight'}`,
      gallery: gallery.filter((g) => g !== image),
      datasheet,
      video,
      relatedNews,
      isNew: card?.isNew ?? false,
      publishedAt: p.date,
      updatedAt: p.modified,
      zalightUrl: p.link,
    };
  });

  return products.sort((a, b) => (a.brand ?? '').localeCompare(b.brand ?? '') || a.name.localeCompare(b.name, 'it'));
}

// ---------------------------------------------------------------------------
// News (snapshot a build-time; il client la aggiorna live)
// ---------------------------------------------------------------------------
export function normalizePost(p, categoriesById) {
  const media = p._embedded?.['wp:featuredmedia']?.[0];
  return {
    id: p.id,
    slug: p.slug,
    date: p.date,
    title: stripTags(p.title?.rendered ?? ''),
    excerpt: stripTags(p.excerpt?.rendered ?? '').replace(/\s*\[…\]$/, '…'),
    url: p.link,
    image: media?.media_details?.sizes?.large?.source_url || media?.source_url || null,
    categories: (p.categories ?? []).map((id) => categoriesById.get(id)).filter(Boolean),
  };
}

async function syncNews() {
  const categories = await fetchAllPages('categories', '_fields=id,name,slug,count');
  const categoriesById = new Map(categories.map((c) => [c.id, c.slug]));
  const posts = await fetchAllPages(
    'posts',
    '_embed=wp:featuredmedia&_fields=id,slug,date,title,excerpt,link,categories,_links,_embedded',
  );
  return {
    categories: categories.map((c) => ({ id: c.id, name: decode(c.name), slug: c.slug, count: c.count })),
    posts: posts.map((p) => normalizePost(p, categoriesById)),
  };
}

// ---------------------------------------------------------------------------
// News dai siti ufficiali dei vendor (RSS)
// ---------------------------------------------------------------------------
const VENDOR_FEEDS = {
  chauvet: 'https://www.chauvetprofessional.com/feed/',
  'chauvet-dj': 'https://www.chauvetdj.com/feed/',
  iluminarc: 'https://www.iluminarc.com/feed/',
  gantom: 'https://www.gantom.com/feed/',
  lites: 'https://www.litessrl.com/feed/',
};

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
};

function cdata(str = '') {
  return str.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1');
}

function parseRss(xml, brandSlug) {
  const items = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const block = m[0];
    const tag = (name) => {
      const v = first(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'), block);
      return v ? cdata(v.trim()) : '';
    };
    const link = tag('link') || first(/<link[^>]*href="([^"]+)"/, block) || '';
    const title = stripTags(tag('title'));
    if (!title || !link) continue;
    const description = tag('description') || tag('content:encoded');
    const excerpt = stripTags(description)
      .replace(/\s*The post .* appeared first on .*$/s, '')
      .trim()
      .slice(0, 220);
    const image =
      first(/<media:content[^>]+url="([^"]+)"/, block) ??
      first(/<enclosure[^>]+url="([^"]+)"[^>]+type="image\//, block) ??
      first(/<img[^>]+src="([^"]+)"/, tag('content:encoded') || description) ??
      null;
    const date = tag('pubDate') || tag('dc:date');
    items.push({
      brand: brandSlug,
      title,
      url: link.trim(),
      date: date ? new Date(date).toISOString() : null,
      excerpt,
      image: image ? decode(image) : null,
    });
  }
  return items;
}

async function syncVendorNews() {
  const entries = Object.entries(VENDOR_FEEDS);
  const results = await mapLimit(entries, 3, async ([brand, url]) => {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseRss(await res.text(), brand).slice(0, 8);
      console.log(`  ${brand}: ${items.length} news`);
      return items;
    } catch (err) {
      console.warn(`  ! feed ${brand} non disponibile (${err.message})`);
      return [];
    }
  });
  return results.flat().sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

// ---------------------------------------------------------------------------
// Referenze (loghi network TV/radio) e home
// ---------------------------------------------------------------------------
async function syncReferences() {
  const html = mainMarkup(await fetchText(`${BASE}/referenze/`));
  const logos = [...html.matchAll(/<img[^>]+src="(https:\/\/www\.zalight\.it\/luce\/wp-content\/uploads\/[^"]+)"[^>]*>/g)]
    .map((m) => m[1])
    .filter((u) => !/logo|chauvet-logo|rollstar/i.test(u));
  return [...new Set(logos)].map((url) => ({
    url,
    name: slugFromUrl(url).replace(/\.(jpe?g|png|webp)$/i, '').replace(/-\d+$/, '').replace(/-/g, ' '),
  }));
}

function parseHomeFeatured(homeHtml) {
  const main = mainMarkup(homeHtml);
  const slugs = [...main.matchAll(/href="https:\/\/www\.zalight\.it\/prodotto\/([^/"]+)\/"/g)].map((m) => m[1]);
  return [...new Set(slugs)];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('→ Sincronizzazione catalogo ZAlight');
  await mkdir(OUT_DIR, { recursive: true });

  const homeHtml = await fetchText(`${BASE}/`);

  console.log('• tassonomie');
  const taxonomies = await syncTaxonomies();

  console.log('• brand');
  const brands = await syncBrands(homeHtml);

  console.log('• prodotti');
  const products = await syncProducts(brands, taxonomies);

  console.log('• news');
  const news = await syncNews();

  console.log('• news vendor (RSS)');
  const vendorNews = await syncVendorNews();

  console.log('• referenze');
  const references = await syncReferences();

  const featured = parseHomeFeatured(homeHtml).filter((slug) => products.some((p) => p.slug === slug));

  const brandsOut = brands.map(({ _cards, ...b }) => ({ ...b, newsFeed: VENDOR_FEEDS[b.slug] ?? null }));
  const meta = {
    syncedAt: new Date().toISOString(),
    source: BASE,
    counts: {
      brands: brandsOut.length,
      products: products.length,
      posts: news.posts.length,
      vendorNews: vendorNews.length,
    },
    featuredProducts: featured,
  };

  const write = (name, data) =>
    writeFile(resolve(OUT_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');

  await Promise.all([
    write('brands.json', brandsOut),
    write('products.json', products),
    write('taxonomies.json', taxonomies),
    write('news.json', news),
    write('vendor-news.json', vendorNews),
    write('references.json', references),
    write('meta.json', meta),
  ]);

  console.log(
    `✓ ${brandsOut.length} brand, ${products.length} prodotti, ${news.posts.length} news, ${vendorNews.length} news vendor → ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
