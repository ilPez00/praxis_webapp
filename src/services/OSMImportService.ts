/**
 * OSMImportService — Imports places from OpenStreetMap via Overpass API.
 *
 * Strategy:
 *   1. Query Overpass for all tagged amenities/tourism/shops/leisure in an area
 *   2. Map OSM tags → Praxis domain types (Body & Health, Culture & Hobbies, etc.)
 *   3. Deduplicate by name+coordinates (within 50m radius)
 *   4. Bulk-insert into Supabase `places` table
 *
 * Extensible to any city — just pass the city name or bounding box.
 */

import { supabase } from '../lib/supabaseClient';
import logger from '../utils/logger';

// ── OSM tag → Praxis domain mapping ───────────────────────────────────────────

const OSM_TO_DOMAIN: Record<string, string> = {
  // Body & Health
  gym: 'Body & Health',
  fitness_centre: 'Body & Health',
  fitness_station: 'Body & Health',
  sports_centre: 'Body & Health',
  swimming_pool: 'Body & Health',
  stadium: 'Body & Health',
  pitch: 'Body & Health',
  pharmacy: 'Body & Health',
  hospital: 'Body & Health',
  clinic: 'Body & Health',
  doctors: 'Body & Health',
  dentist: 'Body & Health',
  yoga: 'Body & Health',
  martial_arts: 'Body & Health',
  dance: 'Body & Health',

  // Mind & Learning
  library: 'Mind & Learning',
  school: 'Mind & Learning',
  university: 'Mind & Learning',
  college: 'Mind & Learning',
  language_school: 'Mind & Learning',
  music_school: 'Mind & Learning',
  driving_school: 'Mind & Learning',
  research_institute: 'Mind & Learning',
  training: 'Mind & Learning',
  kindergarten: 'Mind & Learning',

  // Craft & Career
  coworking_space: 'Craft & Career',
  office: 'Craft & Career',
  conference_centre: 'Craft & Career',
  bank: 'Craft & Career',
  post_office: 'Craft & Career',
  marketplace: 'Craft & Career',
  commercial: 'Craft & Career',

  // Money & Assets
  atm: 'Money & Assets',
  bureau_de_change: 'Money & Assets',
  estate_agent: 'Money & Assets',
  financial_advisor: 'Money & Assets',

  // Environment & Gear
  park: 'Environment & Gear',
  garden: 'Environment & Gear',
  nature_reserve: 'Environment & Gear',
  playground: 'Environment & Gear',
  dog_park: 'Environment & Gear',
  bicycle_rental: 'Environment & Gear',
  hardware: 'Environment & Gear',
  outdoor: 'Environment & Gear',

  // Spirit & Purpose
  place_of_worship: 'Spirit & Purpose',
  monastery: 'Spirit & Purpose',
  cemetery: 'Spirit & Purpose',
  memorial: 'Spirit & Purpose',
  wayside_shrine: 'Spirit & Purpose',

  // Culture & Hobbies
  museum: 'Culture & Hobbies',
  gallery: 'Culture & Hobbies',
  theatre: 'Culture & Hobbies',
  cinema: 'Culture & Hobbies',
  arts_centre: 'Culture & Hobbies',
  studio: 'Culture & Hobbies',
  casino: 'Culture & Hobbies',
  music_venue: 'Culture & Hobbies',
  nightclub: 'Culture & Hobbies',
  attraction: 'Culture & Hobbies',
  artwork: 'Culture & Hobbies',
  viewpoint: 'Culture & Hobbies',
  zoo: 'Culture & Hobbies',
  theme_park: 'Culture & Hobbies',
  archaeological_site: 'Culture & Hobbies',
  castle: 'Culture & Hobbies',
  monument: 'Culture & Hobbies',
  ruins: 'Culture & Hobbies',
  books: 'Culture & Hobbies',
  musical_instrument: 'Culture & Hobbies',
  craft: 'Culture & Hobbies',
  photo: 'Culture & Hobbies',
  art: 'Culture & Hobbies',

  // Friendship & Social
  cafe: 'Friendship & Social',
  restaurant: 'Friendship & Social',
  bar: 'Friendship & Social',
  pub: 'Friendship & Social',
  fast_food: 'Friendship & Social',
  food_court: 'Friendship & Social',
  ice_cream: 'Friendship & Social',
  biergarten: 'Friendship & Social',
  community_centre: 'Friendship & Social',
  social_centre: 'Friendship & Social',
  social_facility: 'Friendship & Social',
  events_venue: 'Friendship & Social',

  // Intimacy & Romance (romantic-coded venues)
  spa: 'Intimacy & Romance',
  sauna: 'Intimacy & Romance',
  love_hotel: 'Intimacy & Romance',
};

