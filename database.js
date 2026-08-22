const { Pool } = require("pg");



// =======================
// DATABASE CONNECTION
// =======================

const DATABASE_URL =
    String(
        process.env.DATABASE_URL || ""
    ).trim();


if(!DATABASE_URL){

    throw new Error(
        "DATABASE_URL is missing. Add a PostgreSQL reference variable to the bot service."
    );

}


const db = new Pool({

    connectionString:
        DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    },

    max:10,

    connectionTimeoutMillis:
        15000,

    idleTimeoutMillis:
        30000,

    keepAlive:
        true,

    keepAliveInitialDelayMillis:
        10000

});


// pg emits an "error" event when an idle pooled connection is
// unexpectedly killed by the database. Without this listener Node treats
// it as an unhandled error and crashes the entire bot.
db.on("error", error => {

    console.error(
        "PostgreSQL pooled connection was interrupted. The pool will reconnect on the next query:"
    );

    console.error(
        error?.message || error
    );

});


const TRANSIENT_DATABASE_CODES =
    new Set([
        "08000",
        "08001",
        "08003",
        "08004",
        "08006",
        "08007",
        "08P01",
        "57P01",
        "57P02",
        "57P03",
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "EHOSTUNREACH",
        "ENETUNREACH",
        "ENOTFOUND"
    ]);


function isTransientDatabaseError(error){

    const code =
        String(
            error?.code || ""
        ).toUpperCase();


    if(
        TRANSIENT_DATABASE_CODES.has(code)
        ||
        code.startsWith("08")
    ){

        return true;

    }


    const message =
        String(
            error?.message || error || ""
        ).toLowerCase();


    return (
        message.includes("connection terminated unexpectedly")
        ||
        message.includes("connection terminated due to connection timeout")
        ||
        message.includes("connection timeout")
        ||
        message.includes("connection reset")
        ||
        message.includes("server closed the connection")
        ||
        message.includes("the database system is starting up")
        ||
        message.includes("cannot connect now")
    );

}


function wait(milliseconds){

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}

const userCache = new Map();

const CACHE_TIME = 30000;


// Every !roll uses exactly 30 seconds, including complete Multi Roll batches.
// Keep this server-side so Luck tiers, reward durations, or callers cannot
// accidentally turn the gameplay cooldown into minutes or hours.
const ROLL_COOLDOWN_MS =
    30 * 1000;


// =====================================================
// LEVEL 1-99 PROTECTION
// =====================================================
//
// Current leveling formula reaches Level 100 at:
// (100 - 1)^2 * 250 = 2,450,250 total XP.
//
// Kept here instead of importing utils/xp.js because
// utils/xp.js -> utils/luck.js -> database.js would create
// a circular dependency.
const LEVEL_100_XP_THRESHOLD =
    Math.pow(99, 2) * 250;


const LOW_LEVEL_TRADE_INCOMING_XP_CAP =
    100000;


// =======================
// GLOBAL BOOST SHOP
// =======================

const SHOP_REFRESH_TIME =
    2 * 60 * 60 * 1000;


const SHOP_CATALOG = {

    "xp:tier1": {
        key: "xp:tier1",
        boostType: "xp",
        tier: "tier1",
        price: 29999,
        maxStock: 5
    },

    "xp:tier2": {
        key: "xp:tier2",
        boostType: "xp",
        tier: "tier2",
        price: 79999,
        maxStock: 3
    },

    "xp:max": {
        key: "xp:max",
        boostType: "xp",
        tier: "max",
        price: 999999,
        maxStock: 2
    },

    "luck:tier1": {
        key: "luck:tier1",
        boostType: "luck",
        tier: "tier1",
        price: 19999,
        maxStock: 15
    },

    "luck:tier2": {
        key: "luck:tier2",
        boostType: "luck",
        tier: "tier2",
        price: 99999,
        maxStock: 15
    },

    "luck:tier3": {
        key: "luck:tier3",
        boostType: "luck",
        tier: "tier3",
        price: 999999,
        maxStock: 5
    },

    "luck:max": {
        key: "luck:max",
        boostType: "luck",
        tier: "max",
        price: 2499999,
        maxStock: 2
    }

};


// Random prices are chosen ONCE per shop refresh and then stored
// in PostgreSQL for the whole shop cycle.
const SHOP_PRICE_OPTIONS = {

    "xp:tier1": [
        29999,
        49999,
        74499
    ],

    "xp:tier2": [
        79999,
        119999,
        144999
    ],

    "xp:max": [
        999999,
        1499999,
        2499999
    ],

    "luck:tier1": [
        19999,
        34999,
        69999
    ],

    "luck:tier2": [
        99999,
        124999,
        249999
    ],

    "luck:tier3": [
        999999,
        1999999,
        4999999
    ],

    "luck:max": [
        2499999,
        7499999,
        12499999
    ]

};


function getRandomShopPrice(item){

    const options =
        SHOP_PRICE_OPTIONS[item.key];


    if(
        !Array.isArray(options)
        ||
        options.length === 0
    ){

        return item.price;

    }


    return options[
        Math.floor(
            Math.random() *
            options.length
        )
    ];

}


// ==============================
// TRAVELING MERCHANT
// ==============================
//
// One appearance roll happens per real shop refresh while
// shop_state is locked. A successful visit lasts one hour (or until
// the current shop cycle ends, whichever comes first). While the
// merchant is visiting, his six global deals and their stock keep
// rotating independently every 30 minutes.

const TRAVELING_MERCHANT_CHANCE =
    0.30;


const TRAVELING_MERCHANT_DEALS_PER_VISIT =
    6;


const TRAVELING_MERCHANT_REFRESH_TIME =
    30 * 60 * 1000;


const TRAVELING_MERCHANT_VISIT_TIME =
    60 * 60 * 1000;


const MERCHANT_HOUR =
    60 * 60 * 1000;


function merchantBoost(
    boostType,
    tier,
    amount
){

    return {
        boostType,
        tier,
        amount
    };

}


function merchantSide({
    xp = 0,
    boosts = [],
    perk = null
} = {}){

    return {
        xp,
        boosts,
        perk
    };

}


const TRAVELING_MERCHANT_DEAL_TEMPLATES = [

    {
        id: "luck_i_cache",
        name: "Overgrown Luck Cache",
        stockOptions: [5],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "tier1", 100)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "tier1", 250)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "tier1", 300)
                    ]
                })
            }
        ]
    },

    {
        id: "xp_luck_iii_bundle",
        name: "Fortune and Experience Bundle",
        stockOptions: [10],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 1)
                    ]
                }),
                reward: merchantSide({
                    xp: 1000000,
                    boosts: [
                        merchantBoost("luck", "tier3", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 2)
                    ]
                }),
                reward: merchantSide({
                    xp: 2000000,
                    boosts: [
                        merchantBoost("luck", "tier3", 2)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 4)
                    ]
                }),
                reward: merchantSide({
                    xp: 3500000,
                    boosts: [
                        merchantBoost("luck", "tier3", 2)
                    ]
                })
            }
        ]
    },

    {
        id: "omega_fortune_bundle",
        name: "Omega Fortune Bundle",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    xp: 5000000,
                    boosts: [
                        merchantBoost("luck", "max", 10)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    xp: 10000000,
                    boosts: [
                        merchantBoost("luck", "max", 20)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    xp: 20000000,
                    boosts: [
                        merchantBoost("luck", "max", 35)
                    ]
                })
            }
        ]
    },

    {
        id: "sell_omega_for_xp",
        name: "Omega Liquidation",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    xp: 50000000
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    xp: 125000000
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    xp: 175000000
                })
            }
        ]
    },

    {
        id: "buy_omega_with_xp",
        name: "Experience-for-Omega Exchange",
        stockOptions: [3],
        variants: [
            {
                cost: merchantSide({
                    xp: 50000000
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    xp: 100000000
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    xp: 250000000
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                })
            }
        ]
    },

    {
        id: "buy_omega_with_luck_max",
        name: "MAX-for-Omega Exchange",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 20)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 40)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 69)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                })
            }
        ]
    },

    {
        id: "luck_iii_upgrade",
        name: "Luck Tier Upgrade",
        stockOptions: [5],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "tier3", 3)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "tier3", 5)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 2)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "tier3", 10)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 2)
                    ]
                })
            }
        ]
    },

    {
        id: "omega_for_xp_infinity",
        name: "Omega-for-Infinity Exchange",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 2)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 3)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 5)
                    ]
                })
            }
        ]
    },

    {
        id: "luck_max_for_xp_infinity",
        name: "Fortune-for-Infinity Exchange",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 15)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 2)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 30)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 3)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 30)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 5)
                    ]
                })
            }
        ]
    },

    {
        id: "xp_infinity_for_luck_max",
        name: "Infinity-for-Fortune Exchange",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 7)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 10)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 12)
                    ]
                })
            }
        ]
    },

    {
        id: "buy_xp_infinity_with_xp",
        name: "Experience-for-Infinity Exchange",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    xp: 40000000
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    xp: 60000000
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    xp: 90000000
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                })
            }
        ]
    },

    {
        id: "timed_infinity_chat_xp",
        name: "Infinity Chat XP Surge",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type: "chat_xp_timed",
                        multiplier: 10,
                        durationMs:
                            12 * MERCHANT_HOUR
                    }
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 2)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type: "chat_xp_timed",
                        multiplier: 20,
                        durationMs:
                            24 * MERCHANT_HOUR
                    }
                })
            }
        ]
    },

    {
        id: "xp_infinity_for_xp_max",
        name: "Infinity-to-MAX Cache",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "max", 20)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "max", 35)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "max", 50)
                    ]
                })
            }
        ]
    },

    {
        id: "xp_infinity_for_omega",
        name: "Infinity-for-Omega Exchange",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 5)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 5)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 2)
                    ]
                })
            }
        ]
    },

    {
        id: "xp_i_for_xp_infinity",
        name: "XP I-for-Infinity Exchange",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "tier1", 250)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 1)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "tier1", 500)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 2)
                    ]
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("xp", "tier1", 1000)
                    ]
                }),
                reward: merchantSide({
                    boosts: [
                        merchantBoost("xp", "infinity", 2)
                    ]
                })
            }
        ]
    },

    {
        id: "timed_triple_roll",
        name: "Temporary Triple Roll License",
        stockOptions: [1, 2],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 5)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type: "multi_roll_timed",
                        rollCount: 3,
                        durationMs:
                            24 * MERCHANT_HOUR
                    }
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 10)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type: "multi_roll_timed",
                        rollCount: 3,
                        durationMs:
                            48 * MERCHANT_HOUR
                    }
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "max", 15)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type: "multi_roll_timed",
                        rollCount: 3,
                        durationMs:
                            48 * MERCHANT_HOUR
                    }
                })
            }
        ]
    },

    {
        id: "permanent_double_chat_xp",
        name: "Permanent Double Chat XP",
        stockOptions: [1],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 2)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type:
                            "chat_xp_permanent",
                        multiplier: 2
                    }
                })
            }
        ]
    },

    {
        id: "permanent_triple_roll",
        name: "Permanent Triple Roll License",
        stockOptions: [1],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 2)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type:
                            "multi_roll_permanent",
                        rollCount: 3
                    }
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 3)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type:
                            "multi_roll_permanent",
                        rollCount: 3
                    }
                })
            }
        ]
    },

    {
        id: "timed_nine_roll",
        name: "Nine-Roll License",
        stockOptions: [1],
        variants: [
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type: "multi_roll_timed",
                        rollCount: 9,
                        durationMs:
                            48 * MERCHANT_HOUR
                    }
                })
            },
            {
                cost: merchantSide({
                    boosts: [
                        merchantBoost("luck", "omega", 1)
                    ]
                }),
                reward: merchantSide({
                    perk: {
                        type: "multi_roll_timed",
                        rollCount: 9,
                        durationMs:
                            72 * MERCHANT_HOUR
                    }
                })
            }
        ]
    }

];


function safeMerchantRandom(random){

    const value =
        Number(
            random()
        );


    if(!Number.isFinite(value)){
        return 0;
    }


    return Math.min(
        0.999999999,
        Math.max(
            0,
            value
        )
    );

}


function pickMerchantOption(
    options,
    random
){

    return options[
        Math.floor(
            safeMerchantRandom(random) *
            options.length
        )
    ];

}


function cloneMerchantSide(side){

    return {

        xp:
            Math.max(
                0,
                Number(side?.xp) || 0
            ),

        boosts:
            Array.isArray(side?.boosts)
                ? side.boosts.map(
                    boost => ({
                        boostType:
                            String(
                                boost.boostType
                            ).toLowerCase(),
                        tier:
                            String(
                                boost.tier
                            ).toLowerCase(),
                        amount:
                            Math.max(
                                1,
                                Math.floor(
                                    Number(
                                        boost.amount
                                    ) || 1
                                )
                            )
                    })
                )
                : [],

        perk:
            side?.perk
                ? {
                    ...side.perk
                }
                : null

    };

}


function createTravelingMerchantDeals(
    random = Math.random
){

    const shuffled =
        [
            ...TRAVELING_MERCHANT_DEAL_TEMPLATES
        ];


    for(
        let index =
            shuffled.length - 1;
        index > 0;
        index--
    ){

        const swapIndex =
            Math.floor(
                safeMerchantRandom(random) *
                (index + 1)
            );


        [
            shuffled[index],
            shuffled[swapIndex]
        ] = [
            shuffled[swapIndex],
            shuffled[index]
        ];

    }


    return shuffled
        .slice(
            0,
            Math.min(
                TRAVELING_MERCHANT_DEALS_PER_VISIT,
                shuffled.length
            )
        )
        .map((template, index) => {

            const variant =
                pickMerchantOption(
                    template.variants,
                    random
                );


            const maxStock =
                Number(
                    pickMerchantOption(
                        template.stockOptions,
                        random
                    )
                );


            return {
                id: template.id,
                name: template.name,
                displayOrder:
                    index + 1,
                maxStock,
                cost:
                    cloneMerchantSide(
                        variant.cost
                    ),
                reward:
                    cloneMerchantSide(
                        variant.reward
                    )
            };

        });

}


function rollTravelingMerchantAppearance(
    random = Math.random
){

    return (
        safeMerchantRandom(random) <
        TRAVELING_MERCHANT_CHANCE
    );

}






// =======================
// TRADING SYSTEM
// =======================

const TRADE_BASE_FEE = 1000;
const TRADE_XP_FEE_RATE = 0.05;

const TRADE_BOOST_FEES = {

    "xp:tier1": 100,
    "xp:tier2": 500,
    "xp:max": 10000,
    "xp:infinity": 100000,

    "luck:tier1": 500,
    "luck:tier2": 4000,
    "luck:tier3": 50000,
    "luck:max": 125000

};

const TRADE_ALLOWED_BOOST_KEYS =
    new Set(
        Object.keys(
            TRADE_BOOST_FEES
        )
    );


function normalizeTradeOffer(offer){

    const raw =
        offer &&
        typeof offer === "object"
            ? offer
            : {};


    const xp =
        Math.max(
            0,
            Math.floor(
                Number(raw.xp) || 0
            )
        );


    const boosts = {};

    const rawBoosts =
        raw.boosts &&
        typeof raw.boosts === "object"
            ? raw.boosts
            : {};


    for(
        const [key, amount] of
        Object.entries(rawBoosts)
    ){

        const normalizedKey =
            String(key).toLowerCase();

        if(
            !TRADE_ALLOWED_BOOST_KEYS.has(
                normalizedKey
            )
        ){

            continue;

        }


        const safeAmount =
            Math.max(
                0,
                Math.floor(
                    Number(amount) || 0
                )
            );


        if(safeAmount > 0){

            boosts[normalizedKey] =
                safeAmount;

        }

    }


    return {
        xp,
        boosts
    };

}


function isTradeOfferEmpty(offer){

    const normalized =
        normalizeTradeOffer(
            offer
        );


    return (
        normalized.xp <= 0
        &&
        Object.keys(
            normalized.boosts
        ).length === 0
    );

}


function calculateTradeFee(offer){

    const normalized =
        normalizeTradeOffer(
            offer
        );


    const xpFee =
        Math.ceil(
            normalized.xp *
            TRADE_XP_FEE_RATE
        );


    let boostFee = 0;

    for(
        const [key, amount] of
        Object.entries(
            normalized.boosts
        )
    ){

        boostFee +=
            (
                TRADE_BOOST_FEES[key] || 0
            ) *
            amount;

    }


    return {

        baseFee:
            TRADE_BASE_FEE,

        xpFee,

        boostFee,

        total:
            TRADE_BASE_FEE +
            xpFee +
            boostFee

    };

}


function parseTradeRow(row){

    if(!row)
        return null;


    return {

        ...row,

        id:
            Number(row.id),

        user1offer:
            normalizeTradeOffer(
                row.user1offer
            ),

        user2offer:
            normalizeTradeOffer(
                row.user2offer
            ),

        user1confirmed:
            Boolean(
                row.user1confirmed
            ),

        user2confirmed:
            Boolean(
                row.user2confirmed
            ),

        cleaned:
            Boolean(
                row.cleaned
            )

    };

}


// =======================
// CREATE TABLES
// =======================

