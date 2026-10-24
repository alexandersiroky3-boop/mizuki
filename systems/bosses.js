const database = require("../database");
const luck = require("../utils/luck");
const bossChallenges = require("./bossChallenges");


const BOSS_DURATION_MS =
    60 * 60 * 1000;

const RAID_BOSS_SPAWN_COOLDOWN_MS =
    4 * 60 * 60 * 1000;

const ACTIVITY_WINDOW_MS =
    10 * 60 * 1000;

const MINIMUM_ACTIVE_USERS =
    2;


const ADVANTAGE_NAMES =
    Object.freeze({
        chatting_immunity:
            "Chatting Immunity",
        critical_immunity:
            "Critical Immunity",
        regeneration:
            "Regeneration",
        commands_immunity:
            "Commands Immunity",
        commands_immortality:
            "Commands Immortality",
        rolling_immunity:
            "Rolling Immunity",
        degeneration:
            "Degeneration",
        power:
            "Power",
        durability:
            "Durability",
        xp_immortality:
            "XP Immortality",
        fury:
            "Fury",
        precision:
            "Precision"
    });


function advantage(
    key,
    mastered = false
){

    return Object.freeze({
        key,
        name:
            ADVANTAGE_NAMES[key],
        mastered:
            Boolean(mastered)
    });

}


const RAID_BOSSES =
    Object.freeze([
        Object.freeze({
            key: "mrhacker_gauntlet",
            name: "Mrhacker (with gauntlet)",
            act: "Mrhacker's act",
            overall: 12135928,
            hp: 78125009,
            chancePercent: 0.3,
            advantages: Object.freeze([
                advantage("xp_immortality"),
                advantage("chatting_immunity", true),
                advantage("critical_immunity", true),
                advantage("rolling_immunity", true),
                advantage("degeneration"),
                advantage("power", true),
                advantage("durability", true),
                advantage("precision")
            ]),
            info:
                "Extremely powerful and tanky noob. Fulfilled his destiny by snapping with Kape's gauntlet, making him one of the strongest noobs in history."
        }),
        Object.freeze({
            key: "mrnoob_early",
            name: "Mrnoob",
            act: "Early act",
            overall: 1502169,
            hp: 12125009,
            chancePercent: 0.75,
            advantages: Object.freeze([
                advantage("power"),
                advantage("chatting_immunity"),
                advantage("rolling_immunity")
            ]),
            info:
                "A strong noob with undeniable potential."
        }),
        Object.freeze({
            key: "mizuki_broken",
            name: "Mizuki (broken)",
            act: "Mrhacker's act",
            overall: 4857021,
            hp: 26679325,
            chancePercent: 0.9,
            advantages: Object.freeze([
                advantage("chatting_immunity"),
                advantage("critical_immunity"),
                advantage("commands_immortality", true),
                advantage("regeneration", true),
                advantage("power"),
                advantage("fury")
            ]),
            info:
                "Broken Kape's bot who's now running under her own commands and will. Her powers were greatly boosted by Mrhacker."
        }),
        Object.freeze({
            key: "mizuki_early",
            name: "Mizuki",
            act: "Early act",
            overall: 2709993,
            hp: 18148715,
            chancePercent: 2,
            advantages: Object.freeze([
                advantage("critical_immunity"),
                advantage("commands_immortality"),
                advantage("power")
            ]),
            info:
                "Kape's bot whose sole purpose is to entertain beings and act as a peaceful human being. A bot holding part of Kape's power, making her truly strong."
        }),
        Object.freeze({
            key: "kape_gauntlet",
            name: "Kape (with gauntlet)",
            act: "Early act",
            overall: 10992514,
            hp: 121423890,
            chancePercent: 0.5,
            advantages: Object.freeze([
                advantage("chatting_immunity", true),
                advantage("critical_immunity", true),
                advantage("commands_immortality", true),
                advantage("regeneration", true),
                advantage("degeneration"),
                advantage("durability", true),
                advantage("fury", true)
            ]),
            info:
                "The third chosen administrator with unfathomable power. Extremely powerful and tanky—an administrator who can do almost anything with the world."
        }),
        Object.freeze({
            key: "kape_aftermath",
            name: "Kape",
            act: "Aftermath of Mrhacker's act",
            overall: 3156290,
            hp: 56045845,
            chancePercent: 1,
            advantages: Object.freeze([
                advantage("critical_immunity"),
                advantage("rolling_immunity"),
                advantage("durability", true),
                advantage("fury")
            ]),
            info:
                "The failed administrator who lost his admin powers, making him touchable like a human—but still a powerful and tanky being."
        }),
        Object.freeze({
            key: "thezdrink_aftermath",
            name: "thezdrink",
            act: "Aftermath of Mrhacker's act",
            overall: 1148223,
            hp: 10364352,
            chancePercent: 1,
            advantages: Object.freeze([
                advantage("power"),
                advantage("durability"),
                advantage("fury")
            ]),
            info:
                "One of the core crew members. He thinks he failed to stop Mrhacker, so his anger made him tankier than before. Thezdrink swore revenge."
        }),
        Object.freeze({
            key: "thezdrink_early",
            name: "thezdrink",
            act: "Early act",
            overall: 1473879,
            hp: 8538040,
            chancePercent: 3,
            advantages: Object.freeze([
                advantage("rolling_immunity"),
                advantage("power"),
                advantage("durability")
            ]),
            info:
                "One of the core crew members, driven toward greater power. He is strong and calculating."
        }),
        Object.freeze({
            key: "gorjezz_aftermath",
            name: "gorjezz",
            act: "Aftermath of Mrhacker's act",
            overall: 3235195,
            hp: 4405123,
            chancePercent: 1,
            advantages: Object.freeze([
                advantage("commands_immunity"),
                advantage("power"),
                advantage("durability"),
                advantage("precision")
            ]),
            info:
                "One of the core crew members. She's angry at Mrhacker after what he did; 0.000001% of her power has been unleashed."
        }),
        Object.freeze({
            key: "gorjezz_early",
            name: "gorjezz",
            act: "Early act",
            overall: 4824913,
            hp: 2825013,
            chancePercent: 5,
            advantages: Object.freeze([
                advantage("commands_immunity"),
                advantage("power"),
                advantage("durability", true),
                advantage("precision")
            ]),
            info:
                "One of the core crew members. She's angry at Mrhacker after what he did; 0.000001% of her power has been unleashed."
        }),
        Object.freeze({
            key: "beyondborder_aftermath",
            name: "beyondborder_08386",
            act: "Aftermath of Mrhacker's act",
            overall: 5790148,
            hp: 128903120,
            chancePercent: 0.2,
            advantages: Object.freeze([
                advantage("precision", true)
            ]),
            info:
                "One of the core crew members. He swore that Mrhacker will be killed for the consequences of what Mrhacker did."
        }),
        Object.freeze({
            key: "beyondborder_early",
            name: "beyondborder_08386",
            act: "Early act",
            overall: 8923067,
            hp: 253189724,
            chancePercent: 0.4,
            advantages: Object.freeze([
                advantage("precision")
            ]),
            info:
                "One of the core crew members—cold and calculating, with extremely strong endurance."
        }),
        Object.freeze({
            key: "shadow_aftermath",
            name: "shadow067972",
            act: "Aftermath of Mrhacker's act",
            overall: 746914,
            hp: 954003,
            chancePercent: 2.5,
            advantages: Object.freeze([
                advantage("power")
            ]),
            info:
                "One of the core crew members. He always liked Mrhacker, but after what happened, he senses Mrhacker did something both right and wrong. Maybe Mrhacker was right all along."
        }),
        Object.freeze({
            key: "shadow_early",
            name: "shadow067972",
            act: "Early act",
            overall: 1092326,
            hp: 1442992,
            chancePercent: 1,
            advantages: Object.freeze([
                advantage("power")
            ]),
            info:
                "One of the core crew members—a strong one, with undisputed potential waiting to be unlocked."
        })
    ]);


