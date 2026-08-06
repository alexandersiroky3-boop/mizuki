const database = require("../database");
const leveling =
    require("../systems/leveling");
const luck =
    require("../utils/luck");
const quests =
    require("../systems/quests");


// 1 hour cooldown
const COOLDOWN =
    15 * 60 * 1000;



const BOT_NAME =
    "bot";



function random(min, max){

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}


async function syncAndTrackLevel(
    message,
    userID
){

    const levelResult =
        await leveling.syncLevelAndAnnounce(
            message.client,
            message.guild.id,
            userID
        );


    await quests.recordLevelChange(
        message,
        levelResult,
        userID
    );


    return levelResult;

}


async function execute(message){


    if(!message.guild)
        return;


    const guildID =
        message.guild.id;


    const userID =
        message.author.id;



    // ==========================
    // Cooldown check
    // ==========================

const remaining =
    await database.getCommandCooldownRemaining(
        guildID,
        userID,
        "kiss"
    );


if(remaining > 0){


    const minutes =
        Math.ceil(
            remaining / 60000
        );


    return message.reply(

        `⏳ You can use !kiss again in ${minutes} minutes.`

    );


}



    const args =
        message.content.trim().split(" ");



    const targetInput =
        args[1];



    if(!targetInput){


        return message.reply(
            "💋 Usage: !kiss @user / user ID / Bot"
        );


    }





    let target = null;



    // ==========================
    // Kiss bot
    // ==========================

    if(
        targetInput.toLowerCase()
        === BOT_NAME
    ){

await database.setCommandCooldown(
    guildID,
    userID,
    "kiss",
    Date.now() + COOLDOWN
);

await quests.recordEvent(
    message,
    "kiss_given",
    1
);

const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "kiss"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "kiss"
    );


        const nice =
            Math.random() < 0.5;



        if(nice){


            const reward =
                random(5,100);



await database.giveXP(
    message.guild.id,
    userID,
    reward
);

await quests.recordEvent(
    message,
    "earn_xp",
    reward
);

await syncAndTrackLevel(
    message,
    userID
);



            return message.channel.send(

`*Goth mommy bot blushed so hard that her whole face turned as red as a tomato... then she licks her lips and keeps looking at you.*

"For your kiss, I will give you **${reward} XP**~~ 💋"${luckExtra}`

            );


        }


        else{


            const loss =
                random(5,100);



const user =
    await database.getUser(
        message.guild.id,
        userID
    );


await database.setXP(

    message.guild.id,

    userID,

    Math.max(
        0,
        user.xp - loss
    )

);

await syncAndTrackLevel(
    message,
    userID
);



            return message.channel.send(

`*Goth mommy blushes for a second... then suddenly slaps you.*

"EW! DON'T YOU KISS ME!" *she says with pure shock and anger.*

"For that, I will take **${loss} XP**!" 😤${luckExtra}`

            );


        }

    }






    // ==========================
    // Mention
    // ==========================

    target =
        message.mentions.users.first();





    // ==========================
    // User ID
    // ==========================

    if(!target && /^\d+$/.test(targetInput)){


        try{


            target =
                await message.client.users.fetch(
                    targetInput
                );


        }
        catch{

            return message.reply(
                "❌ User not found."
            );

        }


    }




    if(!target){


        return message.reply(
            "❌ I couldn't find that user."
        );


    }




    // Prevent kissing yourself

    if(target.id === userID){


        return message.reply(
            "💀 You cannot kiss yourself."
        );


    }




await database.setCommandCooldown(
    guildID,
    userID,
    "kiss",
    Date.now() + COOLDOWN
);

await quests.recordEvent(
    message,
    "kiss_given",
    1
);

await quests.recordEvent(
    message,
    "kiss_received",
    1,
    {
        userID: target.id
    }
);

const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "kiss"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "kiss"
    );



// ==========================
// Give XP
// ==========================

const chance = Math.random();

let reward;
let rarity;

if(chance < 0.80){

    reward = random(5, 100);
    rarity = "💖 Common";

}

else if(chance < 0.95){

    reward = random(100, 1000);
    rarity = "💜 Rare";

}

else if(chance < 0.999){

    reward = random(1000, 5000);
    rarity = "🌌 Epic";

}

else{

    reward = random(5000, 20000);
    rarity = "✨ LEGENDARY";

}

await database.giveXP(

    message.guild.id,
    target.id,
    reward

);

await quests.recordEvent(
    message,
    "earn_xp",
    reward,
    {
        userID: target.id
    }
);

await syncAndTrackLevel(
    message,
    target.id
);

let extra = "";

if(rarity === "✨ LEGENDARY"){

    extra =
`\n\n*Mizuki's eyes widen in complete disbelief...*

*"W-What...? Even I didn't expect a kiss this powerful..."*`;

}

else if(rarity === "🌌 Epic"){

    extra =
`\n\n*Mizuki smiles warmly as magical particles surround ${target}.*`;

}

else if(rarity === "💜 Rare"){

    extra =
`\n\n*Mizuki quietly claps, impressed by the heartfelt kiss.*`;

}

return message.channel.send(

`💋 ${message.author} kissed ${target}!

${rarity}

**${target.username} received +${reward.toLocaleString()} XP!**${extra}${luckExtra}`

);


}



module.exports = {

    execute

};
