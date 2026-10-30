const CHALLENGE_BATTLE_DURATION_MS =
    20 * 60 * 1000;


const REWARD_LABELS =
    Object.freeze({
        luckTier3: "<@&1533960965949886534>",
        luckMax: "<@&1533961286310953042>",
        luckOmega: "<@&1535700310402670592>",
        xpMax: "<@&1526995218098815016>",
        xpInfinity: "<@&1540496714903986388>",
        runeTier2: "<@&1551190089256665168>",
        runeTier3: "<@&1551190400599855165>"
    });


function rewardBundle({
    xp = 0,
    boosts = [],
    shards = 0,
    chests = [],
    unlockFight = false,
    freeUpgradeTokens = 0
} = {}){

    return Object.freeze({
        xp:
            Math.max(
                0,
                Math.floor(Number(xp) || 0)
            ),
        boosts:
            Object.freeze(
                boosts.map(boost =>
                    Object.freeze({
                        boostType:
                            String(boost.boostType),
                        tier:
                            String(boost.tier),
                        amount:
                            Math.max(
                                1,
                                Math.floor(
                                    Number(boost.amount) || 1
                                )
                            )
                    })
                )
            ),
        shards:
            Math.max(
                0,
                Math.floor(Number(shards) || 0)
            ),
        chests:
            Object.freeze(
                chests.map(chest =>
                    Object.freeze({
                        tier:
                            String(chest.tier),
                        amount:
                            Math.max(
                                1,
                                Math.floor(
                                    Number(chest.amount) || 1
                                )
                            )
                    })
                )
            ),
        unlockFight:
            Boolean(unlockFight),
        freeUpgradeTokens:
            Math.max(
                0,
                Math.floor(
                    Number(freeUpgradeTokens) || 0
                )
            )
    });

}


const BOSS_CHALLENGES =
    Object.freeze([
        Object.freeze({
            key: "crew",
            number: 1,
            name: "The Crew",
            requiredLevel: 100,
            prerequisite: null,
            bossName: "Mizuki (20%)",
            stages: Object.freeze([
                "challenge_crew_shadow",
                "challenge_crew_thezdrink",
                "challenge_crew_gorjezz",
                "challenge_crew_mrnoob",
                "challenge_crew_beyondborder",
                "challenge_crew_kape",
                "challenge_crew_mizuki"
            ]),
            firstReward:
                rewardBundle({
                    xp: 100000000,
                    shards: 20000,
                    chests: [
                        {tier: "boss", amount: 5}
                    ],
                    boosts: [
                        {
                            boostType: "xp",
                            tier: "infinity",
                            amount: 1
                        },
                        {
                            boostType: "luck",
                            tier: "max",
                            amount: 15
                        },
                        {
                            boostType: "luck",
                            tier: "tier3",
                            amount: 30
                        }
                    ]
                }),
            repeatReward:
                rewardBundle({
                    xp: 10000000,
                    shards: 2000,
                    chests: [
                        {tier: "boss", amount: 1}
                    ],
                    boosts: [
                        {
                            boostType: "rune",
                            tier: "tier2",
                            amount: 8
                        },
                        {
                            boostType: "luck",
                            tier: "tier3",
                            amount: 2
                        }
                    ]
                })
        }),
        Object.freeze({
            key: "arrival",
            number: 2,
            name: "Mrhacker's Arrival",
            requiredLevel: 200,
            prerequisite: "crew",
            bossName: "Mrhacker (with gauntlet)",
            stages: Object.freeze([
                "challenge_arrival_kdc",
                "challenge_arrival_thezdrink",
                "challenge_arrival_shadow",
                "challenge_arrival_beyondborder",
                "challenge_arrival_kape",
                "challenge_arrival_mizuki",
                "challenge_arrival_mrhacker"
            ]),
            firstReward:
                rewardBundle({
                    xp: 2000000000,
                    shards: 500000,
                    chests: [
                        {tier: "boss", amount: 1}
                    ],
                    boosts: [
                        {
                            boostType: "luck",
                            tier: "omega",
                            amount: 2
                        },
                        {
                            boostType: "xp",
                            tier: "infinity",
                            amount: 5
                        },
                        {
                            boostType: "rune",
                            tier: "tier3",
                            amount: 25
                        }
                    ],
                    unlockFight: true,
                }),
            repeatReward:
                rewardBundle({
                    xp: 75000000,
                    shards: 15000,
                    chests: [
                        {tier: "boss", amount: 1}
                    ],
                    boosts: [
                        {
                            boostType: "rune",
                            tier: "tier3",
                            amount: 6
                        },
                        {
                            boostType: "rune",
                            tier: "tier2",
                            amount: 15
                        },
                        {
                            boostType: "luck",
                            tier: "tier3",
                            amount: 5
                        }
                    ]
                })
        }),
        Object.freeze({
            key: "conclusion",
            number: 3,
            name: "Mrhacker's Conclusion",
            requiredLevel: 300,
            prerequisite: "arrival",
            bossName: "beyondborder_08386 (with gauntlet)",
            stages: Object.freeze([
                "challenge_conclusion_kape",
                "challenge_conclusion_gorjezz",
                "challenge_conclusion_shadow",
                "challenge_conclusion_thezdrink",
                "challenge_conclusion_mrhacker",
                "challenge_conclusion_frampto",
                "challenge_conclusion_beyondborder"
            ]),
            firstReward:
                rewardBundle({
                    xp: 10000000000,
                    shards: 2000000,
                    chests: [
                        {tier: "boss", amount: 1}
                    ],
                    boosts: [
                        {
                            boostType: "luck",
                            tier: "omega",
                            amount: 5
                        },
                        {
                            boostType: "xp",
                            tier: "infinity",
                            amount: 20
                        },
                        {
                            boostType: "rune",
                            tier: "tier3",
                            amount: 50
                        }
                    ],
                    freeUpgradeTokens: 1
                }),
            repeatReward:
                rewardBundle({
                    xp: 300000000,
                    shards: 100000,
                    chests: [
                        {tier: "boss", amount: 1}
                    ],
                    boosts: [
                        {
                            boostType: "rune",
                            tier: "tier3",
                            amount: 15
                        },
                        {
                            boostType: "rune",
                            tier: "tier2",
                            amount: 40
                        },
                        {
                            boostType: "luck",
                            tier: "tier3",
                            amount: 12
                        }
                    ]
                })
        })
    ]);


