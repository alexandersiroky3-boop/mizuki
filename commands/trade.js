const database =
    require("../database");

const trades =
    require("../systems/trades");

const xp =
    require("../utils/xp");

const economyLimits =
    require("../utils/economyLimits");


const TRADE_REQUEST_COOLDOWN =
    60 * 1000;

const TRADE_COOLDOWN_KEY =
    "trade_request";


async function sendStarterFeedback(
    message,
    content
){

    return message.reply(
        content
    ).catch(
        () => {}
    );

}


async function execute(message){

    if(!message.guild)
        return;


    const senderData =
        await database.getUser(
            message.guild.id,
            message.author.id
        );


    const senderXP =
        Number(senderData?.xp) || 0;


    const senderProtection =
        economyLimits.getTradeProtection(
            senderXP
        );


    if(!senderProtection.unlocked){

        const senderLevel =
            xp.getLevel(senderXP);


        return sendStarterFeedback(
            message,
            `🔒 Trading unlocks at **Level ${economyLimits.TRADE_UNLOCK_LEVEL}**. You are currently **Level ${senderLevel}**.`
        );

    }


    const cooldownRemaining =
        await database.getCommandCooldownRemaining(
            message.guild.id,
            message.author.id,
            TRADE_COOLDOWN_KEY
        );


    if(cooldownRemaining > 0){

        const readyAt =
            Math.ceil(
                (
                    Date.now() +
                    cooldownRemaining
                ) / 1000
            );


        return sendStarterFeedback(
            message,
            `You can send another trade request <t:${readyAt}:R>.`
        );

    }


    const target =
        message.mentions.users.first();


    if(!target){

        return sendStarterFeedback(
            message,
            "Use `!trade @user` to send someone a trade request."
        );

    }


    if(
        target.id ===
        message.author.id
    ){

        return sendStarterFeedback(
            message,
            "You cannot trade with yourself."
        );

    }


    if(target.bot){

        return sendStarterFeedback(
            message,
            "You cannot trade with a bot."
        );

    }


    const targetMember =
        await message.guild.members.fetch(
            target.id
        ).catch(
            () => null
        );


    if(!targetMember){

        return sendStarterFeedback(
            message,
            "That user is not currently in this server."
        );

    }


    const targetData =
        await database.getUser(
            message.guild.id,
            target.id
        );


    const targetXP =
        Number(targetData?.xp) || 0;


    const targetProtection =
        economyLimits.getTradeProtection(
            targetXP
        );


    if(!targetProtection.unlocked){

        const targetLevel =
            xp.getLevel(targetXP);


        return sendStarterFeedback(
            message,
            `🔒 ${target} cannot receive trades yet. Trading unlocks at **Level ${economyLimits.TRADE_UNLOCK_LEVEL}**, and they are currently **Level ${targetLevel}**.`
        );

    }


    const inviteExpiresAt =
        Date.now() +
        trades.TRADE_INVITE_TIMEOUT;


    const request =
        await database.createTradeRequest(
            message.guild.id,
            message.author.id,
            target.id,
            inviteExpiresAt
        );


    if(!request.success){

        if(
            request.status ===
            "busy"
        ){

            return sendStarterFeedback(
                message,
                "You or that user already has another open trade. Finish or cancel it first."
            );

        }


        return sendStarterFeedback(
            message,
            "The trade request could not be created."
        );

    }


    try{

        await trades.sendTradeInvite(
            message.channel,
            request.trade,
            message.author
        );

    }
    catch(error){

        console.error(
            "Failed to send trade invitation:",
            error
        );


        await database.cancelTrade(
            request.trade.id,
            message.author.id,
            "The trade invitation could not be sent.",
            "cancelled"
        );


        return sendStarterFeedback(
            message,
            "The trade invitation could not be sent in this channel."
        );

    }


    await database.setCommandCooldown(
        message.guild.id,
        message.author.id,
        TRADE_COOLDOWN_KEY,
        Date.now() +
            TRADE_REQUEST_COOLDOWN
    );

}


module.exports = {
    execute
};
