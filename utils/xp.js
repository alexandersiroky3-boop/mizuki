const luck = require("./luck");

const BOOST_ROLES = {

    tier1:
        "1526994577955750020",

    tier2:
        "1526994944965869648",

    tier3:
        "1526995123420922047",

    max:
        "1526995218098815016"

};

// ======================
// CRITICAL SYSTEM
// ======================
//
// XP Boosts provide the BASE critical chance.
// Luck Boosts add their critical chance bonus.
// Each consecutive critical adds +4% momentum
// to the NEXT critical roll, up to +28%.
// Final critical chance is capped at 95%.

const CRITICAL_MOMENTUM_PER_STREAK = 4;
const CRITICAL_MOMENTUM_CAP = 28;
const CRITICAL_CHANCE_CAP = 95;


function getCriticalMomentum(currentStreak){

    const safeStreak =
        Math.max(
            0,
            Number(currentStreak) || 0
        );


    return Math.min(
        safeStreak *
            CRITICAL_MOMENTUM_PER_STREAK,
        CRITICAL_MOMENTUM_CAP
    );

}


function buildCriticalChance(
    baseCriticalChance,
    luckCriticalBonus,
    currentStreak
){

    const momentumBonus =
        getCriticalMomentum(
            currentStreak
        );


    const finalChance =
        Math.min(
            CRITICAL_CHANCE_CAP,
            Number(baseCriticalChance) +
            Number(luckCriticalBonus) +
            momentumBonus
        );


    return {

        baseCriticalChance:
            Number(baseCriticalChance),

        luckCriticalBonus:
            Number(luckCriticalBonus),

        momentumBonus,

        finalChance

    };

}


// ======================
// LEVEL CALCULATIONS
// ======================

function getLevel(xp){


    let level = 1;


    while(
        getNextLevelXP(level) <= xp
    ){

        level++;

    }


    return level;


}



function getCurrentLevelXP(level){


    if(level <= 1){

        return 0;

    }



    // Old formula until level 100

    if(level <= 100){

        return Math.floor(

            Math.pow(
                level - 1,
                2
            ) * 250

        );

    }



    // Total XP required to reach level 100

    let total =
        Math.floor(

            Math.pow(
                100,
                2
            ) * 250

        );



    // Add custom requirements for levels 101+

    for(
        let lvl = 101;
        lvl < level;
        lvl++
    ){

        total +=
            Math.floor(

                250000 +

                (
                    (lvl - 101) /
                    19
                ) * 750000

            );

    }


    return total;


}



function getNextLevelXP(level){


    // Old formula until level 99 -> 100

    if(level < 100){

        return Math.floor(

            Math.pow(
                level,
                2
            ) * 250

        );

    }



    const current =
        getCurrentLevelXP(
            level
        );



    const requirement =
        Math.floor(

            250000 +

            (
                (level - 100) /
                19
            ) * 750000

        );


    return current + requirement;


}



// ======================
// RANDOM XP
// ======================

function randomXP(
    min,
    max
){


    return Math.floor(

        Math.random() *
        (
            max -
            min +
            1
        )

    ) + min;


}



// ======================
// XP REWARD
// ======================

