const {
    AuditLogEvent
} = require("discord.js");

const database =
    require("../database");

const xp =
    require("../utils/xp");


// =====================================================
// SETTINGS
// =====================================================

const OWNER_ID =
    "1239975819112353969";


const LEVEL_ROLES = [

    {
        minLevel: 500,
        roleID:
            "1536715649974272110"
    },

    {
        minLevel: 250,
        roleID:
            "1536709022474965152"
    },

    {
        minLevel: 100,
        roleID:
            "1536708395741089883"
    },

    {
        minLevel: 50,
        roleID:
            "1536708226110722048"
    },

    {
        minLevel: 25,
        roleID:
            "1536707464085508147"
    },

    {
        minLevel: 1,
        roleID:
            "1536705705434939422"
    }

];


const LEVEL_ROLE_IDS =
    new Set(
        LEVEL_ROLES.map(
            role => role.roleID
        )
    );


const activeSystemSyncs =
    new Map();


function getSyncKey(member){

    return (
        `${member.guild.id}:` +
        `${member.id}`
    );

}


function markSystemSync(member){

    activeSystemSyncs.set(
        getSyncKey(member),
        Date.now() + 5000
    );

}


function clearExpiredSystemSyncs(){

    const now =
        Date.now();


    for(
        const [key, expiresAt] of
        activeSystemSyncs.entries()
    ){

        if(expiresAt <= now){

            activeSystemSyncs.delete(
                key
            );

        }

    }

}


function isSystemSync(member){

    clearExpiredSystemSyncs();


    return (
        Number(
            activeSystemSyncs.get(
                getSyncKey(member)
            )
        ) > Date.now()
    );

}


// =====================================================
// ROLE LOOKUPS
// =====================================================

function getRoleForLevel(level){

    const safeLevel =
        Math.max(
            1,
            Math.floor(
                Number(level) || 1
            )
        );


    return (
        LEVEL_ROLES.find(
            role =>
                safeLevel >=
                role.minLevel
        )
        ||
        LEVEL_ROLES[
            LEVEL_ROLES.length - 1
        ]
    );

}


function getProtectedRoles(member){

    return member.roles.cache.filter(
        role =>
            LEVEL_ROLE_IDS.has(
                role.id
            )
    );

}


// =====================================================
// EXACT ROLE SYNC
// =====================================================

async function setExactLevelRole(
    member,
    desiredRoleID
){

    if(
        !member
        ||
        member.user?.bot
    ){

        return {
            changed: false,
            roleID:
                desiredRoleID || null
        };

    }


    const current =
        getProtectedRoles(
            member
        );


    const removeIDs =
        current
            .filter(
                role =>
                    role.id !==
                    desiredRoleID
            )
            .map(
                role => role.id
            );


    const alreadyHasDesired =
        desiredRoleID
        &&
        member.roles.cache.has(
            desiredRoleID
        );


    if(
        removeIDs.length === 0
        &&
        (
            !desiredRoleID
            ||
            alreadyHasDesired
        )
    ){

        return {
            changed: false,
            roleID:
                desiredRoleID || null
        };

    }


    markSystemSync(
        member
    );


    try{

        if(removeIDs.length > 0){

            await member.roles.remove(
                removeIDs,
                "Automatic exclusive level-role sync"
            );

        }


        if(
            desiredRoleID
            &&
            !member.roles.cache.has(
                desiredRoleID
            )
        ){

            await member.roles.add(
                desiredRoleID,
                "Automatic level-role sync"
            );

        }


        return {
            changed: true,
            roleID:
                desiredRoleID || null
        };

    }
    catch(error){

        console.error(
            `Failed to sync level role for ${member.user?.tag || member.id}:`,
            error
        );


        return {
            changed: false,
            roleID:
                desiredRoleID || null,
            error
        };

    }

}


async function syncMemberLevelRole(
    member,
    knownLevel = null
){

    if(
        !member
        ||
        member.user?.bot
    ){

        return null;

    }


    let level =
        Number(
            knownLevel
        );


    if(
        !Number.isFinite(level)
        ||
        level < 1
    ){

        const user =
            await database.getUser(
                member.guild.id,
                member.id
            );


        level =
            xp.getLevel(
                Number(user?.xp) || 0
            );

    }


    const role =
        getRoleForLevel(
            level
        );


    const result =
        await setExactLevelRole(
            member,
            role.roleID
        );


    return {
        ...result,
        level,
        role
    };

}


