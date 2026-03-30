// chem21.js — CHEM21 Safety/Health/Environment scoring (1–10).
// Ported from chem21scoring.py. Exposes global: CHEM21
// Each solvent object s comes directly from solventData.json.

const CHEM21 = (function () {

  const WATER_CAS = '7732-18-5';
  const CO2_CAS   = '124-38-9';

  // All H/EUH code fields present in solventData.json
  const ALL_HCODES = [
    'H224','H225','H226','H227','H280',
    'H300','H301','H302','H304','H305','H310','H311','H312',
    'H314','H315','H317','H318','H319','H320',
    'H330','H331','H332','H334','H335','H336',
    'H340','H341','H350','H351','H360','H361',
    'H370','H371','H372','H373',
    'H400','H410','H411','H412','H413','H420',
    'EUH019','EUH059','EUH066','EUH070','EUH071',
    'EUH208','EUH380','EUH381',
    'EUH430','EUH431','EUH440','EUH441','EUH450','EUH451',
  ];

  // Heteroatom elements tracked for resistivity / C-only checks
  const HETEROATOMS = new Set(['B','Br','Cl','F','I','N','O','P','S','Si']);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function pf(v) {
    if (v === null || v === undefined || v === '' || v === '?' || v === '-') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function isY(v) {
    return (v || '').trim().toUpperCase() === 'Y';
  }

  /** Count heteroatoms from a molecular formula string. */
  function parseHeteroatoms(formula) {
    const counts = {};
    if (!formula) return counts;
    const re = /([A-Z][a-z]?)(\d*)/g;
    let m;
    while ((m = re.exec(formula)) !== null) {
      const elem = m[1];
      if (HETEROATOMS.has(elem)) {
        counts[elem] = (counts[elem] || 0) + (parseInt(m[2]) || 1);
      }
    }
    return counts;
  }

  function heteroatomSum(formula) {
    return Object.values(parseHeteroatoms(formula)).reduce((a, b) => a + b, 0);
  }

  function hasOnlyCandH(formula) {
    return heteroatomSum(formula) === 0;
  }

  /** Estimate whether a solvent is resistive (for safety score conductivity term). */
  function isResistive(s) {
    const formula = s['Formula'] || '';
    const hSum = heteroatomSum(formula);
    if (hSum === 0) return true;
    const counts = parseHeteroatoms(formula);
    const o = counts['O'] || 0;
    const isEther = isY(s['Is it an ether?']);
    if (isEther && o < 3) return true;
    if (o < 2 && hSum < 2) return true;
    return false;
  }

  /** Map Registration annex field to annex code used internally. */
  function getAnnex(s) {
    const a = (s['Registration annex'] || '').trim();
    if (a === 'ANNEX VII')  return 'VII';
    if (a === 'ANNEX VIII') return 'VIII';
    if (a === 'ANNEX IX')   return 'IX';
    if (a === 'ANNEX X')    return 'X';
    return 'unknown';  // 'Data insufficient' or blank
  }

  // ── Worst-case hazard augmentation ────────────────────────────────────────

  function buildWorstCaseHazards(s) {
    // Start with a copy of all known hazard codes from s
    const wc = {};
    for (const code of ALL_HCODES) wc[code] = s[code] || '';

    const annex = getAnnex(s);

    // Annex-based assumed H-codes (cumulative from lower to higher annex)
    const assumed = new Set();
    if (annex === 'unknown') {
      for (const c of ['H340','H350','H360','H410','H373','H314','H318','H334',
                        'H335','H336','H330','H310','H370','H400','H317','H300'])
        assumed.add(c);
    } else if (annex === 'VII') {
      for (const c of ['H340','H350','H360','H410','H373','H314','H318','H334',
                        'H335','H336','H330','H310','H370','H400'])
        assumed.add(c);
    } else if (annex === 'VIII') {
      for (const c of ['H340','H350','H360','H410','H373']) assumed.add(c);
    } else if (annex === 'IX') {
      for (const c of ['H340','H350','H360','H410']) assumed.add(c);
    }
    // ANNEX X: no annex-based assumptions

    // H304 (aspiration): ANNEX VIII and below, viscosity/density < 20.5, only C+H
    if (annex === 'VIII' || annex === 'VII' || annex === 'unknown') {
      const visc = pf(s['Dynamic viscosity /cP']);
      const dens = pf(s['Density /g per mL']);
      if (visc !== null && dens !== null && dens > 0
          && visc / dens < 20.5
          && hasOnlyCandH(s['Formula'] || '')) {
        assumed.add('H304');
      }
    }

    // Set assumed codes where not already 'Y'
    for (const code of assumed) {
      if (!isY(wc[code])) wc[code] = 'Y';
    }

    // Physical-property-based H-codes (regardless of annex)
    const bp = pf(s['Boiling point /°C']);
    if (bp !== null && bp < 25 && !isY(wc['H280'])) wc['H280'] = 'Y';

    const fpRaw = (s['Flash Point /°C'] || '').trim();
    if (fpRaw.toLowerCase() !== 'does not flash') {
      const fp = pf(fpRaw);
      if (fp !== null) {
        if (fp < 23) {
          if (bp !== null && bp <= 35) { if (!isY(wc['H224'])) wc['H224'] = 'Y'; }
          else                         { if (!isY(wc['H225'])) wc['H225'] = 'Y'; }
        } else if (fp <= 60) { if (!isY(wc['H226'])) wc['H226'] = 'Y'; }
        else if (fp <= 93)   { if (!isY(wc['H227'])) wc['H227'] = 'Y'; }
      }
    }

    return wc;
  }

  /**
   * Build a worst-case environmental augmentation of solvent s for step3.
   * Returns an object that can be merged with s via Object.assign({}, s, wcEnv).
   * Only fills in missing fields — known values are never overridden.
   *
   * Rules (based on REACH annex data requirements):
   *   Biodegradation — if unknown, assume 'Not biodegradable' (worst: p_or_vp)
   *   BCF            — if unknown AND logKOW ≥ 3.0, assume 6000 L/kg (vB > 5000)
   *                    if unknown AND logKOW < 3.0 or logKOW unknown, assume 2100 (B, 2000–5000)
   *   NOEC           — if unknown, assume 0.001 mg/L (< 0.01 → T)
   *   ANNEX X solvents with full data are not augmented (same as health/safety WC).
   */
  function buildWorstCaseEnv(s) {
    const cas    = s['CAS'] || '';
    if (cas === WATER_CAS || cas === CO2_CAS) return {};  // always safe

    const annex  = getAnnex(s);
    if (annex === 'X') return {};   // ANNEX X has sufficient data — no WC needed

    const wc = {};

    // Biodegradation
    const biodeg = (s['Biodegradation in water'] || '').trim();
    if (!biodeg) wc['Biodegradation in water'] = 'Not biodegradable';

    // BCF
    const bcf  = pf(s['BCF (aquatic organisms, preferably fish) / L per kg']);
    const logp = pf(s['log(KOW)']);
    if (bcf === null) {
      // Use logKOW to determine worst-case BCF category
      const wcBCF = (logp !== null && logp >= 3.0) ? 6000 : 2100;
      wc['BCF (aquatic organisms, preferably fish) / L per kg'] = String(wcBCF);
    }

    // NOEC
    const noec = pf(s['NOEC /mg per L']);
    if (noec === null) wc['NOEC /mg per L'] = '0.001';

    return wc;
  }

  // ── Score calculators ─────────────────────────────────────────────────────

  /**
   * Safety score (1–10).
   * haz: hazard object (s for known, wc for worst-case).
   */
  function calcSafety(s, haz) {
    const cas = s['CAS'] || '';
    if (cas === WATER_CAS) return 1;

    // High energy of decomposition
    if (isY(s['Is decomposition energy >500 J/g ?'])) return 10;

    // Flash point → base score
    const fpRaw = (s['Flash Point /°C'] || '').trim();
    let fp;
    if (fpRaw.toLowerCase() === 'does not flash') {
      fp = 61;
    } else {
      fp = pf(fpRaw);
    }

    let score;
    if (fp === null || fp < -20) score = 7;
    else if (fp <= -1)           score = 5;
    else if (fp <= 23)           score = 4;
    else if (fp <= 60)           score = 3;
    else                         score = 1;

    // +1 if autoignition < 200 °C (or missing)
    const aitRaw = (s['Autoignition temperature /°C'] || '').trim();
    if (aitRaw.toLowerCase() !== 'does not ignite') {
      const ait = pf(aitRaw);
      if (ait === null || ait < 200) score += 1;
    }

    // +1 if EUH019
    if (isY((haz || s)['EUH019'])) score += 1;

    // +1 if electrical conductivity < 1e-9, or estimated resistive when missing
    const ec = pf(s['Electrical conductivity /10-1 S per cm']);
    if (ec !== null) {
      if (ec < 1e-9) score += 1;
    } else if (isResistive(s)) {
      score += 1;
    }

    return Math.min(score, 10);
  }

  const HEALTH_SCORE_MAP = {
    H304: 2, H371: 2, H373: 2, H302: 2, H312: 2, H332: 2,
    H336: 2, EUH070: 2, H315: 2, H317: 2, H319: 2, H335: 2,
    EUH066: 2,
    H334: 4, H318: 4,
    H341: 6, H351: 6, H361: 6, H370: 6, H372: 6,
    H301: 6, H311: 6, H331: 6,
    H314: 7,
    H340: 9, H350: 9, H360: 9, H300: 9, H310: 9, H330: 9,
  };

  /** Health score (1–10). */
  function calcHealth(s, haz) {
    const h = haz || s;
    let score = 1;
    for (const [code, cs] of Object.entries(HEALTH_SCORE_MAP)) {
      if (isY(h[code])) score = Math.max(score, cs);
    }
    const bp = pf(s['Boiling point /°C']);
    if (bp !== null && bp < 85) score += 1;
    return Math.min(score, 10);
  }

  /** Environment score (1–10). */
  function calcEnvironment(s, haz) {
    const cas = s['CAS'] || '';
    if (cas === WATER_CAS) return 1;

    const h = haz || s;
    if (isY(h['H420'])) return 10;

    let score = 1;
    const bp = pf(s['Boiling point /°C']);
    if (bp === null || bp < 50 || bp > 200) score = Math.max(score, 7);
    else if (bp < 70 || bp > 140)           score = Math.max(score, 5);
    else                                     score = Math.max(score, 3);

    for (const code of ['H400', 'H410', 'H411']) {
      if (isY(h[code])) score = Math.max(score, 7);
    }
    for (const code of ['H412', 'H413']) {
      if (isY(h[code])) score = Math.max(score, 5);
    }
    if ((s['REACH registration'] || '').trim().toUpperCase() === 'N') {
      score = Math.max(score, 5);
    }

    return Math.min(score, 10);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Compute all six CHEM21 scores for solvent s.
   * Returns { safety, health, env, safetyWC, healthWC, envWC }.
   */
  function getScores(s) {
    const cas = s['CAS'] || '';
    const annex = getAnnex(s);
    const skipWC = (cas === WATER_CAS || cas === CO2_CAS || annex === 'X');

    const safety = calcSafety(s, s);
    const health = calcHealth(s, s);
    const env    = calcEnvironment(s, s);

    let safetyWC, healthWC, envWC;
    if (skipWC) {
      safetyWC = safety;
      healthWC = health;
      envWC    = env;
    } else {
      const wc = buildWorstCaseHazards(s);
      safetyWC = calcSafety(s, wc);
      // Extra worst-case +1 when conductivity is unknown and not resistive
      const ec = pf(s['Electrical conductivity /10-1 S per cm']);
      if (ec === null && !isResistive(s)) safetyWC = Math.min(safetyWC + 1, 10);
      healthWC = calcHealth(s, wc);
      envWC    = calcEnvironment(s, wc);
    }

    return { safety, health, env, safetyWC, healthWC, envWC };
  }

  /** Background colour for a CHEM21 score (1–3 green, 4–6 amber, 7–10 red). */
  function scoreColor(score) {
    if (score === null || score === undefined) return '';
    if (score <= 3) return '#c6efce';
    if (score <= 6) return '#ffeb9c';
    return '#ffc7ce';
  }

  /** Format score for display. */
  function fmt(score) {
    return (score === null || score === undefined) ? '\u2014' : String(score);
  }

  return { getScores, scoreColor, fmt, buildWorstCaseHazards, buildWorstCaseEnv };

})();
