// Central source of truth for the permanent !upgrades system.
// This module is intentionally database-free so commands and gameplay
// systems can share the exact same costs and effects without dependency
// cycles.

const UPGRADE_CATEGORIES = Object.freeze([
    "chatting",
    "rolling",
    "boosts",
    "quests",
    "commerce",
    "trading"
]);


const BOOST_LABELS = Object.freeze({
    "luck:tier3": "<@&1533960965949886534>",
    "luck:max": "<@&1533961286310953042>",
    "luck:omega": "<@&1535700310402670592>",
    "xp:max": "<@&1526995218098815016>",
    "xp:infinity": "<@&1540496714903986388>"
});


function freezeCost(xp = 0, boosts = []){
    return Object.freeze({
        xp: Math.max(0, Number(xp) || 0),
        boosts: Object.freeze(
            boosts.map(boost => Object.freeze({
                boostType: String(boost.boostType).toLowerCase(),
                tier: String(boost.tier).toLowerCase(),
                amount: Math.max(1, Math.floor(Number(boost.amount) || 1))
            }))
        )
    });
}


function upgrade(cost, description){
    return Object.freeze({
        cost,
        description
    });
}


const UPGRADE_DEFINITIONS = Object.freeze({
    chatting: Object.freeze({
        key: "chatting",
        name: "Chatting",
        emoji: "💬",
        summary: "Gain more chat XP, improve criticals, and find XP Boosts more often.",
        upgrades: Object.freeze([
            upgrade(freezeCost(50000), "Gain +20% chat XP."),
            upgrade(freezeCost(200000), "Gain another +30% chat XP and improve the base critical chance."),
            upgrade(freezeCost(1250000), "Improve critical odds again and buff chat XP Boost drops."),
            upgrade(freezeCost(7500000), "Gain another +50% chat XP; 20+ critical streaks now award 5x streak XP instead of 2x."),
            upgrade(
                freezeCost(50000000, [
                    { boostType: "luck", tier: "max", amount: 3 }
                ]),
                "Gain another +75% chat XP, unlock a 2% ten-critical burst, and make 50+ streaks award 20x instead of 5x."
            ),
            upgrade(
                freezeCost(500000000, [
                    { boostType: "xp", tier: "infinity", amount: 2 },
                    { boostType: "luck", tier: "max", amount: 5 }
                ]),
                "Gain another +100% chat XP, improve critical odds, and add +8% to the ten-critical burst chance."
            ),
            upgrade(
                freezeCost(2000000000, [
                    { boostType: "luck", tier: "omega", amount: 1 }
                ]),
                "Gain another +200% chat XP, improve critical odds, add +15% burst chance, and buff chat XP Boost drops."
            ),
            upgrade(
                freezeCost(5000000000),
                "Gain another +500% chat XP, improve critical odds and XP Boost drops, and make 100+ streaks award 50x."
            )
        ])
    }),

    rolling: Object.freeze({
        key: "rolling",
        name: "Rolling",
        emoji: "🎲",
        summary: "Shift !roll toward positive and increasingly rare XP outcomes.",
        upgrades: Object.freeze([
            upgrade(freezeCost(35000), "Increase positive-roll odds and decrease negative-roll odds."),
            upgrade(freezeCost(125000), "Make 5,000+ rolls more common and further favor positive outcomes."),
            upgrade(freezeCost(2500000), "Reduce negative rolls again and improve both 5,000+ and 25,000+ outcomes."),
            upgrade(freezeCost(15000000), "Apply a stronger positive bias and another negative-roll reduction."),
            upgrade(
                freezeCost(75000000, [
                    { boostType: "luck", tier: "max", amount: 5 }
                ]),
                "Make 5,000+ rolls very common and double any final roll above 10,000,000 XP."
            ),
            upgrade(
                freezeCost(500000000, [
                    { boostType: "luck", tier: "omega", amount: 1 },
                    { boostType: "xp", tier: "infinity", amount: 1 }
                ]),
                "Make 25,000+ rolls very common and double rare-outcome weights."
            )
        ])
    }),

    boosts: Object.freeze({
        key: "boosts",
        name: "Boosts",
        emoji: "🧪",
        summary: "Strengthen active boost multipliers and extend activation time.",
        upgrades: Object.freeze([
            upgrade(freezeCost(500000), "Multiply every active boost's effect by 1.2x across supported commands."),
            upgrade(
                freezeCost(12500000, [
                    { boostType: "luck", tier: "max", amount: 1 },
                    { boostType: "xp", tier: "max", amount: 1 },
                    { boostType: "luck", tier: "tier3", amount: 3 }
                ]),
                "Extend every newly activated XP and Luck Boost by 50%."
            ),
            upgrade(
                freezeCost(0, [
                    { boostType: "luck", tier: "omega", amount: 1 }
                ]),
                "Raise active boost strength to 1.5x and double every newly activated boost's timer."
            )
        ])
    }),

    quests: Object.freeze({
        key: "quests",
        name: "Quests",
        emoji: "📜",
        summary: "Improve daily/weekly pools, rewards, rare rewards, and rerolls.",
        upgrades: Object.freeze([
            upgrade(freezeCost(10000000), "Buff daily and weekly rewards and add tougher, more rewarding quest targets."),
            upgrade(freezeCost(125000000), "Buff rewards again, add a 10% rare weekly boost chance, and unlock unfinished quest resets."),
            upgrade(freezeCost(1000000000), "Raise the rare weekly boost chance to 25%, halve reset prices, and apply the strongest reward pool.")
        ])
    }),

    commerce: Object.freeze({
        key: "commerce",
        name: "Shop & Merchant",
        emoji: "🛒",
        summary: "Lower personal prices and occasionally receive double purchases.",
        upgrades: Object.freeze([
            upgrade(freezeCost(500000), "Lower your main-shop XP prices by 15%."),
            upgrade(freezeCost(15000000), "Lower only the XP side of Traveling Merchant deal costs by 10%."),
            upgrade(freezeCost(150000000), "Lower shop prices by another 15% and gain a 2% accidental-double purchase chance.")
        ])
    }),

    trading: Object.freeze({
        key: "trading",
        name: "Trading",
        emoji: "🤝",
        summary: "Reduce the XP fees charged when your trades complete.",
        upgrades: Object.freeze([
            upgrade(freezeCost(2000000), "Reduce all of your trading fees by 20%."),
            upgrade(freezeCost(1000000000), "Reduce all of your trading fees by 70% instead.")
        ])
    })
});


