const { Pool } = require("pg");



// =======================
// DATABASE CONNECTION
// =======================

const db = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl:{
        rejectUnauthorized:false
    },

    max:10

});

const userCache = new Map();

const CACHE_TIME = 30000;


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
        price: 1999,
        maxStock: 15
    },

    "xp:tier2": {
        key: "xp:tier2",
        boostType: "xp",
        tier: "tier2",
        price: 9999,
        maxStock: 15
    },

    "xp:tier3": {
        key: "xp:tier3",
        boostType: "xp",
        tier: "tier3",
        price: 29999,
        maxStock: 10
    },

    "xp:max": {
        key: "xp:max",
        boostType: "xp",
        tier: "max",
        price: 199999,
        maxStock: 5
    },

    "luck:tier1": {
        key: "luck:tier1",
        boostType: "luck",
        tier: "tier1",
        price: 9999,
        maxStock: 15
    },

    "luck:tier2": {
        key: "luck:tier2",
        boostType: "luck",
        tier: "tier2",
        price: 79999,
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

    CREATE TABLE IF NOT EXISTS xp_boost_progress (

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        role TEXT,

        lastAwardXP BIGINT NOT NULL DEFAULT 0,

        PRIMARY KEY(
            guildID,
            userID
        )

    )

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

        PRIMARY KEY(
            guildID,
            userID,
            cycleType,
            cycleKey
        )

    )

`);


await db.query(`

    CREATE TABLE IF NOT EXISTS quest_effects (

        guildID TEXT NOT NULL,

        userID TEXT NOT NULL,

        guaranteed25k75k INTEGER NOT NULL DEFAULT 0,

        guaranteedImpossible INTEGER NOT NULL DEFAULT 0,

        tripleRollUntil BIGINT NOT NULL DEFAULT 0,

        rollWindowEndsAt BIGINT NOT NULL DEFAULT 0,

        rollWindowUses INTEGER NOT NULL DEFAULT 0,

        PRIMARY KEY(
            guildID,
            userID
        )

    )

`);


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

            amount = LEAST(
                shop_stock.amount,
                EXCLUDED.maxAmount
            ),

            price =
                CASE
                    WHEN shop_stock.price IS NULL
                    OR shop_stock.price <= 0
                    THEN EXCLUDED.price
                    ELSE shop_stock.price
                END

    `, [
        item.boostType,
        item.tier,
        item.maxStock,
        initialPrice
    ]);

}


}




async function initDatabase() {

    try {

        await createTables();

        console.log("✅ PostgreSQL database ready");

    } catch (err) {

        console.error("FAILED TO CREATE TABLES");
        console.error(err);

        throw err;

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

UPDATE users

SET

xp = GREATEST(0, xp + $3),

messages = messages + 1


WHERE guildID=$1

AND userID=$2

`,
[
    guildID,
    userID,
    amount
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

    UPDATE users

    SET xp = xp + $3


    WHERE guildID=$1
    AND userID=$2


    `,
    [
        guildID,
        userID,
        amount
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

    DELETE FROM xp_boost_progress

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
// XP BOOST INVENTORY PROGRESS
// =====================================================

async function getXPBoostProgress(
    guildID,
    userID
){

    const result =
        await db.query(`

            SELECT *

            FROM xp_boost_progress

            WHERE guildID=$1
            AND userID=$2

        `, [
            guildID,
            userID
        ]);


    return result.rows[0];

}



async function updateXPBoostProgress(
    guildID,
    userID,
    role,
    lastAwardXP
){

    await db.query(`

        INSERT INTO xp_boost_progress
        (
            guildID,
            userID,
            role,
            lastAwardXP
        )

        VALUES
        ($1,$2,$3,$4)

        ON CONFLICT(
            guildID,
            userID
        )

        DO UPDATE SET

            role=$3,
            lastAwardXP=$4

    `, [
        guildID,
        userID,
        role,
        Math.max(
            0,
            Number(lastAwardXP) || 0
        )
    ]);

}



async function clearXPBoostProgress(
    guildID,
    userID
){

    await db.query(`

        DELETE FROM xp_boost_progress

        WHERE guildID=$1
        AND userID=$2

    `, [
        guildID,
        userID
    ]);

}




// =====================================================
// GLOBAL MERCHANT SHOP
// =====================================================

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
        refreshed
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


        const currentPrice =
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


        await client.query("COMMIT");


        userCache.delete(
            `${guildID}:${userID}`
        );


        return {
            success: true,
            status: "purchased",
            item,
            price: currentPrice,
            balance:
                Number(
                    updatedUser.rows[0]?.xp || 0
                ),
            remainingStock:
                Number(
                    updatedStock.rows[0]?.amount || 0
                ),
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



// =====================================================
// QUEST SYSTEM
// =====================================================

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

                    UPDATE users

                    SET xp = GREATEST(
                        0,
                        xp + $3
                    )

                    WHERE guildID=$1
                    AND userID=$2

                `, [
                    guildID,
                    userID,
                    Math.max(
                        0,
                        Number(reward.amount) || 0
                    )
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


        if(
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
    cooldownMs
){

    const client =
        await db.connect();


    try{

        await client.query("BEGIN");


        const now =
            Date.now();


        const safeCooldown =
            Math.max(
                1000,
                Number(cooldownMs) || 30000
            );


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


        if(
            Number(
                effect.triplerolluntil || 0
            ) > now
        ){

            let windowEndsAt =
                Number(
                    effect.rollwindowendsat || 0
                );


            let windowUses =
                Number(
                    effect.rollwindowuses || 0
                );


            if(windowEndsAt <= now){

                windowEndsAt =
                    now + safeCooldown;

                windowUses =
                    0;

            }


            if(windowUses >= 3){

                await client.query("COMMIT");


                return {
                    allowed: false,
                    remaining:
                        Math.max(
                            0,
                            windowEndsAt - now
                        ),
                    tripleRoll: true,
                    usesLeft: 0
                };

            }


            windowUses++;


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
                windowEndsAt,
                windowUses
            ]);


            await client.query("COMMIT");


            return {
                allowed: true,
                remaining: 0,
                tripleRoll: true,
                usesLeft:
                    3 - windowUses,
                activeUntil:
                    Number(
                        effect.triplerolluntil
                    )
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


        if(remaining > 0){

            await client.query("COMMIT");


            return {
                allowed: false,
                remaining,
                tripleRoll: false,
                usesLeft: 0
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
            tripleRoll: false,
            usesLeft: 0
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


module.exports = {


    SHOP_CATALOG,

    SHOP_REFRESH_TIME,

    getGlobalShop,

    purchaseGlobalShopItem,

    initDatabase,

    getUser,

    addXP,

    giveXP,

    removeUser,

    getAllUsers,

    setXP,

    setLevel,

    getLeaderboard,

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

    getXPBoostProgress,

    updateXPBoostProgress,

    clearXPBoostProgress,

    getQuestCycle,

    createQuestCycle,

    updateQuestCycleProgress,

    claimQuestCycleRewards,

    getQuestEffects,

    consumeGuaranteedQuestRoll,

    useQuestRollCooldown,

};
