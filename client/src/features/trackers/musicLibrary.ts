export interface InstrumentEntry { name: string; family: string }

export const INSTRUMENT_LIBRARY: InstrumentEntry[] = [
  { name: 'Guitar (Acoustic)',  family: 'Strings' }, { name: 'Guitar (Electric)', family: 'Strings' },
  { name: 'Bass Guitar',        family: 'Strings' }, { name: 'Violin',            family: 'Strings' },
  { name: 'Cello',              family: 'Strings' }, { name: 'Ukulele',           family: 'Strings' },
  { name: 'Piano',              family: 'Keys'    }, { name: 'Keyboard',          family: 'Keys'    },
  { name: 'Synthesizer',        family: 'Keys'    }, { name: 'Organ',             family: 'Keys'    },
  { name: 'Drums',              family: 'Percussion' }, { name: 'Percussion',    family: 'Percussion' },
  { name: 'Flute',              family: 'Wind'    }, { name: 'Saxophone',         family: 'Wind'    },
  { name: 'Trumpet',            family: 'Wind'    }, { name: 'Clarinet',          family: 'Wind'    },
  { name: 'Voice / Singing',    family: 'Voice'   }, { name: 'DJ / Production',   family: 'Electronic' },
  { name: 'Music Production',   family: 'Electronic' },
];

export function searchInstruments(query: string): InstrumentEntry[] {
  if (!query.trim()) return INSTRUMENT_LIBRARY.slice(0, 6);
  const q = query.toLowerCase();
  return INSTRUMENT_LIBRARY.filter(i => i.name.toLowerCase().includes(q) || i.family.toLowerCase().includes(q)).slice(0, 8);
}
