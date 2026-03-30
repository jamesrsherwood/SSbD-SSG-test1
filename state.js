// state.js — Manages user selections in localStorage so they persist across pages.
// Import with: <script src="state.js"></script>
// Usage:
//   const s = loadState();        // read current selections (or defaults)
//   s.reaction = 'Esterification';
//   saveState(s);                  // write back after any change
//   clearState();                  // reset everything to defaults

const STATE_KEY = 'ssgUserSettings';

function getDefaults() {
  return {
    // ── Reaction ────────────────────────────────────────────────────────────
    reaction: 'Other',
    referenceSolvent: '',
    chemicalsAutofill: false,
    reactantX: { name: '', rmm: null, conc: 1 },
    reactantY: { name: '', rmm: null, conc: 1 },
    reactantZ: { name: '', rmm: null, conc: 1 },
    product:   { name: '', rmm: null             },
    otherReagents: { name: '', mass: null        },

    // ── Process ─────────────────────────────────────────────────────────────
    processType:      'PROC1',
    scale:            100,    // litres
    processTemp:      null,   // °C; null = use reaction default
    reactionTemp:     25,     // °C; set automatically from selected reaction (read-only override for step2a)
    reactionTime:     12,     // hours

    // ── Risk scenario ────────────────────────────────────────────────────────
    exposureTemp:     'Ambient temperature',
    exposureTime:     '<15min',
    ventilation:      'No ventilation',
    lev:              true,   // local exhaust ventilation (spreadsheet default: LEV=Y)
    rpe:              'no RPE',
    ppe:              'no PPE',

    // ── Utilities & waste management ─────────────────────────────────────────
    endOfLife:            'Incinerated',
    distillationRecovery: null,   // % (0–100)

    // ── Impact ───────────────────────────────────────────────────────────────
    energyIntensity:  'EU',
    climateChange:    null,  // kg CO₂eq per kg reagents
    freshwaterUse:    null,  // litres per kg reagents

    // ── Hazard categories to permit ──────────────────────────────────────────
    hazards: {
      chronicToxicity:  true,
      suspectedChronic: true,
      acuteToxicity:    true,
      envPBT:           true,
      envToxicity:      true,
    },

    // ── Compatible functional groups ─────────────────────────────────────────
    functionalGroups: {
      acid:              true,
      ester:             true,
      alcoholMono:       true,
      ether:             true,
      aromaticHydrocarbon: true,
      ketoneAndCarbonate:  true,
      chlorinated:       true,
      multifunctional:   true,
      amide:             true,
      inorganic:         true,
      amine:             true,
      ionicLiquid:       true,
      aliphaticHydrocarbon: true,
      eutecticMixture:   true,
      otherHeteroatom:   true,
      otherHalogenated:  true,
      perfluorinated:    true,
      polyol:            true,
      siloxane:          true,
    },

    // ── Polarity ─────────────────────────────────────────────────────────────
    polarityDataOnly:   false,
    refineByPolarity:   false,
    polarityD:          16,
    polarityP:          9,
    polarityH:          7,
    polarityRadius:     6,

    // ── Solvent set & state ───────────────────────────────────────────────────
    solventSet:         'Full set',
    stateAtRT: {
      solid:   true,
      liquid:  true,
      gas:     true,
    },
    reachOnly:          false,

    // ── Physical property filters (enabled + min/max) ─────────────────────────
    properties: {
      meltingPoint:    { enabled: false, min: null, max: null },
      boilingPoint:    { enabled: false, min: null, max: null },
      density:         { enabled: false, min: null, max: null },
      viscosity:       { enabled: false, min: null, max: null },
      surfaceTension:  { enabled: false, min: null, max: null },
      flashPoint:      { enabled: false, min: null, max: null },
      autoFlammability:{ enabled: false, min: null, max: null },
      bioThreshold:    { enabled: false, min: null, max: null },
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Load the saved state, falling back to defaults for any missing keys. */
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const defaults = getDefaults();
      // Shallow-merge top-level, then deep-merge nested objects
      const merged = Object.assign({}, defaults, saved);
      merged.reactantX     = Object.assign({}, defaults.reactantX,     saved.reactantX     || {});
      merged.reactantY     = Object.assign({}, defaults.reactantY,     saved.reactantY     || {});
      merged.reactantZ     = Object.assign({}, defaults.reactantZ,     saved.reactantZ     || {});
      // If saved concentration is null (old default), fall back to new default
      if (merged.reactantX.conc === null) merged.reactantX.conc = defaults.reactantX.conc;
      if (merged.reactantY.conc === null) merged.reactantY.conc = defaults.reactantY.conc;
      if (merged.reactantZ.conc === null) merged.reactantZ.conc = defaults.reactantZ.conc;
      if (merged.reactionTime  === null) merged.reactionTime    = defaults.reactionTime;
      merged.product       = Object.assign({}, defaults.product,       saved.product       || {});
      merged.otherReagents = Object.assign({}, defaults.otherReagents, saved.otherReagents || {});
      merged.hazards         = Object.assign({}, defaults.hazards,         saved.hazards         || {});
      merged.functionalGroups= Object.assign({}, defaults.functionalGroups, saved.functionalGroups|| {});
      merged.stateAtRT       = Object.assign({}, defaults.stateAtRT,       saved.stateAtRT       || {});
      merged.properties      = Object.assign({}, defaults.properties);
      if (saved.properties) {
        for (const key of Object.keys(defaults.properties)) {
          merged.properties[key] = Object.assign({}, defaults.properties[key], saved.properties[key] || {});
        }
      }
      return merged;
    }
  } catch (e) {
    console.warn('ssgUserSettings: could not parse localStorage, using defaults.', e);
  }
  return getDefaults();
}

/** Persist the full state object to localStorage. */
function saveState(data) {
  localStorage.setItem(STATE_KEY, JSON.stringify(data));
}

/** Wipe the saved state (resets to defaults on next loadState()). */
function clearState() {
  localStorage.removeItem(STATE_KEY);
}
