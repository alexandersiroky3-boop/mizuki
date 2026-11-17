'use strict';
const config = require('./rarityConfig');
const HIGH = new Set(['legendary', 'mythic', 'cosmic', 'jackpot']);
const clampLevel = (n,max) => Math.min(max,Math.max(0,Math.floor(Number(n)||0)));

function normalize(rows){
    if(!Array.isArray(rows) || !rows.length) throw Error('Empty rarity table');
    const copied=rows.map(row=>{
        const weight=Number(row.weight ?? Number(row.chancePercent)/100);
        if(!Number.isFinite(weight)||weight<0) throw Error('Invalid rarity weight: '+row.key);
        const min=row.min ?? row.minXP, max=row.max ?? row.maxXP;
        if(min!==undefined && (!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||max<min)) throw Error('Invalid XP range: '+row.key);
        return {...row,weight};
    });
    const total=copied.reduce((sum,r)=>sum+r.weight,0);
    if(!(total>0) || !Number.isFinite(total))throw Error('Rarity weights must have a finite positive total');
    return copied.map(r=>({...r,weight:r.weight/total,chancePercent:r.weight/total*100}));
}

function base(id){
    const rows=config.tables[id];
    if(!rows)throw Error('Unknown rarity table: '+id);
    return normalize(rows.map(r=>({...r,tableID:id})));
}

// Balanced signed additions, not multipliers. If a donor is exhausted, the
// remaining configured donors fund its share. If all are exhausted, additions
// shrink proportionally. No negative weights and no silent boosts to low tiers.
function transfer(rows,deltas={},scale=1){
    const existing=new Set(rows.map(r=>r.key));
    for(const [key,amount] of Object.entries(deltas)){
        if(!existing.has(key)||!Number.isFinite(amount))throw Error('Invalid Luck delta: '+key);
    }
    const entries=Object.entries(deltas).map(([key,n])=>[key,n*scale]);
    const add=entries.filter(([,n])=>n>0), remove=entries.filter(([,n])=>n<0);
    const requested=add.reduce((s,[,n])=>s+n,0);
    const deducted=remove.reduce((s,[,n])=>s-n,0);
    if(Math.abs(requested-deducted)>1e-8)throw Error('Luck additions and deductions must balance');
    if(!requested)return rows.map(r=>({...r}));
    const result=rows.map(r=>({...r})), byKey=new Map(result.map(r=>[r.key,r]));
    const available=remove.reduce((s,[key])=>s+byKey.get(key).weight,0);
    const amount=Math.min(requested,available);
    let pending=amount, donors=remove;
    for(let pass=0;pending>1e-14 && donors.length && pass<=rows.length;pass++){
        const shares=donors.reduce((s,[,n])=>s-n,0);
        let taken=0;
        for(const [key,n]of donors){const r=byKey.get(key),part=Math.min(r.weight,pending*(-n)/shares);r.weight-=part;taken+=part;}
        pending-=taken;donors=donors.filter(([key])=>byKey.get(key).weight>1e-14);
    }
    for(const [key,n]of add)byKey.get(key).weight+=amount*n/requested;
    return result.map(r=>({...r,chancePercent:r.weight*100}));
}

function extraDelta(rows,amount){
    const donors=rows.filter(r=>!HIGH.has(r.key));
    // Extra blessing/stolen/leaderboard luck deliberately never increases jackpot.
    const receivers=rows.filter(r=>HIGH.has(r.key)&&r.key!=='jackpot');
    if(!receivers.length)return {};
    const available=donors.reduce((s,r)=>s+r.weight,0);
    if(!available)return {};
    return Object.fromEntries([...donors.map(r=>[r.key,-amount*r.weight/available]),...receivers.map(r=>[r.key,amount/receivers.length])]);
}

