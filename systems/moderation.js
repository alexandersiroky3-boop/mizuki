const {
    AuditLogEvent,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const database = require("../database");

const OWNER_ID = "1239975819112353969";
const BANNED_ROLE_ID = "1537100069533126676";
const BAN_LIST_CHANNEL_ID = "1537104026825658428";

const MOD_ROLE_IDS = new Set([
    "1534602857641410712",
    "1324943417775493163",
    "1324943459903209574",
    "1324933637866786911"
]);

const BANNED_ROLE_CHANGE_ADD = "add";
const BANNED_ROLE_CHANGE_REMOVE = "remove";
const BANNED_ROLE_AUTHORIZATION_TTL_MS = 15 * 1000;
const BANNED_ROLE_AUDIT_WINDOW_MS = 10 * 1000;
const BANNED_ROLE_AUDIT_RETRY_DELAYS_MS = [0, 350, 900];

// A Banned-role edit is allowed only when one of the moderation flows below
// registers the exact guild/member/direction first. This prevents a manual
// moderator edit from being mistaken for a bot command merely because both
// changes appear in Discord's audit log as being made by Mizuki.
const authorizedBannedRoleChanges = new Map();
const consumedBannedRoleAuditEntries = new Map();
let nextBannedRoleAuthorizationID = 1;

function wait(milliseconds){
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function normalizeBannedRoleAction(action){
    if(action === BANNED_ROLE_CHANGE_ADD || action === BANNED_ROLE_CHANGE_REMOVE){
        return action;
    }
    throw new TypeError(`Invalid Banned-role action: ${action}`);
}

function getBannedRoleAuthorizationKey(guildID, memberID, action){
    return [
        String(guildID),
        String(memberID),
        normalizeBannedRoleAction(action)
    ].join(":");
}

function cleanupBannedRoleAuthorizations(now = Date.now()){
    for(const [key, tokens] of authorizedBannedRoleChanges){
        const active = tokens.filter(token => token.expiresAt > now);
        if(active.length) authorizedBannedRoleChanges.set(key, active);
        else authorizedBannedRoleChanges.delete(key);
    }

    for(const [entryID, expiresAt] of consumedBannedRoleAuditEntries){
        if(expiresAt <= now) consumedBannedRoleAuditEntries.delete(entryID);
    }
}

function authorizeBannedRoleChange(guildID, memberID, action){
    cleanupBannedRoleAuthorizations();

    const key = getBannedRoleAuthorizationKey(guildID, memberID, action);
    const token = {
        id: nextBannedRoleAuthorizationID++,
        key,
        expiresAt: Date.now() + BANNED_ROLE_AUTHORIZATION_TTL_MS
    };
    const tokens = authorizedBannedRoleChanges.get(key) || [];
    tokens.push(token);
    authorizedBannedRoleChanges.set(key, tokens);
    return token;
}

function revokeBannedRoleAuthorization(token){
    if(!token?.key) return;
    const tokens = authorizedBannedRoleChanges.get(token.key);
    if(!tokens) return;
    const remaining = tokens.filter(candidate => candidate.id !== token.id);
    if(remaining.length) authorizedBannedRoleChanges.set(token.key, remaining);
    else authorizedBannedRoleChanges.delete(token.key);
}

function consumeBannedRoleAuthorization(guildID, memberID, action){
    cleanupBannedRoleAuthorizations();

    const key = getBannedRoleAuthorizationKey(guildID, memberID, action);
    const tokens = authorizedBannedRoleChanges.get(key);
    if(!tokens?.length) return false;

    tokens.shift();
    if(tokens.length) authorizedBannedRoleChanges.set(key, tokens);
    else authorizedBannedRoleChanges.delete(key);
    return true;
}

async function setBannedRole(member, shouldHaveRole, reason){
    if(!member?.guild?.id || !member?.id || !member?.roles?.cache){
        throw new TypeError("A valid guild member is required to change the Banned role.");
    }

    const currentlyHasRole = member.roles.cache.has(BANNED_ROLE_ID);
    if(currentlyHasRole === shouldHaveRole) return false;

    const action = shouldHaveRole
        ? BANNED_ROLE_CHANGE_ADD
        : BANNED_ROLE_CHANGE_REMOVE;
    const token = authorizeBannedRoleChange(member.guild.id, member.id, action);

    try{
        if(shouldHaveRole){
            await member.roles.add(BANNED_ROLE_ID, reason);
        } else {
            await member.roles.remove(BANNED_ROLE_ID, reason);
        }
        return true;
    } catch(error){
        // A failed Discord request has no matching guildMemberUpdate event, so
        // its unused permission token must not authorize a later manual edit.
        revokeBannedRoleAuthorization(token);
        throw error;
    }
}

function addBannedRole(member, reason){
    return setBannedRole(member, true, reason);
}

function removeBannedRole(member, reason){
    return setBannedRole(member, false, reason);
}

function auditChangeContainsBannedRole(change){
    const values = [];
    if(Array.isArray(change?.new)) values.push(...change.new);
    if(Array.isArray(change?.old)) values.push(...change.old);
    return values.some(role => String(role?.id ?? role) === BANNED_ROLE_ID);
}

function auditEntryMatchesBannedRoleChange(entry, memberID, action, changedAt){
    const expectedChangeKey = action === BANNED_ROLE_CHANGE_ADD
        ? "$add"
        : "$remove";
    const targetID = String(entry?.targetId ?? entry?.target?.id ?? "");
    const createdAt = Number(entry?.createdTimestamp);

    if(targetID !== String(memberID) || !Number.isFinite(createdAt)) return false;
    if(createdAt < changedAt - BANNED_ROLE_AUDIT_WINDOW_MS) return false;
    if(createdAt > changedAt + BANNED_ROLE_AUDIT_WINDOW_MS) return false;

    return Array.isArray(entry?.changes) && entry.changes.some(change =>
        change?.key === expectedChangeKey && auditChangeContainsBannedRole(change)
    );
}

async function findBannedRoleAuditExecutor(
    guild,
    memberID,
    action,
    changedAt = Date.now(),
    retryDelays = BANNED_ROLE_AUDIT_RETRY_DELAYS_MS
){
    let auditLogReadable = false;

    for(const delay of retryDelays){
        if(delay > 0) await wait(delay);

        let auditLogs;
        try{
            auditLogs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberRoleUpdate,
                limit: 8
            });
            auditLogReadable = true;
        } catch(error){
            // Missing permission/access will not improve during this event.
            if([50001, 50013].includes(Number(error?.code)) ||
                [401, 403].includes(Number(error?.status ?? error?.statusCode))){
                break;
            }
            continue;
        }

        cleanupBannedRoleAuthorizations();
        const entries = auditLogs?.entries?.values
            ? [...auditLogs.entries.values()]
            : (Array.isArray(auditLogs?.entries) ? auditLogs.entries : []);
        const entry = entries
            .filter(candidate =>
                !consumedBannedRoleAuditEntries.has(String(candidate?.id)) &&
                auditEntryMatchesBannedRoleChange(
                    candidate,
                    memberID,
                    action,
                    changedAt
                )
            )
            .sort((a, b) => Number(b.createdTimestamp) - Number(a.createdTimestamp))[0];

        if(entry){
            const entryID = String(entry.id);
            consumedBannedRoleAuditEntries.set(
                entryID,
                Date.now() + BANNED_ROLE_AUDIT_WINDOW_MS * 2
            );
            return {
                executorID: String(entry.executorId ?? entry.executor?.id ?? "") || null,
                auditLogReadable: true,
                entryID
            };
        }
    }

    return {
        executorID: null,
        auditLogReadable,
        entryID: null
    };
}