async function createTables(){

await db.query(`

    ALTER TABLE users

    ADD COLUMN IF NOT EXISTS
    currentCriticalStreak INTEGER DEFAULT 0

`);


await db.query(`

    ALTER TABLE users

    ADD COLUMN IF NOT EXISTS
    bestCriticalStreak INTEGER DEFAULT 0

`);


await db.query(`

    ALTER TABLE users

    ADD COLUMN IF NOT EXISTS
    rollGuaranteeProgress INTEGER NOT NULL DEFAULT 0

`);

await db.query(`

    CREATE TABLE IF NOT EXISTS command_cooldowns (

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        commandName TEXT NOT NULL,

        expiresAt BIGINT NOT NULL,

        PRIMARY KEY(
            guildID,
            userID,
            commandName
        )

    )

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS xp_logs (

        id SERIAL PRIMARY KEY,

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        amount INTEGER NOT NULL,

        critical BOOLEAN DEFAULT FALSE,

        criticalStreak INTEGER DEFAULT 0,

        criticalMultiplier INTEGER DEFAULT 1,

        source TEXT DEFAULT 'message',

        timestamp BIGINT NOT NULL

    )

`);


// Positive XP earned after this update is recorded here so the bot can
// build rolling weekly and monthly leaderboards. Spending or losing XP does
// not erase XP that was legitimately earned during the selected period.
await db.query(`

    CREATE TABLE IF NOT EXISTS leaderboard_xp_activity (

        id BIGSERIAL PRIMARY KEY,

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        amount BIGINT NOT NULL,

        timestamp BIGINT NOT NULL

    )

`);


await db.query(`

    CREATE INDEX IF NOT EXISTS
    leaderboard_xp_activity_period_idx

    ON leaderboard_xp_activity(
        guildID,
        timestamp,
        userID
    )

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS luck_boosts (

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        role TEXT NOT NULL,

        expiresAt BIGINT NOT NULL,

        PRIMARY KEY(
            guildID,
            userID
        )

    )

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS boost_inventory (

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        boostType TEXT NOT NULL,

        tier TEXT NOT NULL,

        amount INTEGER NOT NULL DEFAULT 0,

        PRIMARY KEY(
            guildID,
            userID,
            boostType,
            tier
        )

    )

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS user_message_preferences (

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        muteXPBoostMessages BOOLEAN NOT NULL
            DEFAULT FALSE,

        muteCriticalMessages BOOLEAN NOT NULL
            DEFAULT FALSE,

        PRIMARY KEY(
            guildID,
            userID
        )

    )

`);


// Hourly XP remains in boost_activity, but the removed threshold/tier-award
// system and all of its saved progress are deleted permanently.
await db.query(`

    DROP TABLE IF EXISTS xp_boost_progress

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS shop_state (

        id SMALLINT PRIMARY KEY,

        nextRefreshAt BIGINT NOT NULL

    )

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS shop_stock (

        boostType TEXT NOT NULL,

        tier TEXT NOT NULL,

        amount INTEGER NOT NULL DEFAULT 0,

        maxAmount INTEGER NOT NULL DEFAULT 0,

        price BIGINT,

        PRIMARY KEY(
            boostType,
            tier
        )

    )

`);


await db.query(`

    ALTER TABLE shop_stock

    ADD COLUMN IF NOT EXISTS
    price BIGINT

`);


await db.query(`

    INSERT INTO shop_state
    (
        id,
        nextRefreshAt
    )

    VALUES
    (1,$1)

    ON CONFLICT(id)
    DO NOTHING

`, [
    Date.now() + SHOP_REFRESH_TIME
]);


await db.query(`

    CREATE TABLE IF NOT EXISTS
    traveling_merchant_state (

        id SMALLINT PRIMARY KEY,

        active BOOLEAN NOT NULL
            DEFAULT FALSE,

        cycleID BIGINT NOT NULL
            DEFAULT 0,

        startedAt BIGINT NOT NULL
            DEFAULT 0,

        endsAt BIGINT NOT NULL
            DEFAULT 0,

        nextRestockAt BIGINT NOT NULL
            DEFAULT 0

    )

`);


await db.query(`

    INSERT INTO traveling_merchant_state
    (
        id,
        active,
        cycleID,
        startedAt,
        endsAt
    )

    VALUES
    (1,FALSE,0,0,0)

    ON CONFLICT(id)
    DO NOTHING

`);


await db.query(`

    ALTER TABLE traveling_merchant_state

    ADD COLUMN IF NOT EXISTS
    nextRestockAt BIGINT NOT NULL DEFAULT 0

`);


// Existing visits created before 30-minute merchant restocks were
// added get their first faster restock no later than 30 minutes after
// this version starts. New visits set this value during the shop roll.
await db.query(`

    UPDATE traveling_merchant_state

    SET nextRestockAt =
        CASE
            WHEN active = TRUE
            AND endsAt > $1
            THEN LEAST(
                endsAt,
                $1 + $2
            )
            ELSE endsAt
        END

    WHERE nextRestockAt <= 0

`, [
    Date.now(),
    TRAVELING_MERCHANT_REFRESH_TIME
]);


await db.query(`

    CREATE TABLE IF NOT EXISTS
    traveling_merchant_stock (

        cycleID BIGINT NOT NULL,

        dealID TEXT NOT NULL,

        displayOrder INTEGER NOT NULL,

        deal JSONB NOT NULL,

        amount INTEGER NOT NULL
            DEFAULT 0,

        maxAmount INTEGER NOT NULL
            DEFAULT 0,

        PRIMARY KEY(
            cycleID,
            dealID
        )

    )

`);


await db.query(`

    CREATE INDEX IF NOT EXISTS
    traveling_merchant_stock_order_idx

    ON traveling_merchant_stock(
        cycleID,
        displayOrder
    )

`);


// =====================================================
// XP BOOST REMAKE MIGRATION
// =====================================================
// Preserve Tier I, Tier II and MAX inventories (including large existing
// stockpiles), but fully retire XP Boost III. The current shop and merchant
// are allowed to supply the three active shop tiers and XP Boost Infinity.
await db.query(`

    DELETE FROM boost_inventory

    WHERE LOWER(boostType) = 'xp'
    AND LOWER(tier) = 'tier3'

`);


await db.query(`

    DELETE FROM boosts

    WHERE role = '1526995123420922047'

`);


await db.query(`

    DELETE FROM shop_stock

    WHERE LOWER(boostType) = 'xp'
    AND LOWER(tier) = 'tier3'

`);


await db.query(`

    DELETE FROM traveling_merchant_stock

    WHERE EXISTS (

        SELECT 1

        FROM jsonb_array_elements(
            COALESCE(
                deal -> 'reward' -> 'boosts',
                '[]'::jsonb
            )
        ) AS rewardBoost

        WHERE LOWER(
            rewardBoost ->> 'boostType'
        ) = 'xp'
        AND LOWER(
            rewardBoost ->> 'tier'
        ) = 'tier3'

    )

    OR EXISTS (

        SELECT 1

        FROM jsonb_array_elements(
            COALESCE(
                deal -> 'cost' -> 'boosts',
                '[]'::jsonb
            )
        ) AS costBoost

        WHERE LOWER(
            costBoost ->> 'boostType'
        ) = 'xp'
        AND LOWER(
            costBoost ->> 'tier'
        ) = 'tier3'

    )

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS quest_cycles (

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        cycleType TEXT NOT NULL,

        cycleKey TEXT NOT NULL,

        expiresAt BIGINT NOT NULL,

        quests JSONB NOT NULL,

        rewards JSONB NOT NULL,

        rewarded BOOLEAN NOT NULL DEFAULT FALSE,

        rewardedAt BIGINT,

        resetCount INTEGER NOT NULL DEFAULT 0,

        PRIMARY KEY(
            guildID,
            userID,
            cycleType,
            cycleKey
        )

    )

`);


await db.query(`

    ALTER TABLE quest_cycles

    ADD COLUMN IF NOT EXISTS
    resetCount INTEGER NOT NULL DEFAULT 0

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS quest_effects (

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        guaranteed25k75k INTEGER NOT NULL DEFAULT 0,

        guaranteedImpossible INTEGER NOT NULL DEFAULT 0,

        guaranteed250k INTEGER NOT NULL DEFAULT 0,

        guaranteed500k INTEGER NOT NULL DEFAULT 0,

        guaranteed1m INTEGER NOT NULL DEFAULT 0,

        guaranteed10m INTEGER NOT NULL DEFAULT 0,

        guaranteed15m INTEGER NOT NULL DEFAULT 0,

        guaranteed25m INTEGER NOT NULL DEFAULT 0,

        nextRollBurst10 INTEGER NOT NULL DEFAULT 0,

        nextRollBurst20 INTEGER NOT NULL DEFAULT 0,

        nextRollBurst50 INTEGER NOT NULL DEFAULT 0,

        tripleRollUntil BIGINT NOT NULL DEFAULT 0,

        multiRollUntil BIGINT NOT NULL DEFAULT 0,

        multiRollCount INTEGER NOT NULL DEFAULT 1,

        rollWindowEndsAt BIGINT NOT NULL DEFAULT 0,

        rollWindowUses INTEGER NOT NULL DEFAULT 0,

        chatXP2Until BIGINT NOT NULL DEFAULT 0,

        chatXP10Until BIGINT NOT NULL DEFAULT 0,

        chatXP20Until BIGINT NOT NULL DEFAULT 0,

        shopDiscount50Until BIGINT NOT NULL DEFAULT 0,

        shopDiscount90Until BIGINT NOT NULL DEFAULT 0,

        guaranteedCriticalsRemaining INTEGER NOT NULL DEFAULT 0,

        socialTripleUntil BIGINT NOT NULL DEFAULT 0,

        merchantPermanentChatXPMultiplier
            INTEGER NOT NULL DEFAULT 1,

        merchantPermanentRollCount
            INTEGER NOT NULL DEFAULT 1,

        merchantTimedRollCount
            INTEGER NOT NULL DEFAULT 1,

        merchantTimedRollUntil
            BIGINT NOT NULL DEFAULT 0,

        PRIMARY KEY(
            guildID,
            userID
        )

    )

`);


// Existing Railway databases already have quest_effects, so every new
// reward field is added safely without touching saved user progress.
await db.query(`

    ALTER TABLE quest_effects

    ADD COLUMN IF NOT EXISTS guaranteed250k INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS guaranteed500k INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS guaranteed1m INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS guaranteed10m INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS guaranteed15m INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS guaranteed25m INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nextRollBurst10 INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nextRollBurst20 INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS nextRollBurst50 INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS multiRollUntil BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS multiRollCount INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS rollWindowEndsAt BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rollWindowUses INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS chatXP2Until BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS chatXP10Until BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS chatXP20Until BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shopDiscount50Until BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shopDiscount90Until BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS guaranteedCriticalsRemaining INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS socialTripleUntil BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS merchantPermanentChatXPMultiplier INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS merchantPermanentRollCount INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS merchantTimedRollCount INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS merchantTimedRollUntil BIGINT NOT NULL DEFAULT 0

`);


// Repair cooldowns written by older builds that accidentally used a timed
// reward's remaining duration. A legitimate Multi Roll window can never be
// more than 30 seconds in the future. The reward expiry fields themselves
// are deliberately left alone.
await db.query(`

    UPDATE quest_effects

    SET
        rollWindowEndsAt = 0,
        rollWindowUses = 0

    WHERE rollWindowEndsAt > $1

`, [
    Date.now() + ROLL_COOLDOWN_MS
]);


// Older builds saved Luck-based !roll cooldowns lasting from several minutes
// to several hours. Clear only those invalid future roll timestamps so affected
// users can roll immediately after this build starts. Other command cooldowns
// are not touched.
await db.query(`

    UPDATE command_cooldowns

    SET expiresAt = 0

    WHERE commandName = 'roll'
    AND expiresAt > $1

`, [
    Date.now() + ROLL_COOLDOWN_MS
]);




await db.query(`

    CREATE TABLE IF NOT EXISTS trades (

        id BIGSERIAL PRIMARY KEY,

        guildID TEXT NOT NULL,

        user1ID TEXT NOT NULL,

        user2ID TEXT NOT NULL,

        status TEXT NOT NULL DEFAULT 'pending',

        channelID TEXT,

        roleID TEXT,

        panelMessageID TEXT,

        user1Offer JSONB NOT NULL
            DEFAULT '{"xp":0,"boosts":{}}'::jsonb,

        user2Offer JSONB NOT NULL
            DEFAULT '{"xp":0,"boosts":{}}'::jsonb,

        user1Confirmed BOOLEAN NOT NULL
            DEFAULT FALSE,

        user2Confirmed BOOLEAN NOT NULL
            DEFAULT FALSE,

        fee1 BIGINT NOT NULL DEFAULT 0,

        fee2 BIGINT NOT NULL DEFAULT 0,

        createdAt BIGINT NOT NULL,

        updatedAt BIGINT NOT NULL,

        expiresAt BIGINT NOT NULL,

        completedAt BIGINT,

        cancelledBy TEXT,

        failureReason TEXT,

        cleaned BOOLEAN NOT NULL
            DEFAULT FALSE

    )

`);


await db.query(`

    CREATE INDEX IF NOT EXISTS
    trades_open_user1_idx

    ON trades(
        guildID,
        user1ID,
        status
    )

`);


await db.query(`

    CREATE INDEX IF NOT EXISTS
    trades_open_user2_idx

    ON trades(
        guildID,
        user2ID,
        status
    )

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS moderation_bans (

        guildID TEXT NOT NULL,
        userID TEXT NOT NULL,
        moderatorID TEXT NOT NULL,
        reason TEXT NOT NULL,
        savedRoleIDs JSONB NOT NULL DEFAULT '[]'::jsonb,
        startedAt BIGINT NOT NULL,
        expiresAt BIGINT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        endedAt BIGINT,
        endedBy TEXT,

        PRIMARY KEY(guildID, userID)

    )

`);


await db.query(`

    CREATE INDEX IF NOT EXISTS moderation_bans_expiry_idx

    ON moderation_bans(active, expiresAt)

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS moderation_config (

        guildID TEXT PRIMARY KEY,
        panelMessageID TEXT

    )

`);


// Weekly/monthly rankings only need the most recent 30 days. Keep two extra
// days as a safety margin so this table stays small even on active servers.
await db.query(`

    DELETE FROM leaderboard_xp_activity

    WHERE timestamp < $1

`, [
    Date.now() -
    32 * 24 * 60 * 60 * 1000
]);


await db.query(`

    DELETE FROM quest_cycles

    WHERE expiresAt < $1

`, [
    Date.now() -
    14 * 24 * 60 * 60 * 1000
]);


for(const item of Object.values(SHOP_CATALOG)){

    const initialPrice =
        getRandomShopPrice(item);


    const allowedPrices =
        Array.isArray(
            SHOP_PRICE_OPTIONS[item.key]
        )
            ? SHOP_PRICE_OPTIONS[item.key]
            : [item.price];


    await db.query(`

        INSERT INTO shop_stock
        (
            boostType,
            tier,
            amount,
            maxAmount,
            price
        )

        VALUES
        ($1,$2,$3,$3,$4)

        ON CONFLICT(
            boostType,
            tier
        )

        DO UPDATE SET

            maxAmount = EXCLUDED.maxAmount,

            amount =
                CASE
                    WHEN shop_stock.maxAmount <>
                        EXCLUDED.maxAmount
                    THEN EXCLUDED.maxAmount
                    ELSE LEAST(
                        shop_stock.amount,
                        EXCLUDED.maxAmount
                    )
                END,

            price =
                CASE
                    WHEN shop_stock.price IS NULL
                    OR shop_stock.price <= 0
                    OR NOT (
                        shop_stock.price =
                        ANY($5::BIGINT[])
                    )
                    THEN EXCLUDED.price
                    ELSE shop_stock.price
                END

    `, [
        item.boostType,
        item.tier,
        item.maxStock,
        initialPrice,
        allowedPrices
    ]);

}


}




async function initDatabase() {

    let attempt =
        0;


    while(true){

        try{

            // Fail here with a clear connection error before attempting the
            // schema queries. Pool automatically replaces dead connections.
            await db.query(
                "SELECT 1"
            );


            await createTables();


            console.log(
                "✅ PostgreSQL database ready"
            );


            return;

        }
        catch(error){

            console.error(
                "FAILED TO INITIALIZE POSTGRESQL"
            );

            console.error(
                error?.message || error
            );


            // SQL/schema/authentication errors should remain fatal because
            // retrying them forever would hide a real configuration bug.
            if(!isTransientDatabaseError(error)){

                throw error;

            }


            attempt++;


            const retryDelay =
                Math.min(
                    60000,
                    2000 *
                    Math.pow(
                        2,
                        Math.min(
                            attempt - 1,
                            5
                        )
                    )
                );


            console.error(
                `PostgreSQL is unavailable. Retrying in ${Math.ceil(retryDelay / 1000)} seconds (attempt ${attempt})...`
            );


            await wait(
                retryDelay
            );

        }

    }

}






// =====================================================
// USER SYSTEM
// =====================================================


async function createUser(
    guildID,
    userID
){


    await db.query(`

    INSERT INTO users
    (
        guildID,
        userID
    )

    VALUES
    ($1,$2)


    ON CONFLICT DO NOTHING

    `,
    [
        guildID,
        userID
    ]);

}





async function getUser(
    guildID,
    userID
){

    const key =
        `${guildID}:${userID}`;


// CACHE DISABLED



    // Create user if missing

    await db.query(`

    INSERT INTO users
    (
        guildID,
        userID
    )

    VALUES($1,$2)

    ON CONFLICT DO NOTHING

    `,
    [
        guildID,
        userID
    ]);




    // Get user

    const result =
        await db.query(`

        SELECT *

        FROM users

        WHERE guildID=$1

        AND userID=$2

        `,
        [
            guildID,
            userID
        ]);



    const user =
        result.rows[0];



    return user;

}






async function addXP(
    guildID,
    userID,
    amount
){

    await db.query(`

    INSERT INTO users
    (
        guildID,
        userID
    )

    VALUES($1,$2)

    ON CONFLICT DO NOTHING

    `,
    [
        guildID,
        userID
    ]);




await db.query(`

WITH updated_user AS (

    UPDATE users

    SET

    xp = GREATEST(0, xp + $3),

    messages = messages + 1


    WHERE guildID=$1

    AND userID=$2

    RETURNING guildID, userID

)

INSERT INTO leaderboard_xp_activity
(
    guildID,
    userID,
    amount,
    timestamp
)

SELECT
    guildID,
    userID,
    $3,
    $4

FROM updated_user

WHERE $3 > 0

`,
[
    guildID,
    userID,
    amount,
    Date.now()
]);



    userCache.delete(
        `${guildID}:${userID}`
    );

}






