const database = require("../database");


const CHEST_EMOJIS = Object.freeze({
    bronze: ":bronze_chest:",
    gilded: ":gilded_chest:",
    boss: ":boss_chest:"
});


const CHEST_NAMES = Object.freeze({
    bronze: "Bronze Chest",
    gilded: "Gilded Chest",
    boss: "Boss Chest"
});


const ROLL_CHEST_CHANCES = Object.freeze({
    bronze: 2,
    gilded: 0.3
});


function getChestEmoji(guild, tier){
    const normalizedTier = String(tier || "").toLowerCase();
    const emoji = guild?.emojis?.cache?.find?.(
        entry => entry.name === `${normalizedTier}_chest`
    );
    return emoji
        ? emoji.toString()
        : CHEST_EMOJIS[normalizedTier] || "🎁";
}


function randomInteger(minimum, maximum, random = Math.random){
    const min = Math.ceil(Math.min(minimum, maximum));
    const max = Math.floor(Math.max(minimum, maximum));
    return min + Math.floor(
        Math.max(0, Math.min(0.999999999, Number(random()) || 0))
        * (max - min + 1)
    );
}


function randomChoice(values, random = Math.random){
    return values[
        randomInteger(0, values.length - 1, random)
    ];
}


function weightedChoice(entries, random = Math.random){
    const total = entries.reduce(
        (sum, entry) => sum + Math.max(0, Number(entry.weight) || 0),
        0
    );
    let cursor =
        Math.max(0, Math.min(0.999999999, Number(random()) || 0))
        * total;

    for(const entry of entries){
        cursor -= Math.max(0, Number(entry.weight) || 0);
        if(cursor < 0){
            return entry;
        }
    }
    return entries[entries.length - 1];
}


function rollRollChestDrop(random = Math.random){
    // One shared draw makes the outcomes mutually exclusive. Luck never
    // enters this calculation and one individual roll can drop at most one.
    const position =
        Math.max(0, Math.min(0.999999999, Number(random()) || 0))
        * 100;

    if(position < ROLL_CHEST_CHANCES.gilded){
        return "gilded";
    }
    if(
        position <
        ROLL_CHEST_CHANCES.gilded
        + ROLL_CHEST_CHANCES.bronze
    ){
        return "bronze";
    }
    return null;
}


const BRONZE_REWARDS = Object.freeze([
    Object.freeze({
        key: "xp_common",
        weight: 41,
        build(random){
            const xp = randomInteger(1500000, 7500000, random);
            return {bundle: {xp}, text: `**${xp.toLocaleString()} XP**`};
        }
    }),
    Object.freeze({
        key: "xp_rare",
        weight: 3,
        build(random){
            const xp = randomInteger(15000000, 27500000, random);
            return {bundle: {xp}, text: `**${xp.toLocaleString()} XP**`};
        }
    }),
    Object.freeze({
        key: "luck_max",
        weight: 11,
        build(random){
            const amount = randomChoice([5, 7, 8], random);
            return {
                bundle: {boosts: [{boostType: "luck", tier: "max", amount}]},
                text: `**${amount}x** 🍀 Luck Boost MAX`
            };
        }
    }),
    Object.freeze({
        key: "luck_three",
        weight: 27,
        build(random){
            const amount = randomChoice([12, 15, 21], random);
            return {
                bundle: {boosts: [{boostType: "luck", tier: "tier3", amount}]},
                text: `**${amount}x** ☘️ Luck Boost III`
            };
        }
    }),
    Object.freeze({
        key: "xp_max",
        weight: 13,
        build(random){
            const amount = randomChoice([6, 8, 10], random);
            return {
                bundle: {boosts: [{boostType: "xp", tier: "max", amount}]},
                text: `**${amount}x** XP Boost MAX`
            };
        }
    }),
    Object.freeze({
        key: "rune_two",
        weight: 2.9,
        build(random){
            const amount = randomChoice([50, 60, 75], random);
            return {
                bundle: {boosts: [{boostType: "rune", tier: "tier2", amount}]},
                text: `**${amount}x** 💠 Power Rune II`
            };
        }
    }),
    Object.freeze({
        key: "bless_unlock",
        weight: 0.1,
        build(){
            return {
                bundle: {unlockBless: true},
                text: "Permanently obtain **!bless**"
            };
        }
    })
]);