async function handleBannedRoleProtection(oldMember, newMember){
    const oldHasRole = oldMember.roles.cache.has(BANNED_ROLE_ID);
    const newHasRole = newMember.roles.cache.has(BANNED_ROLE_ID);
    if(oldHasRole === newHasRole){
        return { changed: false, allowed: true, reverted: false };
    }

    const action = newHasRole
        ? BANNED_ROLE_CHANGE_ADD
        : BANNED_ROLE_CHANGE_REMOVE;

    // The exact add/remove was registered immediately before a trusted
    // !ban/!unban/expiry/rollback operation touched Discord.
    if(consumeBannedRoleAuthorization(newMember.guild.id, newMember.id, action)){
        return {
            changed: true,
            allowed: true,
            reverted: false,
            source: "moderation-system"
        };
    }

    const audit = await findBannedRoleAuditExecutor(
        newMember.guild,
        newMember.id,
        action,
        Date.now()
    );

    if(audit.executorID === OWNER_ID){
        return {
            changed: true,
            allowed: true,
            reverted: false,
            source: "owner"
        };
    }

    const executorText = audit.executorID || "an unknown executor";
    const reason =
        `Protected Banned role: reverted unauthorized ${action} by ${executorText}`;

    if(newHasRole){
        await removeBannedRole(newMember, reason);
    } else {
        await addBannedRole(newMember, reason);
    }

    console.warn(
        `Reverted unauthorized Banned-role ${action} for ` +
        `${newMember.user?.tag || newMember.id}; executor: ${executorText}.`
    );

    return {
        changed: true,
        allowed: false,
        reverted: true,
        source: audit.auditLogReadable ? "unauthorized" : "unverified",
        executorID: audit.executorID
    };
}