async function giveXP(
    guildID,
    userID,
    amount
){


    await createUser(
        guildID,
        userID
    );


    await db.query(`

    WITH updated_user AS (

        UPDATE users

        SET xp = xp + $3


        WHERE guildID=$1
        AND userID=$2

        RETURNING guildID, userID

    )

    INSERT INTO leaderboard_xp_activity
    (
        guildID,
        userID,
        amount,
        timestamp
    )

    SELECT
        guildID,
        userID,
        $3,
        $4

    FROM updated_user

    WHERE $3 > 0


    `,
    [
        guildID,
        userID,
        amount,
        Date.now()
    ]);

}







async function setXP(
    guildID,
    userID,
    amount
){


    await createUser(
        guildID,
        userID
    );


    await db.query(`

    UPDATE users

    SET xp=$3


    WHERE guildID=$1
    AND userID=$2


    `,
    [
        guildID,
        userID,
        amount
    ]);

}







async function setLevel(
    guildID,
    userID,
    level
){


    await createUser(
        guildID,
        userID
    );


    await db.query(`

    UPDATE users

    SET level=$3


    WHERE guildID=$1
    AND userID=$2


    `,
    [
        guildID,
        userID,
        level
    ]);

}







// =====================================================
// LEADERBOARD
// =====================================================


async function getLeaderboard(
    guildID,
    limit = 10
){


    const result =
        await db.query(`

        SELECT *

        FROM users

        WHERE guildID=$1

        ORDER BY xp DESC

        LIMIT $2


        `,
        [
            guildID,
            limit
        ]);


    return result.rows;

}




async function getPeriodLeaderboard(
    guildID,
    period,
    limit = 10
){


    const durations = {

        weekly:
            7 * 24 * 60 * 60 * 1000,

        monthly:
            30 * 24 * 60 * 60 * 1000

    };


    const duration =
        durations[
            String(period).toLowerCase()
        ];


    if(!duration){

        throw new Error(
            `Unknown leaderboard period: ${period}`
        );

    }


    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 10,
                25
            )
        );


    const result =
        await db.query(`

            SELECT

                activity.userID,

                SUM(activity.amount)::BIGINT
                    AS "periodXP",

                users.xp,

                users.level

            FROM leaderboard_xp_activity
                AS activity

            INNER JOIN users

                ON users.guildID =
                    activity.guildID

                AND users.userID =
                    activity.userID

            WHERE activity.guildID=$1

            AND activity.timestamp >= $2

            GROUP BY

                activity.userID,

                users.xp,

                users.level

            ORDER BY

                SUM(activity.amount) DESC,

                users.xp DESC,

                activity.userID ASC

            LIMIT $3


        `, [
            guildID,
            Date.now() - duration,
            safeLimit
        ]);


    return result.rows;

}






// =====================================================
// BOOST XP TRACKING
// =====================================================


async function addBoostActivity(
    guildID,
    userID,
    xp
){


    await db.query(`

    INSERT INTO boost_activity

    (
        guildID,
        userID,
        xp,
        timestamp
    )


    VALUES

    ($1,$2,$3,$4)


    `,
    [
        guildID,
        userID,
        xp,
        Date.now()
    ]);

}





async function clearOldBoostActivity(){


    await db.query(`

    DELETE FROM boost_activity

    WHERE timestamp < $1

    `,
    [
        Date.now() - 60*60*1000
    ]);

}







async function getHourlyBoostXP(
    guildID,
    userID
){


    await clearOldBoostActivity();


    const result =
        await db.query(`

        SELECT SUM(xp) AS total

        FROM boost_activity

        WHERE guildID=$1

        AND userID=$2


        `,
        [
            guildID,
            userID
        ]);


    return Number(
        result.rows[0].total || 0
    );

}


async function resetHourlyBoostXP(
    guildID,
    userID
){

    await db.query(`

    DELETE FROM boost_activity

    WHERE guildID=$1

    AND userID=$2


    `,
    [
        guildID,
        userID
    ]);

}




// =====================================================
// BOOST SYSTEM
// =====================================================


async function getBoost(
    guildID,
    userID
){


    const result =
        await db.query(`

        SELECT *

        FROM boosts

        WHERE guildID=$1

        AND userID=$2


        `,
        [
            guildID,
            userID
        ]);


    return result.rows[0];

}







async function updateBoost(
    guildID,
    userID,
    role,
    expiresAt,
    lastRefreshXP,
    boostXP
){


    await db.query(`

    INSERT INTO boosts

    (
        guildID,
        userID,
        role,
        expiresAt,
        lastRefreshXP,
        boostXP
    )


    VALUES

    ($1,$2,$3,$4,$5,$6)


    ON CONFLICT(guildID,userID)

    DO UPDATE SET

    role=$3,

    expiresAt=$4,

    lastRefreshXP=$5,

    boostXP=$6


    `,
    [
        guildID,
        userID,
        role,
        expiresAt,
        lastRefreshXP,
        boostXP
    ]);

}





async function clearBoost(
    guildID,
    userID
){

    await db.query(`

    DELETE FROM boosts

    WHERE guildID=$1

    AND userID=$2

    `,
    [
        guildID,
        userID
    ]);

}





async function getExpiredBoosts(){


    const result =
        await db.query(`

        SELECT *

        FROM boosts

        WHERE expiresAt <= $1


        `,
        [
            Date.now()
        ]);


    return result.rows;

}





async function getAllBoosts(){


    const result =
        await db.query(`

        SELECT *

        FROM boosts


        `);


    return result.rows;

}

// =====================================================
// REMOVE USER DATA
// =====================================================

async function removeUser(guildID, userID){

    const client =
        await db.connect();

    try{

        await client.query("BEGIN");


        await client.query(`

            DELETE FROM boost_activity

            WHERE guildID=$1
            AND userID=$2

        `, [
            guildID,
            userID
        ]);

await client.query(`

    DELETE FROM command_cooldowns

    WHERE guildID=$1

    AND userID=$2

`, [
    guildID,
    userID
]);

await client.query(`

    DELETE FROM luck_boosts

    WHERE guildID=$1

    AND userID=$2

`, [
    guildID,
    userID
]);

await client.query(`

    DELETE FROM boost_inventory

    WHERE guildID=$1

    AND userID=$2

`, [
    guildID,
    userID
]);

await client.query(`

    DELETE FROM user_message_preferences

    WHERE guildID=$1

    AND userID=$2

`, [
    guildID,
    userID
]);

await client.query(`

    DELETE FROM xp_logs

    WHERE guildID=$1
    AND userID=$2

`, [
    guildID,
    userID
]);


await client.query(`

    DELETE FROM quest_cycles

    WHERE guildID=$1
    AND userID=$2

`, [
    guildID,
    userID
]);

await client.query(`

    DELETE FROM quest_effects

    WHERE guildID=$1
    AND userID=$2

`, [
    guildID,
    userID
]);


        await client.query(`

            DELETE FROM boosts

            WHERE guildID=$1
            AND userID=$2

        `, [
            guildID,
            userID
        ]);


        await client.query(`

            DELETE FROM users

            WHERE guildID=$1
            AND userID=$2

        `, [
            guildID,
            userID
        ]);


        await client.query("COMMIT");


        userCache.delete(
            `${guildID}:${userID}`
        );

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}



// =====================================================
// GET ALL USERS IN A GUILD
// =====================================================

async function getAllUsers(guildID){

    const result =
        await db.query(`

            SELECT *

            FROM users

            WHERE guildID=$1

            ORDER BY xp DESC

        `, [
            guildID
        ]);


    return result.rows;

}

// =====================================================
// CRITICAL STREAKS
// =====================================================

async function getCriticalStreak(
    guildID,
    userID
){

    await createUser(
        guildID,
        userID
    );


    const result =
        await db.query(`

            SELECT
                currentCriticalStreak,
                bestCriticalStreak

            FROM users

            WHERE guildID=$1
            AND userID=$2

        `, [
            guildID,
            userID
        ]);


    const user =
        result.rows[0];


    return {

        current:
            Number(
                user?.currentcriticalstreak || 0
            ),

        best:
            Number(
                user?.bestcriticalstreak || 0
            )

    };

}



async function setCriticalStreak(
    guildID,
    userID,
    streak
){

    await createUser(
        guildID,
        userID
    );


    await db.query(`

        UPDATE users

        SET

            currentCriticalStreak=$3,

            bestCriticalStreak=
                GREATEST(
                    bestCriticalStreak,
                    $3
                )

        WHERE guildID=$1
        AND userID=$2

    `, [
        guildID,
        userID,
        streak
    ]);

}



async function resetCriticalStreak(
    guildID,
    userID
){

    await createUser(
        guildID,
        userID
    );


    await db.query(`

        UPDATE users

        SET currentCriticalStreak=0

        WHERE guildID=$1
        AND userID=$2

    `, [
        guildID,
        userID
    ]);

}



// =====================================================
// XP LOGS
// =====================================================

async function addXPLog(
    guildID,
    userID,
    amount,
    critical = false,
    criticalStreak = 0,
    criticalMultiplier = 1,
    source = "message"
){

    await db.query(`

        INSERT INTO xp_logs
        (
            guildID,
            userID,
            amount,
            critical,
            criticalStreak,
            criticalMultiplier,
            source,
            timestamp
        )

        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8)

    `, [
        guildID,
        userID,
        amount,
        critical,
        criticalStreak,
        criticalMultiplier,
        source,
        Date.now()
    ]);

}



async function getRecentXPLogs(
    guildID,
    limit = 20
){

    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 20,
                100
            )
        );


    const result =
        await db.query(`

            SELECT *

            FROM xp_logs

            WHERE guildID=$1

            ORDER BY timestamp DESC

            LIMIT $2

        `, [
            guildID,
            safeLimit
        ]);


    return result.rows;

}

// =====================================================
// COMMAND COOLDOWNS
// =====================================================

async function getCommandCooldownRemaining(
    guildID,
    userID,
    commandName
){


    const normalizedCommand =
        String(commandName).toLowerCase();


    const result =
        await db.query(`

            SELECT expiresAt

            FROM command_cooldowns

            WHERE guildID=$1

            AND userID=$2

            AND commandName=$3

        `, [
            guildID,
            userID,
            normalizedCommand
        ]);


    const cooldown =
        result.rows[0];


    if(!cooldown){

        return 0;

    }


    const remaining =
        Number(cooldown.expiresat) -
        Date.now();


    // Remove cooldown if it already expired.
    if(remaining <= 0){


        await db.query(`

            DELETE FROM command_cooldowns

            WHERE guildID=$1

            AND userID=$2

            AND commandName=$3

        `, [
            guildID,
            userID,
            normalizedCommand
        ]);


        return 0;

    }


    return remaining;


}



async function setCommandCooldown(
    guildID,
    userID,
    commandName,
    expiresAt
){


    const normalizedCommand =
        String(commandName).toLowerCase();


    await db.query(`

        INSERT INTO command_cooldowns
        (
            guildID,
            userID,
            commandName,
            expiresAt
        )

        VALUES
        ($1,$2,$3,$4)

        ON CONFLICT(
            guildID,
            userID,
            commandName
        )

        DO UPDATE SET

        expiresAt=$4

    `, [
        guildID,
        userID,
        normalizedCommand,
        expiresAt
    ]);


}



async function clearCommandCooldown(
    guildID,
    userID,
    commandName
){


    const normalizedCommand =
        String(commandName).toLowerCase();


    await db.query(`

        DELETE FROM command_cooldowns

        WHERE guildID=$1

        AND userID=$2

        AND commandName=$3

    `, [
        guildID,
        userID,
        normalizedCommand
    ]);


}

// =====================================================
// LUCK BOOSTS
// =====================================================

async function getLuckBoost(
    guildID,
    userID
){

    const result =
        await db.query(`

            SELECT *

            FROM luck_boosts

            WHERE guildID=$1

            AND userID=$2

        `, [
            guildID,
            userID
        ]);


    return result.rows[0];

}



async function updateLuckBoost(
    guildID,
    userID,
    role,
    expiresAt
){

    await db.query(`

        INSERT INTO luck_boosts
        (
            guildID,
            userID,
            role,
            expiresAt
        )

        VALUES
        ($1,$2,$3,$4)

        ON CONFLICT(
            guildID,
            userID
        )

        DO UPDATE SET

        role=$3,

        expiresAt=$4

    `, [
        guildID,
        userID,
        role,
        expiresAt
    ]);

}



async function clearLuckBoost(
    guildID,
    userID
){

    await db.query(`

        DELETE FROM luck_boosts

        WHERE guildID=$1

        AND userID=$2

    `, [
        guildID,
        userID
    ]);

}



async function getExpiredLuckBoosts(){

    const result =
        await db.query(`

            SELECT *

            FROM luck_boosts

            WHERE expiresAt <= $1

        `, [
            Date.now()
        ]);


    return result.rows;

}



async function getAllLuckBoosts(){

    const result =
        await db.query(`

            SELECT *

            FROM luck_boosts

        `);


    return result.rows;

}


// =====================================================
// BOOST INVENTORY
// =====================================================

async function addBoostInventory(
    guildID,
    userID,
    boostType,
    tier,
    amount = 1
){

    const safeAmount =
        Math.max(
            1,
            Math.floor(
                Number(amount) || 1
            )
        );


    const result =
        await db.query(`

            INSERT INTO boost_inventory
            (
                guildID,
                userID,
                boostType,
                tier,
                amount
            )

            VALUES
            ($1,$2,$3,$4,$5)

            ON CONFLICT(
                guildID,
                userID,
                boostType,
                tier
            )

            DO UPDATE SET

                amount =
                    boost_inventory.amount +
                    EXCLUDED.amount

            RETURNING amount

        `, [
            guildID,
            userID,
            String(boostType).toLowerCase(),
            String(tier).toLowerCase(),
            safeAmount
        ]);


    return Number(
        result.rows[0]?.amount || 0
    );

}



async function getBoostInventory(
    guildID,
    userID
){

    const result =
        await db.query(`

            SELECT
                boostType,
                tier,
                amount

            FROM boost_inventory

            WHERE guildID=$1
            AND userID=$2
            AND amount > 0

        `, [
            guildID,
            userID
        ]);


    return result.rows;

}



async function getBoostInventoryAmount(
    guildID,
    userID,
    boostType,
    tier
){

    const result =
        await db.query(`

            SELECT amount

            FROM boost_inventory

            WHERE guildID=$1
            AND userID=$2
            AND boostType=$3
            AND tier=$4

        `, [
            guildID,
            userID,
            String(boostType).toLowerCase(),
            String(tier).toLowerCase()
        ]);


    return Number(
        result.rows[0]?.amount || 0
    );

}



async function consumeBoostInventory(
    guildID,
    userID,
    boostType,
    tier
){

    const result =
        await db.query(`

            UPDATE boost_inventory

            SET amount = amount - 1

            WHERE guildID=$1
            AND userID=$2
            AND boostType=$3
            AND tier=$4
            AND amount > 0

            RETURNING amount

        `, [
            guildID,
            userID,
            String(boostType).toLowerCase(),
            String(tier).toLowerCase()
        ]);


    if(result.rowCount === 0){

        return {
            success: false,
            remaining: 0
        };

    }


    const remaining =
        Number(
            result.rows[0]?.amount || 0
        );


    if(remaining <= 0){

        await db.query(`

            DELETE FROM boost_inventory

            WHERE guildID=$1
            AND userID=$2
            AND boostType=$3
            AND tier=$4
            AND amount <= 0

        `, [
            guildID,
            userID,
            String(boostType).toLowerCase(),
            String(tier).toLowerCase()
        ]);

    }


    return {
        success: true,
        remaining
    };

}



// =====================================================
// PERSONAL REPLY MUTE SETTINGS
// =====================================================

function normalizeMessageMuteType(type){

    const normalized =
        String(type || "")
            .trim()
            .toLowerCase();


    if([
        "xp",
        "xp_boost",
        "xp_boosts"
    ].includes(normalized)){

        return "xp_boost";

    }


    if([
        "critical",
        "criticals",
        "crit"
    ].includes(normalized)){

        return "critical";

    }


    return null;

}


function normalizeMessageMuteRow(row){

    return {
        xpBoostMessages:
            Boolean(
                row?.mutexpboostmessages
            ),
        criticalMessages:
            Boolean(
                row?.mutecriticalmessages
            )
    };

}


async function getMessageMutePreferences(
    guildID,
    userID
){

    const result =
        await db.query(`

            SELECT
                muteXPBoostMessages,
                muteCriticalMessages

            FROM user_message_preferences

            WHERE guildID=$1
            AND userID=$2

        `, [
            guildID,
            userID
        ]);


    return normalizeMessageMuteRow(
        result.rows[0]
    );

}


async function isMessageTypeMuted(
    guildID,
    userID,
    type
){

    const normalizedType =
        normalizeMessageMuteType(
            type
        );


    if(!normalizedType){
        return false;
    }


    const preferences =
        await getMessageMutePreferences(
            guildID,
            userID
        );


    return normalizedType === "xp_boost"
        ? preferences.xpBoostMessages
        : preferences.criticalMessages;

}


async function toggleMessageTypeMute(
    guildID,
    userID,
    type
){

    const normalizedType =
        normalizeMessageMuteType(
            type
        );


    if(!normalizedType){
        throw new TypeError(`Unknown message mute type: ${type}`);
    }


    // The column is selected only from these hard-coded values. User input is
    // never inserted into SQL identifiers.
    const column =
        normalizedType === "xp_boost"
            ? "muteXPBoostMessages"
            : "muteCriticalMessages";


    const result =
        await db.query(`

            INSERT INTO user_message_preferences
            (
                guildID,
                userID,
                ${column}
            )

            VALUES
            ($1,$2,TRUE)

            ON CONFLICT(
                guildID,
                userID
            )

            DO UPDATE SET
                ${column} =
                    NOT user_message_preferences.${column}

            RETURNING
                muteXPBoostMessages,
                muteCriticalMessages

        `, [
            guildID,
            userID
        ]);


    return normalizeMessageMuteRow(
        result.rows[0]
    );

}




// =====================================================
// GLOBAL MERCHANT SHOP
// =====================================================

