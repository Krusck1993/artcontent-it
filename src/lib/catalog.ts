import brandsJson from '../data/zalight/brands.json';
import productsJson from '../data/zalight/products.json';
import taxonomiesJson from '../data/zalight/taxonomies.json';
import newsJson from '../data/zalight/news.json';
import vendorNewsJson from '../data/zalight/vendor-news.json';
import referencesJson from '../data/zalight/references.json';
import metaJson from '../data/zalight/meta.json';

export interface Brand {
  id: number;
  name: string;
  slug: string;
  productCount: number;
  zalightUrl: string;
  website: string | null;
  logo: string | null;
  description: string[];
  newsFeed: string | null;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  settori: string[];
  tipologie: string[];
  shortDescription: string;
  description: string[];
  image: string | null;
  imageAlt: string;
  gallery: string[];
  datasheet: string | null;
  video: string | null;
  relatedNews: { url: string; title: string }[];
  isNew: boolean;
  publishedAt: string;
  updatedAt: string;
  zalightUrl: string;
}

export interface Settore {
  id: number;
  name: string;
  slug: string;
  count: number;
  zalightUrl: string;
  description: string[];
  gallery: string[];
}

export interface Tipologia {
  id: number;
  name: string;
  slug: string;
  count: number;
  zalightUrl: string;
}

export interface Post {
  id: number;
  slug: string;
  date: string;
  title: string;
  excerpt: string;
  url: string;
  image: string | null;
  categories: string[];
}

export interface VendorNews {
  brand: string;
  title: string;
  url: string;
  date: string | null;
  excerpt: string;
  image: string | null;
}

export interface Reference {
  url: string;
  name: string;
}

export const brands = brandsJson as Brand[];
export const settori = (taxonomiesJson as { settori: Settore[]; tipologie: Tipologia[] }).settori;
export const tipologie = (taxonomiesJson as { settori: Settore[]; tipologie: Tipologia[] }).tipologie;
export const posts = (newsJson as { posts: Post[] }).posts;
export const vendorNews = vendorNewsJson as VendorNews[];
export const references = referencesJson as Reference[];
export const meta = metaJson as {
  syncedAt: string;
  source: string;
  counts: { brands: number; products: number; posts: number; vendorNews: number };
  featuredProducts: string[];
};

/** Prodotti pubblicabili: esclude le bozze senza brand né immagine. */
export const products = (productsJson as Product[]).filter((p) => p.brand && p.image);

const brandBySlug = new Map(brands.map((b) => [b.slug, b]));
const settoreBySlug = new Map(settori.map((s) => [s.slug, s]));
const tipologiaBySlug = new Map(tipologie.map((t) => [t.slug, t]));
const productBySlug = new Map(products.map((p) => [p.slug, p]));

export const getBrand = (slug: string | null | undefined): Brand | undefined =>
  slug ? brandBySlug.get(slug) : undefined;
export const getSettore = (slug: string): Settore | undefined => settoreBySlug.get(slug);
export const getTipologia = (slug: string): Tipologia | undefined => tipologiaBySlug.get(slug);
export const getProduct = (slug: string): Product | undefined => productBySlug.get(slug);

export const productsByBrand = (slug: string): Product[] => products.filter((p) => p.brand === slug);
export const productsBySettore = (slug: string): Product[] => products.filter((p) => p.settori.includes(slug));
export const productsByTipologia = (slug: string): Product[] => products.filter((p) => p.tipologie.includes(slug));

/** Prodotti in evidenza (ordine della home ZAlight), con fallback ai più recenti. */
export const featuredProducts = (limit = 8): Product[] => {
  const featured = meta.featuredProducts.map((slug) => productBySlug.get(slug)).filter((p): p is Product => Boolean(p));
  if (featured.length >= limit) return featured.slice(0, limit);
  const rest = latestProducts(limit * 2).filter((p) => !featured.includes(p));
  return [...featured, ...rest].slice(0, limit);
};

export const latestProducts = (limit = 12): Product[] =>
  [...products].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);

export const newProducts = (limit = 12): Product[] => {
  const flagged = products.filter((p) => p.isNew).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return flagged.length >= limit ? flagged.slice(0, limit) : [...flagged, ...latestProducts(limit * 2).filter((p) => !p.isNew)].slice(0, limit);
};

/** Prodotti correlati: stessa tipologia, poi stesso brand. */
export const relatedProducts = (product: Product, limit = 4): Product[] => {
  const sameType = products.filter(
    (p) => p.slug !== product.slug && p.tipologie.some((t) => product.tipologie.includes(t)),
  );
  const sameBrand = sameType.filter((p) => p.brand === product.brand);
  const others = sameType.filter((p) => p.brand !== product.brand);
  const fallback = productsByBrand(product.brand ?? '').filter((p) => p.slug !== product.slug);
  return [...new Set([...sameBrand, ...others, ...fallback])].slice(0, limit);
};

/** Brand ordinati: distribuzioni esclusive prima, poi per numero di prodotti. */
export const exclusiveBrandSlugs = ['chauvet', 'chauvet-dj', 'iluminarc'];
export const sortedBrands = (): Brand[] =>
  [...brands].sort((a, b) => {
    const ea = exclusiveBrandSlugs.indexOf(a.slug);
    const eb = exclusiveBrandSlugs.indexOf(b.slug);
    if (ea !== -1 || eb !== -1) return (ea === -1 ? 99 : ea) - (eb === -1 ? 99 : eb);
    return b.productCount - a.productCount;
  });

/** Case study: articoli ZAlight che raccontano tour, show e installazioni. */
export const caseStudies = (limit?: number): Post[] => {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  return limit ? sorted.slice(0, limit) : sorted;
};

/** Trova i prodotti citati nel titolo di un articolo (per collegare case study → catalogo). */
export const productsMentionedIn = (text: string, limit = 4): Product[] => {
  const haystack = text.toLowerCase();
  const found = products.filter((p) => {
    const name = p.name.toLowerCase();
    return name.length >= 5 && haystack.includes(name);
  });
  // Preferisci i nomi più lunghi (più specifici)
  return found.sort((a, b) => b.name.length - a.name.length).slice(0, limit);
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
};

export const brandLabel = (slug: string | null | undefined): string => getBrand(slug)?.name ?? 'ZAlight';
