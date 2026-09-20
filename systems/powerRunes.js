const POWER_RUNE_PROFILES = {

    tier1: {
        tier: "tier1",
        roleID: "1551186904903450685",
        name: "Power Rune I",
        xp: 100000,
        chance: 3,
        order: 1
    },

    tier2: {
        tier: "tier2",
        roleID: "1551190089256665168",
        name: "Power Rune II",
        xp: 1000000,
        chance: 0.5,
        order: 2
    },

    tier3: {
        tier: "tier3",
        roleID: "1551190400599855165",
        name: "Power Rune III",
        xp: 10000000,
        chance: 0.08,
        order: 3
    }

};


const POWER_RUNE_TIERS = [
    "tier1",
    "tier2",
    "tier3"
];


const MAX_POWER_RUNE_REDEEM_QUANTITY =
    1000000;


function getDatabase(){

    // Keep configuration helpers usable in isolated tests without opening a
    // PostgreSQL pool. Runtime inventory operations still share database.js.
    return require("../database");

}


function normalizePowerRuneTier(tier){

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
        "3": "tier3",
        "iii": "tier3",
        "tier3": "tier3"
    };


    return aliases[normalized] || null;

}


function getPowerRuneProfile(tier){

    return (
        POWER_RUNE_PROFILES[
            normalizePowerRuneTier(tier)
        ] || null
    );

}


function parsePowerRuneQuantity(value){

    const text =
        String(value ?? "").trim();


    if(!/^\d+$/.test(text)){
        return null;
    }


    const quantity =
        Number(text);


    if(
        !Number.isSafeInteger(quantity)
        ||
        quantity < 1
        ||
        quantity >
            MAX_POWER_RUNE_REDEEM_QUANTITY
    ){
        return null;
    }


    return quantity;

}


function safeRandomPercent(random = Math.random){

    let rawRoll;


    try{
        rawRoll = Number(random());
    }
    catch{
        rawRoll = 1;
    }


    if(!Number.isFinite(rawRoll)){
        rawRoll = 1;
    }


    return (
        Math.min(
            99.999999999,
            Math.max(
                0,
                rawRoll * 100
            )
        )
    );

}


function rollPowerRuneDropTier(
    random = Math.random
){

    const roll =
        safeRandomPercent(random);


    // A single roll keeps the three exact chances mutually exclusive, so one
    // XP-earning chat message can never award several Rune tiers at once.
    const orderedTiers = [
        "tier3",
        "tier2",
        "tier1"
    ];


    let cumulativeChance = 0;


    for(const tier of orderedTiers){

        cumulativeChance +=
            POWER_RUNE_PROFILES[tier]
                .chance;


        if(roll < cumulativeChance){
            return tier;
        }

    }


    return null;

}


function inventoryAmountMap(rows){

    const amounts =
        new Map();


    for(const row of rows || []){

        const boostType =
            String(
                row.boosttype ??
                row.boostType ??
                ""
            ).toLowerCase();


        if(boostType !== "rune"){
            continue;
        }


        const tier =
            normalizePowerRuneTier(
                row.tier
            );


        if(!tier){
            continue;
        }


        amounts.set(
            tier,
            Math.max(
                0,
                Number(row.amount) || 0
            )
        );

    }


    return amounts;

}


async function syncMemberPowerRuneRoles(
    member,
    inventoryRows = null
){

    if(!member?.guild?.id || !member?.id){
        return {
            added: [],
            removed: []
        };
    }


    const rows =
        inventoryRows ||
        await getDatabase()
            .getBoostInventory(
                member.guild.id,
                member.id
            );


    const amounts =
        inventoryAmountMap(rows);


    const roleIDsToAdd = [];
    const roleIDsToRemove = [];


    for(const profile of Object.values(
        POWER_RUNE_PROFILES
    )){

        const shouldOwnRole =
            Number(
                amounts.get(profile.tier) || 0
            ) > 0;


        const ownsRole =
            Boolean(
                member.roles?.cache?.has(
                    profile.roleID
                )
            );


        if(shouldOwnRole && !ownsRole){
            roleIDsToAdd.push(
                profile.roleID
            );
        }
        else if(!shouldOwnRole && ownsRole){
            roleIDsToRemove.push(
                profile.roleID
            );
        }

    }


    if(roleIDsToRemove.length > 0){

        await member.roles.remove(
            roleIDsToRemove,
            "Power Rune inventory synchronization"
        );

    }


    if(roleIDsToAdd.length > 0){

        await member.roles.add(
            roleIDsToAdd,
            "Power Rune inventory synchronization"
        );

    }


    return {
        added: roleIDsToAdd,
        removed: roleIDsToRemove
    };

}