function resolve(id,profile=null,{rollingLevel=0}={}){
    let rows=base(id);
    const tier=String(profile?.tier||'none').toLowerCase();
    const luckScale=profile?.commandLuckScale===0.5?0.5:1;
    const luck=config.luck[id]?.[tier];
    if(luck){
        rows=transfer(rows,luck);
        const upgrades=clampLevel(profile?.boostUpgradeLevel,4);
        const delta=tier==='omega'
            ? (id==='roll'?config.boostUpgrade.rollOmega:config.boostUpgradeOmega?.[id]??config.boostUpgrade[id])
            : config.boostUpgrade[id];
        for(let level=1;level<=upgrades;level++){
            const step=config.boostUpgradeByLevel?.[level];
            rows=transfer(rows,step?.[tier==='omega'?id+'.omega':id]??step?.[id]??delta);
        }
    }
    if(id==='roll')for(let level=1;level<=clampLevel(rollingLevel,8);level++){
        const kind=tier==='omega'?'omega':'normal';
        rows=transfer(rows,config.rollingUpgradeByLevel?.[level]?.[kind]??config.rollingUpgrade[kind]);
    }
    const ext=config.externalLuck;
    const blessing=Number(profile?.blessingLuckMultiplier)||1;
    const extra=Math.min(ext.maxExtra,(blessing>1?(blessing>=20?ext.blessingRare:ext.blessingNormal):0)+Math.max(0,Number(profile?.trollStackCount)||0)*ext.stolenBoost+(id==='roll'&&Number(profile?.leaderboardRollLuckMultiplier)>1?ext.leaderboard:0));
    if(extra)rows=transfer(rows,extraDelta(rows,extra));
    if(luckScale===0.5){
        // Halve the final upper-rarity odds even without an equipped boost.
        // Fixed guarantees and the independent Evolved draw bypass this table.
        const high=rows.filter(r=>HIGH.has(r.key)),low=rows.filter(r=>!HIGH.has(r.key));
        const removed=high.reduce((sum,r)=>sum+r.weight/2,0),lowTotal=low.reduce((sum,r)=>sum+r.weight,0);
        if(low.length)rows=transfer(rows,Object.fromEntries([
            ...high.map(r=>[r.key,-r.weight/2]),
            ...low.map(r=>[r.key,lowTotal?removed*r.weight/lowTotal:removed/low.length])
        ]));
    }
    return rows;
}

function resolveRows(rows,profile){
    const id=rows?.[0]?.tableID;
    if(!id)throw Error('Rarity table must come from rarity.base()');
    return resolve(id,profile);
}
function unit(random){const n=Number(random());if(!Number.isFinite(n)||n<0||n>1)throw Error('Invalid random value');return Math.min(1-Number.EPSILON,n);}
function pick(rows,random=Math.random){
    const entries=normalize(rows).filter(r=>r.weight>0);
    let position=unit(random);
    for(const row of entries){position-=row.weight;if(position<0)return row;}
    return entries[entries.length-1];
}
// Quality sub-tiers inside each rarity (85% bad / 10% neutral / 5% good).
// This keeps the full authored range possible while making high rolls rare.
const QUALITY_WEIGHTS = Object.freeze([
    { key: "bad",     weight: 0.85 },
    { key: "neutral", weight: 0.10 },
    { key: "good",    weight: 0.05 }
]);

// Split points as fractions of the rarity's full range (low → mid → high).
// Tuned so "bad" covers most of the bottom, "good" is the top tail.
const QUALITY_SPLITS = Object.freeze({
    //            badEnd   neutralEnd  (good goes to 1.0)
    common:     [0.70,     0.92],
    uncommon:   [0.70,     0.92],
    rare:       [0.65,     0.90],
    epic:       [0.60,     0.88],
    legendary:  [0.55,     0.85],
    mythic:     [0.105,    0.342],  // ~10M-30M / 30M-75M / 75M-200M as requested
    jackpot:    [1.0, 1.0]     // fixed value, always neutral
});

function pickQuality(random = Math.random){
    let position = unit(random);
    for(const q of QUALITY_WEIGHTS){
        position -= q.weight;
        if(position < 0) return q.key;
    }
    return "bad";
}

