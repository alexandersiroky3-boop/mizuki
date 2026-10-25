const database = require("../database");


const BOSS_SHOP_APPEARANCE_CHANCE_PERCENT = 35;
const BOSS_SHOP_DURATION_MS = 20 * 60 * 1000;
const BOSS_SHOP_REFRESH_MS = 10 * 60 * 1000;
const BOSS_SHOP_VISIBLE_ITEMS = 3;


function randomChoice(values, random = Math.random){
    const safeValues = Array.isArray(values) ? values : [values];
    const position = Math.max(
        0,
        Math.min(0.999999999, Number(random()) || 0)
    );
    return safeValues[
        Math.min(
            safeValues.length - 1,
            Math.floor(position * safeValues.length)
        )
    ];
}


const BOSS_SHOP_CATALOG = Object.freeze([
    Object.freeze({
        key: "boss_chests",
        name: "10 Boss Chests",
        emoji: ":boss_chest:",
        prices: Object.freeze([5000, 7500, 12500, 15000, 20000]),
        maxStock: 3,
        createReward(){
            return {
                chests: [{tier: "boss", amount: 10}]
            };
        },
        describe(){
            return "**10x** :boss_chest: Boss Chests";
        }
    }),
    Object.freeze({
        key: "luck_omega",
        name: "Luck Boost Ω",
        emoji: "👁️‍🗨️",
        prices: Object.freeze([50000, 75000, 125000, 150000]),
        maxStock: 1,
        createReward(random){
            const amount = randomChoice([1, 2, 3], random);
            return {
                boosts: [{boostType: "luck", tier: "omega", amount}]
            };
        },
        describe(bundle){
            return `**${bundle.boosts[0].amount}x** 👁️‍🗨️ Luck Boost Ω`;
        }
    }),
    Object.freeze({
        key: "xp_infinity",
        name: "XP Boost ထ",
        emoji: "🧿",
        prices: Object.freeze([40000, 55000, 80000, 100000]),
        maxStock: 1,
        createReward(random){
            const amount = randomChoice([2, 4, 6], random);
            return {
                boosts: [{boostType: "xp", tier: "infinity", amount}]
            };
        },
        describe(bundle){
            return `**${bundle.boosts[0].amount}x** 🧿 XP Boost ထ`;
        }
    }),
    Object.freeze({
        key: "spawn_boss",
        name: "One !spawnboss Use",
        emoji: "⚔️",
        prices: Object.freeze([222222, 333333, 555555, 666666]),
        maxStock: 5,
        createReward(){
            return {spawnBossUses: 1};
        },
        describe(){
            return "**1 use** of `!spawnboss` *(uses stack)*";
        }
    }),
    Object.freeze({
        key: "multi_commands",
        name: "3x Multi-Commands",
        emoji: "➕",
        prices: Object.freeze([30000, 60000, 75000, 99000]),
        maxStock: 5,
        createReward(random){
            const hours = randomChoice([3, 5], random);
            return {
                timedAllCommands: {
                    extraCount: 2,
                    durationMs: hours * 60 * 60 * 1000,
                    stackDuration: false
                }
            };
        },
        describe(bundle){
            const hours = Math.round(
                bundle.timedAllCommands.durationMs / 3600000
            );
            return `**3 total executions** per command for **${hours} hours** *(duplicate active rewards add 3 hours)*`;
        }
    })
]);


function shuffle(values, random = Math.random){
    const result = [...values];
    for(let index = result.length - 1; index > 0; index--){
        const swapIndex = Math.floor(
            Math.max(0, Math.min(0.999999999, Number(random()) || 0))
            * (index + 1)
        );
        [result[index], result[swapIndex]] =
            [result[swapIndex], result[index]];
    }
    return result;
}


function generateBossShopStock(random = Math.random){
    return shuffle(BOSS_SHOP_CATALOG, random)
        .slice(0, BOSS_SHOP_VISIBLE_ITEMS)
        .map((entry, index) => {
            const rewardBundle = entry.createReward(random);
            return {
                slotID: `${index + 1}:${entry.key}`,
                key: entry.key,
                name: entry.name,
                emoji: entry.emoji,
                price: randomChoice(entry.prices, random),
                stock: entry.maxStock,
                maxStock: entry.maxStock,
                description: entry.describe(rewardBundle),
                rewardBundle
            };
        });
}


async function openBossShop(
    guildID,
    now = Date.now(),
    random = Math.random
){
    return database.saveBossShopState({
        guildID,
        openedAt: now,
        expiresAt: now + BOSS_SHOP_DURATION_MS,
        refreshAt: now + BOSS_SHOP_REFRESH_MS,
        stock: generateBossShopStock(random)
    });
}


async function maybeOpenBossShopAfterRaid(
    guildID,
    random = Math.random,
    now = Date.now()
){
    const current = await getActiveBossShop(guildID, now, random);
    if(current){
        return {opened: false, alreadyActive: true, shop: current};
    }

    if((Number(random()) || 0) * 100 >= BOSS_SHOP_APPEARANCE_CHANCE_PERCENT){
        return {opened: false, alreadyActive: false, shop: null};
    }

    const shop = await openBossShop(guildID, now, random);
    return {opened: true, alreadyActive: false, shop};
}


async function getActiveBossShop(
    guildID,
    now = Date.now(),
    random = Math.random
){
    let shop = await database.getBossShopState(guildID);
    if(!shop || shop.expiresAt <= now){
        return null;
    }

    if(shop.refreshAt <= now){
        shop = await database.saveBossShopState({
            guildID,
            openedAt: shop.openedAt,
            expiresAt: shop.expiresAt,
            refreshAt: Math.min(
                shop.expiresAt,
                now + BOSS_SHOP_REFRESH_MS
            ),
            stock: generateBossShopStock(random)
        });
    }

    return shop;
}


async function purchaseBossShopItem(
    guildID,
    userID,
    slotID,
    now = Date.now(),
    random = Math.random
){
    const shop = await getActiveBossShop(guildID, now, random);
    if(!shop){
        return {success: false, status: "shop-closed"};
    }
    return database.purchaseBossShopItem(
        guildID,
        userID,
        slotID,
        now
    );
}


module.exports = {
    BOSS_SHOP_APPEARANCE_CHANCE_PERCENT,
    BOSS_SHOP_DURATION_MS,
    BOSS_SHOP_REFRESH_MS,
    BOSS_SHOP_VISIBLE_ITEMS,
    BOSS_SHOP_CATALOG,
    generateBossShopStock,
    openBossShop,
    maybeOpenBossShopAfterRaid,
    getActiveBossShop,
    purchaseBossShopItem
};