// Tags that produce useful descriptions
const TAG_PRIORITY = ['cuisine', 'sport', 'denomination', 'religion', 'tourism', 'shop', 'amenity', 'leisure'];

// ── Overpass query builder ─────────────────────────────────────────────────────

function buildOverpassQuery(areaName: string): string {
  // Query all amenities, tourism, leisure, and shops in a named area
  return `
[out:json][timeout:120];
area["name"="${areaName}"]["admin_level"~"^(6|8)$"]->.searchArea;
(
  nwr["amenity"]["name"](area.searchArea);
  nwr["tourism"]["name"](area.searchArea);
  nwr["leisure"]["name"](area.searchArea);
  nwr["shop"]["name"](area.searchArea);
  nwr["sport"]["name"](area.searchArea);
  nwr["historic"]["name"](area.searchArea);
);
out center 5000;
`.trim();
}

// ── OSM element → Praxis place ────────────────────────────────────────────────

interface OSMElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface PraxisPlace {
  name: string;
  type: string;
  address: string | null;
  city: string;
  latitude: number;
  longitude: number;
  description: string | null;
  website: string | null;
  schedule: string | null;
  tags: string[];
}

function classifyElement(tags: Record<string, string>): string | null {
  // Check amenity, tourism, leisure, shop, sport, historic in order
  for (const key of ['amenity', 'leisure', 'sport', 'tourism', 'historic', 'shop']) {
    const val = tags[key];
    if (val && OSM_TO_DOMAIN[val]) return OSM_TO_DOMAIN[val];
  }
  return null;
}

function buildAddress(tags: Record<string, string>): string | null {
  const parts: string[] = [];
  if (tags['addr:street']) {
    parts.push(tags['addr:street']);
    if (tags['addr:housenumber']) parts[0] = `${tags['addr:street']} ${tags['addr:housenumber']}`;
  }
  if (tags['addr:postcode']) parts.push(tags['addr:postcode']);
  return parts.length > 0 ? parts.join(', ') : null;
}

function buildDescription(tags: Record<string, string>): string | null {
  if (tags.description) return tags.description;
  const bits: string[] = [];
  if (tags.cuisine) bits.push(`Cuisine: ${tags.cuisine.replace(/;/g, ', ')}`);
  if (tags.sport) bits.push(`Sport: ${tags.sport.replace(/;/g, ', ')}`);
  if (tags.denomination) bits.push(tags.denomination);
  if (tags.religion) bits.push(tags.religion);
  for (const key of ['amenity', 'tourism', 'leisure', 'shop', 'historic']) {
    if (tags[key]) { bits.push(tags[key].replace(/_/g, ' ')); break; }
  }
  return bits.length > 0 ? bits.join(' · ') : null;
}

function buildSchedule(tags: Record<string, string>): string | null {
  return tags.opening_hours || null;
}

function buildTags(tags: Record<string, string>): string[] {
  const result: string[] = [];
  if (tags.amenity) result.push(tags.amenity.replace(/_/g, '-'));
  if (tags.cuisine) tags.cuisine.split(';').slice(0, 3).forEach(c => result.push(c.trim()));
  if (tags.sport) tags.sport.split(';').slice(0, 2).forEach(s => result.push(s.trim()));
  if (tags.tourism) result.push(tags.tourism.replace(/_/g, '-'));
  if (tags.shop) result.push(tags.shop.replace(/_/g, '-'));
  if (tags.historic) result.push(tags.historic.replace(/_/g, '-'));
  return result.slice(0, 5);
}