const CHALLENGE_BY_KEY =
    new Map(
        BOSS_CHALLENGES.map(challenge => [
            challenge.key,
            challenge
        ])
    );


const CHALLENGE_BY_NUMBER =
    new Map(
        BOSS_CHALLENGES.map(challenge => [
            challenge.number,
            challenge
        ])
    );


function getBossChallenge(value){

    if(Number.isInteger(Number(value))){
        return CHALLENGE_BY_NUMBER.get(
            Number(value)
        ) || null;
    }


    return CHALLENGE_BY_KEY.get(
        String(value || "")
            .trim()
            .toLowerCase()
    ) || null;

}


function formatRewardBundle(bundle){

    const parts = [];


    if(Number(bundle?.xp) > 0){
        parts.push(
            `**${Number(bundle.xp).toLocaleString("en-US")} XP**`
        );
    }


    for(const boost of bundle?.boosts || []){

        const label = {
            "luck:tier3": REWARD_LABELS.luckTier3,
            "luck:max": REWARD_LABELS.luckMax,
            "luck:omega": REWARD_LABELS.luckOmega,
            "xp:max": REWARD_LABELS.xpMax,
            "xp:infinity": REWARD_LABELS.xpInfinity,
            "rune:tier2": REWARD_LABELS.runeTier2,
            "rune:tier3": REWARD_LABELS.runeTier3
        }[`${boost.boostType}:${boost.tier}`]
        || `**${boost.boostType}:${boost.tier}**`;


        parts.push(
            `**${Number(boost.amount).toLocaleString("en-US")}x** ${label}`
        );

    }


    if(bundle?.unlockFight){
        parts.push("Unlock **!fight** permanently");
    }


    if(Number(bundle?.freeUpgradeTokens) > 0){
        parts.push(
            `**${Number(bundle.freeUpgradeTokens)} free upgrade**`
        );
    }


    if(Number(bundle?.shards) > 0){
        parts.push(
            `**${Number(bundle.shards).toLocaleString("en-US")} boss shards**`
        );
    }


    for(const chest of bundle?.chests || []){
        parts.push(
            `**${Number(chest.amount).toLocaleString("en-US")}x** :boss_chest: Boss Chest`
        );
    }


    return parts.join(" • ") || "No rewards";

}


module.exports = {
    CHALLENGE_BATTLE_DURATION_MS,
    REWARD_LABELS,
    BOSS_CHALLENGES,
    getBossChallenge,
    formatRewardBundle
};
