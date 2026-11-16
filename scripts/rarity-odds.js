// Usage: node scripts/rarity-odds.js roll omega 8 4
// Or: node scripts/rarity-odds.js hug.level100Plus max 0 3
const config=require('../utils/rarityConfig');
const rarity=require('../utils/rarity');
const [id='roll',tier='none',rolling='0',boosts='0']=process.argv.slice(2);
if(!config.tables[id]){console.error('Available tables: '+Object.keys(config.tables).join(', '));process.exitCode=1;}
else{
 const rows=rarity.resolve(id,{tier,boostUpgradeLevel:Number(boosts)},{rollingLevel:Number(rolling)});
 console.log(`${id} | Luck ${tier} | Rolling ${rolling} | Boosts ${boosts}`);
 console.table(rows.map(r=>({rarity:r.key,weight:r.weight.toFixed(10),percent:r.chancePercent.toFixed(8)+'%',minXP:r.min??r.minXP??r.normal?.gained.min??'effect',maxXP:r.max??r.maxXP??r.normal?.gained.max??'effect'})));
 console.log('Total: '+rows.reduce((s,r)=>s+r.chancePercent,0).toFixed(8)+'%');
 if(id==='roll'){
  const negative=rarity.negativeChance({tier,boostUpgradeLevel:Number(boosts)},Number(rolling));
  console.log(`Sign: ${((1-negative)*100).toFixed(4)}% positive / ${(negative*100).toFixed(4)}% negative`);
  console.table([...rows.map(r=>({sign:'positive',rarity:r.key,overallPercent:((1-negative)*r.weight*100).toFixed(8)+'%'})),...rarity.base('rollNegative').map(r=>({sign:'negative',rarity:r.key,overallPercent:(negative*r.weight*100).toFixed(8)+'%'}))]);
 }
 console.log('Independent Evolved: '+(id==='roll'||id==='rollNegative'?rarity.evolvedChance(Number(rolling)):id==='troll'?0:rarity.evolvedChance())*100+'%');
}
