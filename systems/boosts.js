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

    max:
        "1526995218098815016",

    infinity:
        "1540496714903986388"

};


// XP Boost III no longer exists. Keep its old role ID only in the cleanup
// list so Mizuki can remove leftover copies after deployment.
const LEGACY_XP_BOOST_III_ROLE_ID =
    "1526995123420922047";


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

        multiplier:
            5,

        criticalChanceBonus:
            5,

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

        multiplier:
            25,

        criticalChanceBonus:
            10,

        order:
            2

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

        multiplier:
            75,

        criticalChanceBonus:
            20,

        order:
            3

    },


    infinity: {

        tier:
            "infinity",

        roleID:
            BOOST_ROLES.infinity,

        name:
            "XP Boost ထ",

        duration:
            BOOST_DURATION,

        durationText:
            "1 hour",

        multiplier:
            500,

        criticalChanceBonus:
            30,

        order:
            4

    }

};


const XP_BOOST_DROP_CHANCES = {

    chat: {
        tier1: 7,
        tier2: 3,
        max: 0.75,
        infinity: 0.01
    },

    roll: {
        tier1: 12,
        tier2: 5,
        max: 1.5,
        infinity: 0.075
    },

    social: {
        tier1: 15,
        tier2: 7.5,
        max: 3,
        infinity: 0.35
    }

};


const BOOST_ROLE_IDS =
    [
        ...Object.values(
            BOOST_ROLES
        ),
        LEGACY_XP_BOOST_III_ROLE_ID
    ];



// =====================================
// HELPERS
// =====================================

function normalizeXPBoostTier(tier){

    const normalized =
        String(tier || "")
            .trim()
            .toLowerCase();


    const aliases = {
        "1": "tier1",
        "i": "tier1",
        "tier1": "tier1",
        "2": "tier2",
        "ii": "tier2",
        "tier2": "tier2",
        "max": "max",
        "inf": "infinity",
        "infinity": "infinity",
        "∞": "infinity",
        "ထ": "infinity"
    };


    return aliases[normalized] || null;

}



function getBoostProfileByTier(tier){

    return (
        BOOST_PROFILES[
            normalizeXPBoostTier(
                tier
            )
        ] || null
    );

}


function getMemberBoostProfile(member){

    return (
        Object.values(
            BOOST_PROFILES
        )
            .sort(
                (first, second) =>
                    second.order - first.order
            )
            .find(
                profile =>
                    member?.roles?.cache?.has(
                        profile.roleID
                    )
            )
        ||
        getNoBoostProfile()
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

        multiplier:
            1,

        criticalChanceBonus:
            0,

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
// RANDOM XP BOOST INVENTORY DROPS
// =====================================

function rollXPBoostDropTier(
    dropType,
    random = Math.random
){

    const chances =
        XP_BOOST_DROP_CHANCES[
            String(dropType || "").toLowerCase()
        ];


    if(!chances){
        return null;
    }


    const rawRoll =
        Number(
            random()
        );


    const roll =
        Math.min(
            99.999999999,
            Math.max(
                0,
                Number.isFinite(rawRoll)
                    ? rawRoll * 100
                    : 0
            )
        );


    // One random roll makes these mutually exclusive real percentages.
    // Rare tiers are checked first, so at most one item can be awarded.
    const orderedTiers =
        [
            "infinity",
            "max",
            "tier2",
            "tier1"
        ];


    let cumulativeChance =
        0;


    for(const tier of orderedTiers){

        cumulativeChance +=
            Number(
                chances[tier]
            ) || 0;


        if(roll < cumulativeChance){
            return tier;
        }

    }


    return null;

}


async function tryXPBoostDrop(
    member,
    dropType,
    source = dropType,
    random = Math.random
){

    const tier =
        rollXPBoostDropTier(
            dropType,
            random
        );


    if(!tier){
        return null;
    }


    return awardXPBoost(
        member,
        tier,
        source
    );

}


function buildXPBoostDropMessage(
    message,
    award
){

    if(!award?.awarded){
        return "";
    }


    const profile =
        award.role;


    return (
        `⚡ ${message.author} found **1x** <@&${profile.roleID}>! ` +
        `Stored in your XP Boost inventory: **x${Number(award.amount).toLocaleString()}**.`
    );

}


async function sendXPBoostDropReply(
    message,
    award
){

    if(!award?.awarded){
        return null;
    }


    let muted = false;


    try{

        muted =
            await database.isMessageTypeMuted(
                message.guild.id,
                message.author.id,
                "xp_boost"
            );

    }
    catch(error){

        console.error(
            "Could not read XP Boost reply preference:",
            error
        );

    }


    if(muted){
        return null;
    }


    return message.reply({
        content:
            buildXPBoostDropMessage(
                message,
                award
            ),
        allowedMentions: {
            users: [message.author.id],
            roles: [],
            repliedUser: false
        }
    }).catch(error => {

        console.error(
            "Could not send XP Boost drop reply:",
            error
        );


        return null;

    });

}


async function tryAndAnnounceXPBoostDrop(
    message,
    dropType,
    source = dropType,
    random = Math.random
){

    let award = null;


    try{

        award =
            await tryXPBoostDrop(
                message.member,
                dropType,
                source,
                random
            );

    }
    catch(error){

        console.error(
            `Could not award ${dropType} XP Boost drop:`,
            error
        );


        return null;

    }


    await sendXPBoostDropReply(
        message,
        award
    );


    return award;

}


// =====================================
// ANTI BOOST ROLE CHEAT
// =====================================

async function checkBoostRole(member){

    if(isBotRoleChange(member))
        return;


    let databaseBoost =
        await database.getBoost(
            member.guild.id,
            member.id
        );


    if(
        databaseBoost
        &&
        !getBoostProfileByRole(
            databaseBoost.role
        )
    ){

        await database.clearBoost(
            member.guild.id,
            member.id
        );


        databaseBoost =
            null;

    }


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

                await getActiveBoost(
                    member
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

        const profile =
            getBoostProfileByRole(
                boost.role
            );

        if(
            !profile
            ||
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
            profile.roleID
        ).catch(console.error);


        restored++;

    }


    // Remove the deleted XP Boost III role even for users who had no active
    // database boost when the bot restarted.
    for(const guild of client.guilds.cache.values()){

        const members =
            await guild.members.fetch()
                .catch(() => null);


        if(!members){
            continue;
        }


        for(const member of members.values()){

            if(
                member.roles.cache.has(
                    LEGACY_XP_BOOST_III_ROLE_ID
                )
            ){

                await getActiveBoost(
                    member
                ).catch(console.error);

            }

        }

    }


    console.log(
        `✅ Restored ${restored} active XP Boosts`
    );

}



module.exports = {

    BOOST_ROLES,

    BOOST_PROFILES,

    XP_BOOST_DROP_CHANCES,

    LEGACY_XP_BOOST_III_ROLE_ID,

    getBoostProfileByTier,

    getBoostProfileByRole,

    getMemberBoostProfile,

    getActiveBoost,

    awardXPBoost,

    activateXPBoostFromInventory,

    rollXPBoostDropTier,

    tryXPBoostDrop,

    buildXPBoostDropMessage,

    sendXPBoostDropReply,

    tryAndAnnounceXPBoostDrop,

    checkBoostRole,

    removeExpiredBoosts,

    removeBoostRoles,

    restoreBoosts

};