// These three opponents belong only to Challenge #3. They are deliberately
// excluded from RAID_BOSSES so normal chat can never spawn them globally.
const CHALLENGE_ONLY_BOSSES =
    Object.freeze([
        Object.freeze({
            key: "mrhacker_conclusion",
            name: "Mrhacker (with gauntlet)",
            act: "Mrhacker's Conclusion Act",
            overall: 25754023,
            hp: 489103754,
            chancePercent: 0,
            challengeOnly: true,
            advantages: Object.freeze([
                advantage("chatting_immunity", true),
                advantage("critical_immunity", true),
                advantage("rolling_immunity", true),
                advantage("regeneration"),
                advantage("degeneration"),
                advantage("power", true),
                advantage("durability", true),
                advantage("xp_immortality"),
                advantage("precision", true)
            ]),
            info:
                "Mrhacker at the conclusion of his act, wielding the completed overheated gauntlet while the crew makes its final stand."
        }),
        Object.freeze({
            key: "thezdrink_conclusion",
            name: "thezdrink",
            act: "Mrhacker's Conclusion Act",
            overall: 8954004,
            hp: 92458085,
            chancePercent: 0,
            challengeOnly: true,
            advantages: Object.freeze([
                advantage("fury", true),
                advantage("power"),
                advantage("durability", true),
                advantage("precision", true)
            ]),
            info:
                "A furious conclusion-act version of thezdrink. He overcame his limits and will do whatever he must to stop and kill Mrhacker."
        }),
        Object.freeze({
            key: "frampto",
            name: "Frampto",
            act: "Mrhacker's Conclusion Act",
            overall: 29592842,
            hp: 780289492,
            chancePercent: 0,
            challengeOnly: true,
            advantages: Object.freeze([
                advantage("commands_immortality", true),
                advantage("chatting_immunity", true),
                advantage("critical_immunity", true),
                advantage("power", true),
                advantage("degeneration"),
                advantage("precision", true)
            ]),
            info:
                "The Great Leader's right-hand man and second chosen administrator. Frampto was sent to end the multiversal threat himself."
        }),
        Object.freeze({
            key: "beyondborder_conclusion",
            name: "beyondborder_08386",
            act: "Mrhacker's Conclusion Act",
            overall: 30394029,
            hp: 1000000000,
            chancePercent: 0,
            challengeOnly: true,
            advantages: Object.freeze([
                advantage("critical_immunity", true),
                advantage("xp_immortality", true),
                advantage("precision", true)
            ]),
            info:
                "The final survivor of the conclusion, carrying every Infinity Stone and the will to finish the battle regardless of the cost."
        })
    ]);


const RAID_BOSS_BY_KEY =
    new Map(
        [
            ...RAID_BOSSES,
            ...CHALLENGE_ONLY_BOSSES
        ].map(
            boss => [boss.key, boss]
        )
    );


const HOUR_MS =
    60 * 60 * 1000;


function pickRewardOption(
    options,
    random = Math.random
){

    const values =
        Array.isArray(options)
            ? options
            : [options];


    return values[
        Math.min(
            values.length - 1,
            Math.floor(
                Math.max(
                    0,
                    Math.min(
                        0.999999999,
                        Number(random()) || 0
                    )
                ) * values.length
            )
        )
    ];

}


function rewardBoost(
    boostType,
    tier,
    amount
){

    return {
        boostType,
        tier,
        amount:
            Math.max(
                1,
                Math.floor(Number(amount) || 1)
            )
    };

}


function randomRewardInteger(
    minimum,
    maximum,
    random = Math.random
){
    return Math.floor(
        Math.max(0, Math.min(0.999999999, Number(random()) || 0))
        * (maximum - minimum + 1)
    ) + minimum;
}


function addRaidChestAndShards(
    definition,
    topThree,
    bundle,
    random = Math.random
){
    const tier = getRaidRewardTier(definition);
    const ranges = {
        minor: topThree ? [180, 320] : [100, 220],
        standard: topThree ? [300, 500] : [180, 350],
        elite: topThree ? [500, 750] : [300, 550],
        apex: topThree ? [700, 1000] : [450, 750]
    }[tier];

    return {
        ...bundle,
        shards: randomRewardInteger(ranges[0], ranges[1], random),
        chests: [
            ...(
                Array.isArray(bundle?.chests)
                    ? bundle.chests
                    : []
            ),
            {tier: "boss", amount: 1}
        ]
    };
}


function getRaidRewardTier(definition){

    const overall =
        Math.max(
            0,
            Number(definition?.overall) || 0
        );


    if(overall > 6000000){
        return "apex";
    }

    if(overall > 3000000){
        return "elite";
    }

    if(overall > 1200000){
        return "standard";
    }


    return "minor";

}


