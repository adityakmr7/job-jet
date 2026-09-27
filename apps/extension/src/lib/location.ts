/**
 * Splits a free-form profile location ("San Francisco, CA", "Berlin,
 * Germany", "Austin, Texas, USA") into the parts real forms ask for
 * separately. Only returns a part when it can actually be derived — a
 * "City" field gets "San Francisco", never the whole "San Francisco, CA",
 * and Country/State stay empty rather than guessed when the string doesn't
 * say (found live on a Greenhouse form: the old single location rule wrote
 * "San Francisco, CA" into both "Street Address" and "City").
 */

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united states": "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "united kingdom": "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  uae: "United Arab Emirates",
};

// Common countries written out in full; anything else in the last position
// is only treated as a country if it isn't a US state and is > 3 letters.
const KNOWN_COUNTRIES = [
  "Canada", "Mexico", "Brazil", "Argentina", "Germany", "France", "Spain", "Portugal", "Italy",
  "Netherlands", "Belgium", "Switzerland", "Austria", "Poland", "Sweden", "Norway", "Denmark",
  "Finland", "Ireland", "India", "China", "Japan", "Singapore", "Australia", "New Zealand",
  "Israel", "South Africa", "Nigeria", "Kenya", "Philippines", "Indonesia", "Vietnam", "Pakistan",
  "Bangladesh", "Czech Republic", "Romania", "Ukraine", "Greece", "Turkey", "South Korea",
  "United Arab Emirates", "United Kingdom", "United States", "Colombia", "Chile", "Peru", "Egypt",
];

export interface LocationParts {
  city?: string;
  /** Full state/province name when derivable ("California" for "CA"). */
  state?: string;
  country?: string;
}

export function parseLocation(location: string | undefined): LocationParts {
  if (!location) return {};
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};

  const result: LocationParts = {};
  const countryOf = (token: string): string | undefined => {
    const alias = COUNTRY_ALIASES[token.toLowerCase()];
    if (alias) return alias;
    return KNOWN_COUNTRIES.find((c) => c.toLowerCase() === token.toLowerCase());
  };
  const stateOf = (token: string): string | undefined => {
    const upper = token.toUpperCase();
    if (US_STATES[upper]) return US_STATES[upper];
    return Object.values(US_STATES).find((s) => s.toLowerCase() === token.toLowerCase());
  };

  if (parts.length === 1) {
    const only = parts[0];
    const country = countryOf(only);
    if (country) return { country };
    return { city: only };
  }

  result.city = parts[0];
  const rest = parts.slice(1);
  for (const token of rest) {
    const country = countryOf(token);
    if (country && !result.country) {
      result.country = country;
      continue;
    }
    const state = stateOf(token);
    if (state && !result.state) {
      result.state = state;
      continue;
    }
  }
  if (result.state && !result.country) result.country = "United States";
  return result;
}

/** Lowercased alias -> canonical token pairs handed to the main-world
 *  filler so an async location dropdown's "San Francisco, California,
 *  United States" can be matched against a profile's "San Francisco, CA". */
export function locationAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [abbr, name] of Object.entries(US_STATES)) aliases[abbr.toLowerCase()] = name.toLowerCase();
  for (const [alias, name] of Object.entries(COUNTRY_ALIASES)) aliases[alias] = name.toLowerCase();
  return aliases;
}