async function replaceTravelingMerchantStock(
    client,
    cycleID
){

    await client.query(`

        DELETE FROM
        traveling_merchant_stock

    `);


    const deals =
        createTravelingMerchantDeals();


    for(const deal of deals){

        await client.query(`

            INSERT INTO
            traveling_merchant_stock
            (
                cycleID,
                dealID,
                displayOrder,
                deal,
                amount,
                maxAmount
            )

            VALUES
            ($1,$2,$3,$4::jsonb,$5,$5)

        `, [
            cycleID,
            deal.id,
            deal.displayOrder,
            JSON.stringify(deal),
            deal.maxStock
        ]);

    }


    return deals;

}


async function refreshTravelingMerchant(
    client,
    startedAt,
    endsAt
){

    const active =
        rollTravelingMerchantAppearance();


    const numericStartedAt =
        Number(startedAt);


    const numericEndsAt =
        Number(endsAt);


    const merchantEndsAt =
        active
            ? Math.min(
                numericEndsAt,
                numericStartedAt +
                    TRAVELING_MERCHANT_VISIT_TIME
            )
            : numericEndsAt;


    const nextRestockAt =
        active
            ? Math.min(
                merchantEndsAt,
                numericStartedAt +
                    TRAVELING_MERCHANT_REFRESH_TIME
            )
            : merchantEndsAt;


    // The cycle ID changes on every 30-minute inventory rotation.
    // A click from an older panel can therefore never buy a new deal
    // that happens to reuse the same deal ID.
    const cycleID =
        active
            ? nextRestockAt
            : numericEndsAt;


    if(active){

        await replaceTravelingMerchantStock(
            client,
            cycleID
        );

    }
    else{

        await client.query(`

            DELETE FROM
            traveling_merchant_stock

        `);

    }


    await client.query(`

        UPDATE traveling_merchant_state

        SET
            active=$1,
            cycleID=$2,
            startedAt=$3,
            endsAt=$4,
            nextRestockAt=$5

        WHERE id=1

    `, [
        active,
        cycleID,
        numericStartedAt,
        merchantEndsAt,
        nextRestockAt
    ]);


    return {
        active,
        cycleID,
        startedAt:
            numericStartedAt,
        endsAt:
            merchantEndsAt,
        nextRestockAt
    };

}


async function lockAndRefreshTravelingMerchant(
    client,
    shopState
){

    const stateResult =
        await client.query(`

            SELECT
                active,
                cycleID,
                startedAt,
                endsAt,
                nextRestockAt

            FROM traveling_merchant_state

            WHERE id=1

            FOR UPDATE

        `);


    const row =
        stateResult.rows[0] || {};


    const now =
        Date.now();


    const endsAt =
        Number(
            row.endsat || 0
        );


    let nextRestockAt =
        Number(
            row.nextrestockat || 0
        );


    let cycleID =
        Number(
            row.cycleid || 0
        );


    const active =
        Boolean(row.active)
        &&
        endsAt > now;


    let refreshed =
        false;


    if(active && nextRestockAt <= now){

        if(nextRestockAt <= 0){

            nextRestockAt =
                now +
                TRAVELING_MERCHANT_REFRESH_TIME;

        }
        else{

            const missedRestocks =
                Math.floor(
                    (
                        now - nextRestockAt
                    ) /
                    TRAVELING_MERCHANT_REFRESH_TIME
                ) + 1;


            nextRestockAt +=
                missedRestocks *
                TRAVELING_MERCHANT_REFRESH_TIME;

        }


        nextRestockAt =
            Math.min(
                endsAt,
                nextRestockAt
            );


        cycleID =
            nextRestockAt;


        await replaceTravelingMerchantStock(
            client,
            cycleID
        );


        await client.query(`

            UPDATE traveling_merchant_state

            SET
                cycleID=$1,
                nextRestockAt=$2

            WHERE id=1

        `, [
            cycleID,
            nextRestockAt
        ]);


        refreshed =
            true;

    }


    return {
        active,
        cycleID,
        startedAt:
            Number(
                row.startedat || 0
            ),
        endsAt,
        nextRestockAt,
        nextRefreshAt:
            active
                ? nextRestockAt
                : shopState.nextRefreshAt,
        refreshed
    };

}


async function lockAndRefreshShop(client){

    const stateResult =
        await client.query(`

            SELECT nextRefreshAt

            FROM shop_state

            WHERE id=1

            FOR UPDATE

        `);


    let nextRefreshAt =
        Number(
            stateResult.rows[0]?.nextrefreshat
        ) ||
        Date.now() + SHOP_REFRESH_TIME;


    const now =
        Date.now();


    let refreshed =
        false;


    let merchantActive =
        null;


    if(nextRefreshAt <= now){

        const missedRefreshes =
            Math.floor(
                (
                    now - nextRefreshAt
                ) /
                SHOP_REFRESH_TIME
            ) + 1;


        nextRefreshAt +=
            missedRefreshes *
            SHOP_REFRESH_TIME;


        await client.query(`

            UPDATE shop_stock

            SET amount = maxAmount

        `);


        // Pick and store the next cycle's prices.
        // Because shop_state is locked above, this only happens
        // once even if multiple users open !shop at the same time.
        for(const item of Object.values(SHOP_CATALOG)){

            const nextPrice =
                getRandomShopPrice(item);


            await client.query(`

                UPDATE shop_stock

                SET price=$3

                WHERE boostType=$1
                AND tier=$2

            `, [
                item.boostType,
                item.tier,
                nextPrice
            ]);

        }


        const merchantState =
            await refreshTravelingMerchant(
                client,
                now,
                nextRefreshAt
            );


        merchantActive =
            merchantState.active;


        await client.query(`

            UPDATE shop_state

            SET nextRefreshAt=$1

            WHERE id=1

        `, [
            nextRefreshAt
        ]);


        refreshed =
            true;

    }


    return {
        nextRefreshAt,
        refreshed,
        merchantActive
    };

}


async function getGlobalShop(){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const state =
            await lockAndRefreshShop(
                client
            );


        const stockResult =
            await client.query(`

                SELECT
                    boostType,
                    tier,
                    amount,
                    maxAmount,
                    price

                FROM shop_stock

                ORDER BY
                    boostType DESC,
                    CASE tier
                        WHEN 'tier1' THEN 1
                        WHEN 'tier2' THEN 2
                        WHEN 'tier3' THEN 3
                        WHEN 'max' THEN 4
                        ELSE 5
                    END

            `);


        await client.query("COMMIT");


        return {
            ...state,
            stock: stockResult.rows
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}


async function purchaseGlobalShopItem(
    guildID,
    userID,
    itemKey
){

    const normalizedKey =
        String(itemKey).toLowerCase();


    const item =
        SHOP_CATALOG[normalizedKey];


    if(!item){

        return {
            success: false,
            status: "invalid-item"
        };

    }


    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const state =
            await lockAndRefreshShop(
                client
            );


        const stockResult =
            await client.query(`

                SELECT
                    amount,
                    price

                FROM shop_stock

                WHERE boostType=$1
                AND tier=$2

                FOR UPDATE

            `, [
                item.boostType,
                item.tier
            ]);


        const currentStock =
            Number(
                stockResult.rows[0]?.amount || 0
            );


        const basePrice =
            Number(
                stockResult.rows[0]?.price
            ) || item.price;


        if(currentStock <= 0){

            await client.query("COMMIT");

            return {
                success: false,
                status: "sold-out",
                nextRefreshAt:
                    state.nextRefreshAt
            };

        }


        await client.query(`

            INSERT INTO quest_effects
            (
                guildID,
                userID
            )

            VALUES($1,$2)

            ON CONFLICT DO NOTHING

        `, [
            guildID,
            userID
        ]);


        const discountResult =
            await client.query(`

                SELECT
                    shopDiscount50Until,
                    shopDiscount90Until

                FROM quest_effects

                WHERE guildID=$1
                AND userID=$2

                FOR UPDATE

            `, [
                guildID,
                userID
            ]);


        const discountRow =
            discountResult.rows[0] || {};


        const discountPercent =
            Number(
                discountRow.shopdiscount90until || 0
            ) > Date.now()
                ? 90
                : Number(
                    discountRow.shopdiscount50until || 0
                ) > Date.now()
                    ? 50
                    : 0;


        const currentPrice =
            Math.max(
                1,
                Math.ceil(
                    basePrice *
                    (100 - discountPercent) /
                    100
                )
            );


        await client.query(`

            INSERT INTO users
            (
                guildID,
                userID
            )

            VALUES($1,$2)

            ON CONFLICT DO NOTHING

        `, [
            guildID,
            userID
        ]);


        const userResult =
            await client.query(`

                SELECT xp

                FROM users

                WHERE guildID=$1
                AND userID=$2

                FOR UPDATE

            `, [
                guildID,
                userID
            ]);


        const currentXP =
            Number(
                userResult.rows[0]?.xp || 0
            );


        if(currentXP < currentPrice){

            await client.query("COMMIT");

            return {
                success: false,
                status: "not-enough-xp",
                price: currentPrice,
                basePrice,
                discountPercent,
                balance: currentXP,
                missing:
                    currentPrice - currentXP,
                nextRefreshAt:
                    state.nextRefreshAt
            };

        }


        const updatedStock =
            await client.query(`

                UPDATE shop_stock

                SET amount = amount - 1

                WHERE boostType=$1
                AND tier=$2
                AND amount > 0

                RETURNING amount

            `, [
                item.boostType,
                item.tier
            ]);


        if(updatedStock.rowCount === 0){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "sold-out",
                nextRefreshAt:
                    state.nextRefreshAt
            };

        }


        const updatedUser =
            await client.query(`

                UPDATE users

                SET xp = xp - $3

                WHERE guildID=$1
                AND userID=$2

                RETURNING xp

            `, [
                guildID,
                userID,
                currentPrice
            ]);


        const inventoryResult =
            await client.query(`

                INSERT INTO boost_inventory
                (
                    guildID,
                    userID,
                    boostType,
                    tier,
                    amount
                )

                VALUES
                ($1,$2,$3,$4,1)

                ON CONFLICT(
                    guildID,
                    userID,
                    boostType,
                    tier
                )

                DO UPDATE SET

                    amount =
                        boost_inventory.amount + 1

                RETURNING amount

            `, [
                guildID,
                userID,
                item.boostType,
                item.tier
            ]);


        // lockAndRefreshShop() holds the single shop_state row
        // FOR UPDATE, so all purchases are serialized. This makes
        // the "sell out the entire store" check race-safe.
        const totalStockResult =
            await client.query(`

                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total

                FROM shop_stock

            `);


        const entireStoreSoldOut =
            Number(
                totalStockResult.rows[0]?.total || 0
            ) <= 0;


        await client.query("COMMIT");


        userCache.delete(
            `${guildID}:${userID}`
        );


        return {
            success: true,
            status: "purchased",
            item,
            price: currentPrice,
            basePrice,
            discountPercent,
            balance:
                Number(
                    updatedUser.rows[0]?.xp || 0
                ),
            remainingStock:
                Number(
                    updatedStock.rows[0]?.amount || 0
                ),
            entireStoreSoldOut,
            inventoryAmount:
                Number(
                    inventoryResult.rows[0]?.amount || 0
                ),
            nextRefreshAt:
                state.nextRefreshAt
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}


function parseTravelingMerchantDeal(value){

    if(
        value &&
        typeof value === "object"
    ){
        return value;
    }


    try{
        return JSON.parse(value);
    }
    catch{
        return null;
    }

}


function normalizeTravelingMerchantBoosts(
    boosts
){

    const combined =
        new Map();


    for(
        const rawBoost of
        Array.isArray(boosts)
            ? boosts
            : []
    ){

        const boostType =
            String(
                rawBoost?.boostType || ""
            ).toLowerCase();


        const tier =
            String(
                rawBoost?.tier || ""
            ).toLowerCase();


        const amount =
            Math.max(
                0,
                Math.floor(
                    Number(
                        rawBoost?.amount
                    ) || 0
                )
            );


        if(
            ![
                "xp",
                "luck"
            ].includes(boostType)
            ||
            !tier
            ||
            amount <= 0
        ){
            continue;
        }


        const key =
            `${boostType}:${tier}`;


        const current =
            combined.get(key) || {
                boostType,
                tier,
                amount: 0
            };


        current.amount +=
            amount;


        combined.set(
            key,
            current
        );

    }


    return [
        ...combined.values()
    ];

}


function normalizeTravelingMerchantPerk(
    rawPerk
){

    if(
        !rawPerk ||
        typeof rawPerk !== "object"
    ){
        return null;
    }


    const type =
        String(
            rawPerk.type || ""
        ).toLowerCase();


    if(type === "chat_xp_permanent"){

        return {
            type,
            multiplier:
                Math.max(
                    2,
                    Math.floor(
                        Number(
                            rawPerk.multiplier
                        ) || 2
                    )
                )
        };

    }


    if(type === "chat_xp_timed"){

        return {
            type,
            multiplier:
                Number(
                    rawPerk.multiplier
                ) >= 20
                    ? 20
                    : 10,
            durationMs:
                Math.max(
                    MERCHANT_HOUR,
                    Math.floor(
                        Number(
                            rawPerk.durationMs
                        ) ||
                        12 * MERCHANT_HOUR
                    )
                )
        };

    }


    if(type === "multi_roll_permanent"){

        return {
            type,
            rollCount:
                Math.max(
                    2,
                    Math.floor(
                        Number(
                            rawPerk.rollCount
                        ) || 3
                    )
                )
        };

    }


    if(type === "multi_roll_timed"){

        return {
            type,
            rollCount:
                Math.max(
                    2,
                    Math.floor(
                        Number(
                            rawPerk.rollCount
                        ) || 3
                    )
                ),
            durationMs:
                Math.max(
                    MERCHANT_HOUR,
                    Math.floor(
                        Number(
                            rawPerk.durationMs
                        ) ||
                        24 * MERCHANT_HOUR
                    )
                )
        };

    }


    return null;

}


function getTravelingMerchantRollPerk(
    effects,
    now = Date.now()
){

    const permanentRollCount =
        Math.max(
            1,
            Number(
                effects
                    ?.merchantpermanentrollcount
            ) || 1
        );


    const timedUntil =
        Number(
            effects
                ?.merchanttimedrolluntil || 0
        );


    const timedRollCount =
        timedUntil > now
            ? Math.max(
                1,
                Number(
                    effects
                        ?.merchanttimedrollcount
                ) || 1
            )
            : 1;


    return {
        rollCount:
            Math.max(
                permanentRollCount,
                timedRollCount
            ),
        permanentRollCount,
        timedRollCount,
        activeUntil:
            timedUntil > now
                ? timedUntil
                : 0
    };

}


function resolveChatXPMultiplier(
    effects,
    now = Date.now()
){

    const permanentMultiplier =
        Math.max(
            1,
            Number(
                effects
                    ?.merchantpermanentchatxpmultiplier
            ) || 1
        );


    if(
        Number(
            effects?.chatxp20until || 0
        ) > now
    ){
        return Math.max(
            20,
            permanentMultiplier
        );
    }


    if(
        Number(
            effects?.chatxp10until || 0
        ) > now
    ){
        return Math.max(
            10,
            permanentMultiplier
        );
    }


    if(
        Number(
            effects?.chatxp2until || 0
        ) > now
    ){
        return Math.max(
            2,
            permanentMultiplier
        );
    }


    return permanentMultiplier;

}


function normalizeTravelingMerchantDeal(
    rawDeal
){

    const parsed =
        parseTravelingMerchantDeal(
            rawDeal
        );


    if(!parsed){
        return null;
    }


    return {

        id:
            String(
                parsed.id || ""
            ).toLowerCase(),

        name:
            String(
                parsed.name ||
                "Traveling Merchant Deal"
            ),

        displayOrder:
            Math.max(
                1,
                Number(
                    parsed.displayOrder
                ) || 1
            ),

        cost: {
            xp:
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            parsed.cost?.xp
                        ) || 0
                    )
                ),
            boosts:
                normalizeTravelingMerchantBoosts(
                    parsed.cost?.boosts
                ),
            perk: null
        },

        reward: {
            xp:
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            parsed.reward?.xp
                        ) || 0
                    )
                ),
            boosts:
                normalizeTravelingMerchantBoosts(
                    parsed.reward?.boosts
                ),
            perk:
                normalizeTravelingMerchantPerk(
                    parsed.reward?.perk
                )
        }

    };

}