function isModerator(member){
    return member?.id === OWNER_ID ||
        member?.roles?.cache?.some(role => MOD_ROLE_IDS.has(role.id));
}

function parseDuration(input){
    const value = String(input || "").trim().toLowerCase();
    const match = value.match(/^(\d+)(m|h|d|w)?$/);
    if(!match) return null;

    const amount = Number(match[1]);
    const unit = match[2] || "d";
    const multipliers = {
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000
    };
    const milliseconds = amount * multipliers[unit];

    if(!Number.isSafeInteger(milliseconds) || milliseconds < 60 * 1000 ||
        milliseconds > 365 * 24 * 60 * 60 * 1000){
        return null;
    }

    return milliseconds;
}

function formatRemaining(expiresAt){
    const remaining = Math.max(0, Number(expiresAt) - Date.now());
    if(remaining <= 0) return "Expired";
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.max(1, Math.ceil((remaining % 3600000) / 60000));
    return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`]
        .filter(Boolean).join(" ");
}

function hierarchyError(message, target){
    if(target.id === OWNER_ID){
        return "❌ **The server owner is permanently protected and cannot be punished.**";
    }
    if(target.id === message.author.id){
        return "❌ You cannot punish yourself.";
    }
    if(target.user.bot){
        return "❌ You cannot punish bots.";
    }
    if(target.id === message.guild.ownerId){
        return "❌ The Discord server owner cannot be punished.";
    }

    const actor = message.member;
    const ownerBypass = actor.id === OWNER_ID || actor.id === message.guild.ownerId;
    if(!ownerBypass && actor.roles.highest.comparePositionTo(target.roles.highest) <= 0){
        return "❌ You cannot punish a member whose highest role is equal to or above yours.";
    }

    const botMember = message.guild.members.me;
    if(!botMember || botMember.roles.highest.comparePositionTo(target.roles.highest) <= 0){
        return "❌ Mizuki cannot manage this member because their role is too high.";
    }
    return null;
}

async function resolveMember(message, rawTarget){
    const mentioned = message.mentions.members.first();
    if(mentioned) return mentioned;
    const id = String(rawTarget || "").replace(/[^0-9]/g, "");
    if(!id) return null;
    return message.guild.members.fetch(id).catch(() => null);
}

async function updateBanList(guild){
    const channel = await guild.channels.fetch(BAN_LIST_CHANNEL_ID).catch(() => null);
    if(!channel?.isTextBased()) return;

    const bans = await database.getActiveModerationBans(guild.id);
    const lines = bans.map((ban, index) => {
        const reason = String(ban.reason || "No reason provided").slice(0, 300);
        return `**${index + 1}. <@${ban.userid}>**\n` +
            `Time remaining: **${formatRemaining(ban.expiresat)}**\n` +
            `Reason: ${reason}\nModerator: <@${ban.moderatorid}>`;
    });

    let description = lines.length
        ? `You have been banned.\n\n${lines.join("\n\n")}`
        : "There are currently no temporarily banned members.";
    if(description.length > 4000){
        description = description.slice(0, 3960) + "\n\n*More bans are saved in the database.*";
    }

    const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("🔨 Active Bans")
        .setDescription(description)
        .setFooter({ text: "This message updates automatically." })
        .setTimestamp();

    const storedMessageID = await database.getModerationPanelMessageID(guild.id);
    let panel = storedMessageID
        ? await channel.messages.fetch(storedMessageID).catch(() => null)
        : null;

    if(panel?.author?.id === guild.client.user.id){
        await panel.edit({ embeds: [embed] });
        return;
    }

    // Reuse an older Mizuki panel if the database was reset.
    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    panel = recent?.find(message =>
        message.author.id === guild.client.user.id &&
        message.embeds[0]?.title === "🔨 Active Bans"
    );

    if(panel){
        await panel.edit({ embeds: [embed] });
    } else {
        panel = await channel.send({ embeds: [embed] });
    }

    await database.setModerationPanelMessageID(guild.id, panel.id);
}

async function applyTimedBan(message, target, durationMs, reason){
    const existing = await database.getActiveModerationBan(message.guild.id, target.id);
    if(existing) return { error: "❌ That member is already temporarily banned." };

    const bannedRole = await message.guild.roles.fetch(BANNED_ROLE_ID).catch(() => null);
    const botMember = message.guild.members.me;
    if(!bannedRole || !botMember || botMember.roles.highest.comparePositionTo(bannedRole) <= 0){
        return { error: "❌ Mizuki cannot manage the configured Banned role. Move Mizuki's role above it." };
    }

    const rolesToSave = target.roles.cache.filter(role =>
        role.id !== message.guild.id &&
        role.id !== BANNED_ROLE_ID &&
        !role.managed
    );
    const unmanageable = rolesToSave.filter(role =>
        botMember.roles.highest.comparePositionTo(role) <= 0
    );
    if(unmanageable.size){
        return { error: "❌ Mizuki cannot safely remove every role from this member because one or more roles are above Mizuki." };
    }

    const roleIDs = [...rolesToSave.keys()];
    const expiresAt = Date.now() + durationMs;
    await database.createModerationBan({
        guildID: message.guild.id,
        userID: target.id,
        moderatorID: message.author.id,
        reason,
        expiresAt,
        savedRoleIDs: roleIDs
    });

    try{
        await addBannedRole(target, `Temporary ban by ${message.author.tag}: ${reason}`);
        if(roleIDs.length) await target.roles.remove(roleIDs, `Temporary ban by ${message.author.tag}: ${reason}`);
    } catch(error){
        // Best-effort rollback prevents a failed database/Discord operation
        // from leaving the member stranded with a partial role state.
        await removeBannedRole(target, "Temporary-ban rollback").catch(() => {});
        if(roleIDs.length){
            await target.roles.add(roleIDs, "Temporary-ban rollback").catch(() => {});
        }
        await database.cancelModerationBan(message.guild.id, target.id);
        throw error;
    }

    await updateBanList(message.guild);
    return { expiresAt };
}

async function restoreTimedBan(guild, userID, endedBy = "Automatic expiry"){
    const ban = await database.getActiveModerationBan(guild.id, userID);
    if(!ban) return false;

    const member = await guild.members.fetch(userID).catch(() => null);
    if(member){
        const botMember = guild.members.me;
        const restorable = (ban.savedroleids || []).filter(roleID => {
            const role = guild.roles.cache.get(roleID);
            return role && !role.managed && botMember.roles.highest.comparePositionTo(role) > 0;
        });
        await removeBannedRole(member, endedBy).catch(() => {});
        if(restorable.length) await member.roles.add(restorable, endedBy);
    }

    await database.finishModerationBan(guild.id, userID, endedBy);
    await updateBanList(guild);
    return true;
}

async function restoreExpiredBans(client){
    const expired = await database.getExpiredModerationBans();
    for(const ban of expired){
        const guild = await client.guilds.fetch(ban.guildid).catch(() => null);
        if(guild) await restoreTimedBan(guild, ban.userid, "Temporary ban expired").catch(console.error);
    }
}

async function initialize(client, guildID){
    const guild = await client.guilds.fetch(guildID).catch(() => null);
    if(!guild) return;

    const botMember = guild.members.me ||
        await guild.members.fetchMe().catch(() => null);
    if(!botMember?.permissions?.has(PermissionFlagsBits.ViewAuditLog)){
        console.warn(
            "Banned-role protection needs View Audit Log to recognize the owner's " +
            "manual role changes. Unverified manual changes will be reverted for safety."
        );
    }

    await restoreExpiredBans(client);
    await updateBanList(guild).catch(console.error);
}

module.exports = {
    OWNER_ID,
    BANNED_ROLE_ID,
    MOD_ROLE_IDS,
    isModerator,
    parseDuration,
    formatRemaining,
    hierarchyError,
    resolveMember,
    applyTimedBan,
    restoreTimedBan,
    restoreExpiredBans,
    updateBanList,
    initialize,
    addBannedRole,
    removeBannedRole,
    auditEntryMatchesBannedRoleChange,
    findBannedRoleAuditExecutor,
    handleBannedRoleProtection
};
