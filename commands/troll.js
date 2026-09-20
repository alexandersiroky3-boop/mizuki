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


function getMentionedUser(message){
    return message.mentions?.users?.first?.() || null;
}


function getMentionedMember(message){
    return message.mentions?.members?.first?.() || null;
}


async function resolveTarget(message, targetID){

    const mentionedUser = getMentionedUser(message);
    const mentionedMember = getMentionedMember(message);

    let member =
        mentionedMember?.id === targetID
            ? mentionedMember
            : message.guild.members.cache?.get?.(targetID) || null;


    if(!member){
        member = await message.guild.members.fetch(targetID)
            .catch(error => {
                console.warn(
                    `!troll could not fetch guild member ${targetID}; using the resolved mention when available:`,
                    error?.message || error
                );
                return null;
            });
    }


    const user =
        member?.user
        || (
            mentionedUser?.id === targetID
                ? mentionedUser
                : null
        );


    return {
        member,
        user,
        // Discord supplied an actual mention object, so a temporary member
        // fetch/cache failure must not make a valid command unusable.
        resolvedFromMention:
            mentionedUser?.id === targetID
    };

}


async function replySafely(message, content){

    const payload = {
        content,
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    };


    try{
        return await message.reply(payload);
    }
    catch(replyError){

        if(message.channel?.send){
            return message.channel.send(payload);
        }

        throw replyError;

    }
}


async function executeTroll(message){

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


    const target = await resolveTarget(
        message,
        targetID
    );

    if(
        !target.user
        || (
            !target.member
            && !target.resolvedFromMention
        )
    ){
        return replySafely(
            message,
            "I could not find that user in this server."
        );
    }

    if(target.user.bot){
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


    if(!result?.success && result?.status === "target-active"){
        return replySafely(
            message,
            `<@${targetID}> already has a troll effect active. Wait for it to finish or expire before trolling them again.`
        );
    }

    if(!result?.success){
        return replySafely(
            message,
            "The troll could not be applied. Please try again."
        );
    }


    // The troll is already committed at this point. A secondary cooldown
    // write must never hide the successful result from the user.
    await database.setCommandCooldown(
        guildID,
        actorID,
        "troll",
        Date.now() + COOLDOWN
    ).catch(error => {
        console.error(
            "!troll applied an effect but could not save its cooldown:",
            error
        );
    });


    for(const changedUserID of result.changedUserIDs || []){
        await leveling.syncLevelAndAnnounce(
            message.client,
            guildID,
            changedUserID
        ).catch(error => {
            console.error(
                `!troll could not sync level state for ${changedUserID}:`,
                error
            );
        });
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


async function execute(message){

    try{
        return await executeTroll(message);
    }
    catch(error){

        console.error(
            "!troll command failed:",
            error
        );


        return replySafely(
            message,
            "❌ **!troll could not finish because of an internal error.** The exact cause was written to the bot log."
        ).catch(replyError => {

            console.error(
                "!troll also failed to send its error reply:",
                replyError
            );

            return null;

        });

    }

}


module.exports = {
    execute,
    COOLDOWN,
    formatCooldown,
    getTargetID,
    resolveTarget
};
