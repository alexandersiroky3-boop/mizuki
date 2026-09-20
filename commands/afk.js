const database =
    require("../database");


const AFK_SUFFIX =
    " [afk]";


const DISCORD_NICKNAME_MAX_LENGTH =
    32;


function hasAFKSuffix(value){

    return String(value || "")
        .toLowerCase()
        .endsWith(
            AFK_SUFFIX
        );

}


function removeAFKSuffix(value){

    const name =
        String(value || "");


    if(!hasAFKSuffix(name)){
        return name;
    }


    return name
        .slice(
            0,
            -AFK_SUFFIX.length
        )
        .trimEnd();

}


function buildAFKNickname(displayName){

    const originalDisplayName =
        removeAFKSuffix(
            displayName
        );


    const maximumBaseLength =
        DISCORD_NICKNAME_MAX_LENGTH
        - AFK_SUFFIX.length;


    const characters =
        Array.from(
            originalDisplayName
        );


    const shortened =
        characters.length >
            maximumBaseLength;


    const baseName =
        characters
            .slice(
                0,
                maximumBaseLength
            )
            .join("")
            .trimEnd();


    return {
        nickname:
            `${baseName || "AFK"}${AFK_SUFFIX}`,
        shortened
    };

}


async function resolveMember(message){

    if(message.member){
        return message.member;
    }


    return message.guild.members.fetch(
        message.author.id
    );

}


async function sendNicknamePermissionError(
    message
){

    return message.reply({
        content:
            "⚠️ I couldn't change your nickname. Make sure my role has **Manage Nicknames** and is above yours.",
        allowedMentions: {
            parse: []
        }
    });

}


async function disableAFK(
    message,
    member,
    savedStatus,
    announce = true
){

    const currentNickname =
        member.nickname;


    const hasVisibleMarker =
        hasAFKSuffix(
            currentNickname
        );


    if(hasVisibleMarker){

        const restoredNickname =
            savedStatus
                ? savedStatus.originalNickname
                : (
                    removeAFKSuffix(
                        currentNickname
                    )
                    || null
                );


        try{

            await member.setNickname(
                restoredNickname,
                "AFK status removed"
            );

        }
        catch(error){

            console.error(
                `Could not remove AFK nickname for ${message.author.id} in ${message.guild.id}:`,
                error
            );


            if(announce){
                return sendNicknamePermissionError(
                    message
                );
            }


            return {
                removed: false,
                reason: "nickname_failed"
            };

        }

    }


    if(savedStatus){

        await database.clearAFKStatus(
            message.guild.id,
            message.author.id
        );

    }


    if(announce){

        return message.reply({
            content:
                "👋 **Welcome back! Your AFK status has been removed.**",
            allowedMentions: {
                parse: []
            }
        });

    }


    return {
        removed: true
    };

}


async function removeAFKOnMessage(message){

    if(
        !message.guild
        || message.author?.bot
    ){
        return false;
    }


    let member;


    try{

        member =
            await resolveMember(
                message
            );

    }
    catch(error){

        console.error(
            `Could not resolve member ${message.author.id} for automatic AFK removal:`,
            error
        );


        return false;

    }


    // Almost every guild message stops here, so normal chat does not create a
    // database query. Only members visibly marked AFK need their saved name.
    if(
        !hasAFKSuffix(
            member.nickname
        )
    ){
        return false;
    }


    try{

        const savedStatus =
            await database.getAFKStatus(
                message.guild.id,
                message.author.id
            );


        const result =
            await disableAFK(
                message,
                member,
                savedStatus,
                false
            );


        return Boolean(
            result?.removed
        );

    }
    catch(error){

        console.error(
            `Automatic AFK removal failed for ${message.author.id} in ${message.guild.id}:`,
            error
        );


        return false;

    }

}


async function execute(message){

    if(!message.guild){
        return;
    }


    let member;


    try{

        member =
            await resolveMember(
                message
            );

    }
    catch(error){

        console.error(
            "Could not resolve member for !afk:",
            error
        );


        return message.reply(
            "⚠️ I couldn't find your server member profile right now."
        );

    }


    let savedStatus;


    try{

        savedStatus =
            await database.getAFKStatus(
                message.guild.id,
                message.author.id
            );

    }
    catch(error){

        console.error(
            "Could not read AFK status:",
            error
        );


        return message.reply(
            "⚠️ I couldn't check your AFK status right now. Please try again."
        );

    }


    if(
        savedStatus
        || hasAFKSuffix(
            member.nickname
        )
    ){

        try{

            return await disableAFK(
                message,
                member,
                savedStatus,
                true
            );

        }
        catch(error){

            console.error(
                "Could not disable AFK status:",
                error
            );


            return message.reply(
                "⚠️ I couldn't remove your AFK status right now. Please try again."
            );

        }

    }


    const originalNickname =
        member.nickname ?? null;


    const {
        nickname: afkNickname,
        shortened
    } = buildAFKNickname(
        member.displayName
        || member.user?.displayName
        || member.user?.username
        || "AFK"
    );


    try{

        await database.setAFKStatus(
            message.guild.id,
            message.author.id,
            originalNickname
        );


        try{

            await member.setNickname(
                afkNickname,
                "AFK status enabled"
            );

        }
        catch(error){

            await database.clearAFKStatus(
                message.guild.id,
                message.author.id
            ).catch(() => {});


            console.error(
                `Could not set AFK nickname for ${message.author.id} in ${message.guild.id}:`,
                error
            );


            return sendNicknamePermissionError(
                message
            );

        }


        return message.reply({
            content:
                "💤 **You're now AFK.** Send any message or use `!afk` again to remove it."
                + (
                    shortened
                        ? "\n*Your visible name was shortened temporarily to fit Discord's nickname limit.*"
                        : ""
                ),
            allowedMentions: {
                parse: []
            }
        });

    }
    catch(error){

        console.error(
            "Could not enable AFK status:",
            error
        );


        return message.reply(
            "⚠️ I couldn't enable your AFK status right now. Please try again."
        );

    }

}


module.exports = {
    execute,
    removeAFKOnMessage,
    hasAFKSuffix,
    removeAFKSuffix,
    buildAFKNickname,
    AFK_SUFFIX,
    DISCORD_NICKNAME_MAX_LENGTH
};
