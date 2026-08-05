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



    const level =
        Number(args[1]);



    const userID =
        args[2];




    if(
        isNaN(level) ||
        level < 1
    ){


        return message.reply(
            "Usage: `!setlevel <level> <userID>`"
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





    const requiredXP =
        xp.getCurrentLevelXP(
            level
        );





    await database.setXP(


        message.guild.id,

        target.id,

        requiredXP


    );





    await database.setLevel(


        message.guild.id,

        target.id,

        level


    );






    message.reply(


        `✅ Set **${target.username}** to **Level ${level}**.`


    );


}



module.exports = {

    execute

};