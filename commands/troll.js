const database = require("../database");
const xp = require("../utils/xp");
const leveling = require("../systems/leveling");
const trolls = require("../systems/trolls");


const COOLDOWN = 5 * 60 * 1000;


function formatCooldown(milliseconds){

    const totalSeconds = Math.ceil(
        Math.max(0, milliseconds) / 1000
    );
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if(minutes === 0){
        return `${seconds}s`;
    }

    if(seconds === 0){
        return `${minutes}m`;
    }

    return `${minutes}m ${seconds}s`;

}


function getTargetID(message){

    const mentioned = message.mentions?.users?.first?.();

    if(mentioned){
        return mentioned.id;
    }

    const match = String(message.content || "")
        .match(/^!troll\s+(?:<@!?)?(\d{16,22})>?\s*$/i);

    return match?.[1] || null;

}


async function replySafely(message, content){
    return message.reply({
        content,
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });
}


async function execute(message){

    if(!message.guild || message.author.bot){
        return null;
    }

    const guildID = message.guild.id;
    const actorID = message.author.id;
    const targetID = getTargetID(message);


    if(!targetID){
        return replySafely(
            message,
            "Usage: **!troll @user**"
        );
    }

    if(targetID === actorID){
        return replySafely(
            message,
            "You cannot troll yourself."
        );
    }


    const targetMember = await message.guild.members.fetch(
        targetID
    ).catch(() => null);

    if(!targetMember){
        return replySafely(
            message,
            "I could not find that user in this server."
        );
    }

    if(targetMember.user.bot){
        return replySafely(
            message,
            "Bots cannot receive troll effects."
        );
    }


    const remaining = await database.getCommandCooldownRemaining(
        guildID,
        actorID,
        "troll"
    );

    if(remaining > 0){
        return replySafely(
            message,
            `⏳ You can use **!troll** again in **${formatCooldown(remaining)}**.`
        );
    }


    if(await trolls.hasActiveEffect(guildID, targetID)){
        return replySafely(
            message,
            `<@${targetID}> already has a troll effect active. Wait for it to finish or expire before trolling them again.`
        );
    }


    const [actorUser, targetUser] = await Promise.all([
        database.getUser(guildID, actorID),
        database.getUser(guildID, targetID)
    ]);

    const result = await trolls.createTrollAttempt({
        guildID,
        actorID,
        targetID,
        actorLevel: xp.getLevel(Number(actorUser?.xp) || 0),
        targetLevel: xp.getLevel(Number(targetUser?.xp) || 0)
    });


    if(!result.success && result.status === "target-active"){
        return replySafely(
            message,
            `<@${targetID}> already has a troll effect active. Wait for it to finish or expire before trolling them again.`
        );
    }

    if(!result.success){
        return replySafely(
            message,
            "The troll could not be applied. Please try again."
        );
    }


    await database.setCommandCooldown(
        guildID,
        actorID,
        "troll",
        Date.now() + COOLDOWN
    );


    for(const changedUserID of result.changedUserIDs || []){
        await leveling.syncLevelAndAnnounce(
            message.client,
            guildID,
            changedUserID
        );
    }


    if(result.rarity === "failed"){
        return replySafely(
            message,
            `💥 <@${actorID}>'s troll on <@${targetID}> **failed and backfired!**\n${result.publicDescription}`
        );
    }


    return replySafely(
        message,
        `<@${actorID}> trolled <@${targetID}>, giving <@${targetID}> a secret bad effect.`
    );

}


module.exports = {
    execute,
    COOLDOWN,
    formatCooldown,
    getTargetID
};