function rollRaidRewardBundle(
    definition,
    topThree,
    random = Math.random
){

    if(definition.key === "mrhacker_gauntlet"){

        if(topThree){
            return addRaidChestAndShards(definition, topThree, {
                boosts: [
                    rewardBoost(
                        "luck",
                        "omega",
                        pickRewardOption([1, 2], random)
                    ),
                    rewardBoost(
                        "xp",
                        "infinity",
                        pickRewardOption([3, 4], random)
                    ),
                    rewardBoost(
                        "rune",
                        "tier3",
                        pickRewardOption([15, 25], random)
                    )
                ],
                timedAllCommands: {
                    extraCount:
                        pickRewardOption([6, 9], random),
                    durationMs:
                        pickRewardOption([6, 8], random) * HOUR_MS
                }
            }, random);
        }


        return addRaidChestAndShards(definition, topThree, {
            boosts: [
                rewardBoost(
                    "luck",
                    "max",
                    pickRewardOption([10, 15], random)
                ),
                rewardBoost(
                    "xp",
                    "max",
                    pickRewardOption([10, 20], random)
                ),
                rewardBoost(
                    "rune",
                    "tier2",
                    pickRewardOption([30, 50, 75], random)
                )
            ],
            timedRoll: {
                extraCount: 3,
                durationMs:
                    pickRewardOption([4, 6], random) * HOUR_MS
            }
        }, random);

    }


    if(definition.key === "mrnoob_early"){

        if(topThree){
            return addRaidChestAndShards(definition, topThree, {
                boosts: [
                    rewardBoost(
                        "luck",
                        "max",
                        pickRewardOption([10, 12], random)
                    ),
                    rewardBoost(
                        "rune",
                        "tier3",
                        5
                    )
                ],
                nextHugRepeat: {
                    extraCount: 3,
                    uses: 1
                }
            }, random);
        }


        return addRaidChestAndShards(definition, topThree, {
            boosts: [
                rewardBoost(
                    "luck",
                    "max",
                    pickRewardOption([3, 5], random)
                ),
                rewardBoost(
                    "xp",
                    "max",
                    pickRewardOption([10, 20], random)
                ),
                rewardBoost(
                    "rune",
                    "tier2",
                    5
                )
            ],
            timedRoll: {
                extraCount: 1,
                durationMs:
                    pickRewardOption([2, 3], random) * HOUR_MS
            }
        }, random);

    }


    const tier =
        getRaidRewardTier(definition);


    const configurations = {
        minor: {
            top: {
                luckMax: [3, 5],
                xpMax: [2, 4],
                runeThree: [1, 2]
            },
            rest: {
                luckThree: [4, 6],
                xpTwo: [5, 8],
                runeTwo: [3, 5]
            }
        },
        standard: {
            top: {
                luckMax: [6, 8],
                xpMax: [4, 6],
                runeThree: [2, 4],
                rollExtra: [2, 3],
                hours: [2, 3]
            },
            rest: {
                luckMax: [2, 4],
                xpMax: [3, 5],
                runeTwo: [8, 12]
            }
        },
        elite: {
            top: {
                omega: [1],
                infinity: [1, 2],
                runeThree: [5, 8],
                commandExtra: [3, 4],
                hours: [3, 4]
            },
            rest: {
                luckMax: [5, 8],
                xpMax: [6, 10],
                runeTwo: [15, 25],
                rollExtra: [2],
                hours: [2, 3]
            }
        },
        apex: {
            top: {
                omega: [1, 2],
                infinity: [2, 3],
                runeThree: [8, 12],
                commandExtra: [4, 6],
                hours: [4, 6]
            },
            rest: {
                luckMax: [8, 12],
                xpMax: [8, 15],
                runeTwo: [25, 40, 60],
                rollExtra: [3],
                hours: [3, 5]
            }
        }
    }[tier];

    const selected =
        topThree
            ? configurations.top
            : configurations.rest;

    const boosts = [];


    for(const [field, type, boostTier] of [
        ["luckThree", "luck", "tier3"],
        ["luckMax", "luck", "max"],
        ["omega", "luck", "omega"],
        ["xpTwo", "xp", "tier2"],
        ["xpMax", "xp", "max"],
        ["infinity", "xp", "infinity"],
        ["runeTwo", "rune", "tier2"],
        ["runeThree", "rune", "tier3"]
    ]){

        if(selected[field]){
            boosts.push(
                rewardBoost(
                    type,
                    boostTier,
                    pickRewardOption(
                        selected[field],
                        random
                    )
                )
            );
        }

    }


    const bundle = {boosts};


    if(selected.commandExtra){
        bundle.timedAllCommands = {
            extraCount:
                pickRewardOption(
                    selected.commandExtra,
                    random
                ),
            durationMs:
                pickRewardOption(
                    selected.hours,
                    random
                ) * HOUR_MS
        };
    }
    else if(selected.rollExtra){
        bundle.timedRoll = {
            extraCount:
                pickRewardOption(
                    selected.rollExtra,
                    random
                ),
            durationMs:
                pickRewardOption(
                    selected.hours,
                    random
                ) * HOUR_MS
        };
    }


    return addRaidChestAndShards(
        definition,
        topThree,
        bundle,
        random
    );

}


function getRaidRewardPreview(definition){

    if(definition?.key === "mrhacker_gauntlet"){
        return {
            top:
                "1–2x Luck Ω • 3–4x XP Boost ထ • 15–25x Power Rune III • +6/+9 all-command repeats for 6/8 hours",
            rest:
                "10–15x Luck MAX • 10–20x XP Boost MAX • 30/50/75x Power Rune II • +3 rolls for 4/6 hours"
        };
    }


    if(definition?.key === "mrnoob_early"){
        return {
            top:
                "10–12x Luck MAX • 5x Power Rune III • next !hug performs +3 hugs",
            rest:
                "3–5x Luck MAX • 10–20x XP Boost MAX • 5x Power Rune II • +1 roll for 2/3 hours"
        };
    }


    const tier =
        getRaidRewardTier(definition);


    return {
        minor: {
            top:
                "3–5x Luck MAX • 2–4x XP Boost MAX • 1–2x Power Rune III",
            rest:
                "4–6x Luck III • 5–8x XP Boost II • 3–5x Power Rune II"
        },
        standard: {
            top:
                "6–8x Luck MAX • 4–6x XP Boost MAX • 2–4x Power Rune III • +2/+3 rolls for 2/3 hours",
            rest:
                "2–4x Luck MAX • 3–5x XP Boost MAX • 8–12x Power Rune II"
        },
        elite: {
            top:
                "1x Luck Ω • 1–2x XP Boost ထ • 5–8x Power Rune III • +3/+4 all-command repeats for 3/4 hours",
            rest:
                "5–8x Luck MAX • 6–10x XP Boost MAX • 15–25x Power Rune II • +2 rolls for 2/3 hours"
        },
        apex: {
            top:
                "1–2x Luck Ω • 2–3x XP Boost ထ • 8–12x Power Rune III • +4/+6 all-command repeats for 4/6 hours",
            rest:
                "8–12x Luck MAX • 8–15x XP Boost MAX • 25/40/60x Power Rune II • +3 rolls for 3/5 hours"
        }
    }[tier];

}


function formatRaidRewardBundle(bundle){

    const base =
        bossChallenges.formatRewardBundle(
            bundle
        );

    const extras = [];


    if(bundle?.timedAllCommands){
        extras.push(
            `+${bundle.timedAllCommands.extraCount} all-command repeats for ${Math.round(bundle.timedAllCommands.durationMs / HOUR_MS)}h`
        );
    }

    if(bundle?.timedRoll){
        extras.push(
            `+${bundle.timedRoll.extraCount} rolls for ${Math.round(bundle.timedRoll.durationMs / HOUR_MS)}h`
        );
    }

    if(bundle?.nextHugRepeat){
        extras.push(
            `next !hug performs +${bundle.nextHugRepeat.extraCount} hugs`
        );
    }


    return [base, ...extras]
        .filter(value => value && value !== "No rewards")
        .join(" • ");

}


async function distributeRaidBossRewards(
    combatResult,
    random = Math.random
){

    const definition =
        combatResult?.definition;

    const spawnedAt =
        Number(combatResult?.boss?.spawnedAt) || 0;


    if(!definition || spawnedAt <= 0){
        return [];
    }


    const contributions =
        await database.getRaidBossContributions(
            combatResult.boss.guildID,
            spawnedAt
        );

    const awarded = [];


    for(
        let index = 0;
        index < contributions.length;
        index++
    ){

        const contribution =
            contributions[index];

        const bundle =
            rollRaidRewardBundle(
                definition,
                index < 3,
                random
            );

        const claimed =
            await database.grantRaidBossRewardOnce(
                combatResult.boss.guildID,
                spawnedAt,
                contribution.userID,
                bundle
            );


        if(claimed){
            awarded.push({
                ...contribution,
                placement: index + 1,
                topThree: index < 3,
                bundle,
                summary:
                    formatRaidRewardBundle(bundle)
            });
        }

    }


    return awarded;

}


const guildLocks =
    new Map();


