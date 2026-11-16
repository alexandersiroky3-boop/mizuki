const MAX_COMMAND_COUNT = 3;
const EXTENSION_MS = 3 * 60 * 60 * 1000;
function normalizeRewards(value){
    if(Array.isArray(value)) return value.filter(item => item?.type !== 'next_roll_burst').map(normalizeRewards);
    if(!value || typeof value !== 'object') return value;
    const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeRewards(item)]));
    for(const key of ['rollCount', 'repeatCount']){
        if(key in result) result[key] = Math.min(3, Math.max(1, Number(result[key]) || 1));
    }
    for(const key of ['extraRolls', 'extraCount', 'extraUses']){
        if(key in result) result[key] = Math.min(2, Math.max(0, Number(result[key]) || 0));
    }
    if(result.type === 'multi_roll' && result.label){
        result.label = `Each \`!roll\` performs **${result.rollCount || 3} total rolls** for **${Math.round(Number(result.durationMs || 0)/3600000)} hours**`;
    }
    if(result.type === "guaranteed_jackpot") result.amount = 1;
    if(result.type === "boost" && ["luck","xp"].includes(result.boostType) && ["max","tier3"].includes(result.tier)){
        const weekly = result.weeklyRewardRulesetVersion != null;
        const caps = weekly ? [15,20,25,30] : [5,7,10,15];
        if(result.questUpgradeLevel != null) result.amount = Math.min(Number(result.amount)||1, caps[Math.min(3,Math.max(0,Number(result.questUpgradeLevel)||0))]);
    }
    return result;
}
module.exports = {MAX_COMMAND_COUNT, EXTENSION_MS, normalizeRewards};
