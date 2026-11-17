/**
 * Configurazione centrale del sito ARTCONTENT.
 * I valori marcati TODO vanno completati con i dati reali dell'agenzia.
 */
export const site = {
  name: 'ARTCONTENT',
  legalName: 'Artcontent', // TODO: ragione sociale completa (es. Artcontent S.r.l.)
  tagline: 'Agenzia ZAlight per Emilia-Romagna e Marche',
  description:
    'ARTCONTENT è l’agenzia tecnico-commerciale ZAlight per Emilia-Romagna e Marche: consulenza, demo on-site, progetti illuminotecnici e supporto su Chauvet Professional, Chauvet DJ, Iluminarc e tutti i brand distribuiti da ZAlight.',
  url: 'https://www.artcontent.it',
  locale: 'it_IT',
  email: 'info@artcontent.it', // TODO: verificare
  phone: '+39 000 000 0000', // TODO: numero reale
  phoneHref: 'tel:+390000000000', // TODO: numero reale
  whatsapp: 'https://wa.me/390000000000', // TODO: numero reale
  address: {
    street: 'Via Esempio, 1', // TODO
    city: 'Bologna', // TODO
    province: 'BO', // TODO
    zip: '40100', // TODO
    region: 'Emilia-Romagna',
    country: 'IT',
  },
  vat: 'IT00000000000', // TODO: partita IVA
  social: {
    linkedin: 'https://www.linkedin.com/company/artcontent', // TODO
    instagram: 'https://www.instagram.com/artcontent', // TODO
    facebook: '', // opzionale
    youtube: '', // opzionale
  },
  /** Endpoint del form contatti (Formspree, Web3Forms, Netlify Forms, Cloudflare Worker…). Vuoto = fallback mailto. */
  formEndpoint: import.meta.env.PUBLIC_FORM_ENDPOINT ?? '',
  openingHours: 'Lun–Ven 9:00–18:00',
} as const;

export const territory = {
  regions: [
    {
      name: 'Emilia-Romagna',
      provinces: ['Bologna', 'Modena', 'Reggio Emilia', 'Parma', 'Piacenza', 'Ferrara', 'Ravenna', 'Forlì-Cesena', 'Rimini'],
    },
    {
      name: 'Marche',
      provinces: ['Ancona', 'Pesaro e Urbino', 'Macerata', 'Fermo', 'Ascoli Piceno'],
    },
  ],
} as const;

export const zalight = {
  name: 'ZAlight',
  legalName: 'Zalight Srl',
  url: 'https://www.zalight.it',
  email: 'info@zalight.it',
  phone: '+39 0376 1331094',
  address: 'Via dell’Artigianato, 20 – 46024 Moglia (MN)',
  founded: 2013,
  claim: 'Distributore esclusivo per l’Italia di Chauvet Professional, Chauvet DJ e Iluminarc',
  award: 'Miglior distributore Chauvet Professional area EMEA 2024',
  social: {
    linkedin: 'https://www.linkedin.com/company/zalight-srl',
    instagram: 'https://www.instagram.com/zalightsrl/',
    facebook: 'https://www.facebook.com/ZalightSrl',
    youtube: 'https://www.youtube.com/channel/UC_dY10H7RMfMoyg4_lLTnEw',
  },
  newsletter:
    'https://lb.benchmarkemail.com//listbuilder/signupnew?JAxkftwYca1cVoR%252FwTRkw%252F5pwVnAjsSIWD6OohLNW4MQ9amXwphcsla3EfeH%252BvDp',
  logo: 'https://www.zalight.it/luce/wp-content/uploads/2022/07/logo-white.svg',
  logoDark: 'https://www.zalight.it/luce/wp-content/uploads/2022/07/logo.svg',
  teamPhoto: 'https://www.zalight.it/luce/wp-content/uploads/2024/01/zalight-team.jpg',
  heroPoster: 'https://www.zalight.it/luce/wp-content/uploads/2025/12/home-2025-poster-scaled.jpg',
  awardPhoto: 'https://www.zalight.it/luce/wp-content/uploads/2025/09/PREMIO-IN-4.jpeg',
  /** Endpoint REST pubblico usato dal client per aggiornare le news live. */
  api: 'https://www.zalight.it/wp-json/wp/v2',
} as const;

export const nav = [
  { label: 'Prodotti', href: '/prodotti' },
  { label: 'Vendor', href: '/vendor' },
  { label: 'Settori', href: '/settori' },
  { label: 'Servizi', href: '/servizi' },
  { label: 'Case study', href: '/case-study' },
  { label: 'News', href: '/news' },
  { label: 'Chi siamo', href: '/chi-siamo' },
] as const;
