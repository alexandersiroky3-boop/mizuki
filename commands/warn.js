const database = require("../database");

const OWNER_ID = "1239975819112353969";


async function execute(message){


    if(!message.guild)
        return;



    // ======================
    // Owner only
    // ======================

    if(message.author.id !== OWNER_ID){

        return message.reply(
            "❌ You don't have permission to use this command!"
        );

    }




    let target;



    if(message.mentions.members.first()){

        target = message.mentions.members.first();

    }

    else {

        const id =
            message.content.split(" ")[1];


        if(!id)
            return message.reply(
                "❌ You need to mention someone or provide their ID!"
            );


        try{

            target =
                await message.guild.members.fetch(id);

        }

        catch{

            return message.reply(
                "❌ I couldn't find that user!"
            );

        }

    }




    if(target.user.bot){

        return message.reply(
            "❌ You cannot warn bots!"
        );

    }



    if(target.id === message.author.id){

        return message.reply(
            "❌ You cannot warn yourself!"
        );

    }





    const punishmentXP =
        Math.floor(
            Math.random() * (1000 - 500 + 1)
        ) + 500;



    await database.addXP(

        message.guild.id,

        target.id,

        -punishmentXP

    );





    message.channel.send(

`*She blushes but while having an angry face*

You've been a bad little **BOY**!

*Before making him learn a lesson, she pauses, her blush deepens*

N- not that I LIKE BAD LITTLE BOYS LIKE YOU.. hehe~

*She keeps looking at him with "fury", unleashing 0.00001% of her power*

I'm taking **${punishmentXP} XP** from you! 😤`

    );


}



module.exports = {

    execute

};