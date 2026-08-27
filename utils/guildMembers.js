// Discord Gateway opcode 8 (Request Guild Members) is heavily rate-limited.
// guild.members.fetch() with no user ID uses that opcode, so every full-server
// operation must paginate through Discord's normal REST member-list endpoint.

const GUILD_MEMBER_PAGE_SIZE =
    1000;


function normalizePageSize(pageSize){

    return Math.max(
        1,
        Math.min(
            GUILD_MEMBER_PAGE_SIZE,
            Math.floor(
                Number(pageSize) ||
                GUILD_MEMBER_PAGE_SIZE
            )
        )
    );

}


function getHighestSnowflake(ids){

    let highest =
        null;


    for(const rawID of ids){

        const id =
            String(rawID);


        if(
            highest === null
            ||
            BigInt(id) >
                BigInt(highest)
        ){

            highest =
                id;

        }

    }


    return highest;

}


async function* iterateGuildMemberPages(
    guild,
    options = {}
){

    if(
        !guild?.members
        ||
        typeof guild.members.list !==
            "function"
    ){

        throw new TypeError(
            "A guild with GuildMemberManager#list is required."
        );

    }


    const pageSize =
        normalizePageSize(
            options.pageSize
        );


    const cache =
        options.cache !== false;


    let after =
        null;


    while(true){

        // GuildMemberManager#list calls GET /guilds/{guild.id}/members.
        // discord.js queues HTTP rate limits automatically and this does not
        // consume the Gateway opcode-8 request bucket.
        const members =
            await guild.members.list({
                limit:
                    pageSize,
                after:
                    after || undefined,
                cache
            });


        yield members;


        if(members.size < pageSize){
            break;
        }


        const nextAfter =
            getHighestSnowflake(
                members.keys()
            );


        if(
            !nextAfter
            ||
            nextAfter === after
        ){

            throw new Error(
                "Discord member-list pagination did not advance."
            );

        }


        after =
            nextAfter;

    }

}


async function listAllGuildMembers(
    guild,
    options = {}
){

    const allMembers =
        [];


    for await(
        const page of
        iterateGuildMemberPages(
            guild,
            options
        )
    ){

        allMembers.push(
            ...page.values()
        );

    }


    return allMembers;

}


module.exports = {
    GUILD_MEMBER_PAGE_SIZE,
    normalizePageSize,
    getHighestSnowflake,
    iterateGuildMemberPages,
    listAllGuildMembers
};
