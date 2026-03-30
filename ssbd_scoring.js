// ssbd_scoring.js — SSbD assessment engine for the SSbD-SSG web app.
// Based on EU SSbD Recommendation 2022/2510 and ECETOC TRA v3 exposure model.
// Loaded as a plain script; exposes a single global object: SSBD

const SSBD = (function () {

  // ── Atomic weights for MW calculation ─────────────────────────────────────
  const AW = {
    H:1.008, He:4.003, Li:6.941, Be:9.012, B:10.811, C:12.011, N:14.007,
    O:15.999, F:18.998, Ne:20.18, Na:22.99, Mg:24.305, Al:26.982, Si:28.086,
    P:30.974, S:32.06, Cl:35.45, Ar:39.948, K:39.098, Ca:40.078, Fe:55.845,
    Co:58.933, Ni:58.693, Cu:63.546, Zn:65.38, Br:79.904, I:126.904,
  };

  // ── ECETOC TRA v3 inhalation lookup: PROC + LEV(Y/N) + fugacity → mg/m³ ──
  // Fugacity levels: "high" (VP > 75 mmHg), "medium" (3.75–75), "low" (0.000075–3.75), "very low" (<0.000075)
  const INHAL = {
    PROC1Yhigh:0.01, PROC1Ymedium:0.01, PROC1Ylow:0.01, 'PROC1Yvery low':0.01,
    PROC1Nhigh:0.01, PROC1Nmedium:0.01, PROC1Nlow:0.01, 'PROC1Nvery low':0.01,
    PROC2Yhigh:25,   PROC2Ymedium:5,    PROC2Ylow:1,    'PROC2Yvery low':0.1,
    PROC2Nhigh:25,   PROC2Nmedium:5,    PROC2Nlow:1,    'PROC2Nvery low':0.1,
    PROC3Yhigh:50,   PROC3Ymedium:10,   PROC3Ylow:3,    'PROC3Yvery low':0.1,
    PROC3Nhigh:50,   PROC3Nmedium:10,   PROC3Nlow:3,    'PROC3Nvery low':0.1,
    PROC4Yhigh:100,  PROC4Ymedium:20,   PROC4Ylow:5,    'PROC4Yvery low':0.1,
    PROC4Nhigh:100,  PROC4Nmedium:20,   PROC4Nlow:5,    'PROC4Nvery low':0.1,
    PROC5Yhigh:250,  PROC5Ymedium:50,   PROC5Ylow:5,    'PROC5Yvery low':0.1,
    PROC5Nhigh:250,  PROC5Nmedium:50,   PROC5Nlow:5,    'PROC5Nvery low':0.1,
    PROC6Yhigh:250,  PROC6Ymedium:50,   PROC6Ylow:5,    'PROC6Yvery low':0.1,
    PROC6Nhigh:250,  PROC6Nmedium:50,   PROC6Nlow:5,    'PROC6Nvery low':0.1,
    PROC7Yhigh:500,  PROC7Ymedium:250,  PROC7Ylow:100,  'PROC7Yvery low':100,
    PROC7Nhigh:500,  PROC7Nmedium:250,  PROC7Nlow:100,  'PROC7Nvery low':100,
    PROC8aYhigh:250, PROC8aYmedium:50,  PROC8aYlow:10,  'PROC8aYvery low':0.1,
    PROC8aNhigh:250, PROC8aNmedium:50,  PROC8aNlow:10,  'PROC8aNvery low':0.1,
    PROC8bYhigh:150, PROC8bYmedium:25,  PROC8bYlow:5,   'PROC8bYvery low':0.1,
    PROC8bNhigh:150, PROC8bNmedium:25,  PROC8bNlow:5,   'PROC8bNvery low':0.1,
    PROC9Yhigh:200,  PROC9Ymedium:50,   PROC9Ylow:5,    'PROC9Yvery low':0.1,
    PROC9Nhigh:200,  PROC9Nmedium:50,   PROC9Nlow:5,    'PROC9Nvery low':0.1,
    PROC10Yhigh:250, PROC10Ymedium:50,  PROC10Ylow:5,   'PROC10Yvery low':0.1,
    PROC10Nhigh:250, PROC10Nmedium:50,  PROC10Nlow:5,   'PROC10Nvery low':0.1,
    PROC12Yhigh:100, PROC12Ymedium:20,  PROC12Ylow:2,   'PROC12Yvery low':2,
    PROC12Nhigh:100, PROC12Nmedium:20,  PROC12Nlow:2,   'PROC12Nvery low':2,
    PROC13Yhigh:250, PROC13Ymedium:50,  PROC13Ylow:10,  'PROC13Yvery low':0.1,
    PROC13Nhigh:250, PROC13Nmedium:50,  PROC13Nlow:10,  'PROC13Nvery low':0.1,
    PROC14Yhigh:250, PROC14Ymedium:50,  PROC14Ylow:5,   'PROC14Yvery low':0.1,
    PROC14Nhigh:250, PROC14Nmedium:50,  PROC14Nlow:5,   'PROC14Nvery low':0.1,
    PROC15Yhigh:50,  PROC15Ymedium:10,  PROC15Ylow:5,   'PROC15Yvery low':0.1,
    PROC15Nhigh:50,  PROC15Nmedium:10,  PROC15Nlow:5,   'PROC15Nvery low':0.1,
    PROC16Yhigh:25,  PROC16Ymedium:5,   PROC16Ylow:1,   'PROC16Yvery low':0.1,
    PROC16Nhigh:25,  PROC16Nmedium:5,   PROC16Nlow:1,   'PROC16Nvery low':0.1,
    PROC17Yhigh:100, PROC17Ymedium:50,  PROC17Ylow:20,  'PROC17Yvery low':20,
    PROC17Nhigh:100, PROC17Nmedium:50,  PROC17Nlow:20,  'PROC17Nvery low':20,
    PROC18Yhigh:100, PROC18Ymedium:50,  PROC18Ylow:20,  'PROC18Yvery low':20,
    PROC18Nhigh:100, PROC18Nmedium:50,  PROC18Nlow:20,  'PROC18Nvery low':20,
    PROC19Yhigh:250, PROC19Ymedium:50,  PROC19Ylow:10,  'PROC19Yvery low':0.1,
    PROC19Nhigh:250, PROC19Nmedium:50,  PROC19Nlow:10,  'PROC19Nvery low':10,
  };

  // ── Dermal initial exposure by PROC (mg/kg/day) ───────────────────────────
  const DERMAL = {
    PROC1:0.034, PROC2:1.37, PROC3:0.69, PROC4:6.86, PROC5:13.71,
    PROC6:27.43, PROC7:42.86, PROC8a:27.43, PROC8b:13.71, PROC9:6.86,
    PROC10:27.43, PROC12:0.34, PROC13:13.71, PROC14:3.43, PROC15:0.34,
    PROC16:0.34, PROC17:27.43, PROC18:13.71, PROC19:141.43,
  };

  // ── Risk level mapping ─────────────────────────────────────────────────────
  // Score 1=worst (A), 5=best (E), 0=no data
  const LABELS = ['', 'A', 'B', 'C', 'D', 'E'];
  const FULL   = ['', '(A) Very high risk', '(B) High risk', '(C) Medium risk', '(D) Low risk', '(E) Negligible risk'];
  const COLORS = ['#aaa', '#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#852379'];
  // index 0 = no data (grey)

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Molecular weight from empirical formula string, e.g. "C2H4Cl2" */
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

  /**
   * Vapour pressure at T_celsius (°C) via Antoine equation.
   * NIST form: log10(P/bar) = A − B/(C + T_K)   where T_K = T_celsius + 273.15
   * Returns mmHg (1 bar = 750.062 mmHg).  Falls back to stored VP if Antoine
   * coefficients are absent.
   */
  function vp(s, T_celsius) {
    const A = parseFloat(s['Antoine A']);
    const B = parseFloat(s['Antoine B']);
    const C = parseFloat(s['Antoine C']);
    if (!isNaN(A) && !isNaN(B) && !isNaN(C)) {
      const TK = T_celsius + 273.15;
      const denom = C + TK;
      if (denom === 0) return null;
      return 750.062 * Math.pow(10, A - B / denom);
    }
    // No Antoine data: attempt two-point Clausius-Clapeyron using stored VP and boiling point.
    // Anchor 1: stored VP at its reference temperature (field "Temperature for vapour pressure /°C",
    //           defaulting to 25 °C if absent).
    // Anchor 2: VP = 760 mmHg at the normal boiling point.
    const stored = parseFloat(s['Vapour pressure /mmHg']);
    const bp     = parseFloat(s['Boiling point /\u00b0C']);
    if (!isNaN(stored) && stored > 0 && !isNaN(bp)) {
      const T_ref = (parseFloat(s['Temperature for vapour pressure /\u00b0C']) || 25) + 273.15;
      const T_bp  = bp + 273.15;
      const T2    = T_celsius + 273.15;
      if (T_bp > T_ref) {
        // ΔHvap/R from the two anchor points
        const dHvapR = Math.log(760 / stored) / (1 / T_ref - 1 / T_bp);
        return stored * Math.exp(dHvapR * (1 / T_ref - 1 / T2));
      }
    }
    // Final fallback: stored VP as-is
    return isNaN(stored) ? null : stored;
  }

  /** Classify vapour pressure (mmHg) → "high"/"medium"/"low"/"very low" */
  function fugLevel(vp_mmHg) {
    if (vp_mmHg === null || isNaN(vp_mmHg)) return null;
    if (vp_mmHg > 75)        return 'high';
    if (vp_mmHg >= 3.75)     return 'medium';
    if (vp_mmHg >= 0.000075) return 'low';
    return 'very low';
  }

  /** Parse a numeric field, returning null if absent or non-numeric */
  function num(s, key) {
    const v = parseFloat(s[key]);
    return isNaN(v) ? null : v;
  }

  /** RCR → risk score 1–5 (or 0 if no data, or 1 if no exposure limit).
   *  Thresholds from SSbD SSG.xlsx Database sheet rows 377–381:
   *  A ≥ 1.0,  B ≥ 0.75,  C ≥ 0.5,  D ≥ 0.005,  E < 0.005
   */
  function rcrScore(rcr, hasHazard) {
    if (rcr === null) return hasHazard ? 1 : 0; // no limit but hazard → worst
    if (rcr >= 1)     return 1;
    if (rcr >= 0.75)  return 2;
    if (rcr >= 0.5)   return 3;
    if (rcr >= 0.005) return 4;
    return 5;
  }

  // ── SSbD Step 1: Hazard group ─────────────────────────────────────────────

  const GRP_A = ['H334','H340','H350','H360','H372','EUH380','EUH381'];
  const GRP_B = ['H317','H370','H371','H410','H411'];
  const GRP_C = ['H302','H304','H305','H310','H311','H312','H314','H315',
                 'H318','H319','H320','H332','H335','H336','H341','H351',
                 'H361','H373','H400','H412','H413','H420','EUH059',
                 'H300','H301','H330','H331'];
  // Fire codes handled in Safety step, not hazard group
  const FIRE  = ['H224','H225','H226','H227'];

  // ── Route-hazard H-code mappings (from hazard_cat_known_route.csv) ─────────
  const INH_CODES = new Set([
    'EUH071','EUH208','EUH380','EUH381',
    'H304','H305','H330','H331','H332','H334','H335','H336',
    'H340','H341','H350','H351','H360','H361','H370','H371','H372','H373',
  ]);
  const DERM_CODES = new Set([
    'EUH066','EUH208','EUH380','EUH381',
    'H310','H311','H312','H314','H315','H317',
    'H341','H350','H351','H360','H361','H370','H371','H372','H373',
  ]);
  const EYE_CODES = new Set([
    'EUH208','EUH270','EUH380','EUH381',
    'H314','H318','H319','H320',
    'H340','H341','H350','H351','H360','H361','H370','H371','H372','H373',
  ]);

  function hasRouteHazard(s, codeSet) {
    for (const c of codeSet) {
      if ((s[c] || '').trim().toUpperCase() === 'Y') return true;
    }
    return false;
  }

  function step1(s) {
    const a = GRP_A.filter(h => s[h] === 'Y');
    const b = GRP_B.filter(h => s[h] === 'Y');
    const c = GRP_C.filter(h => s[h] === 'Y');
    const f = FIRE.filter(h => s[h] === 'Y');
    if (a.length) return { score:1, group:'A', hazards:a };
    if (b.length) return { score:2, group:'B', hazards:b };
    if (c.length) return { score:3, group:'C', hazards:c };
    if (f.length) return { score:4, group:'D', hazards:f };
    return { score:5, group:'E', hazards:[] };
  }

  // ── SSbD Step 2a: Occupational health risk ────────────────────────────────

  function step2a(s, st) {
    // Water is definitively safe — always rank E regardless of missing exposure limits
    if ((s['Name'] || '').trim() === 'Water')
      return { score: 5, rcr_lt: null, rcr_st: null, rcr_d: null, fug: null };
    const proc    = st.processType  || 'PROC13';
    const lev     = st.lev ? 'Y' : 'N';
    const useProc = st.exposureTemp === 'Process temperature';
    const time    = st.exposureTime || '1-4hr';
    const vent    = st.ventilation  || 'Good ventilation';
    const rpe     = st.rpe || 'no RPE';
    const ppe     = st.ppe || 'no PPE';

    // VP: process-temperature mode uses Antoine at the set temperature;
    // room-temperature mode uses the stored room-temp VP (matches Python 'rt' mode),
    // falling back to Antoine at 25 °C if no stored value is available.
    let vpVal;
    if (useProc) {
      // processTemp is a user override; fall back to the reaction's own temperature
      vpVal = vp(s, st.processTemp ?? st.reactionTemp ?? 25);
    } else {
      const stored = parseFloat(s['Vapour pressure /mmHg']);
      vpVal = !isNaN(stored) ? stored : vp(s, 25);
    }
    const fug   = fugLevel(vpVal);

    const MW = mw(s['Formula'] || '');

    // Ventilation factor
    const ventF = vent === 'Good ventilation'     ? 0.7
                : vent === 'Enhanced ventilation' ? 0.3
                : 1.0; // No ventilation or Basic ventilation

    // Exposure time factor (applied to 8-hr TWA base)
    const timeF = time === '<15min'     ? 0.1
                : time === '15min-1hr'  ? 0.2
                : time === '1-4hr'      ? 0.6
                : 1.0; // >4hr

    // RPE factor (inhalation)
    const rpeF = rpe === '95% effectiveness' ? 0.05
               : rpe === '90% effectiveness' ? 0.1
               : 1.0;

    // Per-PROC LEV reduction factors (from process_exposure.csv).
    // PROC1 is fully closed — LEV has no additional effect on inhalation or dermal.
    // PROC10 and PROC19 LEV reduces inhalation but NOT dermal.
    // All other PROCs: LEV reduces both inhalation and dermal by 0.1.
    const _noLevInhal = new Set(['PROC1']);
    const _noLevDerm  = new Set(['PROC1','PROC10','PROC19']);
    const levF     = (lev === 'Y' && !_noLevInhal.has(proc)) ? 0.1 : 1.0;
    const levDermF = (lev === 'Y' && !_noLevDerm.has(proc))  ? 0.1 : 1.0;

    // PPE factor (dermal)
    const ppeF = ppe === '95% effectiveness' ? 0.05
               : ppe === '90% effectiveness' ? 0.1
               : ppe === '80% effectiveness' ? 0.2
               : 1.0;

    // Short-term multiplier (4× unless very low volatility and not a spray-type PROC).
    // PROC7/17/18 are always spray; PROC10/19 only act as spray when LEV=Y (Excel logic).
    const alwaysSpray = ['PROC7','PROC17','PROC18'];
    const levSpray    = ['PROC10','PROC19'];
    const isSpray = alwaysSpray.includes(proc) || (levSpray.includes(proc) && lev === 'Y');
    const stMult = (fug === 'very low' && !isSpray) ? 1 : 4;

    // ── Inhalation (long-term, 8 hr TWA) ──
    let rcr_lt = null, rcr_st = null, rcr_d = null;

    if (fug !== null) {
      const key  = proc + lev + fug;
      const base = INHAL[key];

      if (base !== undefined) {
        const exp_lt = base * (MW / 24) * ventF * timeF * rpeF * levF;
        const exp_st = base * (MW / 24) * ventF * rpeF * levF * stMult;

        const dnel_lt = num(s, 'DNEL (long term inhalation) /mg per m3');
        const oel_lt  = num(s, 'Long term occupational exposure limit (8 hr) /mg per m3');
        const dnel_st = num(s, 'DNEL (short term inhalation) /mg per m3');
        const oel_st  = num(s, 'Short term occupational exposure limit (15 min) /mg per m3');
        const dnel_d  = num(s, 'DNEL (long term dermal) /mg per kg per day');

        // OEL takes priority over DNEL (regulatory limit preferred), matching Python logic
        const lim_lt = oel_lt ?? dnel_lt;
        const lim_st = oel_st ?? dnel_st;

        if (lim_lt !== null) rcr_lt = exp_lt / lim_lt;
        if (lim_st !== null) rcr_st = exp_st / lim_st;

        // ── Dermal ──
        const dermBase = DERMAL[proc] || 13.71;
        const dermTimeF = (fug === 'very low' || fug === 'low') ? 1.0 : timeF;
        const exp_d = dermBase * dermTimeF * ppeF * levDermF;
        if (dnel_d !== null) rcr_d = exp_d / dnel_d;

        // Route hazard flags (from hazard_cat_known_route.csv mappings)
        const hasInhalHaz     = hasRouteHazard(s, INH_CODES);
        const hasDermOrEyeHaz = hasRouteHazard(s, DERM_CODES) || hasRouteHazard(s, EYE_CODES);
        const h314 = (s['H314'] || '').trim().toUpperCase() === 'Y';
        const h318 = (s['H318'] || '').trim().toUpperCase() === 'Y';

        // Long-term inhalation: limit → RCR; hazard+no limit → A; no hazard → E
        let s_lt;
        if (lim_lt !== null)  { s_lt = rcrScore(rcr_lt, false); }
        else if (hasInhalHaz) { s_lt = 1; }
        else                  { s_lt = 5; }

        // Short-term inhalation: same gating as LT
        let s_st;
        if (lim_st !== null)  { s_st = rcrScore(rcr_st, false); }
        else if (hasInhalHaz) { s_st = 1; }
        else                  { s_st = 5; }

        // Dermal: DNEL → RCR; no DNEL + no hazard → E;
        //         no DNEL + H314 (corrosive) → B; no DNEL + H318 (eye) → C;
        //         no DNEL + other dermal/eye hazard → A
        let s_d;
        if (dnel_d !== null)       { s_d = rcrScore(rcr_d, false); }
        else if (!hasDermOrEyeHaz) { s_d = 5; }
        else if (h314)             { s_d = 2; }
        else if (h318)             { s_d = 3; }
        else                       { s_d = 1; }

        const worst = [s_lt, s_st, s_d].filter(x => x > 0);
        const score = worst.length ? Math.min(...worst) : 0;

        return {
          score, rcr_lt, rcr_st, rcr_d,
          exp_lt: +exp_lt.toPrecision(3),
          exp_st: +exp_st.toPrecision(3),
          exp_d:  +exp_d.toPrecision(3),
          lim_lt, lim_st, dnel_d,
          vpVal: vpVal ? +vpVal.toPrecision(3) : null, fug,
        };
      }
    }

    return { score:0, rcr_lt:null, rcr_st:null, rcr_d:null, fug };
  }

  // ── SSbD Step 2b: Safety (fire & explosion) ───────────────────────────────

  function step2b(s) {
    const fp = num(s, 'Flash Point /\u00b0C');
    const bp = num(s, 'Boiling point /\u00b0C');

    // Classify by flash point (GHS/CLP criteria) and H-codes
    if (s['H224'] === 'Y' || (fp !== null && fp < 23 && bp !== null && bp <= 35))
      return { score:1, label:'Extremely flammable (FP < 23 °C, BP ≤ 35 °C)', fp, bp };
    if (s['H225'] === 'Y' || (fp !== null && fp < 23))
      return { score:2, label:'Highly flammable (FP < 23 °C)', fp, bp };
    if (s['H226'] === 'Y' || (fp !== null && fp >= 23 && fp <= 60))
      return { score:3, label:'Flammable (FP 23–60 °C)', fp, bp };
    if (s['H227'] === 'Y' || (fp !== null && fp > 60 && fp <= 93))
      return { score:4, label:'Combustible liquid (FP 60–93 °C)', fp, bp };
    if (fp !== null && fp > 93)
      return { score:5, label:'Low fire hazard (FP > 93 °C)', fp, bp };
    // No flash point data
    if (s['H280'] === 'Y')
      return { score:3, label:'Gas under pressure', fp, bp };
    return { score:5, label:'No fire hazard identified', fp, bp };
  }

  // ── SSbD Step 3: Environmental risk (SSbD3b logic) ───────────────────────
  // Ported from ssbd3b_logic.py — uses environmental fate partition to select
  // air risk, water risk, or worst-of-both based on where the solvent ends up.

  function step3(s) {
    const halflife = num(s, 'Photodegradation halflife /days');
    const airPct   = num(s, 'Air /%');
    const waterPct = num(s, 'Water /%');
    const soilPct  = num(s, 'Soil /%');
    const sedPct   = num(s, 'Sediment /%');
    const biodeg   = (s['Biodegradation in water'] || '').trim();
    const bcf      = num(s, 'BCF (aquatic organisms, preferably fish) / L per kg');
    const logp     = num(s, 'log(KOW)');
    const noec     = num(s, 'NOEC /mg per L');
    const hazSt    = (s['SVHC hazard status'] || '').trim();
    const regAnnex = (s['Registration annex'] || '').trim();
    const name     = (s['Name'] || '').trim();

    const LS = { A:1, B:2, C:3, D:4, E:5 };   // letter → score
    const haz = c => (s[c] || '').trim().toUpperCase() === 'Y';

    // ── 1. Environmental fate (Mackay partition %) ──
    let fate = 'unknown';
    if (airPct !== null && waterPct !== null && soilPct !== null && sedPct !== null) {
      const ss = soilPct + sedPct;
      if      (airPct   > 85)                    fate = 'air';
      else if (waterPct > 85)                    fate = 'water';
      else if (airPct   > 60)                    fate = 'mostly_air';
      else if (waterPct > 60)                    fate = 'mostly_water';
      else if (ss       > 60)                    fate = 'soil_and_sediment';
      else if (airPct > 20 && waterPct > 20)     fate = 'air_and_water';
      else if (airPct > 20 && ss > 20)           fate = 'air_and_soil';
      else if (waterPct > 20 && ss > 20)         fate = 'soil_and_water';
    }
    const fateAir   = ['air','mostly_air','air_and_water','air_and_soil'].includes(fate);

    // ── 2. Air persistence (photo-degradation OH-radical half-life) ──
    // Thresholds: ≤ 3 d = short-lived, ≥ 21 d = long-lived, between = preferential
    let airPersist = 'unknown';
    if (halflife !== null) {
      if      (halflife >= 21) airPersist = 'long_lived';
      else if (halflife <= 3)  airPersist = 'short_lived';
      else                     airPersist = 'preferential';
    }

    // ── 3. Air risk letter ──
    const isOzone = haz('H420') || haz('EUH059');
    let airLetter;
    if (name === 'Water' || name === 'Carbon dioxide') {
      airLetter = 'E';
    } else if (isOzone) {
      airLetter = 'A';
    } else if (fateAir && (airPersist === 'unknown' || airPersist === 'long_lived')) {
      airLetter = 'A';
    } else if (fateAir && airPersist === 'short_lived') {
      airLetter = 'B';
    } else if (airPersist === 'preferential') {
      airLetter = 'C';  // regardless of whether fate involves air
    } else {
      airLetter = 'D';
    }

    // ── 4. Water persistence category ──
    // Maps biodegradation text → internal category used in PBT/water-risk checks.
    // 'Biodegradable' (not readily) → text contains 'persistent (P)' →
    //   counts as p_or_vp in Python's _persistence_is_p_or_vp()
    let waterPersist = 'unknown';
    if      (biodeg === 'Not biodegradable')                              waterPersist = 'p_or_vp';
    else if (biodeg === 'Inherently biodegradable not meeting criteria')  waterPersist = 'ambiguous';
    else if (biodeg === 'Biodegradable')                                  waterPersist = 'none';
    else if (biodeg === 'Readily biodegradable')                          waterPersist = 'none';

    // PBT is_p: p_or_vp OR potentially_p (both satisfy _persistence_is_p_or_vp in Python)
    const isPorVP   = waterPersist === 'p_or_vp' || waterPersist === 'potentially_p';
    // Water risk is_p_or_vp also includes ambiguous (text contains 'ambiguous')
    const isPorAmb  = isPorVP || waterPersist === 'ambiguous';

    // ── 5. Bioaccumulation ──
    let bioaccCat = 'unknown';
    if (bcf !== null) {
      if      (bcf > 5000) bioaccCat = 'vb';
      else if (bcf > 2000) bioaccCat = 'b';
      else                 bioaccCat = 'none';
    } else if (logp !== null) {
      if      (logp >= 4.5) bioaccCat = 'logp_vb';
      else if (logp >= 3.0) bioaccCat = 'logp_b';
      else                  bioaccCat = 'none';
    }
    const isBorVB = bioaccCat === 'vb' || bioaccCat === 'b';
    const isvB    = bioaccCat === 'vb';

    // ── 6. Environmental toxicity ──
    // T: NOEC < 0.01 mg/L, H372, H373
    // CMR: H340/H350/H360/H361 or CMR in hazard status
    // Aquatic: H400–H413
    // Sufficient data (ANNEX IX/X) with no hazard flag → no concern
    let toxCat = 'insufficient';
    if (name === 'Water' || name === 'Carbon dioxide') {
      toxCat = 'none';
    } else if ((noec !== null && noec < 0.01) || haz('H372') || haz('H373')) {
      toxCat = 'T';
    } else if (haz('H340') || haz('H350') || haz('H360') || haz('H361') || hazSt.includes('CMR')) {
      toxCat = 'CMR';
    } else if (haz('H400')) {
      toxCat = 'H400';
    } else if (haz('H410') || haz('H411') || haz('H412') || haz('H413')) {
      toxCat = 'aquatic';
    } else if (regAnnex === 'ANNEX IX' || regAnnex === 'ANNEX X') {
      toxCat = 'none';  // sufficient data, no aquatic hazard flag → no concern
    }
    // _toxicity_is_t() returns true for T, CMR, or aquatic toxicity
    const isT = toxCat === 'T' || toxCat === 'CMR' || toxCat === 'H400' || toxCat === 'aquatic';

    // ── 7. PBT / vPvB ──
    let pbt = 'none';
    if (hazSt === 'PBT') {
      pbt = 'PBT';
    } else if (hazSt === 'vPvB') {
      pbt = 'vPvB';
    } else if (isPorVP && isvB) {
      pbt = 'vPvB';   // very persistent AND very bioaccumulating
    } else if (isPorVP && isBorVB && isT) {
      pbt = 'PBT';    // persistent AND bioaccumulating AND toxic
    } else if ((waterPersist === 'ambiguous' || waterPersist === 'unknown') &&
               (bioaccCat === 'logp_vb' || bioaccCat === 'logp_b' || bioaccCat === 'unknown')) {
      pbt = 'undetermined';
    }

    // ── 8. Water risk letter ──
    let waterLetter;
    if (name === 'Water' || name === 'Carbon dioxide') {
      waterLetter = 'E';
    } else if (pbt === 'PBT' || pbt === 'vPvB') {
      waterLetter = 'A';
    } else if (waterPct !== null && waterPct < 20) {
      waterLetter = 'E';   // low water-phase exposure → negligible
    } else if (isPorAmb || isBorVB || isT) {
      waterLetter = 'C';
    } else {
      waterLetter = 'D';
    }

    // ── 9. Combined risk (fate-directed) ──
    function worstLetter(a, b) {
      const p = { A:0, B:1, C:2, D:3, E:4 };
      return (p[a] ?? 4) <= (p[b] ?? 4) ? a : b;
    }
    let combined;
    if (name === 'Water' || name === 'Carbon dioxide') {
      combined = 'E';
    } else if (pbt === 'PBT' || pbt === 'vPvB') {
      combined = 'A';
    } else if (isOzone) {
      combined = 'A';
    } else if (fate === 'air'        || fate === 'mostly_air')   { combined = airLetter;   }
    else if   (fate === 'water'      || fate === 'mostly_water') { combined = waterLetter; }
    else if   (fate === 'soil_and_sediment')                     { combined = 'B';         }
    else if   (fate === 'air_and_water')  { combined = worstLetter(airLetter, waterLetter); }
    else if   (fate === 'air_and_soil')                          { combined = airLetter;   }
    else if   (fate === 'soil_and_water')                        { combined = waterLetter; }
    else                                                         { combined = 'B'; } // unknown

    const score      = LS[combined]     || 0;
    const airScore   = LS[airLetter]    || 0;
    const waterScore = LS[waterLetter]  || 0;

    // Sub-scores for detail view (numeric approximation)
    const PERS_SCORE  = { p_or_vp:1, ambiguous:2, potentially_p:3, none:5, unknown:0 };
    const BIACC_SCORE = { vb:1, b:2, logp_vb:2, logp_b:3, none:5, unknown:0 };
    const TOX_SCORE   = { T:1, CMR:2, H400:2, aquatic:3, insufficient:3, none:5 };
    const persScore   = PERS_SCORE[waterPersist]  ?? 0;
    const bioaccScore = BIACC_SCORE[bioaccCat]    ?? 0;
    const tScore      = TOX_SCORE[toxCat]         ?? 0;

    const tag = (pbt === 'PBT' || pbt === 'vPvB') ? pbt : '';

    return {
      score, tag, fate,
      airScore, waterScore, persScore, bioaccScore, tScore,
      halflife, bcf, noec,
    };
  }

  // ── SSbD Step 4: Sustainability (LCA-based) ───────────────────────────────

  /**
   * Compute process energy (MJ) for a solvent batch.
   * Ports process_logic.py:compute_energy() — heating, jacket loss, stirring.
   * Reflux penalty included when BP ≤ process temperature.
   * Returns total MJ, or null if required data is missing.
   */
  function _processEnergyMJ(s, st) {
    const rp = (typeof APP_OPTIONS !== 'undefined' && APP_OPTIONS.reactorParams)
               ? APP_OPTIONS.reactorParams[st.scale] : null;
    if (!rp) return null;

    const density = num(s, 'Density /g per mL');
    const cp      = num(s, 'Specific heat capacity /J per kg\u2019K') ??
                    num(s, 'Specific heat capacity /J per kg?K');
    const bp      = num(s, 'Boiling point /\u00b0C');
    if (density === null || cp === null) return null;

    const T        = st.processTemp ?? st.reactionTemp ?? 25;
    const timeHr   = st.reactionTime || 12;            // state stores hours
    const deltaT   = T - 20;
    const nHeat    = rp.n_heat;
    if (nHeat <= 0) return null;

    // 1. Initial heating: Cp [J/kgK] × density [g/mL=kg/L] × Vmix [m³=1000L] × ΔT / n_heat / 1e6
    const qHeat = (cp * density * 1000 * rp.Vmix * deltaT) / (nHeat * 1e6);

    // 2. Reflux penalty (only when BP ≤ process temp)
    let reflux = 0;
    if (bp !== null && bp <= T) {
      // Hvap (J/mol) = Hildebrand² × MolarVolume + R × T(K)
      // Hildebrand = sqrt(d²+p²+h²) from Hansen components [MPa½ → Pa½ ×1000? No, keep MPa½ units]
      // Molar volume = MW/density [cm³/mol]
      const hD  = num(s, 'Dispersion forces /MPa\u00bd');
      const hP  = num(s, 'Dipole forces /MPa\u00bd');
      const hH  = num(s, 'Hydrogen bonding forces /MPa\u00bd');
      const formulaStr = s['Formula'] || '';
      const mwVal = mw(formulaStr);
      if (hD !== null && hP !== null && hH !== null && mwVal > 0) {
        // Hildebrand in MPa½; molar volume in cm³/mol → convert to m³/mol for SI units
        // Hvap = (H_MPa½ * 1000)² * (mwVal/density * 1e-6) + 8.314 * (T+273.15)
        // Since H in MPa½ = (H * 1e6 Pa)½, H² in Pa = H_MPa½² × 1e6
        // But molar volume in m³/mol = (mwVal[g/mol] / density[g/mL]) × 1e-6 [m³/mL]
        const hild_sq = (hD*hD + hP*hP + hH*hH) * 1e6;  // Pa
        const Vm      = (mwVal / density) * 1e-6;          // m³/mol
        const hvap    = hild_sq * Vm + 8.314 * (T + 273.15); // J/mol
        // reflux = density[kg/L]*scale[L]*(1000/MW)*Hvap[J/mol]*(timeHr/2)/1e6 → MJ
        reflux = density * (st.scale || 100) * (1000 / mwVal) * hvap * (timeHr / 2) / 1e6;
      }
    }

    // 3. Jacket heat loss: A [m²] × ka [W/m²K] × ΔT × 3600 × timeHr / n_heat / 1e6
    const qLoss = (rp.A * rp.ka * deltaT * 3600 * timeHr) / (nHeat * 1e6);

    // 4. Stirring: Np × density [g/mL] × N³ × d⁵ × 3600 × timeHr / n_heat / 1e6
    const eStir = (rp.Np * density * Math.pow(rp.N, 3) * Math.pow(rp.d, 5)
                   * 3600 * timeHr) / (nHeat * 1e6);

    return qHeat + reflux + qLoss + eStir;
  }

  // ── EOL helpers (ported from ssbd4_logic.py) ─────────────────────────────

  /** Count carbon atoms from empirical formula string, e.g. "CH2Cl2" → 1 */
  function _countC(formula) {
    if (!formula) return 0;
    const m = formula.match(/C(\d*)/);
    if (!m) return 0;
    return m[1] ? parseInt(m[1]) : 1;
  }

  /**
   * Incineration balance CC (kg CO₂/kg):
   *   (C_atoms × 44.01 / MW) + cc_c2g × (prod_energy + incin_energy) / prod_energy
   */
  function _calcIncinCC(s, cc_c2g) {
    const prodE  = num(s, 'Production energy /MJ per kg');
    const incinE = num(s, 'Net incineration energy balance /MJ per kg');
    const formula = s['Formula'] || '';
    const mwVal   = mw(formula);
    const cAtoms  = _countC(formula);
    if (prodE === null || cc_c2g === null || prodE <= 0) return null;
    // Carbon-free molecule (e.g. water): CO₂ emission term is 0 regardless of MW;
    // net incineration energy is 0 (non-combustible) when data is absent.
    if (cAtoms === 0) {
      const effIncinE = incinE !== null ? incinE : 0;
      return cc_c2g * (prodE + effIncinE) / prodE;
    }
    if (incinE === null || mwVal <= 0) return null;
    return (cAtoms * 44.01 / mwVal) + cc_c2g * (prodE + incinE) / prodE;
  }

  /** Distillation balance CC (kg CO₂/kg): cc_c2g × (1 − recovery/100), default 90% recovery */
  function _calcDistilCC(cc_c2g, recovery_pct) {
    if (cc_c2g === null) return null;
    const recovery = (recovery_pct != null) ? +recovery_pct : 90.0;
    return cc_c2g * (1.0 - recovery / 100.0);
  }

  /**
   * Distillation recovery energy (MJ) — mirrors Excel Database column MT.
   * Only meaningful when EOL = 'Recycled by distillation'.
   * Term 1: heat batch from 20 °C to boiling point  (Cp × mass × ΔT)
   * Term 2: vaporise batch  (moles × Hvap × 2.2 efficiency factor)
   * Both divided by (n_heat − 0.1) per Excel model.
   */
  function _distilEnergyMJ(s, st) {
    const rp = (typeof APP_OPTIONS !== 'undefined' && APP_OPTIONS.reactorParams)
               ? APP_OPTIONS.reactorParams[st.scale] : null;
    if (!rp) return null;

    const density = num(s, 'Density /g per mL');
    const cp      = num(s, 'Specific heat capacity /J per kg\u2019K') ??
                    num(s, 'Specific heat capacity /J per kg?K');
    const bp      = num(s, 'Boiling point /\u00b0C');
    const hD      = num(s, 'Dispersion forces /MPa\u00bd');
    const hP      = num(s, 'Dipole forces /MPa\u00bd');
    const hH      = num(s, 'Hydrogen bonding forces /MPa\u00bd');
    const formulaStr = s['Formula'] || '';
    const mwVal   = mw(formulaStr);

    if (density === null || cp === null || bp === null || mwVal <= 0) return null;
    if (hD === null || hP === null || hH === null) return null;

    const scale = st.scale || 100;
    const eff   = rp.n_heat - 0.1;   // Excel uses (n_heat − 0.1) for distillation
    if (eff <= 0) return null;

    // Hvap at boiling point (J/mol): Hildebrand² × molar volume + R×T(K)
    const hild_sq = (hD*hD + hP*hP + hH*hH) * 1e6;  // Pa
    const Vm      = (mwVal / density) * 1e-6;          // m³/mol
    const hvap    = hild_sq * Vm + 8.314 * (bp + 273.15); // J/mol

    // Term 1: heating from 20 °C to BP
    const qHeat = cp * density * scale * Math.max(0, bp - 20) / (eff * 1e6);
    // Term 2: vaporisation (×2.2 for condenser/efficiency losses per Excel model)
    const qVap  = density * scale * (1000 / mwVal) * hvap * 2.2 / (eff * 1e6);

    return qHeat + qVap;  // MJ
  }

  /** Select WK (EOL-adjusted CC/kg) based on end-of-life option */
  function _selectWk(cc_c2g, incin_cc, distil_cc, eol) {
    if (eol === 'Incinerated')             return incin_cc;  // null if incineration data missing → unranked
    if (eol === 'Recycled by distillation') return distil_cc !== null ? distil_cc : cc_c2g;
    return cc_c2g;  // 'None' or unrecognised → cradle-to-gate only
  }

  /**
   * Step 4 scoring. Totals = EOL-adjusted CC (WK) + process energy CO₂ + user-specified additional.
   *
   * Climate change thresholds (kg CO₂-eq / kg solvent, total):
   *   > 8 → A,  4–8 → B,  2–4 → C,  0.5–2 → D,  ≤ 0.5 → E
   * Water use thresholds (L / kg, total):
   *   > 100 → A,  50–100 → B,  10–50 → C,  1–10 → D,  ≤ 1 → E
   */
  function step4(s, st) {
    const cc_c2g = num(s, 'Climate change (cradle to gate) /kg CO2-eq. per kg');
    const wu_c2g = num(s, 'Water use (production) /L per kg');

    // ── EOL adjustment: select WK ─────────────────────────────────────────────
    const eol       = (st && st.endOfLife) || 'Incinerated';
    const recov     = (st && st.distillationRecovery != null) ? +st.distillationRecovery : null;
    const incin_cc  = _calcIncinCC(s, cc_c2g);

    // For distillation EOL, use an enhanced formula that folds the distillation
    // energy into the CC balance rather than treating it separately in wl_cc:
    //   wk = cc_c2g × (1 − recovery% × (1 − distilEnergy_per_kg / prodE))
    // This matches the spreadsheet where wl_cc is always the reaction process energy.
    // Falls back to the simple (1−recovery%) formula when prodE or distil data is missing.
    let distil_cc = _calcDistilCC(cc_c2g, recov);
    if (eol === 'Recycled by distillation' && cc_c2g !== null) {
      const prodE    = num(s, 'Production energy /MJ per kg');
      const densityD = num(s, 'Density /g per mL');
      const m_kg_d   = (densityD !== null && st && st.scale) ? densityD * (st.scale || 100) : null;
      const distilMJ = (m_kg_d && m_kg_d > 0) ? _distilEnergyMJ(s, st) : null;
      if (prodE !== null && prodE > 0 && distilMJ !== null && m_kg_d > 0) {
        const distilPerKg = distilMJ / m_kg_d;
        const recovery    = recov != null ? recov : 90.0;
        distil_cc = cc_c2g * (1 - (recovery / 100) * (1 - distilPerKg / prodE));
      }
    }

    const wk = _selectWk(cc_c2g, incin_cc, distil_cc, eol);

    // If EOL=Incinerated but incineration data is missing, the CC impact cannot
    // be determined → whole step4 is unranked (score=0)
    if (eol === 'Incinerated' && wk === null)
      return { score: 0, ccScore: 0, wuScore: 0, cc: null, wu: null, cc_c2g, wu_c2g, wl_cc: null, wk, incin_cc, distil_cc, eol, m_kg: null, ccThresholds: null, wuThresholds: null };

    // ── Process energy contribution (WL, kg CO₂/kg solvent) ──────────────────
    // Always uses reaction process energy (heating to process temp + stirring).
    // For distillation EOL the distillation energy is already incorporated into wk.
    let wl_cc = null;
    if (st && st.scale) {
      const totalMJ = _processEnergyMJ(s, st);
      if (totalMJ !== null) {
        const density  = num(s, 'Density /g per mL');
        const co2Map   = (typeof APP_OPTIONS !== 'undefined' && APP_OPTIONS.co2Intensity) || {};
        const region   = (st.energyIntensity) || 'EU';
        const gco2_kwh = co2Map[region] ?? 490;   // fallback: global average
        const m_kg     = density !== null ? density * (st.scale || 100) : null;
        if (m_kg && m_kg > 0) {
          wl_cc = totalMJ * gco2_kwh / 3600 / m_kg;  // kg CO₂/kg solvent
        }
      }
    }

    // ── User-specified additional impacts (batch totals → per-kg) ────────────
    // climateChange and freshwaterUse are entered as total batch quantities
    // (kg CO₂-eq and L respectively); divide by m_kg to get per-kg rates.
    const density_add = num(s, 'Density /g per mL');
    const m_kg_add    = (density_add !== null && st && st.scale) ? density_add * st.scale : null;
    const add_cc = (st && st.climateChange != null && m_kg_add)
                   ? +st.climateChange / m_kg_add : 0;
    const add_wu = (st && st.freshwaterUse != null && m_kg_add)
                   ? +st.freshwaterUse  / m_kg_add : 0;

    // Distillation recovery: subtract the lost fraction (100-recovery)% as a credit.
    // Unlike CC (which only attributes lost carbon), WU keeps recovery% of production water
    // because the factory water is a process input — you credit only what won't need fresh
    // production next cycle. The 1.56 L/kg is the distillation process water added on top.
    const wu_eol = (eol === 'Recycled by distillation' && wu_c2g !== null)
                   ? wu_c2g * ((recov != null ? recov : 90.0) / 100.0) + 1.56
                   : wu_c2g;

    // ── Per-kg totals ─────────────────────────────────────────────────────────
    const cc = wk !== null ? wk + (wl_cc || 0) + add_cc : null;
    const wu = wu_eol !== null ? wu_eol + add_wu : null;

    // m_kg: mass of solvent in batch (kg) = density × scale
    const density_s4 = num(s, 'Density /g per mL');
    const m_kg = (density_s4 !== null && st && st.scale) ? density_s4 * st.scale : null;

    // ── Scoring: percentile-based, only 0 impact gets E ──────────────────────
    // Thresholds [p25, p50, p75] per-kg are computed across the full dataset by
    // computeLCAThresholds(). Returns score=0 until thresholds are available.
    // Ranking: > p75 → A, > p50 → B, > p25 → C, > 0 → D, == 0 → E.
    let ccScore = 0, wuScore = 0;
    let ccThresholds = null, wuThresholds = null;

    if (_lcaThresholds) {
      const ccp = _lcaThresholds.cc;  // [p25, p50, p75] batch totals (kg CO₂-eq)
      const wup = _lcaThresholds.wu;  // [p25, p50, p75] batch totals (L)
      // Thresholds are already in batch-total units; pass directly to sustainBar
      ccThresholds = ccp[0] !== null ? [0, ...ccp] : null;
      wuThresholds = wup[0] !== null ? [0, ...wup] : null;

      const cc_abs = (cc !== null && m_kg !== null) ? cc * m_kg : null;
      const wu_abs = (wu !== null && m_kg !== null) ? wu * m_kg : null;

      if (cc_abs !== null && ccp[0] !== null) {
        if      (cc_abs === 0)        ccScore = 5;
        else if (cc_abs <= ccp[0])    ccScore = 4;
        else if (cc_abs <= ccp[1])    ccScore = 3;
        else if (cc_abs <= ccp[2])    ccScore = 2;
        else                          ccScore = 1;
      }

      if (wu_abs !== null && wup[0] !== null) {
        if      (wu_abs === 0)        wuScore = 5;
        else if (wu_abs <= wup[0])    wuScore = 4;
        else if (wu_abs <= wup[1])    wuScore = 3;
        else if (wu_abs <= wup[2])    wuScore = 2;
        else                          wuScore = 1;
      }
    }

    // Both CC and WU must be ranked; if either is missing show '?' (score=0)
    const score = (ccScore > 0 && wuScore > 0) ? Math.min(ccScore, wuScore) : 0;
    return { score, ccScore, wuScore, cc, wu, cc_c2g, wu_c2g, wl_cc, wk, incin_cc, distil_cc, eol, m_kg, ccThresholds, wuThresholds };
  }

  // ── LCA percentile thresholds (computed once from the full solvent dataset) ──
  // Set by calling SSBD.computeLCAThresholds(solventData, state) on page load
  // and whenever state changes. Scoring in step4 returns score=0 until set.
  let _lcaThresholds = null;

  function _percentile(sorted, p) {
    if (!sorted.length) return null;
    const n   = sorted.length;
    const idx = (p / 100) * (n - 1);          // Excel PERCENTILE.INC convention
    const lo  = Math.floor(idx);
    const hi  = Math.min(lo + 1, n - 1);
    const frac = idx - lo;
    return sorted[lo] + frac * (sorted[hi] - sorted[lo]);
  }

  /**
   * Compute 25th/50th/75th percentiles of CC and WU per-kg values across all
   * solvents with full data. Must be called before step4 scores are meaningful.
   * Uses the same `st` (state) as scoring so EOL adjustments are consistent.
   */
  function computeLCAThresholds(solvents, st) {
    const ccVals = [], wuVals = [];
    for (const s of solvents) {
      const r = step4(s, st);
      // Only include solvents with full data: cc requires wl_cc to be computed
      // (not null), so the process energy contribution is present. Solvents
      // missing boiling point / thermodynamic data have wl_cc=null and cc=wk
      // only — including them pulls percentiles down below the spreadsheet values.
      const cc_abs = (r.cc !== null && r.wl_cc !== null && r.m_kg !== null) ? r.cc * r.m_kg : null;
      const wu_abs = (r.wu !== null && r.m_kg !== null) ? r.wu * r.m_kg : null;
      if (cc_abs !== null && cc_abs > 0) ccVals.push(cc_abs);
      if (wu_abs !== null && wu_abs > 0) wuVals.push(wu_abs);
    }
    ccVals.sort((a, b) => a - b);
    wuVals.sort((a, b) => a - b);
    _lcaThresholds = {
      cc: [_percentile(ccVals, 25), _percentile(ccVals, 50), _percentile(ccVals, 75)],
      wu: [_percentile(wuVals, 25), _percentile(wuVals, 50), _percentile(wuVals, 75)],
    };
  }

  // ── Combined assessment ───────────────────────────────────────────────────

  function all(s, st) {
    const s1 = step1(s);
    const s2a = step2a(s, st);
    const s2b = step2b(s);
    const s3  = step3(s);
    const s4  = step4(s, st);
    // Overall = worst of steps 1–3 (step 4 informational; exclude 0 = no data)
    const mandatory = [s1, s2a, s2b, s3].map(x => x.score).filter(x => x > 0);
    const overall = mandatory.length ? Math.min(...mandatory) : 0;
    return { s1, s2a, s2b, s3, s4, overall };
  }

  // ── Filtering (for guide.html) ────────────────────────────────────────────

  /**
   * Returns true if solvent passes all user filters (hazard, set, REACH,
   * physical properties).
   */
  function permitted(s, st) {
    const h = st.hazards || {};

    // Hazard category filters
    if (!h.chronicToxicity  && GRP_A.filter(x => !x.startsWith('EUH')).some(c => s[c] === 'Y')) return false;
    if (!h.suspectedChronic && ['H341','H351','H361','H373'].some(c => s[c] === 'Y'))            return false;
    if (!h.acuteToxicity    && ['H300','H301','H310','H311','H330','H331','H370','H371'].some(c => s[c] === 'Y')) return false;
    if (!h.envPBT) {
      const r3 = step3(s);
      if (r3.tag === 'PBT' || r3.tag === 'vPvB') return false;
    }
    if (!h.envToxicity && ['H410','H411','H420','EUH059'].some(c => s[c] === 'Y')) return false;

    // REACH filter — Water and CO₂ are exempt (not REACH-registered but definitively safe)
    if (st.reachOnly && s['REACH registration'] !== 'Y') {
      const name = (s['Name'] || '').trim();
      if (name !== 'Water' && name !== 'Carbon dioxide') return false;
    }

    // Solvent set filter
    const setRank = { 'Small set':1, 'Medium set':2, 'Large set':3, 'Full set':4 };
    const allowed = setRank[st.solventSet] || 4;
    const solvRank = setRank[s['Class']] || 4;
    if (solvRank > allowed) return false;

    // Functional group filter
    const fg = st.functionalGroups || {};
    const FG_MAP = {
      'Acid':                                          'acid',
      'Alcohol (monofunctional)':                      'alcoholMono',
      'Aliphatic hydrocarbon':                         'aliphaticHydrocarbon',
      'Amide':                                         'amide',
      'Amine':                                         'amine',
      'Aromatic hydrocarbon':                          'aromaticHydrocarbon',
      'Chlorinated':                                   'chlorinated',
      'Ester':                                         'ester',
      'Ether':                                         'ether',
      'Eutectic mixture':                              'eutecticMixture',
      'Inorganic':                                     'inorganic',
      'Ionic liquid':                                  'ionicLiquid',
      'Ketone and carbonate':                          'ketoneAndCarbonate',
      'Multifunctional':                               'multifunctional',
      'Other heteroatom functional groups (N, P, etc.)': 'otherHeteroatom',
      'Other halogenated':                             'otherHalogenated',
      'Perfluorinated':                                'perfluorinated',
      'Polyol':                                        'polyol',
      'Siloxane':                                      'siloxane',
    };
    const fgKey = FG_MAP[s['Functional groups']];
    if (fgKey && fg[fgKey] === false) return false;

    // State at RT filter — derived from melting/boiling points relative to 25 °C
    const sat = st.stateAtRT || {};
    const mp = parseFloat(s['Melting point /°C']);
    const bp = parseFloat(s['Boiling point /°C']);
    const stateVal = (!isNaN(mp) && mp > 25) ? 'solid'
                   : (!isNaN(bp) && bp < 25)  ? 'gas'
                   : 'liquid';
    if (stateVal === 'solid'  && sat.solid  === false) return false;
    if (stateVal === 'liquid' && sat.liquid === false) return false;
    if (stateVal === 'gas'    && sat.gas    === false) return false;

    // Polarity data filter — exclude solvents missing Hansen HSP or KAT parameters
    if (st.polarityDataOnly) {
      const D1    = parseFloat(s['Dispersion forces /MPa\u00bd']);
      const P1    = parseFloat(s['Dipole forces /MPa\u00bd']);
      const H1    = parseFloat(s['Hydrogen bonding forces /MPa\u00bd']);
      const alpha = parseFloat(s['Hydrogen bond donating ability']);
      const beta  = parseFloat(s['Hydrogen bond accepting ability']);
      const piStr = parseFloat(s['Dipolarity']);
      if (isNaN(D1) || isNaN(P1) || isNaN(H1)) return false;
      if (isNaN(alpha) || isNaN(beta) || isNaN(piStr)) return false;
    }

    // Polarity filter — Hansen RED ≤ 1 (only when refineByPolarity is on and target is set)
    if (st.refineByPolarity) {
      const D0 = parseFloat(st.polarityD);
      const P0 = parseFloat(st.polarityP);
      const H0 = parseFloat(st.polarityH);
      const R0 = parseFloat(st.polarityRadius);
      if (!isNaN(D0) && !isNaN(P0) && !isNaN(H0) && !isNaN(R0) && R0 > 0) {
        const D1 = parseFloat(s['Dispersion forces /MPa\u00bd']);
        const P1 = parseFloat(s['Dipole forces /MPa\u00bd']);
        const H1 = parseFloat(s['Hydrogen bonding forces /MPa\u00bd']);
        if (!isNaN(D1) && !isNaN(P1) && !isNaN(H1)) {
          const Ra2 = 4*(D1-D0)**2 + (P1-P0)**2 + (H1-H0)**2;
          const RED = Math.sqrt(Ra2) / R0;
          if (RED > 1) return false;
        } else {
          return false; // missing Hansen data when polarity filter active → fail
        }
      }
    }

    // Physical property filters
    const p = st.properties || {};
    const propChecks = [
      { key: 'meltingPoint',    field: 'Melting point /\u00b0C'            },
      { key: 'boilingPoint',    field: 'Boiling point /\u00b0C'            },
      { key: 'density',         field: 'Density /g per mL'                 },
      { key: 'viscosity',       field: 'Dynamic viscosity /cP'             },
      { key: 'surfaceTension',  field: 'Surface tension /dynes per cm'     },
      { key: 'flashPoint',      field: 'Flash Point /\u00b0C'              },
      { key: 'autoFlammability', field: 'Autoignition temperature /\u00b0C'},
    ];
    for (const { key, field } of propChecks) {
      const f = p[key];
      if (!f || !f.enabled) continue;
      const raw = (s[field] ?? '').toString().trim();
      if (raw === '' || raw === '?') return false; // truly missing → fail
      const v = parseFloat(raw);
      if (isNaN(v)) continue; // non-numeric but present (e.g. "Does not flash") → pass range check
      if (f.min !== null && f.min !== undefined && v < f.min) return false;
      if (f.max !== null && f.max !== undefined && v > f.max) return false;
    }

    // Bio-based content filter: min % of carbon atoms that must be bio-based
    const bio = p.bioThreshold;
    if (bio && bio.enabled && bio.min !== null && bio.min !== undefined) {
      const totalC = _countC(s['Formula'] || '');
      const bioC   = parseFloat(s['Bio-based carbon atoms']);
      const bioPct = (totalC > 0) ? ((isNaN(bioC) ? 0 : bioC) / totalC * 100) : 0;
      if (bioPct < +bio.min) return false;
    }

    return true;
  }

  // ── Badge HTML helper ─────────────────────────────────────────────────────

  function badge(score) {
    const lbl = LABELS[score] || '?';
    const col = COLORS[score] || '#aaa';
    const fg  = score === 3 ? '#333' : 'white'; // yellow → dark text
    return `<span class="risk-badge" style="background:${col};color:${fg};" title="${FULL[score] || 'No data'}">${lbl}</span>`;
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { all, step1, step2a, step2b, step3, step4, permitted, badge, LABELS, FULL, COLORS, computeLCAThresholds };

})();
