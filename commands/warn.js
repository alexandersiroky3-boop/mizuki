const database = require("../database");
const leveling = require("../systems/leveling");


const OWNER_ID = "1239975819112353969";

const MODERATOR_ROLE_IDS = Object.freeze([
    "1324943417775493163",
    "1324943459903209574"
]);


async function canUseWarn(message){

    if(message.author.id === OWNER_ID){
        return true;
    }


    const member =
        message.member
        || await message.guild.members.fetch(
            message.author.id
        ).catch(() => null);


    if(!member){
        return false;
    }


    if(
        MODERATOR_ROLE_IDS.some(roleID =>
            member.roles.cache.has(roleID)
        )
    ){
        return true;
    }


    await message.guild.roles.fetch().catch(() => null);


    const configuredRoles =
        MODERATOR_ROLE_IDS
            .map(roleID =>
                message.guild.roles.cache.get(roleID)
            )
            .filter(Boolean);


    if(configuredRoles.length === 0){
        return false;
    }


    const minimumModeratorPosition =
        Math.min(
            ...configuredRoles.map(role => role.position)
        );


    return member.roles.highest.position >= minimumModeratorPosition;

}


async function resolveTargetMember(message){

    const mentioned =
        message.mentions.members.first();


    if(mentioned){
        return mentioned;
    }


    const rawTarget =
        String(
            message.content
                .trim()
                .split(/\s+/)[1]
            || ""
        );


    const targetID =
        rawTarget.replace(/[^0-9]/g, "");


    if(!/^\d{17,20}$/.test(targetID)){
        return null;
    }


    return message.guild.members.fetch(
        targetID
    ).catch(() => null);

}


async function execute(message){

    if(!message.guild){
        return null;
    }


    if(!await canUseWarn(message)){
        return message.reply({
            content:
                "❌ You need one of the configured moderator roles (or a role above them) to use `!warn`.",
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });
    }


    const target =
        await resolveTargetMember(message);


    if(!target){
        return message.reply({
            content:
                "❌ Usage: `!warn @user` or `!warn userID`.",
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });
    }


    if(target.user.bot){
        return message.reply("❌ You cannot warn bots!");
    }


    if(target.id === message.author.id){
        return message.reply("❌ You cannot warn yourself!");
    }


    const targetData =
        await database.getUser(
            message.guild.id,
            target.id
        );


    const currentXP =
        Math.max(
            0,
            Number(targetData?.xp) || 0
        );


    const punishmentXP =
        currentXP > 0
            ? Math.max(
                1,
                Math.floor(currentXP * 0.01)
            )
            : 0;


    if(punishmentXP > 0){
        await database.setXP(
            message.guild.id,
            target.id,
            currentXP - punishmentXP
        );


        await leveling.syncLevelAndAnnounce(
            message.client,
            message.guild.id,
            target.id
        ).catch(error => {
            console.error(
                "Could not sync warned user's level:",
                error
            );
        });
    }


    return message.channel.send({
        content:
            `*${message.author} keeps watching ${target} before slightly sighing...*\n\n` +
            `"Oh you bad little giggity guggata noob..."\n\n` +
            `*${message.author} steals Kape's gauntlet, puts it on, and while using 1% of his power...*\n\n` +
            "**SNAPS HIS FINGERS**\n\n" +
            `**${target} lost ${punishmentXP.toLocaleString()} XP haha noob**                     *i mog you*`,
        allowedMentions: {
            users: [
                message.author.id,
                target.id
            ]
        }
    });

}


module.exports = {
    execute,
    canUseWarn,
    resolveTargetMember,
    OWNER_ID,
    MODERATOR_ROLE_IDS
};