async function syncLevelRoleByIDs(
    client,
    guildID,
    userID,
    knownLevel = null
){

    const guild =
        await client.guilds.fetch(
            guildID
        ).catch(
            () => null
        );


    if(!guild)
        return null;


    const member =
        await guild.members.fetch(
            userID
        ).catch(
            () => null
        );


    if(!member)
        return null;


    return syncMemberLevelRole(
        member,
        knownLevel
    );

}


// =====================================================
// SERVER-WIDE REPAIR
// =====================================================

async function syncGuildLevelRoles(
    guild
){

    if(!guild)
        return;


    const members =
        await guild.members.fetch();


    const realMembers =
        [...members.values()]
            .filter(
                member =>
                    !member.user.bot
            );


    const batchSize =
        10;


    for(
        let i = 0;
        i < realMembers.length;
        i += batchSize
    ){

        const batch =
            realMembers.slice(
                i,
                i + batchSize
            );


        await Promise.all(
            batch.map(
                member =>
                    syncMemberLevelRole(
                        member
                    )
            )
        );

    }


    console.log(
        `Level roles synced for ${realMembers.length} members in ${guild.name}.`
    );

}


// =====================================================
// MANUAL ROLE-TAMPER PROTECTION
// =====================================================

function getProtectedRoleChanges(
    oldMember,
    newMember
){

    const added =
        [];


    const removed =
        [];


    for(const roleID of LEVEL_ROLE_IDS){

        const hadBefore =
            oldMember.roles.cache.has(
                roleID
            );


        const hasNow =
            newMember.roles.cache.has(
                roleID
            );


        if(
            !hadBefore
            &&
            hasNow
        ){

            added.push(
                roleID
            );

        }


        if(
            hadBefore
            &&
            !hasNow
        ){

            removed.push(
                roleID
            );

        }

    }


    return {
        added,
        removed
    };

}


async function getLatestRoleChangeExecutor(
    member
){

    try{

        const logs =
            await member.guild.fetchAuditLogs({
                type:
                    AuditLogEvent.MemberRoleUpdate,
                limit:
                    6
            });


        const now =
            Date.now();


        const entry =
            logs.entries.find(
                auditEntry =>
                    String(
                        auditEntry.targetId
                    ) ===
                        String(member.id)
                    &&
                    Math.abs(
                        now -
                        Number(
                            auditEntry.createdTimestamp
                        )
                    ) <= 7000
            );


        return (
            entry?.executorId
            ||
            entry?.executor?.id
            ||
            null
        );

    }
    catch{

        return null;

    }

}


function getHighestAddedRole(
    roleIDs
){

    return LEVEL_ROLES.find(
        role =>
            roleIDs.includes(
                role.roleID
            )
    ) || null;

}


async function handleProtectedRoleUpdate(
    oldMember,
    newMember
){

    if(
        !newMember
        ||
        newMember.user?.bot
    ){

        return false;

    }


    const changes =
        getProtectedRoleChanges(
            oldMember,
            newMember
        );


    if(
        changes.added.length === 0
        &&
        changes.removed.length === 0
    ){

        return false;

    }


    if(
        isSystemSync(
            newMember
        )
    ){

        return true;

    }


    const executorID =
        await getLatestRoleChangeExecutor(
            newMember
        );


    if(
        executorID
        &&
        String(executorID) ===
            String(newMember.client.user.id)
    ){

        return true;

    }


    if(
        String(executorID || "") ===
            OWNER_ID
        &&
        changes.added.length > 0
    ){

        const chosen =
            getHighestAddedRole(
                changes.added
            );


        if(chosen){

            await setExactLevelRole(
                newMember,
                chosen.roleID
            );

            return true;

        }

    }


    // Any non-owner/manual edit is reverted to the
    // XP-correct single automatic role.
    await syncMemberLevelRole(
        newMember
    );


    return true;

}


module.exports = {

    OWNER_ID,

    LEVEL_ROLES,

    LEVEL_ROLE_IDS,

    getRoleForLevel,

    syncMemberLevelRole,

    syncLevelRoleByIDs,

    syncGuildLevelRoles,

    handleProtectedRoleUpdate

};