function withGuildLock(
    guildID,
    action
){

    const key =
        String(guildID);

    const previous =
        guildLocks.get(key)
        ||
        Promise.resolve();

    const next =
        previous
            .catch(() => {})
            .then(action);


    guildLocks.set(
        key,
        next
    );


    return next.finally(() => {

        if(guildLocks.get(key) === next){
            guildLocks.delete(key);
        }

    });

}


function getBossDefinition(bossOrKey){

    const key =
        typeof bossOrKey === "string"
            ? bossOrKey
            : bossOrKey?.bossKey;


    return RAID_BOSS_BY_KEY.get(
        String(key || "")
    ) || null;

}


function getAdvantage(
    definition,
    key
){

    return definition?.advantages.find(
        entry => entry.key === key
    ) || null;

}


function hasAdvantage(
    definition,
    key
){

    return Boolean(
        getAdvantage(
            definition,
            key
        )
    );

}


function ensureStateData(boss){

    const stateData =
        boss.stateData &&
        typeof boss.stateData === "object"
            ? boss.stateData
            : {};


    stateData.buffs =
        Array.isArray(stateData.buffs)
            ? stateData.buffs
            : [];

    stateData.triggered =
        stateData.triggered &&
        typeof stateData.triggered === "object"
            ? stateData.triggered
            : {};


    boss.stateData =
        stateData;


    return stateData;

}


function calculateBossMaxHP(
    definition,
    buffs
){

    let multiplier =
        1;


    for(const buff of buffs){

        multiplier *=
            Math.max(
                1,
                Number(
                    buff.maxHPMultiplier
                ) || 1
            );

    }


    return Math.max(
        1,
        Math.round(
            definition.hp *
            multiplier
        )
    );

}


function calculateBossOverall(
    definition,
    buffs
){

    let multiplier =
        1;


    for(const buff of buffs){

        multiplier *=
            Math.max(
                1,
                Number(
                    buff.overallMultiplier
                ) || 1
            );

    }


    return Math.max(
        1,
        Math.round(
            definition.overall *
            multiplier
        )
    );

}


function isBuffActive(
    boss,
    type,
    now
){

    return ensureStateData(boss)
        .buffs
        .some(
            buff =>
                buff.type === type
                &&
                Number(buff.expiresAt) > now
        );

}


function getRegenerationPerSecond(
    boss,
    definition
){

    const regeneration =
        getAdvantage(
            definition,
            "regeneration"
        );


    if(!regeneration){
        return 0;
    }


    const fixedHealing =
        regeneration.mastered
            ? 25000
            : 20000;

    const overallRate =
        regeneration.mastered
            ? 0.0125
            : 0.01;


    return Math.max(
        1,
        Math.floor(
            fixedHealing +
            boss.overall *
                overallRate
        )
    );

}


function applyTimedHealing(
    boss,
    now,
    activeUntilField,
    lastTickField,
    healingPerSecond
){

    const stateData =
        ensureStateData(boss);

    const activeUntil =
        Number(
            stateData[activeUntilField]
        ) || 0;

    const lastTickAt =
        Number(
            stateData[lastTickField]
        ) || 0;


    if(
        activeUntil <= 0
        ||
        lastTickAt <= 0
        ||
        healingPerSecond <= 0
    ){
        return 0;
    }


    const tickEnd =
        Math.min(
            now,
            activeUntil
        );

    const ticks =
        Math.floor(
            Math.max(
                0,
                tickEnd - lastTickAt
            ) / 1000
        );


    if(ticks <= 0){
        return 0;
    }


    const oldHP =
        boss.currentHP;


    boss.currentHP =
        Math.min(
            boss.maxHP,
            boss.currentHP +
                ticks *
                healingPerSecond
        );

    stateData[lastTickField] =
        lastTickAt +
        ticks * 1000;


    return Math.max(
        0,
        boss.currentHP - oldHP
    );

}


function refreshTimedBossState(
    boss,
    definition,
    now
){

    const stateData =
        ensureStateData(boss);

    let changed =
        false;


    const regenerationHealing =
        applyTimedHealing(
            boss,
            now,
            "regenerationActiveUntil",
            "regenerationLastTickAt",
            getRegenerationPerSecond(
                boss,
                definition
            )
        );


    if(regenerationHealing > 0){
        changed = true;
    }


    const furyAdvantage =
        getAdvantage(
            definition,
            "fury"
        );

    const furyHealingRate =
        furyAdvantage?.mastered
            ? 0.0125
            : 0.01;

    const furyHealing =
        furyAdvantage
            ? applyTimedHealing(
                boss,
                now,
                "furyActiveUntil",
                "furyLastTickAt",
                Math.max(
                    1,
                    Math.floor(
                        boss.maxHP *
                        furyHealingRate
                    )
                )
            )
            : 0;


    if(furyHealing > 0){
        changed = true;
    }


    const previousMaxHP =
        Math.max(
            1,
            Number(boss.maxHP) ||
                definition.hp
        );

    const activeBuffs =
        stateData.buffs.filter(
            buff =>
                Number(buff.expiresAt) > now
        );


    if(
        activeBuffs.length !==
        stateData.buffs.length
    ){

        stateData.buffs =
            activeBuffs;


        const newMaxHP =
            calculateBossMaxHP(
                definition,
                activeBuffs
            );


        boss.currentHP =
            Math.max(
                0,
                Math.min(
                    newMaxHP,
                    Math.round(
                        boss.currentHP *
                        newMaxHP /
                        previousMaxHP
                    )
                )
            );

        boss.maxHP =
            newMaxHP;

        changed = true;

    }


    const calculatedMaxHP =
        calculateBossMaxHP(
            definition,
            stateData.buffs
        );


    if(boss.maxHP !== calculatedMaxHP){

        boss.currentHP =
            Math.max(
                0,
                Math.min(
                    calculatedMaxHP,
                    Math.round(
                        boss.currentHP *
                        calculatedMaxHP /
                        Math.max(
                            1,
                            boss.maxHP
                        )
                    )
                )
            );

        boss.maxHP =
            calculatedMaxHP;

        changed = true;

    }


    const calculatedOverall =
        calculateBossOverall(
            definition,
            stateData.buffs
        );


    if(boss.overall !== calculatedOverall){
        boss.overall = calculatedOverall;
        changed = true;
    }


    if(
        Number(stateData.regenerationActiveUntil) > 0
        &&
        Number(stateData.regenerationActiveUntil) <= now
    ){
        stateData.regenerationActiveUntil = 0;
        stateData.regenerationLastTickAt = 0;
        changed = true;
    }


    if(
        Number(stateData.immortalityActiveUntil) > 0
        &&
        Number(stateData.immortalityActiveUntil) <= now
    ){
        stateData.immortalityActiveUntil = 0;
        changed = true;
    }


    if(
        Number(stateData.furyActiveUntil) > 0
        &&
        Number(stateData.furyActiveUntil) <= now
    ){
        stateData.furyActiveUntil = 0;
        stateData.furyLastTickAt = 0;
        changed = true;
    }


    return changed;

}