function getXPAmount(
    member,
    currentStreak = 0,
    currentLevel = 1
){


    const isAboveLevel100 =
        Number(currentLevel) > 99;


    let min;
    let max;

    let baseCriticalChance;
    let criticalBonus;



    // ======================
    // LEVELS 100+
    // ======================

    if(isAboveLevel100){


        // MAX XP BOOST
        if(
            member.roles.cache.has(
                BOOST_ROLES.max
            )
        ){

            min = 1500;
            max = 5000;

            baseCriticalChance = 40;
            criticalBonus = 7500;

        }


        // XP BOOST III
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier3
            )
        ){

            min = 750;
            max = 1500;

            baseCriticalChance = 25;
            criticalBonus = 2000;

        }


        // XP BOOST II
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier2
            )
        ){

            min = 300;
            max = 750;

            baseCriticalChance = 15;
            criticalBonus = 900;

        }


        // XP BOOST I
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier1
            )
        ){

            min = 125;
            max = 300;

            baseCriticalChance = 12;
            criticalBonus = 500;

        }


        // NO XP BOOST
        else{

            min = 50;
            max = 125;

            baseCriticalChance = 7.5;
            criticalBonus = 200;

        }


    }



    // ======================
    // LEVELS 1-100
    // ======================

    else{


        // MAX XP BOOST
        if(
            member.roles.cache.has(
                BOOST_ROLES.max
            )
        ){

            min = 900;
            max = 2750;

            baseCriticalChance = 20;
            criticalBonus = 3250;

        }


        // XP BOOST III
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier3
            )
        ){

            min = 500;
            max = 900;

            baseCriticalChance = 10;
            criticalBonus = 1000;

        }


        // XP BOOST II
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier2
            )
        ){

            min = 200;
            max = 500;

            baseCriticalChance = 7.5;
            criticalBonus = 600;

        }


        // XP BOOST I
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier1
            )
        ){

            min = 60;
            max = 200;

            baseCriticalChance = 6;
            criticalBonus = 300;

        }


        // NO XP BOOST
        else{

            min = 20;
            max = 60;

            baseCriticalChance = 3;
            criticalBonus = 100;

        }


    }



    // ======================
    // NORMAL XP
    // ======================

    let earnedXP =
        randomXP(
            min,
            max
        );



    // ======================
    // CRITICAL CHANCE
    // ======================

    const startingStreak =
        Math.max(
            0,
            Number(currentStreak) || 0
        );


    const luckCriticalBonus =
        luck.getCriticalChanceBonus(
            member
        );


    const chanceData =
        buildCriticalChance(
            baseCriticalChance,
            luckCriticalBonus,
            startingStreak
        );


    const criticalChance =
        chanceData.finalChance;



    // ======================
    // CRITICAL ROLL
    // ======================

    const critical =
        Math.random() * 100 <
        criticalChance;


    let criticalMultiplier = 1;


    let criticalStreak =
        startingStreak;


    if(critical){


        criticalStreak++;


        // Unlimited critical XP multiplier.
        // The multiplier always matches the full consecutive streak.
        criticalMultiplier =
            criticalStreak;


        earnedXP +=
            criticalBonus *
            criticalMultiplier;


    }
    else{


        // Consecutive still means consecutive:
        // one failed critical fully resets the streak.
        criticalStreak = 0;


    }



    // The chance the user would have on their NEXT
    // XP-eligible message after this result.
    const nextChanceData =
        buildCriticalChance(
            baseCriticalChance,
            luckCriticalBonus,
            criticalStreak
        );



    return {


        xp:
            earnedXP,


        critical,


        criticalBonus,


        baseCriticalChance:
            chanceData.baseCriticalChance,


        luckCriticalBonus:
            chanceData.luckCriticalBonus,


        momentumBonus:
            chanceData.momentumBonus,


        criticalChance,


        nextCriticalChance:
            nextChanceData.finalChance,


        criticalMultiplier,


        criticalStreak,


        levelGroup:
            isAboveLevel100
                ? "100+"
                : "1-100"


    };


}



// ======================
// PROGRESS BAR
// ======================

function getProgress(user){


    const level =
        Number(
            user.level
        ) || 1;



    const totalXP =
        Number(
            user.xp
        ) || 0;



    const currentXP =
        getCurrentLevelXP(
            level
        );



    const nextXP =
        getNextLevelXP(
            level
        );



    const progressXP =
        totalXP -
        currentXP;



    const neededXP =
        nextXP -
        currentXP;



    let percentage =
        Math.floor(

            (
                progressXP /
                neededXP
            ) * 100

        );



    percentage =
        Math.max(

            0,

            Math.min(
                percentage,
                100
            )

        );



    const bars = 20;



    const filled =
        Math.floor(
            percentage / 5
        );



    const progressBar =

        "█".repeat(
            filled
        )

        +

        "░".repeat(
            bars - filled
        );



    return {


        percentage,


        progressXP,


        neededXP,


        currentXP,


        nextXP,


        progressBar


    };


}



// ======================
// EXPORTS
// ======================

module.exports = {


    BOOST_ROLES,


    getLevel,


    getCurrentLevelXP,


    getLevelXP:
        getCurrentLevelXP,


    getNextLevelXP,


    getXPAmount,


    getProgress


};
