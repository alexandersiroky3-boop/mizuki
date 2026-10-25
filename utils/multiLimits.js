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
    return result;
}
module.exports = {MAX_COMMAND_COUNT, EXTENSION_MS, normalizeRewards};
