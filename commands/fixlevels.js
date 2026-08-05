const database = require("../database");
const xp = require("../utils/xp");


async function execute(message){


    if(message.author.id !== "1239975819112353969")
        return message.reply("No permission.");



    const users =
        await database.getLeaderboard(
            message.guild.id,
            1000
        );



    let fixed = 0;



    for(const user of users){


        // Safety check
        const userID =
            user.userid || user.userID;



        if(!userID){

            console.log(
                "Skipped user with no ID:",
                user
            );

            continue;

        }



        const level =
            xp.getLevel(
                Math.max(
                    0,
                    user.xp
                )
            );



        await database.setLevel(

            message.guild.id,

            userID,

            level

        );


        fixed++;


    }



    message.reply(

        `✅ Fixed ${fixed} user levels!`

    );


}



module.exports = {
    execute
};