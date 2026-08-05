const database =
    require("../database");



async function execute(message){


    if(!message.guild)
        return;



    const logs =
        await database.getRecentXPLogs(
            message.guild.id,
            20
        );



    if(logs.length === 0){

        return message.reply(
            "📜 There aren't any XP logs yet."
        );

    }



    const lines =
        await Promise.all(

            [...logs].reverse().map(async log => {


                let username =
                    `Unknown User`;


                try{


                    const user =
                        await message.client.users.fetch(
                            log.userid
                        );


                    username =
                        user.username;


                }
                catch{


                    username =
                        `Unknown User`;


                }



                const critical =
                    Boolean(
                        log.critical
                    );


                const streak =
                    Number(
                        log.criticalstreak
                    ) || 0;



                let prefix =
                    "";


                if(critical){


                    if(streak >= 5){

                        prefix =
                            "🐦‍🔥 ";

                    }
                    else{

                        prefix =
                            "🔥 ";

                    }


                }



                const gainedXP =
                    Number(
                        log.amount
                    ) || 0;



                return (
                    `${prefix}${username} gained ${gainedXP.toLocaleString()} XP`
                );


            })

        );



    return message.channel.send(

`📜 **Last ${logs.length} XP Logs**

\`\`\`
${lines.join("\n")}
\`\`\``

    );


}



module.exports = {

    execute

};