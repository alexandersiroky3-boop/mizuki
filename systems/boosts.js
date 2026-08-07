const database =
    require("../database");


// =====================================
// SETTINGS
// =====================================

const BOOST_DURATION =
    60 * 60 * 1000;


const botRoleChanges =
    new Set();


const BOOST_ROLES = {

    tier1:
        "1526994577955750020",

    tier2:
        "1526994944965869648",

    tier3:
        "1526995123420922047",

    max:
        "1526995218098815016"

};


const BOOST_PROFILES = {

    tier1: {

        tier:
            "tier1",

        roleID:
            BOOST_ROLES.tier1,

        name:
            "XP Boost I",

        duration:
            BOOST_DURATION,

        durationText:
            "1 hour",

        order:
            1

    },


    tier2: {

        tier:
            "tier2",

        roleID:
            BOOST_ROLES.tier2,

        name:
            "XP Boost II",

        duration:
            BOOST_DURATION,

        durationText:
            "1 hour",

        order:
            2

    },


    tier3: {

        tier:
            "tier3",

        roleID:
            BOOST_ROLES.tier3,

        name:
            "XP Boost III",

        duration:
            BOOST_DURATION,

        durationText:
            "1 hour",

        order:
            3

    },


    max: {

        tier:
            "max",

        roleID:
            BOOST_ROLES.max,

        name:
            "XP Boost MAX",

        duration:
            BOOST_DURATION,

        durationText:
            "1 hour",

        order:
            4

    }

};


const BOOST_REQUIREMENTS = {

    [BOOST_ROLES.tier1]:
        1250,

    [BOOST_ROLES.tier2]:
        5000,

    [BOOST_ROLES.tier3]:
        12500,

    [BOOST_ROLES.max]:
        25000

};


const ROLE_ORDER = {

    [BOOST_ROLES.tier1]:
        1,

    [BOOST_ROLES.tier2]:
        2,

    [BOOST_ROLES.tier3]:
        3,

    [BOOST_ROLES.max]:
        4

};


const BOOST_ROLE_IDS =
    Object.values(
        BOOST_ROLES
    );



// =====================================
// HELPERS
// =====================================

function getBoostRole(xp){

    if(xp >= 25000)
        return BOOST_ROLES.max;


    if(xp >= 12500)
        return BOOST_ROLES.tier3;


    if(xp >= 5000)
        return BOOST_ROLES.tier2;


    if(xp >= 1250)
        return BOOST_ROLES.tier1;


    return null;

}



function getRequirement(role){

    return (
        BOOST_REQUIREMENTS[role] ||
        0
    );

}



function getBoostProfileByTier(tier){

    return (
        BOOST_PROFILES[
            String(tier).toLowerCase()
        ] || null
    );

}



function getBoostProfileByRole(roleID){

    return (
        Object.values(
            BOOST_PROFILES
        ).find(
            profile =>
                profile.roleID ===
                roleID
        ) || null
    );

}



function getNoBoostProfile(){

    return {

        tier:
            null,

        roleID:
            null,

        name:
            "No XP Boost",

        duration:
            0,

        durationText:
            "",

        order:
            0,

        expiresAt:
            null

    };

}



function getMemberKey(member){

    return (
        `${member.guild.id}:${member.id}`
    );

}



function protectRoleChange(member){

    const key =
        getMemberKey(member);


    botRoleChanges.add(
        key
    );


    setTimeout(() => {

        botRoleChanges.delete(
            key
        );

    }, 5000);

}



function isBotRoleChange(member){

    return botRoleChanges.has(
        getMemberKey(member)
    );

}



// =====================================
// ROLE SYNC
// =====================================

async function syncMemberBoostRoles(
    member,
    activeRoleID = null
){

    const rolesToRemove =
        BOOST_ROLE_IDS.filter(

            roleID =>

                roleID !== activeRoleID
                &&
                member.roles.cache.has(
                    roleID
                )

        );


    const shouldAddActiveRole =

        activeRoleID
        &&
        !member.roles.cache.has(
            activeRoleID
        );


    if(
        rolesToRemove.length === 0
        &&
        !shouldAddActiveRole
    ){

        return;

    }


    protectRoleChange(
        member
    );


    for(const roleID of rolesToRemove){

        await member.roles.remove(
            roleID
        );

    }


    if(shouldAddActiveRole){

        await member.roles.add(
            activeRoleID
        );

    }

}



// =====================================
// GET ACTIVE XP BOOST
// =====================================

