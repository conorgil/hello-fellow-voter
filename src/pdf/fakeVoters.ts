import { normalize } from '../storage';

export interface FakeVoter {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

// Deterministic PRNG (mulberry32) so a given seed always produces the exact
// same 500 records — test PDFs built from them stay reproducible across runs.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Alex', 'Priya', 'Marcus', 'Sofia', 'Declan', 'Teresa', 'Kofi', 'Ingrid', 'Ramon', 'Nadia',
  'Owen', 'Amara', 'Sven', 'Clara', 'Bilal', 'Jasmine', 'Derek', 'Mei', 'Carlos', 'Fiona',
  'Andre', 'Yuki', 'Leila', 'Tomas', 'Nia', 'Felix', 'Anya', 'Omar', 'Brielle', 'Hugo',
  'Sierra', 'Kwame', 'Darrel', 'Peter', 'Wanda', 'Elias', 'Greta', 'Victor', 'Paloma', 'Simeon',
];

const LAST_NAMES = [
  'Whitfield', 'Nandakumar', 'Obeng', 'Marchetti', 'Farrow', 'Vandermeer', 'Asante', 'Solberg',
  'Castellanos', 'Petrenko', 'Fitzgerald', 'Obasi', 'Halvorsen', 'Tanaka', 'Chaudhry', 'Russo',
  'Okafor', 'Lindqvist', 'Delgado', 'Mercer', 'Abiodun', 'Takahashi', 'Haddad', 'Novak',
  'Brightwater', 'Donnelly', 'Hassan', 'Pryce', 'Kowalski', 'Easton', 'Mbeki', 'Taylor',
  'Brothers', 'Sullivan', 'Garza', 'Whitaker', 'Nystrom', 'Oduya', 'Castillo', 'Marsh',
];

const STREET_NAMES = [
  'Maple Grove', 'Winston', 'Birchwood', 'Cedarbrook', 'Hollowgate', 'Sunset Ridge', 'Larkspur',
  'Fjordwood', 'Willowmere', 'Copperfield', 'Thistlebrook', 'Ravenscroft', 'Northgate',
  'Elderberry', 'Foxglove', 'Harborview', 'Millfield', 'Ashford', 'Glendover', 'Riverbend',
  'Westmoor', 'Budd', 'Beechwood', 'Clover', 'Stafford', 'Garfield', 'Pinehurst', 'Oakdale',
  'Crestline', 'Brookhaven',
];

const STREET_TYPES = ['St', 'Ave', 'Rd', 'Ln', 'Dr', 'Ct', 'Blvd', 'Way', 'Ter', 'Pl'];

const CITY_STATE_ZIP: { city: string; state: string; zip: string }[] = [
  { city: 'Springdale', state: 'OH', zip: '45246' },
  { city: 'Lakeview', state: 'IL', zip: '60644' },
  { city: 'Fairhaven', state: 'MI', zip: '48430' },
  { city: 'Rosedale', state: 'TX', zip: '78641' },
  { city: 'Millbrook', state: 'PA', zip: '18974' },
  { city: 'Crestline', state: 'CO', zip: '80439' },
  { city: 'Brookhaven', state: 'GA', zip: '30319' },
  { city: 'Pinehurst', state: 'NC', zip: '28374' },
  { city: 'Oakdale', state: 'CA', zip: '95361' },
  { city: 'Harborview', state: 'WA', zip: '98332' },
  { city: 'Glendover', state: 'MN', zip: '55112' },
  { city: 'Millfield', state: 'VA', zip: '24551' },
  { city: 'Ashford', state: 'WI', zip: '54915' },
  { city: 'Riverbend', state: 'OR', zip: '97477' },
  { city: 'Westmoor', state: 'NJ', zip: '07728' },
  { city: 'Philadelphia', state: 'PA', zip: '19104' },
  { city: 'Fairview Heights', state: 'IL', zip: '62208' },
  { city: 'Cedar Falls', state: 'IA', zip: '50613' },
  { city: 'Mount Holly', state: 'NC', zip: '28120' },
  { city: 'Silver Spring', state: 'MD', zip: '20901' },
  { city: 'Grand Junction', state: 'CO', zip: '81501' },
  { city: 'Lake Charles', state: 'LA', zip: '70601' },
  { city: 'North Haven', state: 'CT', zip: '06473' },
  { city: 'Eagle Pass', state: 'TX', zip: '78852' },
  { city: 'Rock Hill', state: 'SC', zip: '29730' },
  { city: 'Cherry Hill', state: 'NJ', zip: '08002' },
  { city: 'Elk Grove', state: 'CA', zip: '95624' },
  { city: 'Spring Valley', state: 'NY', zip: '10977' },
  { city: 'Deer Park', state: 'TX', zip: '77536' },
  { city: 'White Plains', state: 'NY', zip: '10601' },
];

/**
 * Generates `count` deterministic, mutually-unique fake voter records (same
 * seed always yields the same records) for building synthetic test PDFs.
 * Uniqueness is on the same name+street+city+state+zip key the app itself
 * dedupes on, so the generated set can never collide with itself on import.
 */
export function generateFakeVoters(count: number, seed = 42): FakeVoter[] {
  const random = mulberry32(seed);
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];

  const voters: FakeVoter[] = [];
  const seenKeys = new Set<string>();

  while (voters.length < count) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const houseNumber = 100 + Math.floor(random() * 9800);
    const street = `${houseNumber} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}`;
    const place = pick(CITY_STATE_ZIP);

    const key = [normalize(name), normalize(street), normalize(place.city), normalize(place.state), place.zip].join('|');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    voters.push({ name, street, city: place.city, state: place.state, zip: place.zip });
  }

  return voters;
}