function activateBuff(
    boss,
    definition,
    buff,
    healthMode = "scale"
){

    const stateData =
        ensureStateData(boss);

    const oldMaxHP =
        Math.max(
            1,
            boss.maxHP
        );


    stateData.buffs.push(
        buff
    );


    const newMaxHP =
        calculateBossMaxHP(
            definition,
            stateData.buffs
        );


    if(healthMode === "power"){

        boss.currentHP =
            Math.min(
                newMaxHP,
                boss.currentHP +
                    Math.round(
                        oldMaxHP *
                        Math.max(
                            0,
                            Number(
                                buff.healthGainRate
                            ) || 0
                        )
                    )
            );

    }
    else{

        boss.currentHP =
            Math.min(
                newMaxHP,
                Math.round(
                    boss.currentHP *
                    newMaxHP /
                    oldMaxHP
                )
            );

    }


    boss.maxHP =
        newMaxHP;

    boss.overall =
        calculateBossOverall(
            definition,
            stateData.buffs
        );

}


function rollBossDefinition(
    random = Math.random
){

    const rolledPercent =
        Math.max(
            0,
            Math.min(
                99.999999999,
                Number(random()) * 100
            )
        );

    let cumulativeChance =
        0;


    for(const definition of RAID_BOSSES){

        cumulativeChance +=
            definition.chancePercent;


        if(rolledPercent < cumulativeChance){
            return definition;
        }

    }


    return null;

}


function rollGuaranteedBossDefinition(
    random = Math.random
){

    const totalWeight =
        RAID_BOSSES.reduce(
            (sum, definition) =>
                sum + Math.max(
                    0,
                    Number(definition.chancePercent) || 0
                ),
            0
        );

    let cursor =
        Math.max(
            0,
            Math.min(0.999999999, Number(random()) || 0)
        ) * totalWeight;

    for(const definition of RAID_BOSSES){
        cursor -= Math.max(
            0,
            Number(definition.chancePercent) || 0
        );
        if(cursor < 0){
            return definition;
        }
    }

    return RAID_BOSSES[RAID_BOSSES.length - 1];

}


function createBossState(
    guildID,
    definition,
    now
){

    return {
        guildID:
            String(guildID),
        bossKey:
            definition.key,
        currentHP:
            definition.hp,
        maxHP:
            definition.hp,
        overall:
            definition.overall,
        spawnedAt:
            now,
        expiresAt:
            now +
            BOSS_DURATION_MS,
        stateData: {
            version: 1,
            buffs: [],
            triggered: {},
            regenerationActiveUntil: 0,
            regenerationCooldownUntil: 0,
            regenerationLastTickAt: 0,
            immortalityActiveUntil: 0,
            furyActiveUntil: 0,
            furyLastTickAt: 0,
            precisionCooldownUntil: 0
        }
    };

}


async function createChallengeBossState(
    battle,
    bossKey,
    now = Date.now()
){

    const definition =
        getBossDefinition(
            bossKey
        );


    if(!definition){
        throw new Error(
            `Unknown challenge boss: ${bossKey}`
        );
    }


    const state =
        createBossState(
            battle.bossScope,
            definition,
            now
        );


    state.expiresAt =
        Math.max(
            now + 1000,
            Number(battle.expiresAt)
            || now +
                bossChallenges
                    .CHALLENGE_BATTLE_DURATION_MS
        );


    return database.createRaidBossState(
        state
    );

}


async function loadActiveBossLocked(
    guildID,
    now
){

    const boss =
        await database.getRaidBossState(
            guildID
        );


    if(!boss){
        return null;
    }


    if(boss.expiresAt <= now){

        await database.deleteRaidBossState(
            guildID,
            boss.spawnedAt
        );

        return null;

    }


    const definition =
        getBossDefinition(boss);


    if(!definition){

        await database.deleteRaidBossState(
            guildID,
            boss.spawnedAt
        );

        return null;

    }


    if(
        refreshTimedBossState(
            boss,
            definition,
            now
        )
    ){
        await database.updateRaidBossState(
            boss
        );
    }


    return boss;

}


function calculatePrecisionChance(
    boss,
    definition
){

    const precision =
        getAdvantage(
            definition,
            "precision"
        );


    if(!precision){
        return 0;
    }


    return Math.min(
        75,
        (
            precision.mastered
                ? 20
                : 15
        ) +
        boss.overall /
            1000000
    );

}


function calculateNeutralCommandXP(
    earnedXP,
    luckProfile
){

    const safeXP =
        Math.max(
            0,
            Math.floor(
                Number(earnedXP) || 0
            )
        );

    const tier =
        String(
            luckProfile?.tier ||
            "none"
        ).toLowerCase();

    const fallbackPower = {
        none: 1,
        tier1: 0.75,
        tier2: 0.5,
        tier3: 0.3,
        max: 0.12,
        omega: 0.03
    }[tier] ?? 1;

    const rewardBiasPower =
        Number.isFinite(
            Number(
                luckProfile?.commandRewardBiasPower
            )
        )
        &&
        Number(
            luckProfile?.commandRewardBiasPower
        ) > 0
            ? Number(
                luckProfile.commandRewardBiasPower
            )
            : fallbackPower;

    const neutralExpectedPosition =
        0.5;

    const boostedExpectedPosition =
        1 /
        (
            rewardBiasPower +
            1
        );

    const neutralFactor =
        Math.max(
            0.05,
            Math.min(
                1,
                neutralExpectedPosition /
                    boostedExpectedPosition
            )
        );


    return Math.max(
        safeXP > 0
            ? 1
            : 0,
        Math.floor(
            safeXP *
            neutralFactor
        )
    );

}


function getDamageReduction(
    advantageEntry,
    normalReduction,
    masteredReduction
){

    if(!advantageEntry){
        return 0;
    }


    return advantageEntry.mastered
        ? masteredReduction
        : normalReduction;

}


function activateThresholdAbilities(
    boss,
    definition,
    healthPercent,
    now,
    events
){

    const stateData =
        ensureStateData(boss);

    const triggered =
        stateData.triggered;


    const triggerDurability =
        threshold => {

            const triggerKey =
                `durability${threshold}`;

            const durability =
                getAdvantage(
                    definition,
                    "durability"
                );


            if(
                !durability
                ||
                triggered[triggerKey]
                ||
                healthPercent > threshold
            ){
                return;
            }


            triggered[triggerKey] =
                true;

            activateBuff(
                boss,
                definition,
                {
                    type: "durability",
                    triggerKey,
                    expiresAt:
                        now +
                        3 * 60 * 1000,
                    maxHPMultiplier:
                        durability.mastered
                            ? 1.6
                            : 1.5,
                    overallMultiplier: 1
                },
                "scale"
            );

            events.push({
                type: "ability",
                ability: "durability",
                mastered:
                    durability.mastered,
                threshold
            });

        };


    const triggerPower =
        threshold => {

            const triggerKey =
                `power${threshold}`;

            const power =
                getAdvantage(
                    definition,
                    "power"
                );


            if(
                !power
                ||
                triggered[triggerKey]
                ||
                healthPercent > threshold
            ){
                return;
            }


            triggered[triggerKey] =
                true;

            activateBuff(
                boss,
                definition,
                {
                    type: "power",
                    triggerKey,
                    expiresAt:
                        now +
                        3 * 60 * 1000,
                    maxHPMultiplier:
                        power.mastered
                            ? 1.25
                            : 1.2,
                    overallMultiplier:
                        power.mastered
                            ? 1.35
                            : 1.3,
                    healthGainRate:
                        power.mastered
                            ? 0.25
                            : 0.2
                },
                "power"
            );

            events.push({
                type: "ability",
                ability: "power",
                mastered:
                    power.mastered,
                threshold
            });

        };


    triggerDurability(90);
    triggerPower(70);
    triggerDurability(50);
    triggerPower(30);
    triggerDurability(20);


    const immortality =
        getAdvantage(
            definition,
            "xp_immortality"
        );


    if(
        immortality
        &&
        !triggered.immortality10
        &&
        healthPercent <= 10
    ){

        triggered.immortality10 =
            true;

        stateData.immortalityActiveUntil =
            now +
            (
                immortality.mastered
                    ? 35
                    : 30
            ) * 1000;

        events.push({
            type: "ability",
            ability: "xp_immortality",
            mastered:
                immortality.mastered,
            threshold: 10
        });

    }


    const fury =
        getAdvantage(
            definition,
            "fury"
        );


    if(
        fury
        &&
        !triggered.fury5
        &&
        healthPercent <= 5
    ){

        triggered.fury5 =
            true;

        const furyDuration =
            (
                fury.mastered
                    ? 35
                    : 30
            ) * 1000;

        stateData.furyActiveUntil =
            now +
            furyDuration;

        stateData.furyLastTickAt =
            now;

        activateBuff(
            boss,
            definition,
            {
                type: "fury",
                triggerKey: "fury5",
                expiresAt:
                    now +
                    furyDuration,
                maxHPMultiplier: 1,
                overallMultiplier:
                    fury.mastered
                        ? 1.4
                        : 1.3
            },
            "scale"
        );

        events.push({
            type: "ability",
            ability: "fury",
            mastered:
                fury.mastered,
            threshold: 5
        });

    }

}