async function getTravelingMerchant(){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const shopState =
            await lockAndRefreshShop(
                client
            );


        const merchantState =
            await lockAndRefreshTravelingMerchant(
                client,
                shopState
            );


        const cycleID =
            Number(
                merchantState.cycleID || 0
            );


        const endsAt =
            Number(
                merchantState.endsAt || 0
            );


        const active =
            Boolean(
                merchantState.active
            );


        let dealRows = [];


        if(active){

            const stockResult =
                await client.query(`

                    SELECT
                        dealID,
                        displayOrder,
                        deal,
                        amount,
                        maxAmount

                    FROM traveling_merchant_stock

                    WHERE cycleID=$1

                    ORDER BY displayOrder ASC

                `, [
                    cycleID
                ]);


            dealRows =
                stockResult.rows;

        }


        await client.query("COMMIT");


        return {
            active,
            cycleID,
            startedAt:
                Number(
                    merchantState.startedAt || 0
                ),
            endsAt,
            nextRestockAt:
                Number(
                    merchantState.nextRestockAt || 0
                ),
            nextRefreshAt:
                merchantState.nextRefreshAt,
            refreshed:
                Boolean(
                    shopState.refreshed
                    ||
                    merchantState.refreshed
                ),
            deals:
                dealRows.map(row => ({
                    ...(
                        parseTravelingMerchantDeal(
                            row.deal
                        ) || {}
                    ),
                    id:
                        String(
                            row.dealid
                        ).toLowerCase(),
                    displayOrder:
                        Number(
                            row.displayorder
                        ),
                    amount:
                        Number(
                            row.amount
                        ),
                    maxAmount:
                        Number(
                            row.maxamount
                        )
                }))
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}


async function purchaseTravelingMerchantDeal(
    guildID,
    userID,
    dealID,
    expectedCycleID = null
){

    const normalizedDealID =
        String(
            dealID || ""
        )
            .trim()
            .toLowerCase();


    if(!normalizedDealID){

        return {
            success: false,
            status: "invalid-deal"
        };

    }


    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const shopState =
            await lockAndRefreshShop(
                client
            );


        const merchantState =
            await lockAndRefreshTravelingMerchant(
                client,
                shopState
            );


        const cycleID =
            Number(
                merchantState.cycleID || 0
            );


        if(
            !merchantState.active
        ){

            await client.query("COMMIT");

            return {
                success: false,
                status: "merchant-away",
                nextRefreshAt:
                    merchantState.nextRefreshAt
            };

        }


        if(
            expectedCycleID !== null
            &&
            Number(expectedCycleID) !==
                cycleID
        ){

            await client.query("COMMIT");

            return {
                success: false,
                status: "merchant-refreshed",
                cycleID,
                nextRefreshAt:
                    merchantState.nextRefreshAt
            };

        }


        const stockResult =
            await client.query(`

                SELECT
                    deal,
                    amount,
                    maxAmount,
                    displayOrder

                FROM traveling_merchant_stock

                WHERE cycleID=$1
                AND dealID=$2

                FOR UPDATE

            `, [
                cycleID,
                normalizedDealID
            ]);


        const stockRow =
            stockResult.rows[0];


        if(!stockRow){

            await client.query("COMMIT");

            return {
                success: false,
                status: "invalid-deal"
            };

        }


        if(
            Number(
                stockRow.amount || 0
            ) <= 0
        ){

            await client.query("COMMIT");

            return {
                success: false,
                status: "sold-out",
                remainingStock: 0
            };

        }


        const deal =
            normalizeTravelingMerchantDeal(
                stockRow.deal
            );


        if(
            !deal
            ||
            deal.id !== normalizedDealID
        ){

            throw new Error(
                `Traveling Merchant deal ${normalizedDealID} is invalid.`
            );

        }


        await client.query(`

            INSERT INTO users
            (
                guildID,
                userID
            )

            VALUES($1,$2)

            ON CONFLICT DO NOTHING

        `, [
            guildID,
            userID
        ]);


        const userResult =
            await client.query(`

                SELECT xp

                FROM users

                WHERE guildID=$1
                AND userID=$2

                FOR UPDATE

            `, [
                guildID,
                userID
            ]);


        const currentXP =
            Number(
                userResult.rows[0]?.xp || 0
            );


        if(currentXP < deal.cost.xp){

            await client.query("COMMIT");

            return {
                success: false,
                status: "not-enough-xp",
                required:
                    deal.cost.xp,
                available:
                    currentXP,
                missing:
                    deal.cost.xp -
                    currentXP
            };

        }


        const lockedInventory =
            [];


        for(
            const boostCost of
            deal.cost.boosts
        ){

            const inventoryResult =
                await client.query(`

                    SELECT amount

                    FROM boost_inventory

                    WHERE guildID=$1
                    AND userID=$2
                    AND boostType=$3
                    AND tier=$4

                    FOR UPDATE

                `, [
                    guildID,
                    userID,
                    boostCost.boostType,
                    boostCost.tier
                ]);


            const available =
                Number(
                    inventoryResult
                        .rows[0]?.amount || 0
                );


            if(available < boostCost.amount){

                await client.query("COMMIT");

                return {
                    success: false,
                    status:
                        "not-enough-boosts",
                    boost:
                        boostCost,
                    required:
                        boostCost.amount,
                    available,
                    missing:
                        boostCost.amount -
                        available
                };

            }


            lockedInventory.push({
                ...boostCost,
                available
            });

        }


        await client.query(`

            INSERT INTO quest_effects
            (
                guildID,
                userID
            )

            VALUES($1,$2)

            ON CONFLICT DO NOTHING

        `, [
            guildID,
            userID
        ]);


        const effectResult =
            await client.query(`

                SELECT
                    merchantPermanentChatXPMultiplier,
                    merchantPermanentRollCount

                FROM quest_effects

                WHERE guildID=$1
                AND userID=$2

                FOR UPDATE

            `, [
                guildID,
                userID
            ]);


        const effects =
            effectResult.rows[0] || {};


        const perk =
            deal.reward.perk;


        const alreadyOwned =
            (
                perk?.type ===
                    "chat_xp_permanent"
                &&
                Number(
                    effects
                        .merchantpermanentchatxpmultiplier || 1
                ) >= perk.multiplier
            )
            ||
            (
                perk?.type ===
                    "multi_roll_permanent"
                &&
                Number(
                    effects
                        .merchantpermanentrollcount || 1
                ) >= perk.rollCount
            );


        if(alreadyOwned){

            await client.query("COMMIT");

            return {
                success: false,
                status: "already-owned",
                perk
            };

        }


        for(
            const boostCost of
            lockedInventory
        ){

            await client.query(`

                UPDATE boost_inventory

                SET amount =
                    amount - $5

                WHERE guildID=$1
                AND userID=$2
                AND boostType=$3
                AND tier=$4

            `, [
                guildID,
                userID,
                boostCost.boostType,
                boostCost.tier,
                boostCost.amount
            ]);


            await client.query(`

                DELETE FROM boost_inventory

                WHERE guildID=$1
                AND userID=$2
                AND boostType=$3
                AND tier=$4
                AND amount <= 0

            `, [
                guildID,
                userID,
                boostCost.boostType,
                boostCost.tier
            ]);

        }


        const updatedUser =
            await client.query(`

                UPDATE users

                SET xp =
                    xp - $3 + $4

                WHERE guildID=$1
                AND userID=$2
                AND xp >= $3

                RETURNING xp

            `, [
                guildID,
                userID,
                deal.cost.xp,
                deal.reward.xp
            ]);


        if(updatedUser.rowCount === 0){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "not-enough-xp",
                required:
                    deal.cost.xp,
                available:
                    currentXP
            };

        }


        for(
            const boostReward of
            deal.reward.boosts
        ){

            await client.query(`

                INSERT INTO boost_inventory
                (
                    guildID,
                    userID,
                    boostType,
                    tier,
                    amount
                )

                VALUES
                ($1,$2,$3,$4,$5)

                ON CONFLICT(
                    guildID,
                    userID,
                    boostType,
                    tier
                )

                DO UPDATE SET
                    amount =
                        boost_inventory.amount +
                        EXCLUDED.amount

            `, [
                guildID,
                userID,
                boostReward.boostType,
                boostReward.tier,
                boostReward.amount
            ]);

        }


        if(
            perk?.type ===
            "chat_xp_permanent"
        ){

            await client.query(`

                UPDATE quest_effects

                SET
                    merchantPermanentChatXPMultiplier =
                        GREATEST(
                            merchantPermanentChatXPMultiplier,
                            $3
                        )

                WHERE guildID=$1
                AND userID=$2

            `, [
                guildID,
                userID,
                perk.multiplier
            ]);

        }
        else if(
            perk?.type ===
            "chat_xp_timed"
        ){

            const now =
                Date.now();


            const expiryColumn =
                perk.multiplier >= 20
                    ? "chatXP20Until"
                    : "chatXP10Until";


            await client.query(`

                UPDATE quest_effects

                SET ${expiryColumn} =
                    GREATEST(
                        ${expiryColumn},
                        $3
                    ) + $4

                WHERE guildID=$1
                AND userID=$2

            `, [
                guildID,
                userID,
                now,
                perk.durationMs
            ]);

        }
        else if(
            perk?.type ===
            "multi_roll_permanent"
        ){

            await client.query(`

                UPDATE quest_effects

                SET
                    merchantPermanentRollCount =
                        GREATEST(
                            merchantPermanentRollCount,
                            $3
                        ),

                    rollWindowEndsAt=0,
                    rollWindowUses=0

                WHERE guildID=$1
                AND userID=$2

            `, [
                guildID,
                userID,
                perk.rollCount
            ]);

        }
        else if(
            perk?.type ===
            "multi_roll_timed"
        ){

            const now =
                Date.now();


            await client.query(`

                UPDATE quest_effects

                SET
                    merchantTimedRollCount =
                        CASE
                            WHEN
                                merchantTimedRollUntil >
                                $3
                            THEN
                                GREATEST(
                                    merchantTimedRollCount,
                                    $4
                                )
                            ELSE $4
                        END,

                    merchantTimedRollUntil =
                        GREATEST(
                            merchantTimedRollUntil,
                            $3
                        ) + $5,

                    rollWindowEndsAt=0,
                    rollWindowUses=0

                WHERE guildID=$1
                AND userID=$2

            `, [
                guildID,
                userID,
                now,
                perk.rollCount,
                perk.durationMs
            ]);

        }


        const updatedStock =
            await client.query(`

                UPDATE traveling_merchant_stock

                SET amount =
                    amount - 1

                WHERE cycleID=$1
                AND dealID=$2
                AND amount > 0

                RETURNING amount

            `, [
                cycleID,
                normalizedDealID
            ]);


        if(updatedStock.rowCount === 0){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "sold-out",
                remainingStock: 0
            };

        }


        const totalStockResult =
            await client.query(`

                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total

                FROM traveling_merchant_stock

                WHERE cycleID=$1

            `, [
                cycleID
            ]);


        const entireMerchantSoldOut =
            Number(
                totalStockResult
                    .rows[0]?.total || 0
            ) <= 0;


        await client.query("COMMIT");


        userCache.delete(
            `${guildID}:${userID}`
        );


        return {
            success: true,
            status: "purchased",
            cycleID,
            deal,
            balance:
                Number(
                    updatedUser.rows[0]?.xp || 0
                ),
            rewardXP:
                deal.reward.xp,
            costXP:
                deal.cost.xp,
            xpChange:
                deal.reward.xp -
                deal.cost.xp,
            remainingStock:
                Number(
                    updatedStock
                        .rows[0]?.amount || 0
                ),
            entireMerchantSoldOut,
            nextRefreshAt:
                merchantState.nextRefreshAt
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}



// =====================================================
// QUEST SYSTEM
// =====================================================

const QUEST_RESET_LEVEL_THRESHOLD =
    100;


const QUEST_RESET_CONFIG =
    Object.freeze({

        daily:
            Object.freeze({
                lowLevelPrice:
                    50000,
                highLevelPrice:
                    25000000,
                // Compatibility for older display code. New code must use
                // getQuestResetPrice(cycleType, level).
                price:
                    25000000,
                maxResets:
                    1
            }),

        weekly:
            Object.freeze({
                lowLevelPrice:
                    250000,
                highLevelPrice:
                    100000000,
                // Compatibility for older display code. New code must use
                // getQuestResetPrice(cycleType, level).
                price:
                    100000000,
                maxResets:
                    1
            })

    });


function getQuestResetPrice(
    cycleType,
    level
){

    const config =
        QUEST_RESET_CONFIG[
            String(
                cycleType || ""
            ).toLowerCase()
        ];


    if(!config){

        return null;

    }


    const numericLevel =
        Number(level);


    // Unknown levels default to the higher price so an outdated internal
    // caller can never accidentally grant the Level 1-99 discount.
    const highLevel =
        !Number.isFinite(numericLevel)
        ||
        numericLevel >=
            QUEST_RESET_LEVEL_THRESHOLD;


    return highLevel
        ? Number(config.highLevelPrice)
        : Number(config.lowLevelPrice);

}


function getStoredQuestList(value){

    if(Array.isArray(value)){

        return value;

    }


    if(typeof value === "string"){

        try{

            const parsed =
                JSON.parse(value);


            return Array.isArray(parsed)
                ? parsed
                : [];

        }
        catch{

            return [];

        }

    }


    return [];

}


function isStoredQuestCycleCompleted(cycle){

    const quests =
        getStoredQuestList(
            cycle?.quests
        );


    return (
        Boolean(cycle?.rewarded)
        ||
        (
            quests.length > 0
            &&
            quests.every(
                quest =>
                    Boolean(quest?.completed)
            )
        )
    );

}

async function getQuestCycle(
    guildID,
    userID,
    cycleType,
    cycleKey
){

    const result =
        await db.query(`

            SELECT *

            FROM quest_cycles

            WHERE guildID=$1
            AND userID=$2
            AND cycleType=$3
            AND cycleKey=$4

        `, [
            guildID,
            userID,
            String(cycleType).toLowerCase(),
            cycleKey
        ]);


    return result.rows[0] || null;

}


async function createQuestCycle(
    guildID,
    userID,
    cycleType,
    cycleKey,
    expiresAt,
    quests,
    rewards
){

    await db.query(`

        INSERT INTO quest_cycles
        (
            guildID,
            userID,
            cycleType,
            cycleKey,
            expiresAt,
            quests,
            rewards,
            rewarded
        )

        VALUES
        ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,FALSE)

        ON CONFLICT(
            guildID,
            userID,
            cycleType,
            cycleKey
        )

        DO NOTHING

    `, [
        guildID,
        userID,
        String(cycleType).toLowerCase(),
        cycleKey,
        Number(expiresAt),
        JSON.stringify(quests),
        JSON.stringify(rewards)
    ]);


    return getQuestCycle(
        guildID,
        userID,
        cycleType,
        cycleKey
    );

}


async function getActiveQuestCycles(
    now = Date.now()
){

    const result =
        await db.query(`

            SELECT *

            FROM quest_cycles

            WHERE expiresAt > $1

            ORDER BY expiresAt ASC

        `, [
            Number(now)
        ]);


    return result.rows;

}


async function replaceQuestCycleData(
    guildID,
    userID,
    cycleType,
    cycleKey,
    quests,
    rewards,
    expiresAt = null
){

    const result =
        await db.query(`

            UPDATE quest_cycles

            SET
                quests=$5::jsonb,
                rewards=$6::jsonb,
                expiresAt =
                    CASE
                        WHEN $7::bigint IS NULL
                        THEN expiresAt
                        ELSE $7::bigint
                    END

            WHERE guildID=$1
            AND userID=$2
            AND cycleType=$3
            AND cycleKey=$4

            RETURNING *

        `, [
            guildID,
            userID,
            String(cycleType).toLowerCase(),
            cycleKey,
            JSON.stringify(quests || []),
            JSON.stringify(rewards || []),
            expiresAt === null
                ? null
                : Number(expiresAt)
        ]);


    return result.rows[0] || null;

}


async function resetQuestCycleWithXP(
    guildID,
    userID,
    cycleType,
    cycleKey,
    quests,
    rewards,
    userLevel = QUEST_RESET_LEVEL_THRESHOLD
){

    const normalizedCycleType =
        String(
            cycleType || ""
        ).toLowerCase();


    const config =
        QUEST_RESET_CONFIG[
            normalizedCycleType
        ];


    if(!config){

        return {
            success: false,
            status: "invalid-cycle-type"
        };

    }


    const price =
        getQuestResetPrice(
            normalizedCycleType,
            userLevel
        );


    if(
        !Array.isArray(quests)
        ||
        quests.length === 0
        ||
        !Array.isArray(rewards)
        ||
        rewards.length === 0
    ){

        return {
            success: false,
            status: "invalid-reset-data"
        };

    }


    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        // Lock the quest cycle first, matching the lock order used by
        // progress updates and reward claims. This serializes reset clicks
        // and prevents two requests from spending the same reset slot.
        const cycleResult =
            await client.query(`

                SELECT *

                FROM quest_cycles

                WHERE guildID=$1
                AND userID=$2
                AND cycleType=$3
                AND cycleKey=$4

                FOR UPDATE

            `, [
                guildID,
                userID,
                normalizedCycleType,
                cycleKey
            ]);


        const cycle =
            cycleResult.rows[0];


        if(!cycle){

            await client.query("COMMIT");

            return {
                success: false,
                status: "missing-cycle"
            };

        }


        const expiresAt =
            Number(
                cycle.expiresat || 0
            );


        if(expiresAt <= Date.now()){

            await client.query("COMMIT");

            return {
                success: false,
                status: "cycle-expired",
                nextResetAt:
                    expiresAt
            };

        }


        const resetCount =
            Math.max(
                0,
                Number(
                    cycle.resetcount || 0
                )
            );


        // Completed quest sections are final until their natural renewal.
        // Check this while the row is locked and before locking/deducting XP,
        // so a completion racing with a reset can never be rerolled for more
        // rewards.
        if(isStoredQuestCycleCompleted(cycle)){

            await client.query("COMMIT");

            return {
                success: false,
                status: "quests-completed",
                cycleType:
                    normalizedCycleType,
                price:
                    price,
                maxResets:
                    config.maxResets,
                resetCount,
                remainingResets: 0,
                nextResetAt:
                    expiresAt
            };

        }


        if(resetCount >= config.maxResets){

            await client.query("COMMIT");

            return {
                success: false,
                status: "reset-limit-reached",
                cycleType:
                    normalizedCycleType,
                price:
                    price,
                maxResets:
                    config.maxResets,
                resetCount,
                remainingResets: 0,
                nextResetAt:
                    expiresAt
            };

        }


        await client.query(`

            INSERT INTO users
            (
                guildID,
                userID
            )

            VALUES($1,$2)

            ON CONFLICT DO NOTHING

        `, [
            guildID,
            userID
        ]);


        const userResult =
            await client.query(`

                SELECT xp

                FROM users

                WHERE guildID=$1
                AND userID=$2

                FOR UPDATE

            `, [
                guildID,
                userID
            ]);


        const balance =
            Number(
                userResult.rows[0]?.xp || 0
            );


        if(balance < price){

            await client.query("COMMIT");

            return {
                success: false,
                status: "not-enough-xp",
                cycleType:
                    normalizedCycleType,
                price:
                    price,
                balance,
                missing:
                    price -
                    balance,
                maxResets:
                    config.maxResets,
                resetCount,
                remainingResets:
                    config.maxResets -
                    resetCount,
                nextResetAt:
                    expiresAt
            };

        }


        const updatedUser =
            await client.query(`

                UPDATE users

                SET xp = xp - $3

                WHERE guildID=$1
                AND userID=$2
                AND xp >= $3

                RETURNING xp

            `, [
                guildID,
                userID,
                price
            ]);


        if(updatedUser.rowCount === 0){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "not-enough-xp",
                cycleType:
                    normalizedCycleType,
                price:
                    price,
                balance,
                missing:
                    Math.max(
                        0,
                        price -
                        balance
                    )
            };

        }


        const updatedCycle =
            await client.query(`

                UPDATE quest_cycles

                SET
                    quests=$5::jsonb,
                    rewards=$6::jsonb,
                    rewarded=FALSE,
                    rewardedAt=NULL,
                    resetCount=resetCount + 1

                WHERE guildID=$1
                AND userID=$2
                AND cycleType=$3
                AND cycleKey=$4

                RETURNING *

            `, [
                guildID,
                userID,
                normalizedCycleType,
                cycleKey,
                JSON.stringify(quests),
                JSON.stringify(rewards)
            ]);


        if(updatedCycle.rowCount === 0){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "missing-cycle"
            };

        }


        await client.query("COMMIT");


        userCache.delete(
            `${guildID}:${userID}`
        );


        const nextResetCount =
            resetCount + 1;


        return {
            success: true,
            status: "reset",
            cycleType:
                normalizedCycleType,
            price:
                price,
            balance:
                Number(
                    updatedUser.rows[0]?.xp || 0
                ),
            maxResets:
                config.maxResets,
            resetCount:
                nextResetCount,
            remainingResets:
                Math.max(
                    0,
                    config.maxResets -
                    nextResetCount
                ),
            nextResetAt:
                expiresAt,
            cycle:
                updatedCycle.rows[0]
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}


