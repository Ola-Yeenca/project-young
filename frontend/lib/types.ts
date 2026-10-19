// Shapes returned by the House of Young API (backend/api/serializers.py).

export type City = {
  name: string;
  slug: string;
  country: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  ticket_provider: string;
  whatsapp_number: string;
  instagram_url: string;
};

export type Ref = { name: string; slug: string };

export type EventItem = {
  title: string;
  slug: string;
  city: Ref;
  venue: { name: string; slug: string; address: string; map_url: string };
  kind: string;
  starts_at: string;
  ends_at: string | null;
  local: { date: string; time: string; timezone: string };
  poster: string | null;
  poster_alt: string;
  poster_fit: "contain" | "cover";
  caption: string;
  description: string;
  lineup: { name: string; slug: string | null }[];
  music_style: string;
  music_style_label?: string;
  bpm: number | null;
  ticket_url: string;
  checkout_url?: string;
  ticketing_mode?: "simulation" | "";
  ticket_provider: string;
  price_from: string | null;
  currency: string;
  currency_symbol: string;
  is_free: boolean;
  sold_out: boolean;
  sold_percent: number;
  age_restriction: string;
  is_featured: boolean;
  is_cancelled: boolean;
};

export type Talent = {
  name: string;
  slug: string;
  city: Ref;
  category: string;
  group: "DJs" | "Live" | "Hosts" | string;
  genre: string;
  photo: string | null;
  booking_available: boolean;
  is_featured: boolean;
};

export type Media = { kind: string; image: string | null; video_url: string; caption: string };

export type TalentDetail = Talent & {
  bio: string;
  previous_work: string[];
  travels: boolean;
  links: { label: string; url: string }[];
  media: Media[];
  upcoming_events: { title: string; slug: string; starts_at: string; city: string }[];
};

export type AlbumItem = {
  id: number;
  kind: string;
  image: string | null;
  video_url: string;
  caption: string;
  alt: string;
  order: number;
  views: number;
  downloads: number;
};

export type Album = {
  title: string;
  slug: string;
  city: Ref;
  event: string | null;
  event_title: string | null;
  date: string | null;
  cover: string | null;
  item_count: number;
  items?: AlbumItem[];
};

export type Product = {
  name: string;
  slug: string;
  description: string;
  material: string;
  fit: string;
  image: string | null;
  images: { url: string; alt: string }[];
  variants: { label: string; in_stock: boolean }[];
  prices: { city: string; amount: string; currency: string; currency_symbol: string; checkout_url: string }[];
};

export type FAQ = { category: string; question: string; answer: string };

export type Site = {
  /** The motto. */
  tagline: string;
  intro: string;
  about: string;
  vision: string;
  community: string;
  business_enabled: boolean;
  instagram_url: string;
  tiktok_url: string;
  youtube_url: string;
  show_powered_by: boolean;
};

/** Everything one city needs, loaded together so a city switch swaps it in one go. */
export type CityBundle = {
  city: string;
  featured: EventItem[];
  events: EventItem[];
  past: EventItem[];
  talent: Talent[];
  albums: Album[]; // with items
  products: Product[];
};

/** A HOY Radio track uploaded in Studio. `city` null plays everywhere. */
export type Track = { title: string; artist: string; genre: string; city: string | null; url: string };

export type Global = { cities: City[]; site: Site | null; faqs: FAQ[]; radio: Track[] };