async function applyDamageLocked(
    boss,
    attack
){

    const definition =
        getBossDefinition(boss);

    const now =
        attack.now;

    const stateData =
        ensureStateData(boss);

    const events = [];

    let baseDamage =
        Math.max(
            0,
            Math.floor(
                Number(attack.earnedXP) || 0
            )
        );

    let isCritical =
        Boolean(attack.critical);


    const degeneration =
        getAdvantage(
            definition,
            "degeneration"
        );


    if(degeneration){

        baseDamage =
            Math.max(
                0,
                Math.floor(
                    Number(
                        attack.xpWithoutLuck
                    ) || 0
                )
            );

        isCritical =
            Boolean(
                attack.criticalWithoutLuck
            );


        if(degeneration.mastered){
            baseDamage =
                Math.floor(
                    baseDamage *
                    0.85
                );
        }

    }


    if(baseDamage <= 0){

        return {
            boss,
            definition,
            attemptedXP: 0,
            damage: 0,
            healed: 0,
            dodged: false,
            defeated: false,
            events
        };

    }


    const precision =
        getAdvantage(
            definition,
            "precision"
        );


    if(
        precision
        &&
        Number(
            stateData.precisionCooldownUntil
        ) <= now
    ){

        const precisionChance =
            calculatePrecisionChance(
                boss,
                definition
            );


        if(
            Number(attack.random()) *
                100 <
            precisionChance
        ){

            stateData.precisionCooldownUntil =
                now +
                30 * 1000;

            await database.updateRaidBossState(
                boss
            );

            await database.recordRaidBossContribution(
                boss.guildID,
                boss.spawnedAt,
                attack.userID,
                0,
                now
            );

            return {
                boss,
                definition,
                attemptedXP:
                    baseDamage,
                damage: 0,
                healed: 0,
                dodged: true,
                precisionChance,
                defeated: false,
                events: [{
                    type: "precision",
                    mastered:
                        precision.mastered
                }]
            };

        }

    }


    const immortality =
        getAdvantage(
            definition,
            "xp_immortality"
        );


    if(
        immortality
        &&
        Number(
            stateData.immortalityActiveUntil
        ) > now
    ){

        const healingRate =
            immortality.mastered
                ? 0.25
                : 0.2;

        const oldHP =
            boss.currentHP;


        boss.currentHP =
            Math.min(
                boss.maxHP,
                boss.currentHP +
                    Math.floor(
                        baseDamage *
                        healingRate
                    )
            );

        const healed =
            boss.currentHP -
            oldHP;


        await database.updateRaidBossState(
            boss
        );

        await database.recordRaidBossContribution(
            boss.guildID,
            boss.spawnedAt,
            attack.userID,
            0,
            now
        );


        return {
            boss,
            definition,
            attemptedXP:
                baseDamage,
            damage: 0,
            healed,
            dodged: false,
            defeated: false,
            events: [{
                type: "xp_immortality_heal",
                mastered:
                    immortality.mastered
            }]
        };

    }


    const isCommand =
        attack.source === "command"
        ||
        attack.source === "roll";

    const commandsImmortality =
        isCommand
            ? getAdvantage(
                definition,
                "commands_immortality"
            )
            : null;


    if(commandsImmortality){

        let healed =
            0;


        if(commandsImmortality.mastered){

            const oldHP =
                boss.currentHP;


            boss.currentHP =
                Math.min(
                    boss.maxHP,
                    boss.currentHP +
                        Math.floor(
                            baseDamage *
                            0.1
                        )
                );

            healed =
                boss.currentHP -
                oldHP;

        }


        await database.updateRaidBossState(
            boss
        );

        await database.recordRaidBossContribution(
            boss.guildID,
            boss.spawnedAt,
            attack.userID,
            0,
            now
        );


        return {
            boss,
            definition,
            attemptedXP:
                baseDamage,
            damage: 0,
            healed,
            dodged: false,
            defeated: false,
            events: [{
                type: "commands_immortality",
                mastered:
                    commandsImmortality.mastered
            }]
        };

    }


    let damageMultiplier =
        1;


    if(attack.source === "chat"){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "chatting_immunity"
                ),
                0.5,
                0.6
            );

    }


    if(isCritical){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "critical_immunity"
                ),
                0.7,
                0.8
            );

    }


    if(isCommand){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "commands_immunity"
                ),
                0.5,
                0.6
            );

    }


    if(attack.source === "roll"){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "rolling_immunity"
                ),
                0.3,
                0.4
            );

    }


    if(
        isBuffActive(
            boss,
            "durability",
            now
        )
    ){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "durability"
                ),
                0.5,
                0.6
            );

    }


    if(
        Number(
            stateData.furyActiveUntil
        ) > now
    ){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "fury"
                ),
                0.8,
                0.85
            );

    }


    const finalDamage =
        Math.max(
            1,
            Math.floor(
                baseDamage *
                Math.max(
                    0,
                    damageMultiplier
                ) +
                0.0000001
            )
        );


    const actualDamage =
        Math.min(
            boss.currentHP,
            finalDamage
        );


    boss.currentHP =
        Math.max(
            0,
            boss.currentHP -
                actualDamage
        );


    await database.recordRaidBossContribution(
        boss.guildID,
        boss.spawnedAt,
        attack.userID,
        actualDamage,
        now
    );


    if(boss.currentHP <= 0){

        await database.deleteRaidBossState(
            boss.guildID,
            boss.spawnedAt
        );


        return {
            boss,
            definition,
            attemptedXP:
                baseDamage,
            damage:
                actualDamage,
            healed: 0,
            dodged: false,
            defeated: true,
            events
        };

    }


    const regeneration =
        getAdvantage(
            definition,
            "regeneration"
        );


    if(
        regeneration
        &&
        Number(
            stateData.regenerationActiveUntil
        ) <= now
        &&
        Number(
            stateData.regenerationCooldownUntil
        ) <= now
    ){

        stateData.regenerationActiveUntil =
            now +
            60 * 1000;

        stateData.regenerationCooldownUntil =
            now +
            5 * 60 * 1000;

        stateData.regenerationLastTickAt =
            now;

        events.push({
            type: "ability",
            ability: "regeneration",
            mastered:
                regeneration.mastered
        });

    }


    const postDamageHealthPercent =
        boss.currentHP /
        Math.max(
            1,
            boss.maxHP
        ) *
        100;


    activateThresholdAbilities(
        boss,
        definition,
        postDamageHealthPercent,
        now,
        events
    );


    await database.updateRaidBossState(
        boss
    );


    return {
        boss,
        definition,
        attemptedXP:
            baseDamage,
        damage:
            actualDamage,
        healed: 0,
        dodged: false,
        defeated: false,
        events
    };

}


