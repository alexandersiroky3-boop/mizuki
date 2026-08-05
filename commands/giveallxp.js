const database = require("../database");
const xp = require("../utils/xp");

// YOUR Discord ID
const OWNER_ID = "1239975819112353969";

async function execute(message){

    if(!message.guild)
        return;

    // Owner only
    if(message.author.id !== OWNER_ID){

        return message.reply(
            "❌ You cannot use this command."
        );

    }

    const args =
        message.content.split(/\s+/);

    const amount =
        parseInt(args[1]);

    if(isNaN(amount)){

        return message.reply(
            "Usage: `!giveallxp <amount>`"
        );

    }

    // Fetch every member
    await message.guild.members.fetch();

    let given = 0;

    for(const member of message.guild.members.cache.values()){

        // Skip bots
        if(member.user.bot)
            continue;

        await database.addXP(

            message.guild.id,

            member.id,

            amount

        );

        // Level up immediately
        const user =
            await database.getUser(
                message.guild.id,
                member.id
            );

        const newLevel =
            xp.getLevel(user.xp);

        if(newLevel > user.level){

            await database.setLevel(

                message.guild.id,

                member.id,

                newLevel

            );

        }

        given++;

    }

    message.channel.send(

`✨ Successfully gave **${amount.toLocaleString()} XP** to **${given} members!**`

    );

}

module.exports = {
    execute
};