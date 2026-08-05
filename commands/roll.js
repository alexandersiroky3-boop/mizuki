const database = require("../database");
const boosts = require("../systems/boosts");
const xp = require("../utils/xp");
const leveling = require("../systems/leveling");
const luck =
    require("../utils/luck");


const ROLL_COOLDOWN = 30 * 1000;



async function execute(message){


    if(!message.guild)
        return;



    const userID =
        message.author.id;



    // ======================
    // Cooldown
    // ======================

const remaining =
    await database.getCommandCooldownRemaining(
        message.guild.id,
        message.author.id,
        "roll"
    );


if(remaining > 0){


    const seconds =
        Math.ceil(
            remaining / 1000
        );


    return message.reply(

        `🎲 You must wait **${seconds} seconds** before rolling again!`

    );


}


await database.setCommandCooldown(
    message.guild.id,
    message.author.id,
    "roll",
    Date.now() + ROLL_COOLDOWN
);





// ======================
// ROLL WITH LUCK
// ======================

let wonMaxBoost =
    false;


const user =
    await database.getUser(
        message.guild.id,
        userID
    );


const currentLevel =
    xp.getLevel(
        Number(user.xp)
    );


const isHighLevel =
    currentLevel > 100;


const luckResult =
    await luck.rollWithLuck(
        message.member,
        isHighLevel
    );


const rolledXP =
    luckResult.rolledXP;


// This is the Luck Boost used
// during the current roll.
//
// A Luck Boost won from this roll
// starts affecting future rolls.

const usedLuckBoost =
    luckResult.profile;


    // ======================
    // GIVE XP
    // ======================


await database.addXP(

    message.guild.id,

    userID,

    rolledXP

);


// Track roll XP for boosts
await database.addBoostActivity(

    message.guild.id,

    userID,

    Math.max(0, rolledXP)

);

// ======================
// 0.05% XP BOOST MAX DROP
// ======================
//
// The boost is stored in inventory.
// The user activates it later with !boost.

if(Math.random() < 0.0005){

    wonMaxBoost =
        await boosts.awardXPBoost(
            message.member,
            "max",
            "!roll"
        );

}


// Update boost
await boosts.updateBoost(
    message.member
);

// ======================
// LUCK BOOST REWARD
// ======================
//
// This happens before any result message,
// so every roll can potentially award:
//
// - XP
// - XP Boost MAX
// - Luck Boost

const wonLuckBoost =
    await luck.tryLuckBoostDrop(
        message.member
    );


const rollExtras =
    luck.buildRollExtras(
        message,
        wonMaxBoost,
        usedLuckBoost,
        wonLuckBoost
    );







// ======================
// Impossible Roll
// ======================

if(rolledXP >= 500000){

const bonus =
    Math.floor(
        Math.random() * 1250001
    ) + 750000;

await database.addXP(

    message.guild.id,

    userID,

    bonus

);


await database.addBoostActivity(

    message.guild.id,

    userID,

    bonus

);


await boosts.updateBoost(
    message.member
);

await leveling.syncLevelAndAnnounce(
    message.client,
    message.guild.id,
    userID
);

    return message.channel.send(

`🌠 **THE UNIVERSE FALLS SILENT.**

${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Time itself seems to stop.*

*Mizuki simply stares at the glowing number.*

*"...."*

*"You're... unreal."*

*Without saying another word, she rushes toward ${message.author}, wraps both arms around them and refuses to let go.*

*"I... I don't ever want to forget this moment..."*

*After several long seconds she finally lets go, cheeks glowing bright red.*

*"Congratulations... my luckiest person."*

💖 **Mizuki secretly rewarded you with +${bonus.toLocaleString()} XP!**

✨ **The universe itself acknowledged your existence.**`

    );

}





// ======================
// Legendary Lucky Bonus
// ======================

if(rolledXP >= 200000){

const bonus =
    Math.floor(
        Math.random() * 350001
    ) + 150000;

await database.addXP(

    message.guild.id,

    userID,

    bonus

);


await database.addBoostActivity(

    message.guild.id,

    userID,

    bonus

);


await boosts.updateBoost(
    message.member
);

await leveling.syncLevelAndAnnounce(
    message.client,
    message.guild.id,
    userID
);

    return message.channel.send(

`✨ ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Mizuki stares in complete disbelief.*

*"That's impossible..."*

*Golden sparkles begin swirling around both of you.*

*Mizuki suddenly laughs, throws herself into your arms, and hugs you as tightly as she can.*

*"Hehe... maybe you're my lucky charm after all~"*

💖 **Mizuki secretly rewarded you with +${bonus.toLocaleString()} XP!**`

    );

}


// ======================
// 75k - 200k
// ======================

if(rolledXP >= 75000){

    const bonus =
    Math.floor(
        Math.random() * 75001
    ) + 50000;

    await database.addXP(
        message.guild.id,
        userID,
        bonus
    );

    await database.addBoostActivity(
        message.guild.id,
        userID,
        bonus
    );

    await boosts.updateBoost(
        message.member
    );

await leveling.syncLevelAndAnnounce(
    message.client,
    message.guild.id,
    userID
);

    return message.channel.send(

`🌌 ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*The air itself seems to shimmer.*

*Mizuki slowly lands beside you, completely speechless.*

*"I... I don't even know what to say..."*

*She gently holds both of your hands.*

*"Promise me you'll stay by my side, okay?"*

*She blushes, kisses both cheeks, then quietly flies away.*

💖 **Mizuki secretly rewarded you with +${bonus.toLocaleString()} XP!**`

    );

}


// ======================
// 25k - 75k
// ======================

if(rolledXP >= 25000){

    const bonus =
    Math.floor(
        Math.random() * 40001
    ) + 10000;

    await database.addXP(
        message.guild.id,
        userID,
        bonus
    );

    await database.addBoostActivity(
        message.guild.id,
        userID,
        bonus
    );

    await boosts.updateBoost(
        message.member
    );

await leveling.syncLevelAndAnnounce(
    message.client,
    message.guild.id,
    userID
);

    return message.channel.send(

`🌟 ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Mizuki almost drops out of the sky from pure shock.*

*"N-No way..."*

*She circles around you several times, unable to stop smiling.*

*"I've never seen luck like this..."*

*She hugs you tightly, spins you around laughing, then kisses your forehead.*

💖 **Mizuki secretly rewarded you with +${bonus.toLocaleString()} XP!**`

    );

}

// ======================
// Lucky Roll Bonus
// ======================

if(rolledXP >= 1000){

const bonus =
    Math.floor(
        Math.random() * 501
    ) + 500;

await database.addXP(

    message.guild.id,

    userID,

    bonus

);


await database.addBoostActivity(

    message.guild.id,

    userID,

    bonus

);


await boosts.updateBoost(
    message.member
);

await leveling.syncLevelAndAnnounce(
    message.client,
    message.guild.id,
    userID
);

    return message.channel.send(

`🎲 ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Mizuki's eyes widen for a second before a warm smile appears.*

*"Hehe~ You're stronger than I thought..."*

*She floats closer, gently pats your head before wrapping her arms around you in a quick hug.*

*"Don't stop now... I want to see how far you can go."*

💖 **Mizuki secretly rewarded you with +${bonus} XP!**`

    );

}


// ======================
// Kiss
// ======================

if(rolledXP > 100){

const bonus =
    Math.floor(
        Math.random() * 451
    ) + 50;

await database.addXP(

    message.guild.id,

    userID,

    bonus

);

await database.addBoostActivity(

    message.guild.id,

    userID,

    bonus

);

await boosts.updateBoost(
    message.member
);

await leveling.syncLevelAndAnnounce(
    message.client,
    message.guild.id,
    userID
);


return message.channel.send(

`🎲 ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Mizuki keeps watching ${message.author} with a smile and a slight blush, then flies over and whispers quietly...*

*"Woow... you're my lucky boy/girl~..."*

*She gently kisses ${message.author}'s cheek before flying away.*

💖 The kiss gave you **+${bonus} XP** as a bonus!`

);

}



// ======================
// UPDATE LEVEL
// ======================

await leveling.syncLevelAndAnnounce(
    message.client,
    message.guild.id,
    userID
);



// ======================
// Normal messages
// ======================

if(rolledXP >= 0){

    return message.channel.send(

`🎲 ${message.author} rolled **+${rolledXP.toLocaleString()} XP! Lucky! 🍀**${rollExtras}`

    );

}


return message.channel.send(

`🎲 ${message.author} rolled **${rolledXP.toLocaleString()} XP!** Better luck next time... 💀${rollExtras}`

);


}



module.exports = {

    execute

};