async function getActiveBoost(member){

    const savedBoost =
        await database.getBoost(
            member.guild.id,
            member.id
        );


    if(!savedBoost){

        await syncMemberBoostRoles(
            member,
            null
        );


        return getNoBoostProfile();

    }


    const expiresAt =
        Number(
            savedBoost.expiresat
        ) || 0;


    if(expiresAt <= Date.now()){

        await database.clearBoost(
            member.guild.id,
            member.id
        );


        await syncMemberBoostRoles(
            member,
            null
        );


        return getNoBoostProfile();

    }


    const profile =
        getBoostProfileByRole(
            savedBoost.role
        );


    if(!profile){

        await database.clearBoost(
            member.guild.id,
            member.id
        );


        await syncMemberBoostRoles(
            member,
            null
        );


        return getNoBoostProfile();

    }


    await syncMemberBoostRoles(
        member,
        profile.roleID
    );


    return {

        ...profile,

        expiresAt

    };

}



// =====================================
// AWARD XP BOOST TO INVENTORY
// =====================================

async function awardXPBoost(
    member,
    tier,
    source = "reward"
){

    const profile =
        getBoostProfileByTier(
            tier
        );


    if(!profile){

        return null;

    }


    const amount =
        await database.addBoostInventory(
            member.guild.id,
            member.id,
            "xp",
            profile.tier,
            1
        );


    console.log(
        `${member.user.tag} stored ${profile.name} from ${source}. Inventory: ${amount}`
    );


    return {

        awarded:
            true,

        status:
            "stored",

        source,

        amount,

        role:
            profile

    };

}



// =====================================
// ACTIVATE XP BOOST FROM INVENTORY
// =====================================

async function activateXPBoostFromInventory(
    member,
    tier
){

    const selectedBoost =
        getBoostProfileByTier(
            tier
        );


    if(!selectedBoost){

        return {

            success:
                false,

            status:
                "invalid-tier"

        };

    }


    const currentBoost =
        await getActiveBoost(
            member
        );


    // Do not waste a weaker item while a
    // stronger XP Boost is already active.
    if(
        currentBoost.order >
        selectedBoost.order
    ){

        return {

            success:
                false,

            status:
                "stronger-active",

            currentBoost,

            selectedBoost

        };

    }


    const consumed =
        await database.consumeBoostInventory(
            member.guild.id,
            member.id,
            "xp",
            selectedBoost.tier
        );


    if(!consumed.success){

        return {

            success:
                false,

            status:
                "no-stock",

            selectedBoost

        };

    }


    const previousBoost =
        await database.getBoost(
            member.guild.id,
            member.id
        );


    const expiresAt =
        Date.now() +
        selectedBoost.duration;


    let status =
        "activated";


    if(
        currentBoost.order ===
        selectedBoost.order
        &&
        currentBoost.order > 0
    ){

        status =
            "refreshed";

    }
    else if(
        currentBoost.order > 0
        &&
        selectedBoost.order >
        currentBoost.order
    ){

        status =
            "upgraded";

    }


    try{

        await database.updateBoost(
            member.guild.id,
            member.id,
            selectedBoost.roleID,
            expiresAt,
            0,
            0
        );


        await syncMemberBoostRoles(
            member,
            selectedBoost.roleID
        );

    }
    catch(error){

        await database.addBoostInventory(
            member.guild.id,
            member.id,
            "xp",
            selectedBoost.tier,
            1
        );


        if(previousBoost){

            await database.updateBoost(
                member.guild.id,
                member.id,
                previousBoost.role,
                previousBoost.expiresat,
                previousBoost.lastrefreshxp || 0,
                previousBoost.boostxp || 0
            );


            await syncMemberBoostRoles(
                member,
                previousBoost.role
            );

        }
        else{

            await database.clearBoost(
                member.guild.id,
                member.id
            );


            await syncMemberBoostRoles(
                member,
                null
            );

        }


        throw error;

    }


    return {

        success:
            true,

        status,

        remaining:
            consumed.remaining,

        boost: {

            ...selectedBoost,

            expiresAt

        }

    };

}



// =====================================
// EARN XP BOOST INVENTORY FROM CHATTING
// =====================================

