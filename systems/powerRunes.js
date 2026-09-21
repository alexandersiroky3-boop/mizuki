const { AuditLogEvent } = require("discord.js");
const guildMembers = require("../utils/guildMembers");

const OWNER_ID = "1239975819112353969";
const POWER_RUNE_ROLE_DURATION_MS = 20 * 1000;
const roleTimers = new Map();

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


function roleKey(member){
    return `${member.guild.id}:${member.id}`;
}

async function syncMemberPowerRuneRoles(member){

    if(!member?.guild?.id || !member?.id){
        return {
            added: [],
            removed: []
        };
    }


    const [activations, ownerRoles] = await Promise.all([
        getDatabase().getActivePowerRuneRoles(member.guild.id, member.id),
        getDatabase().getPowerRuneOwnerRoles(member.guild.id, member.id)
    ]);
    const activeTiers = new Set([
        ...activations.map(row => row.tier), ...ownerRoles
    ]);


    const roleIDsToAdd = [];
    const roleIDsToRemove = [];


    for(const profile of Object.values(
        POWER_RUNE_PROFILES
    )){

        const shouldOwnRole = activeTiers.has(profile.tier);


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
            "Power Rune role expired (20 seconds)"
        );

    }


    if(roleIDsToAdd.length > 0){

        await member.roles.add(
            roleIDsToAdd,
            "Power Rune activated for 20 seconds"
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


    console.log(
        `${member.user?.tag || member.id} found ${profile.name} from ${source}. Inventory: ${amount}`
    );


    return {
        awarded: true,
        status: "stored",
        source,
        amount,
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

    if(await getDatabase().isMessageTypeMuted(
        message.guild.id, message.author.id, "power_rune"
    )) return null;


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

            schedulePowerRuneExpiry(member, profile.tier, result.roleExpiresAt);

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


function schedulePowerRuneExpiry(member, tier, expiresAt){
    const key = `${roleKey(member)}:${tier}`;
    const previous = roleTimers.get(key);
    if(previous) clearTimeout(previous);

    const delay = Math.max(0, Number(expiresAt) - Date.now() + 100);
    const timer = setTimeout(async () => {
        roleTimers.delete(key);
        try{
            const latest = await member.guild.members.fetch(member.id)
                .catch(() => member);
            await syncMemberPowerRuneRoles(latest);
            await getDatabase().deleteExpiredPowerRuneRoles(
                member.guild.id, member.id
            );
        }
        catch(error){
            console.error("Power Rune role expiry failed:", error);
        }
    }, delay);
    timer.unref?.();
    roleTimers.set(key, timer);
}

async function removeExpiredPowerRuneRoles(client, guildID){
    const activations = await getDatabase().getPowerRuneRoleActivations(guildID);
    const guild = client.guilds.cache.get(String(guildID));
    if(!guild) return;

    const expiredUsers = new Set(
        activations.filter(row => row.expiresAt <= Date.now())
            .map(row => row.userID)
    );
    for(const userID of expiredUsers){
        const member = await guild.members.fetch(userID).catch(() => null);
        if(member) await syncMemberPowerRuneRoles(member);
        await getDatabase().deleteExpiredPowerRuneRoles(guildID, userID);
    }
}

async function restorePowerRuneRoles(client, guildID){
    const guild = client.guilds.cache.get(String(guildID));
    if(!guild) return;
    const activations = await getDatabase().getPowerRuneRoleActivations(guildID);
    const activeUserIDs = new Set(activations.map(row => row.userID));
    for(const userID of await getDatabase().getPowerRuneOwnerRoleUsers(guildID)){
        activeUserIDs.add(userID);
    }
    const roleIDs = Object.values(POWER_RUNE_PROFILES)
        .map(profile => profile.roleID);

    // Remove roles left behind by older inventory-based versions.
    for await(const page of guildMembers.iterateGuildMemberPages(guild)){
        for(const member of page.values()){
            if(activeUserIDs.has(member.id)
                || roleIDs.some(id => member.roles.cache.has(id))){
                await syncMemberPowerRuneRoles(member);
            }
        }
    }
    await removeExpiredPowerRuneRoles(client, guildID);
    for(const row of activations){
        if(row.expiresAt > Date.now()){
            const member = await guild.members.fetch(row.userID).catch(() => null);
            if(member) schedulePowerRuneExpiry(member, row.tier, row.expiresAt);
        }
    }
}

async function getRoleChangeExecutor(newMember, changedRoles){
    const observedAt = Date.now();
    await new Promise(resolve => setTimeout(resolve, 650));
    const logs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberRoleUpdate,
        limit: 6
    }).catch(error => {
        console.error("Power Rune role audit lookup failed:", error);
        return null;
    });
    const entry = logs?.entries?.find(item =>
        item.target?.id === newMember.id
        && item.createdTimestamp >= observedAt - 1500
        && item.createdTimestamp <= Date.now()
        && item.changes?.some(change =>
            changedRoles.some(role => role.action === change.key
            && [...(change.new || []), ...(change.old || [])]
                .some(entryRole => entryRole.id === role.id))
        )
    );
    return entry?.executor?.id || null;
}

async function checkPowerRuneRoles(oldMember, newMember){
    const changedRoles = Object.values(POWER_RUNE_PROFILES)
        .filter(profile =>
            oldMember.roles.cache.has(profile.roleID)
            !== newMember.roles.cache.has(profile.roleID)
        ).map(profile => ({
            id: profile.roleID,
            action: newMember.roles.cache.has(profile.roleID)
                ? "$add" : "$remove"
        }));

    if(changedRoles.length === 0) return;
    const executor = await getRoleChangeExecutor(newMember, changedRoles);
    if(executor === OWNER_ID){
        for(const role of changedRoles){
            const profile = Object.values(POWER_RUNE_PROFILES)
                .find(item => item.roleID === role.id);
            await getDatabase().setPowerRuneOwnerRole(
                newMember.guild.id, newMember.id, profile.tier,
                role.action === "$add"
            );
        }
        return;
    }
    if(executor === newMember.client?.user?.id){
        return;
    }

    await syncMemberPowerRuneRoles(newMember);
}


module.exports = {
    POWER_RUNE_PROFILES,
    POWER_RUNE_TIERS,
    MAX_POWER_RUNE_REDEEM_QUANTITY,
    POWER_RUNE_ROLE_DURATION_MS,
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
    checkPowerRuneRoles,
    removeExpiredPowerRuneRoles,
    restorePowerRuneRoles
};