function osmToPlace(el: OSMElement, city: string): PraxisPlace | null {
  const tags = el.tags || {};
  if (!tags.name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const domain = classifyElement(tags);
  if (!domain) return null;

  return {
    name: tags.name,
    type: domain,
    address: buildAddress(tags),
    city,
    latitude: lat,
    longitude: lon,
    description: buildDescription(tags),
    website: tags.website || tags['contact:website'] || null,
    schedule: buildSchedule(tags),
    tags: buildTags(tags),
  };
}

// ── Deduplication ──────────────────────────────────────────────────────────────

function deduplicatePlaces(places: PraxisPlace[]): PraxisPlace[] {
  const seen = new Map<string, PraxisPlace>();
  for (const p of places) {
    // Key: lowercase name + rounded coords (within ~50m)
    const key = `${p.name.toLowerCase().trim()}|${p.latitude.toFixed(4)}|${p.longitude.toFixed(4)}`;
    if (!seen.has(key)) {
      seen.set(key, p);
    }
  }
  return Array.from(seen.values());
}

// ── Main import function ───────────────────────────────────────────────────────

export async function importOSMPlaces(
  cityName: string,
  ownerId: string,
  options?: { dryRun?: boolean; skipExisting?: boolean }
): Promise<{ imported: number; skipped: number; total: number; errors: string[] }> {
  const errors: string[] = [];

  // 1. Query Overpass
  logger.info(`[OSM Import] Querying Overpass for "${cityName}"...`);
  const query = buildOverpassQuery(cityName);

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Overpass API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const elements: OSMElement[] = json.elements || [];
  logger.info(`[OSM Import] Got ${elements.length} elements from Overpass`);

  // 2. Convert + classify
  const converted = elements
    .map(el => osmToPlace(el, cityName))
    .filter((p): p is PraxisPlace => p !== null);

  // 3. Deduplicate
  const unique = deduplicatePlaces(converted);
  logger.info(`[OSM Import] ${unique.length} unique places after dedup (from ${converted.length} classified)`);

  if (options?.dryRun) {
    return { imported: 0, skipped: 0, total: unique.length, errors };
  }

  // 4. Skip existing (by name + city)
  let toInsert = unique;
  let skipped = 0;

  if (options?.skipExisting !== false) {
    const { data: existing } = await supabase
      .from('places')
      .select('name, latitude, longitude')
      .ilike('city', cityName);

    if (existing && existing.length > 0) {
      const existingKeys = new Set(
        existing.map((e: any) =>
          `${e.name.toLowerCase().trim()}|${Number(e.latitude).toFixed(4)}|${Number(e.longitude).toFixed(4)}`
        )
      );

      toInsert = unique.filter(p => {
        const key = `${p.name.toLowerCase().trim()}|${p.latitude.toFixed(4)}|${p.longitude.toFixed(4)}`;
        if (existingKeys.has(key)) { skipped++; return false; }
        return true;
      });
    }
  }

  logger.info(`[OSM Import] Inserting ${toInsert.length} places (${skipped} already exist)`);

  // 5. Batch insert (chunks of 200)
  let imported = 0;
  const BATCH = 200;

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH).map(p => ({
      owner_id: ownerId,
      name: p.name,
      type: p.type,
      address: p.address,
      city: p.city,
      latitude: p.latitude,
      longitude: p.longitude,
      description: p.description,
      website: p.website,
      schedule: p.schedule,
      tags: p.tags,
    }));

    const { error } = await supabase.from('places').insert(batch);
    if (error) {
      errors.push(`Batch ${i / BATCH + 1}: ${error.message}`);
      logger.error(`[OSM Import] Batch insert error:`, error.message);
    } else {
      imported += batch.length;
    }
  }

  logger.info(`[OSM Import] Done: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);
  return { imported, skipped, total: unique.length, errors };
}

// ── Stats helper ───────────────────────────────────────────────────────────────

export function getImportStats(places: PraxisPlace[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const p of places) {
    stats[p.type] = (stats[p.type] || 0) + 1;
  }
  return stats;
}