const GILDED_REWARDS = Object.freeze([
    Object.freeze({
        key: "xp",
        weight: 43,
        build(random){
            const xp = randomInteger(55000000, 225000000, random);
            return {bundle: {xp}, text: `**${xp.toLocaleString()} XP**`};
        }
    }),
    Object.freeze({
        key: "rune_three",
        weight: 37,
        build(random){
            const amount = randomChoice([40, 55, 70], random);
            return {
                bundle: {boosts: [{boostType: "rune", tier: "tier3", amount}]},
                text: `**${amount}x** 🔷 Power Rune III`
            };
        }
    }),
    Object.freeze({
        key: "luck_omega",
        weight: 4,
        build(random){
            const amount = randomChoice([1, 2, 3], random);
            return {
                bundle: {boosts: [{boostType: "luck", tier: "omega", amount}]},
                text: `**${amount}x** 👁️‍🗨️ Luck Boost Ω`
            };
        }
    }),
    Object.freeze({
        key: "xp_infinity",
        weight: 11,
        build(random){
            const amount = randomChoice([2, 4, 6], random);
            return {
                bundle: {boosts: [{boostType: "xp", tier: "infinity", amount}]},
                text: `**${amount}x** 🧿 XP Boost ထ`
            };
        }
    }),
    Object.freeze({
        key: "multi_commands",
        weight: 4,
        build(){
            return {
                bundle: {
                    timedAllCommands: {
                        extraCount: 6,
                        durationMs: 24 * 60 * 60 * 1000,
                        excludeCommands: ["troll"]
                    }
                },
                text: "**+6 multi-commands** for every supported command except `!troll` for **24 hours**"
            };
        }
    }),
    Object.freeze({
        key: "luck_omega_jackpot",
        weight: 1,
        build(random){
            const amount = randomChoice([10, 12, 14], random);
            return {
                bundle: {boosts: [{boostType: "luck", tier: "omega", amount}]},
                text: `**${amount}x** 👁️‍🗨️ Luck Boost Ω`
            };
        }
    })
]);


const BOSS_REWARDS = Object.freeze([
    Object.freeze({
        key: "shards",
        weight: 85,
        build(random){
            const shards = randomInteger(100, 2500, random);
            return {
                bundle: {shards},
                text: `**${shards.toLocaleString()} Boss Shards**`
            };
        }
    }),
    Object.freeze({
        key: "spawn_boss",
        weight: 14.5,
        build(){
            return {
                bundle: {spawnBossUses: 1},
                text: "Obtain **1 use** of `!spawnboss`"
            };
        }
    }),
    Object.freeze({
        key: "coinflip",
        weight: 0.5,
        build(){
            return {
                bundle: {unlockCoinflip: true},
                text: "Permanently obtain **!coinflip**"
            };
        }
    })
]);


function rollChestReward(tier, random = Math.random){
    const table = {
        bronze: BRONZE_REWARDS,
        gilded: GILDED_REWARDS,
        boss: BOSS_REWARDS
    }[String(tier).toLowerCase()];

    if(!table){
        throw new Error(`Unknown chest tier: ${tier}`);
    }

    const selected = weightedChoice(table, random);
    return {
        tier: String(tier).toLowerCase(),
        key: selected.key,
        ...selected.build(random)
    };
}


async function tryRollChestDrop(message, random = Math.random){
    const tier = rollRollChestDrop(random);
    if(!tier){
        return null;
    }

    const amount = await database.addBoostInventory(
        message.guild.id,
        message.author.id,
        "chest",
        tier,
        1
    );

    return {
        tier,
        amount,
        text:
            `${getChestEmoji(message.guild, tier)} **${message.author.username} found a ${CHEST_NAMES[tier]}!** `
            + `Inventory: **x${Number(amount).toLocaleString()}**`
    };
}


async function openChest(
    guildID,
    userID,
    tier,
    random = Math.random
){
    const reward = rollChestReward(tier, random);
    const result = await database.openChestReward(
        guildID,
        userID,
        tier,
        reward.bundle
    );
    return {
        ...result,
        reward
    };
}


module.exports = {
    CHEST_EMOJIS,
    CHEST_NAMES,
    getChestEmoji,
    ROLL_CHEST_CHANCES,
    BRONZE_REWARDS,
    GILDED_REWARDS,
    BOSS_REWARDS,
    rollRollChestDrop,
    rollChestReward,
    tryRollChestDrop,
    openChest
};
