// Exact base-rarity bands; bonus XP and Evolved do not reclassify the result.
const RARITY_BANDS = Object.freeze({
    common: [100, 5000], uncommon: [5001, 25000], rare: [25001, 100000],
    epic: [100001, 500000], legendary: [500001, 5000000],
    mythic: [5000001, 99999999], jackpot: [100000000, 1500000000]
});
function rollRarity(rarity, random = Math.random){
    const band = RARITY_BANDS[rarity];
    if(!band) throw new Error("Unknown roll rarity");
    return band[0] + Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, Number(random()) || 0)) * (band[1] - band[0] + 1));
}
module.exports = {RARITY_BANDS, rollRarity};
