# ARTCONTENT.IT

Sito web di **ARTCONTENT**, agenzia tecnico-commerciale [ZAlight](https://www.zalight.it) per Emilia-Romagna e Marche.

Sito statico costruito con **Astro 7 + Tailwind CSS 4**. Catalogo prodotti, brand, settori, case study e news vengono sincronizzati dal sito ZAlight (WordPress REST API + scraping delle pagine pubbliche) e le immagini vengono ottimizzate in WebP in fase di build.

## Comandi

| Comando                 | Descrizione                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `npm install`           | Installa le dipendenze                                                   |
| `npm run dev`           | Server di sviluppo su `http://localhost:4321`                            |
| `npm run sync:zalight`  | Aggiorna `src/data/zalight/*.json` da zalight.it e dai feed dei vendor   |
| `npm run build`         | Build statica in `dist/` (usa i dati già sincronizzati)                  |
| `npm run build:fresh`   | `sync:zalight` + `build`: da usare per il deploy periodico               |
| `npm run preview`       | Anteprima locale della build                                             |
| `npm run check`         | Type-check dei componenti Astro                                          |
| `npm run assets`        | Rigenera favicon/OG image/manifest da `public/favicon.svg`               |

## Dati sempre aggiornati

- **Build time** – `scripts/sync-zalight.mjs` scarica prodotti (con descrizione, galleria, scheda tecnica PDF, video, news correlate), brand, tassonomie, news/case study, referenze e feed RSS ufficiali dei vendor (Chauvet Professional, Gantom, Lites). Programmare `npm run build:fresh` sull'hosting (es. deploy giornaliero/settimanale via cron o webhook).
- **Runtime** – il componente `LiveNews` interroga l'API pubblica di zalight.it dal browser e aggiunge in testa gli articoli pubblicati dopo l'ultima build.

## Configurazione

Tutti i dati aziendali sono in `src/config/site.ts`. Da completare prima della pubblicazione (cercare `TODO`):

- telefono / WhatsApp, indirizzo, P.IVA, profili social;
- team in `src/pages/chi-siamo.astro`.

### Modulo contatti

Il form invia via `fetch` a un endpoint configurato con la variabile d'ambiente `PUBLIC_FORM_ENDPOINT` (es. [Formspree](https://formspree.io), [Web3Forms](https://web3forms.com), una Function dell'hosting). Senza endpoint usa un fallback `mailto:` verso `site.email`.

Creare un file `.env` (non versionato):

```
PUBLIC_FORM_ENDPOINT=https://formspree.io/f/xxxxxxxx
```

## Deploy

Output completamente statico (`dist/`): può essere pubblicato su qualunque hosting statico/CDN (Netlify, Vercel, Cloudflare Pages, Render Static Site, Nginx…). Il dominio canonico è impostato in `astro.config.mjs` (`site`).

## Struttura

```
scripts/            sync-zalight.mjs, make-brand-assets.mjs
src/config/site.ts  dati aziendali, territorio, navigazione
src/data/zalight/   JSON generati dalla sincronizzazione
src/lib/catalog.ts  accesso tipizzato ai dati
src/components/     Header, Footer, ProductCard, BrandCard, LiveNews, ContactForm…
src/pages/          home, prodotti, vendor, settori, servizi, case-study, news, chi-siamo, contatti
```