async function updateQuestCycleProgress(
    guildID,
    userID,
    cycleType,
    cycleKey,
    eventType,
    amount
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const result =
            await client.query(`

                SELECT *

                FROM quest_cycles

                WHERE guildID=$1
                AND userID=$2
                AND cycleType=$3
                AND cycleKey=$4

                FOR UPDATE

            `, [
                guildID,
                userID,
                String(cycleType).toLowerCase(),
                cycleKey
            ]);


        const row =
            result.rows[0];


        if(!row){

            await client.query("ROLLBACK");

            return null;

        }


        const quests =
            typeof row.quests === "string"
                ? JSON.parse(row.quests)
                : row.quests;


        const numericAmount =
            Math.max(
                0,
                Number(amount) || 0
            );


        const newlyCompleted = [];


        for(const quest of quests){

            if(
                quest.type !== eventType ||
                quest.completed
            ){

                continue;

            }


            const previousProgress =
                Math.max(
                    0,
                    Number(quest.progress) || 0
                );


            const target =
                Math.max(
                    1,
                    Number(quest.target) || 1
                );


            const nextProgress =
                quest.mode === "max"
                    ? Math.max(
                        previousProgress,
                        numericAmount
                    )
                    : previousProgress +
                        numericAmount;


            quest.progress =
                Math.min(
                    target,
                    nextProgress
                );


            if(quest.progress >= target){

                quest.completed =
                    true;

                quest.completedAt =
                    Date.now();

                newlyCompleted.push(
                    quest
                );

            }

        }


        const allCompleted =
            quests.length > 0 &&
            quests.every(
                quest =>
                    Boolean(quest.completed)
            );


        await client.query(`

            UPDATE quest_cycles

            SET quests=$5::jsonb

            WHERE guildID=$1
            AND userID=$2
            AND cycleType=$3
            AND cycleKey=$4

        `, [
            guildID,
            userID,
            String(cycleType).toLowerCase(),
            cycleKey,
            JSON.stringify(quests)
        ]);


        await client.query("COMMIT");


        return {
            cycleType:
                String(cycleType).toLowerCase(),
            cycleKey,
            quests,
            rewards:
                typeof row.rewards === "string"
                    ? JSON.parse(row.rewards)
                    : row.rewards,
            newlyCompleted,
            allCompleted,
            rewarded:
                Boolean(row.rewarded)
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}


async function claimQuestCycleRewards(
    guildID,
    userID,
    cycleType,
    cycleKey
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const result =
            await client.query(`

                SELECT *

                FROM quest_cycles

                WHERE guildID=$1
                AND userID=$2
                AND cycleType=$3
                AND cycleKey=$4

                FOR UPDATE

            `, [
                guildID,
                userID,
                String(cycleType).toLowerCase(),
                cycleKey
            ]);


        const row =
            result.rows[0];


        if(!row){

            await client.query("ROLLBACK");

            return {
                claimed: false,
                status: "missing"
            };

        }


        if(row.rewarded){

            await client.query("COMMIT");

            return {
                claimed: false,
                status: "already-claimed"
            };

        }


        const quests =
            typeof row.quests === "string"
                ? JSON.parse(row.quests)
                : row.quests;


        const allCompleted =
            quests.length > 0 &&
            quests.every(
                quest =>
                    Boolean(quest.completed)
            );


        if(!allCompleted){

            await client.query("COMMIT");

            return {
                claimed: false,
                status: "incomplete"
            };

        }


        const rewards =
            typeof row.rewards === "string"
                ? JSON.parse(row.rewards)
                : row.rewards;


        await client.query(`

            INSERT INTO users
            (
                guildID,
                userID
            )

            VALUES($1,$2)

            ON CONFLICT DO NOTHING

        `, [
            guildID,
            userID
        ]);


        await client.query(`

            INSERT INTO quest_effects
            (
                guildID,
                userID
            )

            VALUES($1,$2)

            ON CONFLICT DO NOTHING

        `, [
            guildID,
            userID
        ]);


        const now =
            Date.now();


        for(const reward of rewards){

            if(reward.type === "xp"){

                await client.query(`

                    WITH updated_user AS (

                        UPDATE users

                        SET xp = GREATEST(
                            0,
                            xp + $3
                        )

                        WHERE guildID=$1
                        AND userID=$2

                        RETURNING guildID, userID

                    )

                    INSERT INTO leaderboard_xp_activity
                    (
                        guildID,
                        userID,
                        amount,
                        timestamp
                    )

                    SELECT
                        guildID,
                        userID,
                        $3,
                        $4

                    FROM updated_user

                    WHERE $3 > 0

                `, [
                    guildID,
                    userID,
                    Math.max(
                        0,
                        Number(reward.amount) || 0
                    ),
                    now
                ]);

            }
            else if(reward.type === "boost"){

                await client.query(`

                    INSERT INTO boost_inventory
                    (
                        guildID,
                        userID,
                        boostType,
                        tier,
                        amount
                    )

                    VALUES($1,$2,$3,$4,$5)

                    ON CONFLICT(
                        guildID,
                        userID,
                        boostType,
                        tier
                    )

                    DO UPDATE SET

                        amount =
                            boost_inventory.amount +
                            EXCLUDED.amount

                `, [
                    guildID,
                    userID,
                    String(reward.boostType).toLowerCase(),
                    String(reward.tier).toLowerCase(),
                    Math.max(
                        1,
                        Number(reward.amount) || 1
                    )
                ]);

            }
            else if(
                reward.type === "guaranteed_roll" &&
                reward.rollType === "daily_25k_75k"
            ){

                await client.query(`

                    UPDATE quest_effects

                    SET guaranteed25k75k =
                        guaranteed25k75k + $3

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    Math.max(
                        1,
                        Number(reward.amount) || 1
                    )
                ]);

            }
            else if(
                reward.type === "guaranteed_roll" &&
                reward.rollType === "impossible"
            ){

                await client.query(`

                    UPDATE quest_effects

                    SET guaranteedImpossible =
                        guaranteedImpossible + $3

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    Math.max(
                        1,
                        Number(reward.amount) || 1
                    )
                ]);

            }
            else if(reward.type === "triple_roll"){

                await client.query(`

                    UPDATE quest_effects

                    SET
                        tripleRollUntil =
                            GREATEST(
                                tripleRollUntil,
                                $3
                            ) + $4,

                        rollWindowEndsAt = 0,

                        rollWindowUses = 0

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    now,
                    Math.max(
                        1,
                        Number(reward.durationMs) ||
                        24 * 60 * 60 * 1000
                    )
                ]);

            }
            else if(reward.type === "guaranteed_roll_minimum"){

                const minimumColumns = {
                    250000: "guaranteed250k",
                    500000: "guaranteed500k",
                    1000000: "guaranteed1m",
                    10000000: "guaranteed10m",
                    15000000: "guaranteed15m",
                    25000000: "guaranteed25m"
                };


                const column =
                    minimumColumns[
                        Number(reward.minXP)
                    ];


                if(column){

                    await client.query(`

                        UPDATE quest_effects

                        SET ${column} = ${column} + $3

                        WHERE guildID=$1
                        AND userID=$2

                    `, [
                        guildID,
                        userID,
                        Math.max(
                            1,
                            Number(reward.amount) || 1
                        )
                    ]);

                }

            }
            else if(reward.type === "next_roll_burst"){

                const burstColumns = {
                    10: "nextRollBurst10",
                    20: "nextRollBurst20",
                    50: "nextRollBurst50"
                };


                const column =
                    burstColumns[
                        Number(reward.rollCount)
                    ];


                if(column){

                    await client.query(`

                        UPDATE quest_effects

                        SET ${column} = ${column} + $3

                        WHERE guildID=$1
                        AND userID=$2

                    `, [
                        guildID,
                        userID,
                        Math.max(
                            1,
                            Number(reward.amount) || 1
                        )
                    ]);

                }

            }
            else if(reward.type === "multi_roll"){

                const durationMs =
                    Math.max(
                        1,
                        Number(reward.durationMs) ||
                        24 * 60 * 60 * 1000
                    );


                const rollCount =
                    Math.max(
                        2,
                        Number(reward.rollCount) || 3
                    );


                await client.query(`

                    UPDATE quest_effects

                    SET
                        multiRollCount =
                            CASE
                                WHEN multiRollUntil > $3
                                    THEN GREATEST(multiRollCount, $4)
                                ELSE $4
                            END,

                        multiRollUntil =
                            GREATEST(
                                multiRollUntil,
                                $3
                            ) + $5,

                        rollWindowEndsAt = 0,
                        rollWindowUses = 0

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    now,
                    rollCount,
                    durationMs
                ]);

            }
            else if(reward.type === "chat_xp_multiplier"){

                const multiplier =
                    Number(reward.multiplier) >= 10
                        ? 10
                        : 2;


                const column =
                    multiplier === 10
                        ? "chatXP10Until"
                        : "chatXP2Until";


                await client.query(`

                    UPDATE quest_effects

                    SET ${column} =
                        GREATEST(
                            ${column},
                            $3
                        ) + $4

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    now,
                    Math.max(
                        1,
                        Number(reward.durationMs) ||
                        24 * 60 * 60 * 1000
                    )
                ]);

            }
            else if(reward.type === "shop_discount"){

                const discount =
                    Number(reward.discountPercent) >= 90
                        ? 90
                        : 50;


                const column =
                    discount === 90
                        ? "shopDiscount90Until"
                        : "shopDiscount50Until";


                await client.query(`

                    UPDATE quest_effects

                    SET ${column} =
                        GREATEST(
                            ${column},
                            $3
                        ) + $4

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    now,
                    Math.max(
                        1,
                        Number(reward.durationMs) ||
                        24 * 60 * 60 * 1000
                    )
                ]);

            }
            else if(reward.type === "guaranteed_criticals"){

                await client.query(`

                    UPDATE quest_effects

                    SET guaranteedCriticalsRemaining =
                        guaranteedCriticalsRemaining + $3

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    Math.max(
                        1,
                        Number(reward.amount) || 1
                    )
                ]);

            }
            else if(reward.type === "social_command_triple"){

                await client.query(`

                    UPDATE quest_effects

                    SET socialTripleUntil =
                        GREATEST(
                            socialTripleUntil,
                            $3
                        ) + $4

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    now,
                    Math.max(
                        1,
                        Number(reward.durationMs) ||
                        24 * 60 * 60 * 1000
                    )
                ]);

            }

        }


        await client.query(`

            UPDATE quest_cycles

            SET
                rewarded=TRUE,
                rewardedAt=$5

            WHERE guildID=$1
            AND userID=$2
            AND cycleType=$3
            AND cycleKey=$4

        `, [
            guildID,
            userID,
            String(cycleType).toLowerCase(),
            cycleKey,
            now
        ]);


        await client.query("COMMIT");


        userCache.delete(
            `${guildID}:${userID}`
        );


        return {
            claimed: true,
            status: "claimed",
            rewards
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}


async function getQuestEffects(
    guildID,
    userID
){

    await db.query(`

        INSERT INTO quest_effects
        (
            guildID,
            userID
        )

        VALUES($1,$2)

        ON CONFLICT DO NOTHING

    `, [
        guildID,
        userID
    ]);


    const result =
        await db.query(`

            SELECT *

            FROM quest_effects

            WHERE guildID=$1
            AND userID=$2

        `, [
            guildID,
            userID
        ]);


    return result.rows[0] || null;

}


async function getQuestChatXPMultiplier(
    guildID,
    userID
){

    const effects =
        await getQuestEffects(
            guildID,
            userID
        );


    return resolveChatXPMultiplier(
        effects
    );

}


async function getQuestShopDiscount(
    guildID,
    userID
){

    const effects =
        await getQuestEffects(
            guildID,
            userID
        );


    const now =
        Date.now();


    if(
        Number(
            effects?.shopdiscount90until || 0
        ) > now
    ){

        return 90;

    }


    if(
        Number(
            effects?.shopdiscount50until || 0
        ) > now
    ){

        return 50;

    }


    return 0;

}


async function consumeQuestGuaranteedCritical(
    guildID,
    userID
){

    const result =
        await db.query(`

            UPDATE quest_effects

            SET guaranteedCriticalsRemaining =
                guaranteedCriticalsRemaining - 1

            WHERE guildID=$1
            AND userID=$2
            AND guaranteedCriticalsRemaining > 0

            RETURNING guaranteedCriticalsRemaining

        `, [
            guildID,
            userID
        ]);


    if(result.rowCount === 0){

        return {
            forced: false,
            remaining: 0
        };

    }


    return {
        forced: true,
        remaining:
            Number(
                result.rows[0]
                    ?.guaranteedcriticalsremaining || 0
            )
    };

}


async function getQuestSocialCommandRepeatCount(
    guildID,
    userID
){

    const effects =
        await getQuestEffects(
            guildID,
            userID
        );


    return Number(
        effects?.socialtripleuntil || 0
    ) > Date.now()
        ? 3
        : 1;

}


async function consumeGuaranteedQuestRoll(
    guildID,
    userID
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        await client.query(`

            INSERT INTO quest_effects
            (
                guildID,
                userID
            )

            VALUES($1,$2)

            ON CONFLICT DO NOTHING

        `, [
            guildID,
            userID
        ]);


        const result =
            await client.query(`

                SELECT *

                FROM quest_effects

                WHERE guildID=$1
                AND userID=$2

                FOR UPDATE

            `, [
                guildID,
                userID
            ]);


        const row =
            result.rows[0];


        let rollType =
            null;


        const minimumRewards = [
            {
                field: "guaranteed25m",
                rowField: "guaranteed25m",
                minXP: 25000000
            },
            {
                field: "guaranteed15m",
                rowField: "guaranteed15m",
                minXP: 15000000
            },
            {
                field: "guaranteed10m",
                rowField: "guaranteed10m",
                minXP: 10000000
            },
            {
                field: "guaranteed1m",
                rowField: "guaranteed1m",
                minXP: 1000000
            },
            {
                field: "guaranteed500k",
                rowField: "guaranteed500k",
                minXP: 500000
            },
            {
                field: "guaranteed250k",
                rowField: "guaranteed250k",
                minXP: 250000
            }
        ];


        const minimumReward =
            minimumRewards.find(
                entry =>
                    Number(
                        row[entry.rowField] || 0
                    ) > 0
            );


        if(minimumReward){

            rollType = {
                type: "minimum",
                minXP:
                    minimumReward.minXP
            };


            await client.query(`

                UPDATE quest_effects

                SET ${minimumReward.field} =
                    ${minimumReward.field} - 1

                WHERE guildID=$1
                AND userID=$2

            `, [
                guildID,
                userID
            ]);

        }
        else if(
            Number(
                row.guaranteedimpossible || 0
            ) > 0
        ){

            rollType =
                "impossible";


            await client.query(`

                UPDATE quest_effects

                SET guaranteedImpossible =
                    guaranteedImpossible - 1

                WHERE guildID=$1
                AND userID=$2

            `, [
                guildID,
                userID
            ]);

        }
        else if(
            Number(
                row.guaranteed25k75k || 0
            ) > 0
        ){

            rollType =
                "daily_25k_75k";


            await client.query(`

                UPDATE quest_effects

                SET guaranteed25k75k =
                    guaranteed25k75k - 1

                WHERE guildID=$1
                AND userID=$2

            `, [
                guildID,
                userID
            ]);

        }


        await client.query("COMMIT");


        return rollType;

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}