function sampleXP(row, random = Math.random){
    const min = row.min ?? row.minXP, max = row.max ?? row.maxXP;
    if(!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min)
        throw Error("Invalid reward XP range");

    // Fixed-value rows (jackpot) stay exact
    if(min === max) return min;

    const key = String(row.key || "").toLowerCase();
    const splits = QUALITY_SPLITS[key] || [0.70, 0.92];
    const quality = pickQuality(random);

    const span = max - min;
    let low, high;
    if(quality === "bad"){
        low = min;
        high = min + Math.floor(span * splits[0]);
    }else if(quality === "neutral"){
        low = min + Math.floor(span * splits[0]) + 1;
        high = min + Math.floor(span * splits[1]);
    }else{ // good
        low = min + Math.floor(span * splits[1]) + 1;
        high = max;
    }

    // Safety: keep bounds valid
    low = Math.max(min, Math.min(max, low));
    high = Math.max(low, Math.min(max, high));

    return low + Math.floor(unit(random) * (high - low + 1));
}

function sampleXPWithQuality(row, random = Math.random){
    const min = row.min ?? row.minXP, max = row.max ?? row.maxXP;
    if(!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min)
        throw Error("Invalid reward XP range");

    if(min === max) return { xp: min, quality: "neutral" };

    const key = String(row.key || "").toLowerCase();
    const splits = QUALITY_SPLITS[key] || [0.70, 0.92];
    const quality = pickQuality(random);

    const span = max - min;
    let low, high;
    if(quality === "bad"){
        low = min;
        high = min + Math.floor(span * splits[0]);
    }else if(quality === "neutral"){
        low = min + Math.floor(span * splits[0]) + 1;
        high = min + Math.floor(span * splits[1]);
    }else{
        low = min + Math.floor(span * splits[1]) + 1;
        high = max;
    }

    low = Math.max(min, Math.min(max, low));
    high = Math.max(low, Math.min(max, high));

    const xp = low + Math.floor(unit(random) * (high - low + 1));
    return { xp, quality };
}
function guarantee(){return normalize(config.guarantee);}
function keyForXP(xp){
    const rows=base('roll');
    const found=rows.find(r=>xp>=r.min&&xp<=r.max);
    if(found)return found.key;
    // Guarantees may exceed the ordinary jackpot maximum.
    if(xp>=100000000)return 'jackpot';
    throw Error('Guaranteed XP falls in a gap in configured roll ranges');
}
function presentationXP(key){const row=base('roll').find(r=>r.key===key);if(!row)throw Error('Unknown roll rarity');return row.presentationXP;}
function evolvedChance(rollingLevel=null){return rollingLevel===null?config.evolved.commands:rollingLevel>=8?config.evolved.rollMax:config.evolved.roll;}
function negativeChance(profile,rollingLevel=0){
    const c=config.rollPolarity,tier=String(profile?.tier||'none').toLowerCase();
    const boosts=tier!=='none'?clampLevel(profile?.boostUpgradeLevel,4):0;
    const sum=(a,n)=>a.slice(0,n).reduce((s,x)=>s+x,0);
    return Math.max(c.negativeMinimum,Math.min(1,c.negativeBase-(c.luckReduction[tier]||0)-sum(c.boostReduction,boosts)-sum(c.rollingReduction,clampLevel(rollingLevel,8))));
}
function roll(profile,rollingLevel=0,random=Math.random){
    const negative=unit(random)<negativeChance(profile,rollingLevel);
    const rows=negative?base('rollNegative'):resolve('roll',profile,{rollingLevel});
    const row=pick(rows,random);
    const { xp, quality } = sampleXPWithQuality(row, random);
    // For negative tables the stored min/max are already negative, so xp comes out negative.
    return {rolledXP: xp, rarityKey: row.key, negative, quality};
}
module.exports={base,resolve,resolveRows,pick,sampleXP,sampleXPWithQuality,transfer,normalize,guarantee,keyForXP,presentationXP,evolvedChance,negativeChance,roll};