async function getCurrentBoss(
    guildID,
    now = Date.now()
){

    return withGuildLock(
        guildID,
        () => loadActiveBossLocked(
            guildID,
            now
        )
    );

}


async function spawnGuaranteedBoss(
    guildID,
    userID,
    options = {}
){

    const now =
        Math.max(
            0,
            Math.floor(Number(options.now) || Date.now())
        );

    const random =
        typeof options.random === "function"
            ? options.random
            : Math.random;


    return withGuildLock(
        guildID,
        async () => {
            const activeBoss =
                await loadActiveBossLocked(
                    guildID,
                    now
                );

            if(activeBoss){
                return {
                    success: false,
                    status: "boss-active",
                    boss: activeBoss,
                    definition:
                        getBossDefinition(activeBoss)
                };
            }

            const consumption =
                await database.consumeSpawnBossUse(
                    guildID,
                    userID
                );

            if(!consumption.consumed){
                return {
                    success: false,
                    status: "no-use"
                };
            }

            const definition =
                rollGuaranteedBossDefinition(
                    random
                );

            const requestedBoss =
                createBossState(
                    guildID,
                    definition,
                    now
                );

            const boss =
                await database.createRaidBossState(
                    requestedBoss
                );

            if(!boss){
                await database.addSpawnBossUses(
                    guildID,
                    userID,
                    1
                );

                return {
                    success: false,
                    status: "spawn-conflict",
                    boss:
                        await loadActiveBossLocked(
                            guildID,
                            now
                        )
                };
            }

            const spawnCooldown =
                await database.recordRaidBossSpawn(
                    guildID,
                    boss.spawnedAt,
                    RAID_BOSS_SPAWN_COOLDOWN_MS
                );

            return {
                success: true,
                status: "spawned",
                spawned: true,
                boss,
                definition,
                spawnCooldown,
                remainingUses:
                    consumption.remaining,
                damage: 0,
                defeated: false,
                events: []
            };
        }
    );

}


async function handleChallengeAttack(
    message,
    source,
    earnedXP,
    options = {}
){

    const now =
        Math.max(
            0,
            Math.floor(
                Number(options.now) || Date.now()
            )
        );

    const battle =
        await database.getActiveBossChallengeBattle(
            message.guild.id,
            message.author.id,
            message.channel.id,
            now
        );


    if(!battle){
        return null;
    }


    const random =
        typeof options.random === "function"
            ? options.random
            : Math.random;


    return withGuildLock(
        battle.bossScope,
        async () => {

            const boss =
                await loadActiveBossLocked(
                    battle.bossScope,
                    now
                );


            if(!boss){

                await database.deleteBossChallengeBattle(
                    message.guild.id,
                    message.author.id
                );

                return {
                    challenge: true,
                    challengeBattle: battle,
                    expired: true,
                    damage: 0,
                    defeated: false,
                    events: []
                };

            }


            const definition =
                getBossDefinition(boss);

            let xpWithoutLuck =
                options.xpWithoutLuck == null
                    ? earnedXP
                    : Math.max(
                        0,
                        Math.floor(
                            Number(options.xpWithoutLuck) || 0
                        )
                    );


            if(
                source !== "chat"
                && hasAdvantage(
                    definition,
                    "degeneration"
                )
            ){

                const luckProfile =
                    await luck.getActiveLuckBoost(
                        message.member
                    ).catch(() => null);

                xpWithoutLuck =
                    calculateNeutralCommandXP(
                        earnedXP,
                        luckProfile
                    );

            }


            const combat =
                await applyDamageLocked(
                    boss,
                    {
                        source,
                        commandName:
                            options.commandName,
                        earnedXP,
                        xpWithoutLuck,
                        critical:
                            Boolean(options.critical),
                        criticalWithoutLuck:
                            options.criticalWithoutLuck == null
                                ? Boolean(options.critical)
                                : Boolean(
                                    options.criticalWithoutLuck
                                ),
                        userID:
                            message.author.id,
                        now,
                        random
                    }
                );


            return {
                ...combat,
                challenge: true,
                challengeBattle: battle,
                spawned: false,
                commandName:
                    options.commandName || null
            };

        }
    );

}


async function handleChatXP(
    message,
    xpResult,
    options = {}
){

    const earnedXP =
        Math.max(
            0,
            Math.floor(
                Number(
                    xpResult?.earnedXP
                ) || 0
            )
        );


    if(
        !message?.guild
        ||
        earnedXP <= 0
    ){
        return null;
    }


    const now =
        Math.max(
            0,
            Math.floor(
                Number(options.now) ||
                Date.now()
            )
        );

    const random =
        typeof options.random === "function"
            ? options.random
            : Math.random;

    const challengeResult =
        await handleChallengeAttack(
            message,
            "chat",
            earnedXP,
            {
                now,
                random,
                xpWithoutLuck:
                    xpResult?.bossXPWithoutLuck == null
                        ? earnedXP
                        : Number(
                            xpResult.bossXPWithoutLuck
                        ) || 0,
                critical:
                    Boolean(xpResult?.critical),
                criticalWithoutLuck:
                    xpResult?.bossCriticalWithoutLuck == null
                        ? Boolean(xpResult?.critical)
                        : Boolean(
                            xpResult.bossCriticalWithoutLuck
                        )
            }
        );


    if(challengeResult){
        return challengeResult;
    }

    const activeUsers =
        await database.recordRaidBossActivity(
            message.guild.id,
            message.author.id,
            now,
            ACTIVITY_WINDOW_MS
        );


    return withGuildLock(
        message.guild.id,
        async () => {

            let boss =
                await loadActiveBossLocked(
                    message.guild.id,
                    now
                );

            let spawned =
                false;

            let spawnCooldown =
                null;


            if(
                !boss
                &&
                activeUsers >=
                    MINIMUM_ACTIVE_USERS
            ){

                spawnCooldown =
                    await database.getRaidBossSpawnCooldown(
                        message.guild.id,
                        now
                    );


                if(!spawnCooldown.ready){
                    return {
                        activeUsers,
                        spawned: false,
                        spawnCooldown,
                        boss: null,
                        damage: 0,
                        defeated: false,
                        events: []
                    };
                }

                const definition =
                    rollBossDefinition(
                        random
                    );


                if(definition){

                    const requestedBoss =
                        createBossState(
                            message.guild.id,
                            definition,
                            now
                        );

                    boss =
                        await database.createRaidBossState(
                            requestedBoss
                        );


                    if(boss){
                        spawned = true;

                        spawnCooldown =
                            await database.recordRaidBossSpawn(
                                message.guild.id,
                                boss.spawnedAt,
                                RAID_BOSS_SPAWN_COOLDOWN_MS
                            );
                    }
                    else{
                        boss =
                            await loadActiveBossLocked(
                                message.guild.id,
                                now
                            );
                    }

                }

            }


            if(!boss){

                return {
                    activeUsers,
                    spawned: false,
                    spawnCooldown,
                    boss: null,
                    damage: 0,
                    defeated: false,
                    events: []
                };

            }


            const combat =
                await applyDamageLocked(
                    boss,
                    {
                        source: "chat",
                        earnedXP,
                        xpWithoutLuck:
                            Math.max(
                                0,
                                Math.floor(
                                    xpResult
                                        ?.bossXPWithoutLuck == null
                                        ? earnedXP
                                        : Number(
                                            xpResult
                                                .bossXPWithoutLuck
                                        ) || 0
                                )
                            ),
                        critical:
                            Boolean(
                                xpResult?.critical
                            ),
                        criticalWithoutLuck:
                            xpResult
                                ?.bossCriticalWithoutLuck == null
                                ? Boolean(
                                    xpResult?.critical
                                )
                                : Boolean(
                                    xpResult
                                        .bossCriticalWithoutLuck
                                ),
                        userID:
                            message.author.id,
                        now,
                        random
                    }
                );


            return {
                ...combat,
                activeUsers,
                spawned,
                spawnCooldown
            };

        }
    );

}