async function useQuestRollCooldown(
    guildID,
    userID,
    _requestedCooldownMs
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const now =
            Date.now();


        // The database is the final source of truth. Even if an older command
        // passes a 15-minute value, !roll remains fixed at 30 seconds.
        const safeCooldown =
            ROLL_COOLDOWN_MS;


        await client.query(`

            INSERT INTO quest_effects
            (
                guildID,
                userID
            )

            VALUES($1,$2)

            ON CONFLICT DO NOTHING

        `, [
            guildID,
            userID
        ]);


        const effectResult =
            await client.query(`

                SELECT *

                FROM quest_effects

                WHERE guildID=$1
                AND userID=$2

                FOR UPDATE

            `, [
                guildID,
                userID
            ]);


        const effect =
            effectResult.rows[0];


        const burstOptions = [
            {
                rowField: "nextrollburst50",
                column: "nextRollBurst50",
                rollCount: 50
            },
            {
                rowField: "nextrollburst20",
                column: "nextRollBurst20",
                rollCount: 20
            },
            {
                rowField: "nextrollburst10",
                column: "nextRollBurst10",
                rollCount: 10
            }
        ];


        const burst =
            burstOptions.find(
                entry =>
                    Number(
                        effect[entry.rowField] || 0
                    ) > 0
            ) || null;


        let timedRollCount = 1;
        let activeUntil = 0;


        if(
            Number(
                effect.triplerolluntil || 0
            ) > now
        ){

            timedRollCount = 3;
            activeUntil =
                Number(
                    effect.triplerolluntil
                );

        }


        if(
            Number(
                effect.multirolluntil || 0
            ) > now
        ){

            timedRollCount =
                Math.max(
                    timedRollCount,
                    Math.max(
                        2,
                        Number(
                            effect.multirollcount
                        ) || 3
                    )
                );

            activeUntil =
                Math.max(
                    activeUntil,
                    Number(
                        effect.multirolluntil
                    )
                );

        }


        const merchantRollPerk =
            getTravelingMerchantRollPerk(
                effect,
                now
            );


        timedRollCount =
            Math.max(
                timedRollCount,
                merchantRollPerk.rollCount
            );


        activeUntil =
            Math.max(
                activeUntil,
                merchantRollPerk.activeUntil
            );


        const rollCount =
            Math.max(
                timedRollCount,
                burst?.rollCount || 1
            );


        if(rollCount > 1){

            const windowEndsAt =
                Number(
                    effect.rollwindowendsat || 0
                );


            const windowRemaining =
                windowEndsAt - now;


            // Only trust a saved window when it fits inside the fixed
            // 30-second Multi Roll cooldown. Longer values came from an
            // older bug and are repaired by allowing this batch now, then
            // replacing the bad timestamp below.
            if(
                windowRemaining > 0
                &&
                windowRemaining <=
                    ROLL_COOLDOWN_MS
            ){

                await client.query("COMMIT");


                return {
                    allowed: false,
                    remaining:
                        windowRemaining,
                    multiRoll: true,
                    tripleRoll: true,
                    rollCount,
                    cooldownEndsAt:
                        windowEndsAt,
                    activeUntil,
                    oneShotBurst:
                        Boolean(burst)
                };

            }


            const nextWindowEndsAt =
                now + ROLL_COOLDOWN_MS;


            if(burst){

                await client.query(`

                    UPDATE quest_effects

                    SET
                        rollWindowEndsAt=$3,
                        rollWindowUses=$4,
                        ${burst.column}=${burst.column}-1

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    nextWindowEndsAt,
                    rollCount
                ]);

            }
            else{

                await client.query(`

                    UPDATE quest_effects

                    SET
                        rollWindowEndsAt=$3,
                        rollWindowUses=$4

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    nextWindowEndsAt,
                    rollCount
                ]);

            }


            await client.query("COMMIT");


            return {
                allowed: true,
                remaining: 0,
                multiRoll: true,
                tripleRoll: true,
                rollCount,
                cooldownEndsAt:
                    nextWindowEndsAt,
                activeUntil,
                oneShotBurst:
                    Boolean(burst)
            };

        }


        const cooldownResult =
            await client.query(`

                SELECT expiresAt

                FROM command_cooldowns

                WHERE guildID=$1
                AND userID=$2
                AND commandName='roll'

                FOR UPDATE

            `, [
                guildID,
                userID
            ]);


        const existing =
            cooldownResult.rows[0];


        const remaining =
            existing
                ? Number(existing.expiresat) - now
                : 0;


        // Honor only a legitimate 30-second window. A longer remaining value
        // is stale data from the old Luck cooldown system; ignore it and let
        // the upsert below replace it with a correct 30-second timestamp.
        if(
            remaining > 0
            &&
            remaining <= ROLL_COOLDOWN_MS
        ){

            await client.query("COMMIT");


            return {
                allowed: false,
                remaining,
                multiRoll: false,
                tripleRoll: false,
                rollCount: 1,
                cooldownEndsAt:
                    Number(
                        existing.expiresat
                    )
            };

        }


        await client.query(`

            INSERT INTO command_cooldowns
            (
                guildID,
                userID,
                commandName,
                expiresAt
            )

            VALUES($1,$2,'roll',$3)

            ON CONFLICT(
                guildID,
                userID,
                commandName
            )

            DO UPDATE SET
                expiresAt=$3

        `, [
            guildID,
            userID,
            now + safeCooldown
        ]);


        await client.query("COMMIT");


        return {
            allowed: true,
            remaining: 0,
            multiRoll: false,
            tripleRoll: false,
            rollCount: 1,
            cooldownEndsAt:
                now + safeCooldown
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}


// Atomically advances the persistent 100-roll guarantee. A stored value of
// zero means the previous roll completed a milestone; the returned display
// value is 100 for that result and starts back at 1 on the next roll.
async function advanceRollGuarantee(
    guildID,
    userID,
    threshold = 100
){

    const safeThreshold =
        Math.max(
            2,
            Math.floor(
                Number(threshold) || 100
            )
        );


    const result =
        await db.query(`

            INSERT INTO users
            (
                guildID,
                userID,
                rollGuaranteeProgress
            )

            VALUES($1,$2,1)

            ON CONFLICT(
                guildID,
                userID
            )

            DO UPDATE SET
                rollGuaranteeProgress =
                    MOD(
                        GREATEST(
                            0,
                            users.rollGuaranteeProgress
                        ) + 1,
                        $3
                    )

            RETURNING rollGuaranteeProgress

        `, [
            guildID,
            userID,
            safeThreshold
        ]);


    const storedProgress =
        Number(
            result.rows[0]
                ?.rollguaranteeprogress
        ) || 0;


    const guaranteed =
        storedProgress === 0;


    return {
        threshold: safeThreshold,
        guaranteed,
        progress:
            guaranteed
                ? safeThreshold
                : storedProgress
    };

}



// =====================================================
// TRADING SYSTEM
// =====================================================

async function createTradeRequest(
    guildID,
    user1ID,
    user2ID,
    expiresAt
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        // Advisory locks prevent two simultaneous !trade requests
        // from putting the same person in multiple open trades.
        const lockKeys =
            [
                `${guildID}:${user1ID}`,
                `${guildID}:${user2ID}`
            ].sort();


        for(const lockKey of lockKeys){

            await client.query(
                `SELECT pg_advisory_xact_lock(hashtext($1))`,
                [lockKey]
            );

        }


        const now =
            Date.now();


        await client.query(`

            UPDATE trades

            SET
                status='expired',
                updatedAt=$1,
                failureReason='Trade expired.'

            WHERE guildID=$2
            AND expiresAt <= $1
            AND status IN (
                'pending',
                'setup',
                'active'
            )
            AND (
                user1ID=$3
                OR user2ID=$3
                OR user1ID=$4
                OR user2ID=$4
            )

        `, [
            now,
            guildID,
            user1ID,
            user2ID
        ]);


        const existing =
            await client.query(`

                SELECT *

                FROM trades

                WHERE guildID=$1

                AND status IN (
                    'pending',
                    'setup',
                    'active',
                    'processing'
                )

                AND (
                    user1ID=$2
                    OR user2ID=$2
                    OR user1ID=$3
                    OR user2ID=$3
                )

                ORDER BY id DESC

                LIMIT 1

                FOR UPDATE

            `, [
                guildID,
                user1ID,
                user2ID
            ]);


        if(existing.rowCount > 0){

            await client.query("COMMIT");

            return {
                success: false,
                status: "busy",
                trade:
                    parseTradeRow(
                        existing.rows[0]
                    )
            };

        }


        const result =
            await client.query(`

                INSERT INTO trades
                (
                    guildID,
                    user1ID,
                    user2ID,
                    status,
                    createdAt,
                    updatedAt,
                    expiresAt
                )

                VALUES
                (
                    $1,$2,$3,
                    'pending',
                    $4,$4,$5
                )

                RETURNING *

            `, [
                guildID,
                user1ID,
                user2ID,
                now,
                Number(expiresAt)
            ]);


        await client.query("COMMIT");


        return {
            success: true,
            status: "created",
            trade:
                parseTradeRow(
                    result.rows[0]
                )
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}



async function getTrade(tradeID){

    const result =
        await db.query(`

            SELECT *

            FROM trades

            WHERE id=$1

        `, [
            Number(tradeID)
        ]);


    return parseTradeRow(
        result.rows[0]
    );

}



async function getOpenTradeForUser(
    guildID,
    userID
){

    const result =
        await db.query(`

            SELECT *

            FROM trades

            WHERE guildID=$1

            AND (
                user1ID=$2
                OR user2ID=$2
            )

            AND status IN (
                'pending',
                'setup',
                'active',
                'processing'
            )

            ORDER BY id DESC

            LIMIT 1

        `, [
            guildID,
            userID
        ]);


    return parseTradeRow(
        result.rows[0]
    );

}



async function beginTradeSetup(
    tradeID,
    userID,
    expiresAt
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const result =
            await client.query(`

                SELECT *

                FROM trades

                WHERE id=$1

                FOR UPDATE

            `, [
                Number(tradeID)
            ]);


        const row =
            result.rows[0];


        if(!row){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "missing"
            };

        }


        if(
            String(row.user2id) !==
            String(userID)
        ){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "not-target"
            };

        }


        if(
            row.status !== "pending"
        ){

            await client.query("COMMIT");

            return {
                success: false,
                status: row.status,
                trade:
                    parseTradeRow(row)
            };

        }


        if(
            Number(row.expiresat) <=
            Date.now()
        ){

            await client.query(`

                UPDATE trades

                SET
                    status='expired',
                    updatedAt=$2,
                    failureReason='Trade invite expired.'

                WHERE id=$1

            `, [
                Number(tradeID),
                Date.now()
            ]);


            await client.query("COMMIT");


            return {
                success: false,
                status: "expired"
            };

        }


        const updated =
            await client.query(`

                UPDATE trades

                SET
                    status='setup',
                    updatedAt=$2,
                    expiresAt=$3,
                    failureReason=NULL

                WHERE id=$1

                RETURNING *

            `, [
                Number(tradeID),
                Date.now(),
                Number(expiresAt)
            ]);


        await client.query("COMMIT");


        return {
            success: true,
            status: "setup",
            trade:
                parseTradeRow(
                    updated.rows[0]
                )
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}



async function activateTrade(
    tradeID,
    roleID,
    channelID,
    panelMessageID,
    expiresAt
){

    const result =
        await db.query(`

            UPDATE trades

            SET
                status='active',
                roleID=$2,
                channelID=$3,
                panelMessageID=$4,
                updatedAt=$5,
                expiresAt=$6,
                user1Confirmed=FALSE,
                user2Confirmed=FALSE,
                failureReason=NULL,
                cleaned=FALSE

            WHERE id=$1
            AND status='setup'

            RETURNING *

        `, [
            Number(tradeID),
            String(roleID),
            String(channelID),
            String(panelMessageID),
            Date.now(),
            Number(expiresAt)
        ]);


    return parseTradeRow(
        result.rows[0]
    );

}



async function updateTradePanelMessage(
    tradeID,
    panelMessageID
){

    await db.query(`

        UPDATE trades

        SET
            panelMessageID=$2,
            updatedAt=$3

        WHERE id=$1

    `, [
        Number(tradeID),
        String(panelMessageID),
        Date.now()
    ]);

}



async function updateTradeOffer(
    tradeID,
    userID,
    offer,
    expiresAt
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const result =
            await client.query(`

                SELECT *

                FROM trades

                WHERE id=$1

                FOR UPDATE

            `, [
                Number(tradeID)
            ]);


        const row =
            result.rows[0];


        if(!row){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "missing"
            };

        }


        if(
            row.status !== "active"
        ){

            await client.query("COMMIT");

            return {
                success: false,
                status: row.status,
                trade:
                    parseTradeRow(row)
            };

        }


        if(
            Number(row.expiresat) <=
            Date.now()
        ){

            await client.query(`

                UPDATE trades

                SET
                    status='expired',
                    updatedAt=$2,
                    failureReason='Trade expired.'

                WHERE id=$1

            `, [
                Number(tradeID),
                Date.now()
            ]);


            await client.query("COMMIT");


            return {
                success: false,
                status: "expired"
            };

        }


        const normalized =
            normalizeTradeOffer(
                offer
            );


        let column;


        if(
            String(row.user1id) ===
            String(userID)
        ){

            column =
                "user1Offer";

        }
        else if(
            String(row.user2id) ===
            String(userID)
        ){

            column =
                "user2Offer";

        }
        else{

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "not-participant"
            };

        }


        const updated =
            await client.query(`

                UPDATE trades

                SET
                    ${column}=$2::jsonb,
                    user1Confirmed=FALSE,
                    user2Confirmed=FALSE,
                    updatedAt=$3,
                    expiresAt=$4,
                    failureReason=NULL

                WHERE id=$1

                RETURNING *

            `, [
                Number(tradeID),
                JSON.stringify(
                    normalized
                ),
                Date.now(),
                Number(expiresAt)
            ]);


        await client.query("COMMIT");


        return {
            success: true,
            status: "updated",
            trade:
                parseTradeRow(
                    updated.rows[0]
                )
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}



async function confirmTrade(
    tradeID,
    userID,
    expiresAt
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const result =
            await client.query(`

                SELECT *

                FROM trades

                WHERE id=$1

                FOR UPDATE

            `, [
                Number(tradeID)
            ]);


        const row =
            result.rows[0];


        if(!row){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "missing"
            };

        }


        if(
            row.status !== "active"
        ){

            await client.query("COMMIT");

            return {
                success: false,
                status: row.status,
                trade:
                    parseTradeRow(row)
            };

        }


        if(
            Number(row.expiresat) <=
            Date.now()
        ){

            await client.query(`

                UPDATE trades

                SET
                    status='expired',
                    updatedAt=$2,
                    failureReason='Trade expired.'

                WHERE id=$1

            `, [
                Number(tradeID),
                Date.now()
            ]);


            await client.query("COMMIT");


            return {
                success: false,
                status: "expired"
            };

        }


        let confirmColumn;


        if(
            String(row.user1id) ===
            String(userID)
        ){

            confirmColumn =
                "user1Confirmed";

        }
        else if(
            String(row.user2id) ===
            String(userID)
        ){

            confirmColumn =
                "user2Confirmed";

        }
        else{

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "not-participant"
            };

        }


        const updated =
            await client.query(`

                UPDATE trades

                SET
                    ${confirmColumn}=TRUE,
                    updatedAt=$2,
                    expiresAt=$3

                WHERE id=$1

                RETURNING *

            `, [
                Number(tradeID),
                Date.now(),
                Number(expiresAt)
            ]);


        let trade =
            parseTradeRow(
                updated.rows[0]
            );


        const readyToProcess =
            trade.user1confirmed &&
            trade.user2confirmed;


        if(readyToProcess){

            const processing =
                await client.query(`

                    UPDATE trades

                    SET
                        status='processing',
                        updatedAt=$2

                    WHERE id=$1

                    RETURNING *

                `, [
                    Number(tradeID),
                    Date.now()
                ]);


            trade =
                parseTradeRow(
                    processing.rows[0]
                );

        }


        await client.query("COMMIT");


        return {
            success: true,
            status:
                readyToProcess
                    ? "processing"
                    : "confirmed",
            readyToProcess,
            trade
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}



async function cancelTrade(
    tradeID,
    cancelledBy,
    reason = "Trade cancelled.",
    terminalStatus = "cancelled"
){

    const allowedStatuses =
        new Set([
            "cancelled",
            "declined",
            "expired"
        ]);


    const status =
        allowedStatuses.has(
            terminalStatus
        )
            ? terminalStatus
            : "cancelled";


    const result =
        await db.query(`

            UPDATE trades

            SET
                status=$2,
                cancelledBy=$3,
                failureReason=$4,
                updatedAt=$5,
                user1Confirmed=FALSE,
                user2Confirmed=FALSE

            WHERE id=$1

            AND status NOT IN (
                'completed',
                'cancelled',
                'declined',
                'expired'
            )

            RETURNING *

        `, [
            Number(tradeID),
            status,
            cancelledBy
                ? String(cancelledBy)
                : null,
            String(reason),
            Date.now()
        ]);


    if(result.rowCount > 0){

        return parseTradeRow(
            result.rows[0]
        );

    }


    return getTrade(
        tradeID
    );

}



async function cancelOpenTradesForUser(
    guildID,
    userID,
    reason = "A trader left the server."
){

    const result =
        await db.query(`

            UPDATE trades

            SET
                status='cancelled',
                cancelledBy=$2,
                failureReason=$3,
                updatedAt=$4,
                user1Confirmed=FALSE,
                user2Confirmed=FALSE

            WHERE guildID=$1

            AND (
                user1ID=$2
                OR user2ID=$2
            )

            AND status IN (
                'pending',
                'setup',
                'active',
                'processing'
            )

            RETURNING *

        `, [
            guildID,
            userID,
            String(reason),
            Date.now()
        ]);


    return result.rows.map(
        parseTradeRow
    );

}



