const database =
require("../database");

const xp =
require("../utils/xp");


const OWNER_ID =
"1239975819112353969";



async function execute(message){


    if(message.author.id !== OWNER_ID){


        return message.reply(
            "❌ You cannot use this command."
        );


    }



    const args =
        message.content.trim().split(/\s+/);



    const amount =
        Number(args[1]);



    const userID =
        args[2];



    if(!amount || amount <= 0){


        return message.reply(
            "Usage: `!givexp <amount> <userID>`"
        );


    }



    if(!userID){


        return message.reply(
            "Please provide a user ID."
        );


    }




    let target;


    try{


        target =
            await message.client.users.fetch(
                userID
            );


    }catch{


        return message.reply(
            "❌ Invalid user ID."
        );


    }





    let user =
        await database.getUser(

            message.guild.id,

            target.id

        );





    const oldLevel =
        user.level;





    await database.giveXP(

        message.guild.id,

        target.id,

        amount

    );





    user =
        await database.getUser(

            message.guild.id,

            target.id

        );





    const newLevel =
        xp.getLevel(
            user.xp
        );





    if(newLevel > oldLevel){



        await database.setLevel(

            message.guild.id,

            target.id,

            newLevel

        );



        message.channel.send(

            `🎉 **${target.username}** reached **Level ${newLevel}**!`

        );


    }






    message.reply(

        `✅ Added **${amount.toLocaleString()} XP** to **${target.username}**.`

    );


}



module.exports = {

    execute

};