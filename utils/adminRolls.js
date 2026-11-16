const rarity = require('./rarity');
const RARITY_BANDS = Object.fromEntries(rarity.base('roll').filter(r=>r.key!=='negative').map(r=>[r.key,[r.min,r.max]]));
function rollRarity(key,random=Math.random){ const row=rarity.base('roll').find(r=>r.key===key && key!=='negative'); if(!row)throw Error('Unknown roll rarity'); return rarity.sampleXP(row,random); }
module.exports={RARITY_BANDS,rollRarity};
