// ghs.js — GHS hazard pictogram helper.
// Provides ghsPictograms(s) → HTML string of <img> tags for active hazard codes.

const GHS = (() => {
  const MAP = [
    ['GHS-pictogram-explos',     ['H200','H201','H202','H203','H204','H205','H240','H241','H242']],
    ['GHS-pictogram-flamme',     ['H224','H225','H226','H227','H228','H229','H250','H251','H252','H260','H261']],
    ['GHS-pictogram-rondflam',   ['H270','H271','H272']],
    ['GHS-pictogram-bottle',     ['H280','H281']],
    ['GHS-pictogram-acid',       ['H290','H314','H318']],
    ['GHS-pictogram-skull',      ['H300','H301','H310','H311','H330','H331']],
    ['GHS-pictogram-exclam',     ['H302','H312','H315','H317','H319','H332','H335','H336','EUH066','EUH071']],
    ['GHS-pictogram-silhouette', ['H304','H334','H340','H341','H350','H351','H360','H361','H362','H370','H371','H372','H373']],
    ['GHS-pictogram-pollu',      ['H400','H410','H411','H412','H413']],
  ];

  function pictograms(s) {
    return MAP
      .filter(([, codes]) => codes.some(c => (s[c] || '').trim().toUpperCase() === 'Y'))
      .map(([file]) => `<img src="${file}.svg" title="${file.replace('GHS-pictogram-','')}" width="20" height="20" style="vertical-align:middle;margin-left:3px;">`)
      .join('');
  }

  function cmrLabel(s) {
    const svhc = (s['SVHC hazard status'] || '').trim();
    if (svhc === 'CMR (carcinogen)' || svhc === 'CMR (reprotoxin)')
      return `<img src="CMRlabel.svg" title="CMR (${svhc.slice(4, -1)})" height="20" style="vertical-align:middle;margin-left:3px;">`;
    return '';
  }

  function pbtLabel(tag) {
    if (tag === 'PBT')  return `<img src="PBTlabel.SVG"  title="PBT"  height="20" style="vertical-align:middle;margin-left:3px;">`;
    if (tag === 'vPvB') return `<img src="vPvBlabel.SVG" title="vPvB" height="20" style="vertical-align:middle;margin-left:3px;">`;
    return '';
  }

  return { pictograms, cmrLabel, pbtLabel };
})();