async function executeTradeTransaction(
    tradeID,
    retryExpiresAt
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const tradeResult =
            await client.query(`

                SELECT *

                FROM trades

                WHERE id=$1

                FOR UPDATE

            `, [
                Number(tradeID)
            ]);


        const rawTrade =
            tradeResult.rows[0];


        if(!rawTrade){

            await client.query("ROLLBACK");

            return {
                success: false,
                status: "missing"
            };

        }


        if(
            rawTrade.status !==
            "processing"
        ){

            await client.query("COMMIT");

            return {
                success:
                    rawTrade.status ===
                    "completed",
                status:
                    rawTrade.status,
                trade:
                    parseTradeRow(
                        rawTrade
                    )
            };

        }


        const trade =
            parseTradeRow(
                rawTrade
            );


        const offer1 =
            normalizeTradeOffer(
                trade.user1offer
            );

        const offer2 =
            normalizeTradeOffer(
                trade.user2offer
            );


        if(
            isTradeOfferEmpty(offer1)
            &&
            isTradeOfferEmpty(offer2)
        ){

            const reset =
                await client.query(`

                    UPDATE trades

                    SET
                        status='active',
                        user1Confirmed=FALSE,
                        user2Confirmed=FALSE,
                        failureReason='The trade has no items.',
                        updatedAt=$2,
                        expiresAt=$3

                    WHERE id=$1

                    RETURNING *

                `, [
                    Number(tradeID),
                    Date.now(),
                    Number(retryExpiresAt)
                ]);


            await client.query("COMMIT");


            return {
                success: false,
                status: "empty-trade",
                trade:
                    parseTradeRow(
                        reset.rows[0]
                    )
            };

        }


        const fee1 =
            calculateTradeFee(
                offer1
            );

        const fee2 =
            calculateTradeFee(
                offer2
            );


        // Ensure both user rows exist before locking them.
        await client.query(`

            INSERT INTO users
            (
                guildID,
                userID
            )

            VALUES
                ($1,$2),
                ($1,$3)

            ON CONFLICT DO NOTHING

        `, [
            trade.guildid,
            trade.user1id,
            trade.user2id
        ]);


        const usersResult =
            await client.query(`

                SELECT
                    userID,
                    xp

                FROM users

                WHERE guildID=$1

                AND userID IN (
                    $2,
                    $3
                )

                FOR UPDATE

            `, [
                trade.guildid,
                trade.user1id,
                trade.user2id
            ]);


        const balances =
            new Map(
                usersResult.rows.map(
                    row => [
                        String(row.userid),
                        Number(row.xp) || 0
                    ]
                )
            );


        const balance1 =
            balances.get(
                String(trade.user1id)
            ) || 0;

        const balance2 =
            balances.get(
                String(trade.user2id)
            ) || 0;


        // =====================================================
        // LEVEL 1-99 TRADE XP PROTECTION
        // =====================================================
        //
        // A player who is below Level 100 BEFORE this trade
        // may receive at most 100,000 raw incoming XP from the
        // other trader. This is checked inside the same locked
        // PostgreSQL transaction so it cannot be bypassed by
        // racing confirmations or changing XP at the same time.
        const user1BelowLevel100 =
            balance1 <
            LEVEL_100_XP_THRESHOLD;


        const user2BelowLevel100 =
            balance2 <
            LEVEL_100_XP_THRESHOLD;


        const resetForLowLevelTradeCap =
            async (
                protectedUserID,
                incomingXP
            ) => {

                const reset =
                    await client.query(`

                        UPDATE trades

                        SET
                            status='active',
                            user1Confirmed=FALSE,
                            user2Confirmed=FALSE,
                            failureReason=$2,
                            updatedAt=$3,
                            expiresAt=$4

                        WHERE id=$1

                        RETURNING *

                    `, [
                        Number(tradeID),
                        `Level 1-99 protection: User ${protectedUserID} can receive at most ${LOW_LEVEL_TRADE_INCOMING_XP_CAP.toLocaleString()} XP per trade.`,
                        Date.now(),
                        Number(retryExpiresAt)
                    ]);


                await client.query("COMMIT");


                return {
                    success: false,
                    status:
                        "low-level-xp-cap",
                    userID:
                        String(
                            protectedUserID
                        ),
                    incomingXP:
                        Number(incomingXP) || 0,
                    cap:
                        LOW_LEVEL_TRADE_INCOMING_XP_CAP,
                    trade:
                        parseTradeRow(
                            reset.rows[0]
                        )
                };

            };


        // User 1 receives the XP offered by User 2.
        if(
            user1BelowLevel100
            &&
            offer2.xp >
                LOW_LEVEL_TRADE_INCOMING_XP_CAP
        ){

            return resetForLowLevelTradeCap(
                trade.user1id,
                offer2.xp
            );

        }


        // User 2 receives the XP offered by User 1.
        if(
            user2BelowLevel100
            &&
            offer1.xp >
                LOW_LEVEL_TRADE_INCOMING_XP_CAP
        ){

            return resetForLowLevelTradeCap(
                trade.user2id,
                offer1.xp
            );

        }


        const required1 =
            offer1.xp +
            fee1.total;

        const required2 =
            offer2.xp +
            fee2.total;


        if(balance1 < required1){

            const reset =
                await client.query(`

                    UPDATE trades

                    SET
                        status='active',
                        user1Confirmed=FALSE,
                        user2Confirmed=FALSE,
                        failureReason=$2,
                        updatedAt=$3,
                        expiresAt=$4

                    WHERE id=$1

                    RETURNING *

                `, [
                    Number(tradeID),
                    `User ${trade.user1id} no longer has enough XP.`,
                    Date.now(),
                    Number(retryExpiresAt)
                ]);


            await client.query("COMMIT");


            return {
                success: false,
                status: "insufficient-xp",
                userID:
                    String(trade.user1id),
                balance: balance1,
                required: required1,
                trade:
                    parseTradeRow(
                        reset.rows[0]
                    )
            };

        }


        if(balance2 < required2){

            const reset =
                await client.query(`

                    UPDATE trades

                    SET
                        status='active',
                        user1Confirmed=FALSE,
                        user2Confirmed=FALSE,
                        failureReason=$2,
                        updatedAt=$3,
                        expiresAt=$4

                    WHERE id=$1

                    RETURNING *

                `, [
                    Number(tradeID),
                    `User ${trade.user2id} no longer has enough XP.`,
                    Date.now(),
                    Number(retryExpiresAt)
                ]);


            await client.query("COMMIT");


            return {
                success: false,
                status: "insufficient-xp",
                userID:
                    String(trade.user2id),
                balance: balance2,
                required: required2,
                trade:
                    parseTradeRow(
                        reset.rows[0]
                    )
            };

        }


        const inventoryResult =
            await client.query(`

                SELECT
                    userID,
                    boostType,
                    tier,
                    amount

                FROM boost_inventory

                WHERE guildID=$1

                AND userID IN (
                    $2,
                    $3
                )

                FOR UPDATE

            `, [
                trade.guildid,
                trade.user1id,
                trade.user2id
            ]);


        const inventory =
            new Map();


        for(const row of inventoryResult.rows){

            inventory.set(
                `${row.userid}:` +
                `${String(row.boosttype).toLowerCase()}:` +
                `${String(row.tier).toLowerCase()}`,
                Number(row.amount) || 0
            );

        }


        const verifyBoosts =
            (
                ownerID,
                offer
            ) => {

                for(
                    const [key, required] of
                    Object.entries(
                        offer.boosts
                    )
                ){

                    const available =
                        inventory.get(
                            `${ownerID}:${key}`
                        ) || 0;


                    if(available < required){

                        return {
                            key,
                            required,
                            available
                        };

                    }

                }


                return null;

            };


        const missing1 =
            verifyBoosts(
                String(trade.user1id),
                offer1
            );


        if(missing1){

            const reset =
                await client.query(`

                    UPDATE trades

                    SET
                        status='active',
                        user1Confirmed=FALSE,
                        user2Confirmed=FALSE,
                        failureReason=$2,
                        updatedAt=$3,
                        expiresAt=$4

                    WHERE id=$1

                    RETURNING *

                `, [
                    Number(tradeID),
                    `User ${trade.user1id} no longer owns all offered boosts.`,
                    Date.now(),
                    Number(retryExpiresAt)
                ]);


            await client.query("COMMIT");


            return {
                success: false,
                status: "insufficient-boost",
                userID:
                    String(trade.user1id),
                ...missing1,
                trade:
                    parseTradeRow(
                        reset.rows[0]
                    )
            };

        }


        const missing2 =
            verifyBoosts(
                String(trade.user2id),
                offer2
            );


        if(missing2){

            const reset =
                await client.query(`

                    UPDATE trades

                    SET
                        status='active',
                        user1Confirmed=FALSE,
                        user2Confirmed=FALSE,
                        failureReason=$2,
                        updatedAt=$3,
                        expiresAt=$4

                    WHERE id=$1

                    RETURNING *

                `, [
                    Number(tradeID),
                    `User ${trade.user2id} no longer owns all offered boosts.`,
                    Date.now(),
                    Number(retryExpiresAt)
                ]);


            await client.query("COMMIT");


            return {
                success: false,
                status: "insufficient-boost",
                userID:
                    String(trade.user2id),
                ...missing2,
                trade:
                    parseTradeRow(
                        reset.rows[0]
                    )
            };

        }


        const finalBalance1 =
            balance1 -
            offer1.xp -
            fee1.total +
            offer2.xp;

        const finalBalance2 =
            balance2 -
            offer2.xp -
            fee2.total +
            offer1.xp;


        await client.query(`

            UPDATE users

            SET xp=$3

            WHERE guildID=$1
            AND userID=$2

        `, [
            trade.guildid,
            trade.user1id,
            finalBalance1
        ]);


        await client.query(`

            UPDATE users

            SET xp=$3

            WHERE guildID=$1
            AND userID=$2

        `, [
            trade.guildid,
            trade.user2id,
            finalBalance2
        ]);


        const moveBoosts =
            async (
                fromUserID,
                toUserID,
                offer
            ) => {

                for(
                    const [key, amount] of
                    Object.entries(
                        offer.boosts
                    )
                ){

                    const [
                        boostType,
                        tier
                    ] = key.split(":");


                    await client.query(`

                        UPDATE boost_inventory

                        SET amount =
                            amount - $5

                        WHERE guildID=$1
                        AND userID=$2
                        AND boostType=$3
                        AND tier=$4

                    `, [
                        trade.guildid,
                        fromUserID,
                        boostType,
                        tier,
                        amount
                    ]);


                    await client.query(`

                        DELETE FROM boost_inventory

                        WHERE guildID=$1
                        AND userID=$2
                        AND boostType=$3
                        AND tier=$4
                        AND amount <= 0

                    `, [
                        trade.guildid,
                        fromUserID,
                        boostType,
                        tier
                    ]);


                    await client.query(`

                        INSERT INTO boost_inventory
                        (
                            guildID,
                            userID,
                            boostType,
                            tier,
                            amount
                        )

                        VALUES
                        ($1,$2,$3,$4,$5)

                        ON CONFLICT(
                            guildID,
                            userID,
                            boostType,
                            tier
                        )

                        DO UPDATE SET

                            amount =
                                boost_inventory.amount +
                                EXCLUDED.amount

                    `, [
                        trade.guildid,
                        toUserID,
                        boostType,
                        tier,
                        amount
                    ]);

                }

            };


        await moveBoosts(
            trade.user1id,
            trade.user2id,
            offer1
        );


        await moveBoosts(
            trade.user2id,
            trade.user1id,
            offer2
        );


        const completed =
            await client.query(`

                UPDATE trades

                SET
                    status='completed',
                    fee1=$2,
                    fee2=$3,
                    completedAt=$4,
                    updatedAt=$4,
                    failureReason=NULL,
                    user1Confirmed=TRUE,
                    user2Confirmed=TRUE

                WHERE id=$1

                RETURNING *

            `, [
                Number(tradeID),
                fee1.total,
                fee2.total,
                Date.now()
            ]);


        await client.query("COMMIT");


        userCache.delete(
            `${trade.guildid}:${trade.user1id}`
        );

        userCache.delete(
            `${trade.guildid}:${trade.user2id}`
        );


        return {
            success: true,
            status: "completed",
            trade:
                parseTradeRow(
                    completed.rows[0]
                ),
            fee1,
            fee2,
            balance1:
                finalBalance1,
            balance2:
                finalBalance2
        };

    }
    catch(error){

        await client.query("ROLLBACK");

        throw error;

    }
    finally{

        client.release();

    }

}



async function getExpiredTrades(
    now = Date.now()
){

    const result =
        await db.query(`

            SELECT *

            FROM trades

            WHERE status IN (
                'pending',
                'setup',
                'active'
            )

            AND expiresAt <= $1

            ORDER BY id ASC

        `, [
            Number(now)
        ]);


    return result.rows.map(
        parseTradeRow
    );

}



async function getProcessingTrades(){

    const result =
        await db.query(`

            SELECT *

            FROM trades

            WHERE status='processing'

            ORDER BY id ASC

        `);


    return result.rows.map(
        parseTradeRow
    );

}



async function getTradesNeedingCleanup(){

    const result =
        await db.query(`

            SELECT *

            FROM trades

            WHERE cleaned=FALSE

            AND status IN (
                'completed',
                'cancelled',
                'declined',
                'expired'
            )

            AND (
                channelID IS NOT NULL
                OR roleID IS NOT NULL
            )

            ORDER BY id ASC

        `);


    return result.rows.map(
        parseTradeRow
    );

}



async function markTradeCleaned(
    tradeID
){

    await db.query(`

        UPDATE trades

        SET
            cleaned=TRUE,
            updatedAt=$2

        WHERE id=$1

    `, [
        Number(tradeID),
        Date.now()
    ]);

}


// =====================================================
// MODERATION SYSTEM
// =====================================================

async function createModerationBan({
    guildID,
    userID,
    moderatorID,
    reason,
    expiresAt,
    savedRoleIDs
}){
    const result = await db.query(`
        INSERT INTO moderation_bans
        (guildID, userID, moderatorID, reason, savedRoleIDs, startedAt, expiresAt, active, endedAt, endedBy)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,TRUE,NULL,NULL)
        ON CONFLICT(guildID, userID)
        DO UPDATE SET
            moderatorID=EXCLUDED.moderatorID,
            reason=EXCLUDED.reason,
            savedRoleIDs=EXCLUDED.savedRoleIDs,
            startedAt=EXCLUDED.startedAt,
            expiresAt=EXCLUDED.expiresAt,
            active=TRUE,
            endedAt=NULL,
            endedBy=NULL
        RETURNING *
    `, [
        String(guildID),
        String(userID),
        String(moderatorID),
        String(reason),
        JSON.stringify(savedRoleIDs || []),
        Date.now(),
        Number(expiresAt)
    ]);
    return result.rows[0] || null;
}

async function getActiveModerationBan(guildID, userID){
    const result = await db.query(`
        SELECT * FROM moderation_bans
        WHERE guildID=$1 AND userID=$2 AND active=TRUE
        LIMIT 1
    `, [String(guildID), String(userID)]);
    return result.rows[0] || null;
}

async function getActiveModerationBans(guildID){
    const result = await db.query(`
        SELECT * FROM moderation_bans
        WHERE guildID=$1 AND active=TRUE
        ORDER BY expiresAt ASC
    `, [String(guildID)]);
    return result.rows;
}

async function getExpiredModerationBans(){
    const result = await db.query(`
        SELECT * FROM moderation_bans
        WHERE active=TRUE AND expiresAt <= $1
        ORDER BY expiresAt ASC
    `, [Date.now()]);
    return result.rows;
}

async function finishModerationBan(guildID, userID, endedBy){
    await db.query(`
        UPDATE moderation_bans
        SET active=FALSE, endedAt=$3, endedBy=$4
        WHERE guildID=$1 AND userID=$2 AND active=TRUE
    `, [String(guildID), String(userID), Date.now(), String(endedBy || "Unknown")]);
}

async function cancelModerationBan(guildID, userID){
    await db.query(`
        DELETE FROM moderation_bans
        WHERE guildID=$1 AND userID=$2 AND active=TRUE
    `, [String(guildID), String(userID)]);
}

async function getModerationPanelMessageID(guildID){
    const result = await db.query(`
        SELECT panelMessageID FROM moderation_config WHERE guildID=$1
    `, [String(guildID)]);
    return result.rows[0]?.panelmessageid || null;
}

async function setModerationPanelMessageID(guildID, messageID){
    await db.query(`
        INSERT INTO moderation_config(guildID, panelMessageID)
        VALUES($1,$2)
        ON CONFLICT(guildID)
        DO UPDATE SET panelMessageID=EXCLUDED.panelMessageID
    `, [String(guildID), String(messageID)]);
}



module.exports = {


    SHOP_CATALOG,

    SHOP_PRICE_OPTIONS,

    SHOP_REFRESH_TIME,

    getGlobalShop,

    purchaseGlobalShopItem,

    TRAVELING_MERCHANT_CHANCE,

    TRAVELING_MERCHANT_DEALS_PER_VISIT,

    TRAVELING_MERCHANT_REFRESH_TIME,

    TRAVELING_MERCHANT_VISIT_TIME,

    TRAVELING_MERCHANT_DEAL_TEMPLATES,

    createTravelingMerchantDeals,

    rollTravelingMerchantAppearance,

    getTravelingMerchantRollPerk,

    resolveChatXPMultiplier,

    getTravelingMerchant,

    purchaseTravelingMerchantDeal,

    initDatabase,

    getUser,

    addXP,

    giveXP,

    removeUser,

    getAllUsers,

    setXP,

    setLevel,

    getLeaderboard,

    getPeriodLeaderboard,

    addBoostActivity,

    getHourlyBoostXP,

    resetHourlyBoostXP,

    getBoost,

    updateBoost,

    clearBoost,

    getExpiredBoosts,

    getAllBoosts,

    getCriticalStreak,

    setCriticalStreak,

    resetCriticalStreak,

    addXPLog,

    getRecentXPLogs,

    getCommandCooldownRemaining,

    setCommandCooldown,

    clearCommandCooldown,

    getLuckBoost,

    updateLuckBoost,

    clearLuckBoost,

    getExpiredLuckBoosts,

    getAllLuckBoosts,

    addBoostInventory,

    getBoostInventory,

    getBoostInventoryAmount,

    consumeBoostInventory,

    getMessageMutePreferences,

    isMessageTypeMuted,

    toggleMessageTypeMute,

    QUEST_RESET_CONFIG,

    getQuestResetPrice,

    getQuestCycle,

    createQuestCycle,

    getActiveQuestCycles,

    replaceQuestCycleData,

    resetQuestCycleWithXP,

    updateQuestCycleProgress,

    claimQuestCycleRewards,

    getQuestEffects,

    getQuestChatXPMultiplier,

    getQuestShopDiscount,

    consumeQuestGuaranteedCritical,

    getQuestSocialCommandRepeatCount,

    consumeGuaranteedQuestRoll,

    useQuestRollCooldown,

    advanceRollGuarantee,


    TRADE_BASE_FEE,

    TRADE_XP_FEE_RATE,

    TRADE_BOOST_FEES,

    normalizeTradeOffer,

    calculateTradeFee,

    createTradeRequest,

    getTrade,

    getOpenTradeForUser,

    beginTradeSetup,

    activateTrade,

    updateTradePanelMessage,

    updateTradeOffer,

    confirmTrade,

    cancelTrade,

    cancelOpenTradesForUser,

    executeTradeTransaction,

    getExpiredTrades,

    getProcessingTrades,

    getTradesNeedingCleanup,

    markTradeCleaned,

    createModerationBan,
    getActiveModerationBan,
    getActiveModerationBans,
    getExpiredModerationBans,
    finishModerationBan,
    cancelModerationBan,
    getModerationPanelMessageID,
    setModerationPanelMessageID,


};