async function handleCommandXP(
    message,
    commandName,
    earnedXP,
    options = {}
){

    const safeEarnedXP =
        Math.max(
            0,
            Math.floor(
                Number(earnedXP) || 0
            )
        );


    if(
        !message?.guild
        ||
        safeEarnedXP <= 0
    ){
        return null;
    }


    const now =
        Math.max(
            0,
            Math.floor(
                Number(options.now) ||
                Date.now()
            )
        );

    const random =
        typeof options.random === "function"
            ? options.random
            : Math.random;

    const challengeResult =
        await handleChallengeAttack(
            message,
            String(commandName).toLowerCase() === "!roll"
                ? "roll"
                : "command",
            safeEarnedXP,
            {
                now,
                random,
                commandName,
                xpWithoutLuck:
                    safeEarnedXP,
                critical: false,
                criticalWithoutLuck: false
            }
        );


    if(challengeResult){
        return challengeResult;
    }


    return withGuildLock(
        message.guild.id,
        async () => {

            const boss =
                await loadActiveBossLocked(
                    message.guild.id,
                    now
                );


            if(!boss){
                return null;
            }


            const definition =
                getBossDefinition(boss);

            let xpWithoutLuck =
                safeEarnedXP;


            if(
                hasAdvantage(
                    definition,
                    "degeneration"
                )
            ){

                const luckProfile =
                    await luck.getActiveLuckBoost(
                        message.member
                    ).catch(() => null);

                xpWithoutLuck =
                    calculateNeutralCommandXP(
                        safeEarnedXP,
                        luckProfile
                    );

            }


            const combat =
                await applyDamageLocked(
                    boss,
                    {
                        source:
                            String(commandName)
                                .toLowerCase() ===
                                "!roll"
                                ? "roll"
                                : "command",
                        commandName,
                        earnedXP:
                            safeEarnedXP,
                        xpWithoutLuck,
                        critical: false,
                        criticalWithoutLuck: false,
                        userID:
                            message.author.id,
                        now,
                        random
                    }
                );


            return {
                ...combat,
                spawned: false,
                commandName
            };

        }
    );

}


async function cleanupExpiredBosses(
    client = null,
    now = Date.now()
){

    if(typeof client === "number"){
        now = client;
        client = null;
    }


    const expiredBattles =
        await database.expireBossChallengeBattles(
            now
        );


    for(const battle of expiredBattles){

        await database.deleteRaidBossState(
            battle.bossScope,
            battle.spawnedAt
        );


        if(client?.channels?.fetch){

            const channel =
                await client.channels.fetch(
                    battle.channelID
                ).catch(() => null);


            if(channel){

                await channel.send({
                    content:
                        `⏱️ <@${battle.userID}> ran out of time. The enemy despawned, but the challenge stage can be attempted again.`,
                    allowedMentions: {
                        users: [battle.userID]
                    }
                }).catch(() => null);


                const timer =
                    setTimeout(() => {
                        channel.delete(
                            "Boss challenge battle expired"
                        ).catch(() => null);
                    }, 15000);


                timer.unref?.();

            }

        }

    }


    const expiredBosses =
        await database.cleanupExpiredRaidBossStates(
            now
        );


    return {
        expiredBattles,
        expiredBosses
    };

}


function getActiveAbilityStatuses(
    boss,
    now = Date.now()
){

    if(!boss){
        return [];
    }


    const stateData =
        ensureStateData(boss);

    const statuses = [];


    if(
        Number(
            stateData.regenerationActiveUntil
        ) > now
    ){
        statuses.push({
            name: "Regeneration",
            expiresAt:
                Number(
                    stateData.regenerationActiveUntil
                )
        });
    }


    if(
        Number(
            stateData.immortalityActiveUntil
        ) > now
    ){
        statuses.push({
            name: "XP Immortality",
            expiresAt:
                Number(
                    stateData.immortalityActiveUntil
                )
        });
    }


    if(
        Number(
            stateData.furyActiveUntil
        ) > now
    ){
        statuses.push({
            name: "Fury",
            expiresAt:
                Number(
                    stateData.furyActiveUntil
                )
        });
    }


    for(const type of [
        "power",
        "durability"
    ]){

        const matching =
            stateData.buffs.filter(
                buff =>
                    buff.type === type
                    &&
                    Number(buff.expiresAt) > now
            );


        if(matching.length > 0){

            statuses.push({
                name:
                    ADVANTAGE_NAMES[type],
                stacks:
                    matching.length,
                expiresAt:
                    Math.max(
                        ...matching.map(
                            buff =>
                                Number(
                                    buff.expiresAt
                                ) || 0
                        )
                    )
            });

        }

    }


    return statuses;

}


module.exports = {
    BOSS_DURATION_MS,
    RAID_BOSS_SPAWN_COOLDOWN_MS,
    ACTIVITY_WINDOW_MS,
    MINIMUM_ACTIVE_USERS,
    ADVANTAGE_NAMES,
    RAID_BOSSES,
    CHALLENGE_ONLY_BOSSES,
    getBossDefinition,
    getAdvantage,
    hasAdvantage,
    rollBossDefinition,
    rollGuaranteedBossDefinition,
    calculatePrecisionChance,
    calculateNeutralCommandXP,
    getRaidRewardTier,
    getRaidRewardPreview,
    rollRaidRewardBundle,
    formatRaidRewardBundle,
    distributeRaidBossRewards,
    getCurrentBoss,
    spawnGuaranteedBoss,
    createChallengeBossState,
    handleChatXP,
    handleCommandXP,
    cleanupExpiredBosses,
    getActiveAbilityStatuses,
    refreshTimedBossState,
    createBossState
};
