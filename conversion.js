// conversion.js — LSER/VTNA predicted reaction conversion in solvent.
// Ported from process_logic.py. Exposes global: CONVERSION
// Rate constants k (from LSER) are in L^(n-1) mol^(n-1) min^-1, so dt is in minutes.

const CONVERSION = (function () {

  // ── Atomic weights (subset) ───────────────────────────────────────────────
  const AW = {
    H:1.008, C:12.011, N:14.007, O:15.999, F:18.998, S:32.06,
    Cl:35.45, P:30.974, Si:28.086, Br:79.904, I:126.904, K:39.098,
  };

  // ── LSER table (first entry per reaction name from lser.csv) ─────────────
  // Coefficients: a=KAT alpha, b=KAT beta, s=KAT pi*, d=KAT delta,
  //               h=Hildebrand (MPa½), v=molar volume (cm³/mol)
  // null = coefficient not used for this reaction
  const LSER = {
    'Allylation': {
      XYZ0: -2.066912043, a: -0.676609979, b: -0.772051758, s: 0.514492282,
      d: null, h: null, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 30,
    },
    'Amidation': {
      XYZ0: -10.5, a: null, b: -1.18, s: null,
      d: null, h: null, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 100,
    },
    'Aza-Michael (bimolecular)': {
      XYZ0: -8.44, a: 5.85, b: null, s: -5.46,
      d: null, h: null, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 30,
    },
    'Aza-Michael (trimolecular)': {
      XYZ0: -12.11, a: null, b: 3.08, s: 4.2,
      d: null, h: null, v: null,
      a_order: 1, b_order: 2, c_order: null, T: 30,
    },
    'Diazo esterification/O-alkylation': {
      XYZ0: -1.963269937, a: 4.622177048, b: -9.179142478, s: null,
      d: null, h: null, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 30,
    },
    'Esterification': {
      XYZ0: -8.67, a: null, b: -5.72, s: null,
      d: null, h: null, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 50,
    },
    'Esterification (enzymatic)': {
      XYZ0: 0.91, a: null, b: -4.53, s: null,
      d: null, h: null, v: 0.044,
      a_order: 1, b_order: 1, c_order: null, T: 40,
    },
    'Fluorination': {
      XYZ0: -8.151370648, a: null, b: null, s: 11.04306806,
      d: null, h: null, v: -0.128480533,
      a_order: 1, b_order: 1, c_order: null, T: 90,
    },
    'Hydrogenation (nitrobenzene to aniline)': {
      XYZ0: -7.9, a: 1.9, b: 0.77, s: null,
      d: null, h: null, v: null,
      a_order: 1, b_order: 0, c_order: null, T: 25,  // H2 in excess: pseudo-1st order
    },
    'Mannich reaction': {
      XYZ0: -1.354737498, a: -4.313081665, b: 4.113679179, s: null,
      d: null, h: null, v: -0.059929384,
      a_order: 1, b_order: 1, c_order: 1, T: 30,
    },
    'Menschutkin reaction': {
      XYZ0: -13.87902715, a: null, b: null, s: 5.016230839,
      d: null, h: null, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 50,
    },
    
    'Michael addition reaction': {
      XYZ0: -4.5, a: null, b: 7.4, s: null,
      d: null, h: null, v: -0.052,
      a_order: 1, b_order: 1, c_order: null, T: 21,
    },
    
    'Mizoroki\u2013Heck reaction': {
      XYZ0: -15.21, a: null, b: null, s: 7.98,
      d: null, h: null, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 100,
    },
    'N-arylation': {
      XYZ0: -4.037566599, a: -2.254908925, b: null, s: 3.896304766,
      d: null, h: null, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 25,
    },
    'Ring closing metathesis': {
      XYZ0: -0.739785951, a: null, b: 5.474255904, s: -1.906828334,
      d: null, h: null, v: null,
      a_order: 1, b_order: null, c_order: null, T: 25,  // intramolecular
    },
    'SN1': {
      XYZ0: -33.6, a: 9.6, b: 1.68, s: 11.7,
      d: null, h: 0.011, v: null,
      a_order: 1, b_order: null, c_order: null, T: 25,  // unimolecular
    },
    'SN2': {
      XYZ0: -4.878411585, a: -3.614364371, b: 2.758848112, s: -3.917097616,
      d: null, h: null, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 25,
    },
    'Transesterification': {
      XYZ0: -8.06, a: null, b: -3.47, s: null,
      d: null, h: -0.00389, v: null,
      a_order: 1, b_order: 1, c_order: null, T: 50,
    },
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Molecular weight from empirical formula string */
  function mw(formula) {
    if (!formula || formula === '?') return 100;
    let total = 0;
    const re = /([A-Z][a-z]?)(\d*)/g;
    let m;
    while ((m = re.exec(formula)) !== null) {
      total += (AW[m[1]] || 0) * (parseInt(m[2]) || 1);
    }
    return total || 100;
  }

  /** Hildebrand solubility parameter (MPa½) from Hansen components */
  function hildebrand(s) {
    const D = parseFloat(s['Dispersion forces /MPa\u00bd']);
    const P = parseFloat(s['Dipole forces /MPa\u00bd']);
    const H = parseFloat(s['Hydrogen bonding forces /MPa\u00bd']);
    if (isNaN(D) || isNaN(P) || isNaN(H)) return null;
    return Math.sqrt(D * D + P * P + H * H);
  }

  /** Molar volume (cm³/mol) = MW / density (g/mL) */
  function molarVolume(s) {
    const density = parseFloat(s['Density /g per mL']);
    if (isNaN(density) || density <= 0) return null;
    return mw(s['Formula'] || '') / density;
  }

  /** Compute ln(k) for a solvent. Returns null if any required property missing. */
  function computeLnk(reactionName, s) {
    const entry = LSER[reactionName];
    if (!entry) return null;

    const alpha   = parseFloat(s['Hydrogen bond donating ability']);
    const beta    = parseFloat(s['Hydrogen bond accepting ability']);
    const pi_star = parseFloat(s['Dipolarity']);
    const delta   = parseFloat(s['Polarisability correction factor']);
    const hild    = hildebrand(s);
    const molVol  = molarVolume(s);

    let lnk = entry.XYZ0;
    const terms = [
      [entry.a, alpha,   'KAT alpha'],
      [entry.b, beta,    'KAT beta'],
      [entry.s, pi_star, 'Dipolarity'],
      [entry.d, delta,   'KAT delta'],
      [entry.h, hild,    'Hildebrand'],
      [entry.v, molVol,  'Molar volume'],
    ];
    for (const [coeff, param] of terms) {
      if (coeff !== null && coeff !== undefined) {
        if (param === null || isNaN(param)) return null;
        lnk += coeff * param;
      }
    }
    return lnk;
  }

  /**
   * Compute dt (minutes) for one conversion step from conv_prev to conv_curr.
   * Mirrors _vtna_delta_t_general() in process_logic.py.
   * concs/orders are arrays [A, B, C].
   */
  function vtna_dt(k, conv_prev, conv_curr, concs, orders) {
    if (k <= 0) return null;

    // All provided concentrations (regardless of order) go into c_min
    const validConcs = concs.filter(c => c != null && c > 0);
    if (validConcs.length === 0) return null;

    const c_min = Math.min(...validConcs);
    const delta_conv = conv_curr - conv_prev;
    const numerator = delta_conv * c_min / k;

    const mid_conv = (conv_prev + conv_curr) / 2;
    let denominator = 1.0;
    for (let i = 0; i < concs.length; i++) {
      const conc  = concs[i];
      const order = orders[i];
      if (conc != null && conc > 0 && order != null && order > 0) {
        const c_mid = conc - mid_conv * c_min;
        if (c_mid <= 0) return null;
        denominator *= Math.pow(c_mid, order);
      }
    }
    if (denominator <= 0) return null;
    return numerator / denominator;
  }

  /**
   * Build conversion-vs-time profile.
   * Steps: 0%, 2%, 4%, ..., 98%, 99% — matching Excel BO5:BO59.
   * Returns { lnk, time_hours, conv_pct } or null.
   */
  function computeProfile(reactionName, s, concA, concB, concC) {
    const lnk = computeLnk(reactionName, s);
    if (lnk === null) return null;

    const k     = Math.exp(lnk);
    const entry = LSER[reactionName];
    const concs  = [concA ?? null, concB ?? null, concC ?? null];
    const orders = [entry.a_order, entry.b_order, entry.c_order];

    // Build conversion steps
    const steps = [];
    for (let i = 0; i <= 49; i++) steps.push(i * 0.02);
    steps.push(0.99);

    const time_hours   = [0.0];
    const conv_pct     = [0.0];
    let cumulative_s = 0.0;

    for (let i = 1; i < steps.length; i++) {
      const dt = vtna_dt(k, steps[i - 1], steps[i], concs, orders);
      if (dt === null) break;
      cumulative_s += dt;
      time_hours.push(cumulative_s / 3600.0);
      conv_pct.push(steps[i] * 100.0);
    }

    return { lnk, time_hours, conv_pct };
  }

  /**
   * Query conversion (%) at target time (hours) using floor lookup.
   * Returns the last fully-reached conversion step before target_hours.
   */
  function conversionAtTime(profile, targetHours) {
    if (!profile) return null;
    const { time_hours, conv_pct } = profile;
    if (!time_hours || time_hours.length < 2) return null;
    if (targetHours <= 0) return 0.0;
    if (targetHours >= time_hours[time_hours.length - 1]) return conv_pct[conv_pct.length - 1];
    for (let i = 1; i < time_hours.length; i++) {
      if (targetHours < time_hours[i]) return conv_pct[i - 1];
    }
    return conv_pct[conv_pct.length - 1];
  }

  /**
   * Get predicted conversion (%) for solvent s given state st.
   * Returns a number 0–99, or null if data or settings are insufficient.
   */
  function getConversion(s, st) {
    const reaction = st.reaction;
    const entry = LSER[reaction];
    if (!entry) return null;

    const concA = parseFloat(st.reactantX && st.reactantX.conc);
    const concB = parseFloat(st.reactantY && st.reactantY.conc);
    const concC = parseFloat(st.reactantZ && st.reactantZ.conc);
    const timeH  = parseFloat(st.reactionTime);

    if (isNaN(concA) || concA <= 0) return null;
    if (isNaN(timeH) || timeH <= 0) return null;

    // Require concB if b_order > 0
    if (entry.b_order != null && entry.b_order > 0 && (isNaN(concB) || concB <= 0)) return null;
    // Require concC if c_order > 0
    if (entry.c_order != null && entry.c_order > 0 && (isNaN(concC) || concC <= 0)) return null;

    const usesC = entry.c_order != null && entry.c_order > 0;
    const profile = computeProfile(
      reaction, s,
      isNaN(concA) ? null : concA,
      isNaN(concB) ? null : concB,
      (usesC && !isNaN(concC)) ? concC : null,
    );
    return conversionAtTime(profile, timeH);
  }

  /** Format conversion for display: "XX.X%" or "—" */
  function fmt(conv) {
    if (conv === null || conv === undefined) return '\u2014';
    return conv.toFixed(1) + '%';
  }

  return { LSER, computeLnk, computeProfile, conversionAtTime, getConversion, fmt };

})();
