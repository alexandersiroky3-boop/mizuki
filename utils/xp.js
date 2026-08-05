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

    let criticalChance;
    let criticalBonus;



    // ======================
    // LEVELS 100+
    // ======================

    if(isAboveLevel100){


        // MAX BOOST
        if(
            member.roles.cache.has(
                BOOST_ROLES.max
            )
        ){

            min = 1500;
            max = 5000;

            criticalChance = 40;
            criticalBonus = 7500;

        }


        // TIER 3
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier3
            )
        ){

            min = 750;
            max = 1500;

            criticalChance = 25;
            criticalBonus = 2000;

        }


        // TIER 2
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier2
            )
        ){

            min = 300;
            max = 750;

            criticalChance = 15;
            criticalBonus = 900;

        }


        // TIER 1
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier1
            )
        ){

            min = 125;
            max = 300;

            criticalChance = 12;
            criticalBonus = 500;

        }


        // NO BOOST
        else{

            min = 50;
            max = 125;

            criticalChance = 7.5;
            criticalBonus = 200;

        }


    }



    // ======================
    // LEVELS 1-100
    // ======================

    else{


        // MAX BOOST
        if(
            member.roles.cache.has(
                BOOST_ROLES.max
            )
        ){

            min = 900;
            max = 2750;

            criticalChance = 20;
            criticalBonus = 3250;

        }


        // TIER 3
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier3
            )
        ){

            min = 500;
            max = 900;

            criticalChance = 10;
            criticalBonus = 1000;

        }


        // TIER 2
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier2
            )
        ){

            min = 200;
            max = 500;

            criticalChance = 7.5;
            criticalBonus = 600;

        }


        // TIER 1
        else if(
            member.roles.cache.has(
                BOOST_ROLES.tier1
            )
        ){

            min = 60;
            max = 200;

            criticalChance = 6;
            criticalBonus = 300;

        }


        // NO BOOST
        else{

            min = 20;
            max = 60;

            criticalChance = 3;
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
    // CRITICAL ROLL
    // ======================

    const critical =
        Math.random() * 100 <
        criticalChance;



    let criticalMultiplier = 1;


    let criticalStreak =
        Number(
            currentStreak
        ) || 0;



    if(critical){


        criticalStreak++;


        // Maximum multiplier is x10.
        criticalMultiplier =
            Math.min(
                criticalStreak,
                10
            );


        earnedXP +=
            criticalBonus *
            criticalMultiplier;


    }
    else{


        criticalStreak = 0;


    }



    return {


        xp:
            earnedXP,


        critical,


        criticalBonus,


        criticalChance,


        criticalMultiplier,


        criticalStreak,


        levelGroup:
            isAboveLevel100
                ? "99+"
                : "1-98"


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