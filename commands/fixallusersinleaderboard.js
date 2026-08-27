const database =
    require("../database");

const guildMembers =
    require("../utils/guildMembers");


const OWNER_ID =
    "1239975819112353969";



async function execute(message){


    if(!message.guild){

        return;

    }



    // ==========================
    // OWNER-ONLY COMMAND
    // ==========================

    if(message.author.id !== OWNER_ID){

        return message.reply(

            "❌ Only Kape can use this command."

        );

    }



    const guildID =
        message.guild.id;



    const statusMessage =
        await message.channel.send(

            "🔄 Checking every leaderboard user..."

        );



    try{


        // Paginated REST listing avoids Discord Gateway opcode-8 limits.
        const currentGuildMembers =
            await guildMembers.listAllGuildMembers(
                message.guild,
                {
                    cache: false
                }
            );


        const currentMemberIDs =
            new Set(
                currentGuildMembers.map(
                    member => member.id
                )
            );



        // Get every stored database user
        const databaseUsers =
            await database.getAllUsers(
                guildID
            );



        const unknownUsers =
            databaseUsers.filter(

                user =>
                    !currentMemberIDs.has(
                        user.userid
                    )

            );



        if(unknownUsers.length === 0){

            return statusMessage.edit(

                "✅ The leaderboard is already clean. No unknown users were found."

            );

        }



        let deleted = 0;
        let failed = 0;



        for(const user of unknownUsers){


            try{


                await database.removeUser(
                    guildID,
                    user.userid
                );


                deleted++;


            }
            catch(error){


                failed++;


                console.error(

                    `Failed to delete user ${user.userid}:`,

                    error

                );


            }


        }



        return statusMessage.edit(

`✅ **Leaderboard cleanup complete!**

🗑️ Deleted unknown users: **${deleted}**
❌ Failed deletions: **${failed}**
👥 Current server members: **${guildMembers.size}**
📊 Database entries checked: **${databaseUsers.length}**`

        );


    }
    catch(error){


        console.error(

            "Leaderboard cleanup failed:",

            error

        );


        return statusMessage.edit(

            "❌ Something went wrong while cleaning the leaderboard. Check the console for the error."

        );


    }


}



module.exports = {

    execute

};
