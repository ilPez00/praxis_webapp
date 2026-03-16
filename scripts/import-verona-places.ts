/**
 * Standalone script to import Verona places from OpenStreetMap.
 *
 * Usage:
 *   npx ts-node scripts/import-verona-places.ts --dry-run   # Preview only
 *   npx ts-node scripts/import-verona-places.ts              # Actually import
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import 'dotenv/config';

// Inline Overpass fetch (no supabase dependency for dry-run)
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const OSM_TO_DOMAIN: Record<string, string> = {
  gym: 'Body & Health', fitness_centre: 'Body & Health', fitness_station: 'Body & Health',
  sports_centre: 'Body & Health', swimming_pool: 'Body & Health', stadium: 'Body & Health',
  pitch: 'Body & Health', pharmacy: 'Body & Health', hospital: 'Body & Health',
  clinic: 'Body & Health', doctors: 'Body & Health', dentist: 'Body & Health',
  yoga: 'Body & Health', martial_arts: 'Body & Health', dance: 'Body & Health',

  library: 'Mind & Learning', school: 'Mind & Learning', university: 'Mind & Learning',
  college: 'Mind & Learning', language_school: 'Mind & Learning', music_school: 'Mind & Learning',
  kindergarten: 'Mind & Learning', research_institute: 'Mind & Learning',

  coworking_space: 'Craft & Career', office: 'Craft & Career',
  conference_centre: 'Craft & Career', bank: 'Craft & Career',
  post_office: 'Craft & Career', marketplace: 'Craft & Career',

  atm: 'Money & Assets', bureau_de_change: 'Money & Assets',

  park: 'Environment & Gear', garden: 'Environment & Gear',
  nature_reserve: 'Environment & Gear', playground: 'Environment & Gear',
  dog_park: 'Environment & Gear',

  place_of_worship: 'Spirit & Purpose', monastery: 'Spirit & Purpose',
  cemetery: 'Spirit & Purpose', memorial: 'Spirit & Purpose',

  museum: 'Culture & Hobbies', gallery: 'Culture & Hobbies', theatre: 'Culture & Hobbies',
  cinema: 'Culture & Hobbies', arts_centre: 'Culture & Hobbies', studio: 'Culture & Hobbies',
  nightclub: 'Culture & Hobbies', attraction: 'Culture & Hobbies', artwork: 'Culture & Hobbies',
  viewpoint: 'Culture & Hobbies', zoo: 'Culture & Hobbies', castle: 'Culture & Hobbies',
  monument: 'Culture & Hobbies', ruins: 'Culture & Hobbies', archaeological_site: 'Culture & Hobbies',
  books: 'Culture & Hobbies', art: 'Culture & Hobbies', music_venue: 'Culture & Hobbies',

  cafe: 'Friendship & Social', restaurant: 'Friendship & Social', bar: 'Friendship & Social',
  pub: 'Friendship & Social', fast_food: 'Friendship & Social', ice_cream: 'Friendship & Social',
  biergarten: 'Friendship & Social', community_centre: 'Friendship & Social',
  social_centre: 'Friendship & Social', events_venue: 'Friendship & Social',

  spa: 'Intimacy & Romance', sauna: 'Intimacy & Romance',
};

interface OSMElement {
  type: string; id: number;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function classify(tags: Record<string, string>): string | null {
  for (const key of ['amenity', 'leisure', 'sport', 'tourism', 'historic', 'shop']) {
    const val = tags[key];
    if (val && OSM_TO_DOMAIN[val]) return OSM_TO_DOMAIN[val];
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const city = 'Verona';

  console.log(`\n🗺️  OSM Import — ${city} ${dryRun ? '(DRY RUN)' : '(LIVE)'}\n`);

  const query = `
[out:json][timeout:120];
area["name"="${city}"]["admin_level"~"^(6|8)$"]->.searchArea;
(
  nwr["amenity"]["name"](area.searchArea);
  nwr["tourism"]["name"](area.searchArea);
  nwr["leisure"]["name"](area.searchArea);
  nwr["shop"]["name"](area.searchArea);
  nwr["sport"]["name"](area.searchArea);
  nwr["historic"]["name"](area.searchArea);
);
out center 5000;`.trim();

  console.log('⏳ Querying Overpass API (may take 30-60s)...');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    console.error(`❌ Overpass error ${res.status}:`, await res.text());
    process.exit(1);
  }

  const json = await res.json();
  const elements: OSMElement[] = json.elements || [];
  console.log(`📦 Raw elements: ${elements.length}`);

  // Convert
  const places: Array<{
    name: string; type: string; address: string | null; city: string;
    latitude: number; longitude: number; description: string | null;
    website: string | null; schedule: string | null; tags: string[];
  }> = [];

  for (const el of elements) {
    const tags = el.tags || {};
    if (!tags.name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const domain = classify(tags);
    if (!domain) continue;

    const addrParts: string[] = [];
    if (tags['addr:street']) {
      addrParts.push(tags['addr:housenumber'] ? `${tags['addr:street']} ${tags['addr:housenumber']}` : tags['addr:street']);
    }
    if (tags['addr:postcode']) addrParts.push(tags['addr:postcode']);

    const descBits: string[] = [];
    if (tags.cuisine) descBits.push(`Cuisine: ${tags.cuisine.replace(/;/g, ', ')}`);
    if (tags.sport) descBits.push(`Sport: ${tags.sport.replace(/;/g, ', ')}`);
    if (tags.denomination) descBits.push(tags.denomination);
    for (const k of ['amenity', 'tourism', 'leisure', 'shop', 'historic']) {
      if (tags[k]) { descBits.push(tags[k].replace(/_/g, ' ')); break; }
    }

    const tagList: string[] = [];
    if (tags.amenity) tagList.push(tags.amenity.replace(/_/g, '-'));
    if (tags.cuisine) tags.cuisine.split(';').slice(0, 3).forEach(c => tagList.push(c.trim()));
    if (tags.sport) tags.sport.split(';').slice(0, 2).forEach(s => tagList.push(s.trim()));
    if (tags.tourism) tagList.push(tags.tourism.replace(/_/g, '-'));
    if (tags.historic) tagList.push(tags.historic.replace(/_/g, '-'));

    places.push({
      name: tags.name,
      type: domain,
      address: addrParts.length > 0 ? addrParts.join(', ') : null,
      city,
      latitude: lat,
      longitude: lon,
      description: descBits.length > 0 ? descBits.join(' · ') : null,
      website: tags.website || tags['contact:website'] || null,
      schedule: tags.opening_hours || null,
      tags: tagList.slice(0, 5),
    });
  }

  // Dedup
  const seen = new Map<string, typeof places[0]>();
  for (const p of places) {
    const key = `${p.name.toLowerCase().trim()}|${p.latitude.toFixed(4)}|${p.longitude.toFixed(4)}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  const unique = Array.from(seen.values());

  // Stats
  const stats: Record<string, number> = {};
  for (const p of unique) stats[p.type] = (stats[p.type] || 0) + 1;

  console.log(`\n✅ ${unique.length} unique places (from ${places.length} classified):\n`);
  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  for (const [domain, count] of sorted) {
    console.log(`   ${domain.padEnd(25)} ${count}`);
  }

  // Sample
  console.log('\n📍 Sample places:');
  for (const domain of sorted.slice(0, 5).map(s => s[0])) {
    const sample = unique.filter(p => p.type === domain).slice(0, 3);
    for (const p of sample) {
      console.log(`   [${domain}] ${p.name}${p.address ? ` — ${p.address}` : ''}`);
    }
  }

  if (dryRun) {
    console.log('\n🏁 Dry run complete. Run without --dry-run to import.\n');
    return;
  }

  // Live import
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Get admin user ID (first admin)
  const { data: admin } = await sb.from('profiles').select('id').eq('is_admin', true).limit(1).single();
  if (!admin) {
    console.error('❌ No admin user found. Set is_admin=true on your profile first.');
    process.exit(1);
  }
  console.log(`\n👤 Using admin: ${admin.id}`);

  // Skip existing
  const { data: existing } = await sb.from('places').select('name, latitude, longitude').ilike('city', city);
  const existingKeys = new Set(
    (existing || []).map((e: any) => `${e.name.toLowerCase().trim()}|${Number(e.latitude).toFixed(4)}|${Number(e.longitude).toFixed(4)}`)
  );

  const toInsert = unique.filter(p => {
    const key = `${p.name.toLowerCase().trim()}|${p.latitude.toFixed(4)}|${p.longitude.toFixed(4)}`;
    return !existingKeys.has(key);
  });

  console.log(`📊 ${toInsert.length} new (${existingKeys.size} already exist)`);

  if (toInsert.length === 0) {
    console.log('🏁 Nothing to insert.\n');
    return;
  }

  let imported = 0;
  const BATCH = 200;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH).map(p => ({ owner_id: admin.id, ...p }));
    const { error } = await sb.from('places').insert(batch);
    if (error) {
      console.error(`❌ Batch ${i / BATCH + 1}:`, error.message);
    } else {
      imported += batch.length;
      console.log(`   ✅ Batch ${i / BATCH + 1}: ${batch.length} inserted`);
    }
  }

  console.log(`\n🏁 Done! ${imported} places imported into Praxis.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