async function awardPowerRune(
    member,
    tier,
    source = "chat message"
){

    const profile =
        getPowerRuneProfile(tier);


    if(!profile){
        return null;
    }


    const amount =
        await getDatabase()
            .addBoostInventory(
                member.guild.id,
                member.id,
                "rune",
                profile.tier,
                1
            );


    let roleSynced = true;


    try{

        await syncMemberPowerRuneRoles(
            member
        );

    }
    catch(error){

        roleSynced = false;


        console.error(
            `Could not synchronize ${profile.name} role for ${member.id}:`,
            error
        );

    }


    console.log(
        `${member.user?.tag || member.id} found ${profile.name} from ${source}. Inventory: ${amount}`
    );


    return {
        awarded: true,
        status: "stored",
        source,
        amount,
        roleSynced,
        rune: profile
    };

}


async function tryPowerRuneDrop(
    member,
    source = "chat message",
    random = Math.random
){

    const tier =
        rollPowerRuneDropTier(
            random
        );


    if(!tier){
        return null;
    }


    return awardPowerRune(
        member,
        tier,
        source
    );

}


function buildPowerRuneDropMessage(
    message,
    award
){

    if(!award?.awarded){
        return "";
    }


    const profile =
        award.rune;


    return (
        `🔷 ${message.author} found **1x** <@&${profile.roleID}> from chatting! ` +
        `Rune inventory: **x${Number(award.amount).toLocaleString()}**. ` +
        "Use it through `!boost`."
    );

}


async function sendPowerRuneDropReply(
    message,
    award
){

    if(!award?.awarded){
        return null;
    }


    return message.reply({
        content:
            buildPowerRuneDropMessage(
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
            "Could not send Power Rune drop reply:",
            error
        );


        return null;

    });

}


async function redeemPowerRunes(
    member,
    tier,
    requestedQuantity
){

    const profile =
        getPowerRuneProfile(tier);


    const quantity =
        parsePowerRuneQuantity(
            requestedQuantity
        );


    if(!profile){
        return {
            success: false,
            status: "invalid-tier"
        };
    }


    if(!quantity){
        return {
            success: false,
            status: "invalid-quantity",
            maximum:
                MAX_POWER_RUNE_REDEEM_QUANTITY,
            rune: profile
        };
    }


    const result =
        await getDatabase()
            .redeemPowerRuneInventory(
                member.guild.id,
                member.id,
                profile.tier,
                quantity,
                profile.xp
            );


    if(result.success){

        try{

            await syncMemberPowerRuneRoles(
                member
            );

        }
        catch(error){

            console.error(
                `Could not synchronize Power Rune roles after redemption for ${member.id}:`,
                error
            );

        }

    }


    return {
        ...result,
        rune: profile,
        quantity
    };

}


async function checkPowerRuneRoles(
    oldMember,
    newMember
){

    const changed =
        Object.values(
            POWER_RUNE_PROFILES
        ).some(profile =>
            oldMember.roles.cache.has(
                profile.roleID
            ) !==
            newMember.roles.cache.has(
                profile.roleID
            )
        );


    if(!changed){
        return;
    }


    await syncMemberPowerRuneRoles(
        newMember
    );

}


module.exports = {
    POWER_RUNE_PROFILES,
    POWER_RUNE_TIERS,
    MAX_POWER_RUNE_REDEEM_QUANTITY,
    normalizePowerRuneTier,
    getPowerRuneProfile,
    parsePowerRuneQuantity,
    rollPowerRuneDropTier,
    inventoryAmountMap,
    syncMemberPowerRuneRoles,
    awardPowerRune,
    tryPowerRuneDrop,
    buildPowerRuneDropMessage,
    sendPowerRuneDropReply,
    redeemPowerRunes,
    checkPowerRuneRoles
};