async function updateBoost(member){

    const guildID =
        member.guild.id;


    const userID =
        member.id;


    const hourlyXP =
        await database.getHourlyBoostXP(
            guildID,
            userID
        );


    const wantedRole =
        getBoostRole(
            hourlyXP
        );


    const progress =
        await database.getXPBoostProgress(
            guildID,
            userID
        );


    if(!wantedRole){

        if(
            progress
            &&
            hourlyXP <= 0
        ){

            await database.clearXPBoostProgress(
                guildID,
                userID
            );

        }
        else if(
            progress
            &&
            Number(
                progress.lastawardxp
            ) > hourlyXP
        ){

            await database.updateXPBoostProgress(
                guildID,
                userID,
                progress.role,
                hourlyXP
            );

        }


        return null;

    }


    const wantedProfile =
        getBoostProfileByRole(
            wantedRole
        );


    if(!wantedProfile){

        return null;

    }


    if(!progress){

        const award =
            await awardXPBoost(
                member,
                wantedProfile.tier,
                "hourly XP"
            );


        await database.updateXPBoostProgress(
            guildID,
            userID,
            wantedRole,
            hourlyXP
        );


        return award;

    }


    const progressRole =
        progress.role;


    const progressOrder =
        ROLE_ORDER[
            progressRole
        ] || 0;


    const wantedOrder =
        ROLE_ORDER[
            wantedRole
        ] || 0;


    // Reaching a higher tier stores one
    // copy of that higher-tier boost.
    if(wantedOrder > progressOrder){

        const award =
            await awardXPBoost(
                member,
                wantedProfile.tier,
                "hourly XP tier-up"
            );


        await database.updateXPBoostProgress(
            guildID,
            userID,
            wantedRole,
            hourlyXP
        );


        return award;

    }


    // The rolling one-hour XP total dropped.
    // Move the progress baseline down without
    // awarding another copy immediately.
    if(wantedOrder < progressOrder){

        await database.updateXPBoostProgress(
            guildID,
            userID,
            wantedRole,
            hourlyXP
        );


        return null;

    }


    const lastAwardXP =
        Number(
            progress.lastawardxp
        ) || 0;


    const gained =
        hourlyXP -
        lastAwardXP;


    const requiredGain =

        wantedRole ===
        BOOST_ROLES.max

            ? 1000000

            : getRequirement(
                wantedRole
            );


    if(gained < 0){

        await database.updateXPBoostProgress(
            guildID,
            userID,
            wantedRole,
            hourlyXP
        );


        return null;

    }


    if(gained >= requiredGain){

        const award =
            await awardXPBoost(
                member,
                wantedProfile.tier,
                "hourly XP repeat"
            );


        await database.updateXPBoostProgress(
            guildID,
            userID,
            wantedRole,
            hourlyXP
        );


        return award;

    }


    return null;

}



// =====================================
// ANTI BOOST ROLE CHEAT
// =====================================

async function checkBoostRole(member){

    if(isBotRoleChange(member))
        return;


    const databaseBoost =
        await database.getBoost(
            member.guild.id,
            member.id
        );


    for(
        const role of
        BOOST_ROLE_IDS
    ){

        if(
            member.roles.cache.has(
                role
            )
        ){

            if(
                databaseBoost
                &&
                databaseBoost.role ===
                role
                &&
                Number(
                    databaseBoost.expiresat
                ) > Date.now()
            ){

                continue;

            }


            protectRoleChange(
                member
            );


            await member.roles.remove(
                role
            ).catch(() => {});


            console.log(
                `${member.user.tag} tried to fake XP boost`
            );

        }

    }


    if(
        databaseBoost
        &&
        Number(
            databaseBoost.expiresat
        ) > Date.now()
    ){

        const activeRole =
            databaseBoost.role;


        if(
            !member.roles.cache.has(
                activeRole
            )
        ){

            protectRoleChange(
                member
            );


            await member.roles.add(
                activeRole
            ).catch(console.error);

        }

    }

}



// =====================================
// REMOVE EXPIRED
// =====================================

async function removeExpiredBoosts(client){

    const expired =
        await database.getExpiredBoosts();


    for(const boost of expired){

        const guild =
            client.guilds.cache.get(
                boost.guildid
            );


        if(guild){

            const member =
                await guild.members.fetch(
                    boost.userid
                ).catch(() => null);


            if(member){

                await syncMemberBoostRoles(
                    member,
                    null
                ).catch(console.error);

            }

        }


        await database.clearBoost(
            boost.guildid,
            boost.userid
        );


        console.log(
            `XP Boost expired for ${boost.userid}`
        );

    }

}



// =====================================
// REMOVE ACTIVE XP BOOST
// =====================================

async function removeBoostRoles(member){

    await syncMemberBoostRoles(
        member,
        null
    );


    await database.clearBoost(
        member.guild.id,
        member.id
    );

}



// =====================================
// RESTORE AFTER RESTART
// =====================================

async function restoreBoosts(client){

    const savedBoosts =
        await database.getAllBoosts();


    let restored =
        0;


    for(const boost of savedBoosts){

        if(
            Number(
                boost.expiresat
            ) <= Date.now()
        ){

            await database.clearBoost(
                boost.guildid,
                boost.userid
            );


            continue;

        }


        const guild =
            client.guilds.cache.get(
                boost.guildid
            );


        if(!guild)
            continue;


        const member =
            await guild.members.fetch(
                boost.userid
            ).catch(() => null);


        if(!member)
            continue;


        await syncMemberBoostRoles(
            member,
            boost.role
        ).catch(console.error);


        restored++;

    }


    console.log(
        `✅ Restored ${restored} active XP Boosts`
    );

}



module.exports = {

    BOOST_ROLES,

    BOOST_PROFILES,

    getBoostRole,

    getRequirement,

    getBoostProfileByTier,

    getBoostProfileByRole,

    getActiveBoost,

    awardXPBoost,

    activateXPBoostFromInventory,

    updateBoost,

    checkBoostRole,

    removeExpiredBoosts,

    removeBoostRoles,

    restoreBoosts

};