function normalizeCategory(category){
    const value = String(category || "")
        .trim()
        .toLowerCase();

    const aliases = {
        chat: "chatting",
        chatting: "chatting",
        roll: "rolling",
        rolling: "rolling",
        boost: "boosts",
        boosts: "boosts",
        quest: "quests",
        quests: "quests",
        shop: "commerce",
        merchant: "commerce",
        commerce: "commerce",
        trade: "trading",
        trading: "trading"
    };

    return aliases[value] || null;
}


function getMaxLevel(category){
    const key = normalizeCategory(category);
    return key
        ? UPGRADE_DEFINITIONS[key].upgrades.length
        : 0;
}


function normalizeLevels(levels = {}){
    const normalized = {};

    for(const category of UPGRADE_CATEGORIES){
        normalized[category] = Math.max(
            0,
            Math.min(
                getMaxLevel(category),
                Math.floor(Number(levels?.[category]) || 0)
            )
        );
    }

    return normalized;
}


function getNextUpgrade(category, currentLevel){
    const key = normalizeCategory(category);

    if(!key){
        return null;
    }

    const level = Math.max(0, Math.floor(Number(currentLevel) || 0));
    const next = UPGRADE_DEFINITIONS[key].upgrades[level];

    return next
        ? {
            ...next,
            category: key,
            level: level + 1,
            maxLevel: getMaxLevel(key)
        }
        : null;
}


function getUpgradeEffects(levels = {}){
    const safe = normalizeLevels(levels);
    const chat = safe.chatting;
    const roll = safe.rolling;
    const boost = safe.boosts;
    const quest = safe.quests;
    const commerce = safe.commerce;
    const trading = safe.trading;

    const chatXPBonuses = [0, 0.20, 0.30, 0, 0.50, 0.75, 1, 2, 5];
    let chatXPBonus = 0;
    for(let index = 1; index <= chat; index++){
        chatXPBonus += chatXPBonuses[index] || 0;
    }

    const criticalChanceByLevel = [0, 0, 1, 2.5, 2.5, 2.5, 5, 8, 12];
    const chatDropByLevel = [1, 1, 1, 1.25, 1.25, 1.25, 1.25, 1.6, 2];
    const burstChanceByLevel = [0, 0, 0, 0, 0, 2, 10, 25, 25];

    return Object.freeze({
        levels: Object.freeze(safe),

        chatXPMultiplier: 1 + chatXPBonus,
        chatCriticalChanceBonus: criticalChanceByLevel[chat],
        chatXPBoostDropMultiplier: chatDropByLevel[chat],
        tenCriticalBurstChance: burstChanceByLevel[chat],
        critical20Multiplier: chat >= 4 ? 5 : 2,
        critical50Multiplier: chat >= 5 ? 20 : 5,
        critical100Multiplier: chat >= 8 ? 50 : null,

        rollingLevel: roll,
        doubleTenMillionRolls: roll >= 5,
        rareRollWeightMultiplier: roll >= 6 ? 2 : 1,

        boostMultiplierScale: boost >= 3 ? 1.5 : (boost >= 1 ? 1.2 : 1),
        boostDurationScale: boost >= 3 ? 2 : (boost >= 2 ? 1.5 : 1),

        questLevel: quest,
        questResetUnlocked: quest >= 2,
        questRareBoostChance: quest >= 3 ? 25 : (quest >= 2 ? 10 : 0),
        questResetPriceScale: quest >= 3 ? 0.5 : 1,
        questRewardMultiplier: quest >= 3 ? 1.5 : 1,

        shopDiscountPercent: commerce >= 3 ? 30 : (commerce >= 1 ? 15 : 0),
        merchantXPDiscountPercent: commerce >= 2 ? 10 : 0,
        accidentalDoubleChance: commerce >= 3 ? 2 : 0,

        tradeFeeReductionPercent: trading >= 2 ? 70 : (trading >= 1 ? 20 : 0)
    });
}


function formatCost(cost){
    const parts = [];

    if(Number(cost?.xp) > 0){
        parts.push(`**${Number(cost.xp).toLocaleString()} XP**`);
    }

    for(const boost of cost?.boosts || []){
        const key = `${boost.boostType}:${boost.tier}`;
        const label = BOOST_LABELS[key] || `**${key}**`;
        parts.push(`**${Number(boost.amount).toLocaleString()}x** ${label}`);
    }

    return parts.join(" + ") || "Free";
}


module.exports = {
    UPGRADE_CATEGORIES,
    UPGRADE_DEFINITIONS,
    BOOST_LABELS,
    normalizeCategory,
    normalizeLevels,
    getMaxLevel,
    getNextUpgrade,
    getUpgradeEffects,
    formatCost
};
