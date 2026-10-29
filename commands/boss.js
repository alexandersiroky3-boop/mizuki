const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const database = require("../database");
const bosses = require("../systems/bosses");
const bossChallenges = require("../systems/bossChallenges");
const bossShop = require("../systems/bossShop");
const leveling = require("../systems/leveling");


const INFO_BUTTON_ID = "raid_boss_info";
const CHALLENGES_BUTTON_ID = "raid_boss_challenges";
const CHALLENGE_LIST_BUTTON_ID = "raid_challenge_list";
const BOSS_SHOP_BUTTON_ID = "raid_boss_shop";
const BOSS_SHOP_BUY_PREFIX = "raid_boss_shop_buy:";
const RAID_STATUS_CHANNEL_ID = "1562067936485703811";
const RAID_STATUS_PANEL_FOOTER =
    "Mizuki Raid Boss • Live Status";
const HEALTH_BAR_SEGMENTS = 16;


const raidStatusMessageIDs =
    new Map();


function formatNumber(value){
    return Math.max(
        0,
        Math.round(Number(value) || 0)
    ).toLocaleString("en-US");
}


function resolveGuildEmoji(guild, name, fallback){
    const emoji = guild?.emojis?.cache?.find?.(
        entry => entry.name === name
    );
    return emoji ? emoji.toString() : fallback;
}


function renderChestEmojis(guild, value){
    let rendered = String(value || "");

    for(const tier of ["bronze", "gilded", "boss"]){
        rendered = rendered.replaceAll(
            `:${tier}_chest:`,
            resolveGuildEmoji(
                guild,
                `${tier}_chest`,
                `:${tier}_chest:`
            )
        );
    }

    return rendered;
}


function resolveBossAvatarURL(guild, definition){
    const names = [
        definition?.name,
        String(definition?.name || "").split(" (")[0]
    ]
        .map(value => String(value || "").trim().toLowerCase())
        .filter(Boolean);
    const member = guild?.members?.cache?.find?.(entry => {
        const memberNames = [
            entry.displayName,
            entry.user?.username,
            entry.user?.globalName
        ].map(value => String(value || "").trim().toLowerCase());
        return names.some(name => memberNames.includes(name));
    });
    return member?.displayAvatarURL?.({size: 256}) || null;
}


function buildHealthBar(guild, currentHP, maxHP){
    const safeMaxHP = Math.max(1, Number(maxHP) || 1);
    const safeCurrentHP = Math.max(
        0,
        Math.min(safeMaxHP, Number(currentHP) || 0)
    );
    const ratio = safeCurrentHP / safeMaxHP;
    const activeSegments = safeCurrentHP <= 0
        ? 0
        : Math.max(
            1,
            Math.min(
                HEALTH_BAR_SEGMENTS,
                Math.ceil(ratio * HEALTH_BAR_SEGMENTS)
            )
        );
    const activeEmoji = resolveGuildEmoji(
        guild,
        "active_health_bar",
        "🟩"
    );
    const emptyEmoji = resolveGuildEmoji(
        guild,
        "empty_health_bar",
        "⬛"
    );

    return activeEmoji.repeat(activeSegments)
        + emptyEmoji.repeat(
            HEALTH_BAR_SEGMENTS - activeSegments
        );
}


function getHealthColor(currentHP, maxHP){
    const ratio = Math.max(0, Number(currentHP) || 0)
        / Math.max(1, Number(maxHP) || 1);
    if(ratio > 0.6) return 0x43B581;
    if(ratio > 0.25) return 0xFAA61A;
    return 0xED4245;
}


function formatAdvantages(definition){
    return definition.advantages
        .map(entry =>
            `• ${entry.name}${entry.mastered ? " **(mastered)**" : ""}`
        )
        .join("\n") || "None";
}


function getAdvantageRuntimeStatus(boss, advantage, now = Date.now()){
    const state = boss?.stateData || {};
    const buffs = Array.isArray(state.buffs) ? state.buffs : [];
    const activeBuffs = buffs.filter(buff =>
        buff.type === advantage.key
        && Number(buff.expiresAt) > now
    );
    const passive = new Set([
        "chatting_immunity",
        "critical_immunity",
        "chatting_immortality",
        "critical_immortality",
        "commands_immunity",
        "commands_immortality",
        "rolling_immunity",
        "degeneration"
    ]);

    if(passive.has(advantage.key)) return "🟢 **ACTIVE**";

    if(advantage.key === "precision"){
        const cooldownUntil = Number(state.precisionCooldownUntil) || 0;
        return cooldownUntil > now
            ? `🟡 **COOLDOWN** until <t:${Math.floor(cooldownUntil / 1000)}:R>`
            : "🟢 **READY**";
    }

    const timedField = {
        regeneration: "regenerationActiveUntil",
        xp_immortality: "immortalityActiveUntil",
        fury: "furyActiveUntil"
    }[advantage.key];
    const expiresAt = timedField
        ? Number(state[timedField]) || 0
        : activeBuffs.length > 0
            ? Math.max(
                ...activeBuffs.map(buff => Number(buff.expiresAt) || 0)
            )
            : 0;

    if(expiresAt > now){
        return `🟢 **ACTIVE** until <t:${Math.floor(expiresAt / 1000)}:R>${
            activeBuffs.length > 1 ? ` ×${activeBuffs.length}` : ""
        }`;
    }

    if(advantage.key === "regeneration"){
        const cooldownUntil = Number(state.regenerationCooldownUntil) || 0;
        if(cooldownUntil > now){
            return `🟡 **COOLDOWN** until <t:${Math.floor(cooldownUntil / 1000)}:R>`;
        }
        return "⚫ **INACTIVE — ready after damage**";
    }

    return "⚫ **INACTIVE**";
}


function formatAdvantageStatuses(boss, definition, now = Date.now()){
    return definition.advantages
        .map(advantage =>
            `• **${advantage.name}**${
                advantage.mastered ? " *(mastered)*" : ""
            } — ${getAdvantageRuntimeStatus(boss, advantage, now)}`
        )
        .join("\n") || "None";
}


function buildBossEmbed(guild, boss, options = {}){
    const definition = bosses.getBossDefinition(boss);
    if(!definition) return buildNoBossEmbed();

    const expiresTimestamp = Math.floor(boss.expiresAt / 1000);
    const rewards = bosses.getRaidRewardPreview(definition);

    const embed = new EmbedBuilder()
        .setColor(
            options.expired
                ? 0x747F8D
                : getHealthColor(boss.currentHP, boss.maxHP)
        )
        .setTitle(
            options.expired
                ? "⏱️ RAID BOSS DESPAWNED"
                : options.defeated
                ? "🏆 RAID BOSS DEFEATED"
                : options.spawned
                    ? "⚠️ A RAID BOSS HAS ARRIVED"
                    : "⚔️ RAID BOSS — LIVE STATUS"
        )
        .setDescription(
            `## ${definition.name} {CANON}\n`
            + `*${definition.act}*\n\n`
            + `${buildHealthBar(guild, boss.currentHP, boss.maxHP)}\n`
            + `**${formatNumber(boss.currentHP)} / ${formatNumber(boss.maxHP)} HP**`
        )
        .addFields(
            {
                name: "OVERALL",
                value: `**${formatNumber(boss.overall)}**`,
                inline: true
            },
            {
                name: "Spawn chance",
                value: `**${definition.chancePercent}%**`,
                inline: true
            },
            {name: "Info", value: `*${definition.info}*`},
            {
                name: "Advantages — live status",
                value: formatAdvantageStatuses(
                    boss,
                    definition,
                    options.now
                )
            },
            {name: "🏆 Top 3 damage", value: rewards.top},
            {
                name: "🎁 Every other contributor",
                value: rewards.rest
            },
            {
                name:
                    `${resolveGuildEmoji(guild, "boss_chest", ":boss_chest:")} Raid extras`,
                value:
                    "The rewards above already include **exactly 1 Boss Chest** and this boss's shard reward per eligible damage contributor."
            },
            {
                name: "Timer",
                value: options.expired
                    ? "**The one-hour timer ended before the boss was defeated.**"
                    : options.defeated
                        ? "**Defeated by the server.**"
                    : `Despawns <t:${expiresTimestamp}:R> • <t:${expiresTimestamp}:T>`
            }
        );

    const avatarURL = resolveBossAvatarURL(guild, definition);
    if(avatarURL){
        embed
            .setAuthor({name: definition.name, iconURL: avatarURL})
            .setThumbnail(avatarURL);
    }


    embed.setFooter({
        text:
            RAID_STATUS_PANEL_FOOTER
    });

    return embed;
}


function buildNoBossEmbed(options = {}){
    const challengeHint =
        options.showChallengeHint === false
            ? ""
            : " Personal Challenges are still available below.";

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("⚔️ RAID BOSS")
        .setDescription(
            "There is **no active global raid boss** right now.\n\n"
            + "The **6 raid bosses** have a combined **1.25% chance per eligible chat-XP reward**, after the **4-hour natural-spawn cooldown** and activity from **2 users within 10 minutes**. Challenge Bosses never spawn here."
            + challengeHint
        )
        .addFields({
            name: "Raid duration",
            value: "Every spawned raid boss remains for **1 hour** unless the server defeats it first."
        })
        .setFooter({
            text:
                RAID_STATUS_PANEL_FOOTER
        });

    return embed;
}


function buildMainButtons(){
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(INFO_BUTTON_ID)
            .setLabel("Info")
            .setEmoji("ℹ️")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(CHALLENGES_BUTTON_ID)
            .setLabel("Challenges")
            .setEmoji("🗝️")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(BOSS_SHOP_BUTTON_ID)
            .setLabel("Boss Shop")
            .setEmoji("💠")
            .setStyle(ButtonStyle.Success)
    );
}


function buildBossPayload(guild, boss, options = {}){
    return {
        embeds: [
            boss
                ? buildBossEmbed(guild, boss, options)
                : buildNoBossEmbed()
        ],
        components: [buildMainButtons()],
        allowedMentions: {parse: [], repliedUser: false}
    };
}


function buildRaidStatusPayload(guild, boss, options = {}){
    return {
        embeds: [
            boss
                ? buildBossEmbed(guild, boss, options)
                : buildNoBossEmbed({
                    showChallengeHint: false
                })
        ],
        components: [],
        allowedMentions: {parse: []}
    };
}


async function buildBossShopPayload(
    guildID,
    userID,
    notice = null,
    guild = null
){

    const [shop, shards] =
        await Promise.all([
            bossShop.getActiveBossShop(guildID),
            database.getBossShards(guildID, userID)
        ]);


    if(!shop){
        return {
            content: notice,
            embeds: [
                new EmbedBuilder()
                    .setColor(0x747F8D)
                    .setTitle("💠 BOSS SHOP — CLOSED")
                    .setDescription(
                        `Your balance: **${formatNumber(shards)} shards**\n\n` +
                        "The Boss Shop has a **35% chance** to appear after the server defeats a global raid boss. It remains open for **20 minutes**."
                    )
                    .setFooter({
                        text: "Three random products appear whenever the shop opens."
                    })
            ],
            components: [],
            allowedMentions: {parse: []}
        };
    }


    const embed =
        new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("💠 BOSS SHOP")
            .setDescription(
                `Your balance: **${formatNumber(shards)} shards**\n` +
                `Shop closes <t:${Math.floor(shop.expiresAt / 1000)}:R> • stock refreshes <t:${Math.floor(shop.refreshAt / 1000)}:R>`
            );


    const buttons =
        new ActionRowBuilder();


    for(
        let index = 0;
        index < shop.stock.length;
        index++
    ){
        const item = shop.stock[index];

        embed.addFields({
            name:
                `${index + 1}. ${item.name} — ${formatNumber(item.price)} shards`,
            value:
                `${renderChestEmojis(guild, item.description)}\nStock: **${Math.max(0, Number(item.stock) || 0)}/${Math.max(0, Number(item.maxStock) || 0)}**`
        });

        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `${BOSS_SHOP_BUY_PREFIX}${item.slotID}`
                )
                .setLabel(`Buy #${index + 1}`)
                .setEmoji("💠")
                .setStyle(ButtonStyle.Success)
                .setDisabled(Number(item.stock) <= 0)
        );
    }


    embed.setFooter({
        text: "Only three of the five products appear • More items coming soon"
    });


    return {
        content: notice,
        embeds: [embed],
        components:
            shop.stock.length > 0
                ? [buttons]
                : [],
        allowedMentions: {parse: []}
    };

}


async function getRaidStatusChannel(client){

    const cached =
        client?.channels?.cache?.get?.(
            RAID_STATUS_CHANNEL_ID
        );


    const channel =
        cached
        || await client?.channels?.fetch?.(
            RAID_STATUS_CHANNEL_ID
        ).catch(error => {

            console.error(
                `Could not fetch raid status channel ${RAID_STATUS_CHANNEL_ID}:`,
                error
            );


            return null;

        });


    return (
        channel?.isTextBased?.()
        && typeof channel.send === "function"
    )
        ? channel
        : null;

}


function isRaidStatusPanelMessage(
    message,
    clientUserID
){

    if(
        !message
        || (
            clientUserID
            && message.author?.id !== clientUserID
        )
    ){
        return false;
    }


    const embeds =
        Array.from(
            message.embeds || []
        );


    // The dedicated panel is sent directly to the channel. Normal !boss
    // command replies have a message reference and must never be reused as
    // the persistent panel, even though they render the same footer.
    if(message.reference){
        return false;
    }


    if(
        embeds.some(embed =>
            embed?.footer?.text ===
                RAID_STATUS_PANEL_FOOTER
        )
    ){
        return true;
    }


    // Reuse panels created by the earlier implementation before the footer
    // marker existed.
    return embeds.some(embed =>
        [
            "⚔️ RAID BOSS",
            "⚔️ RAID BOSS — LIVE STATUS",
            "⚠️ A RAID BOSS HAS ARRIVED",
            "🏆 RAID BOSS DEFEATED",
            "⏱️ RAID BOSS DESPAWNED"
        ].includes(
            embed?.title
        )
    );

}


async function findRaidStatusMessage(
    client,
    statusChannel,
    preferredMessageIDs = []
){

    const uniqueMessageIDs =
        Array.from(
            new Set(
                preferredMessageIDs
                    .map(value =>
                        String(value || "").trim()
                    )
                    .filter(Boolean)
            )
        );


    for(const messageID of uniqueMessageIDs){

        const message =
            await statusChannel.messages.fetch(
                messageID
            ).catch(() => null);


        if(message){
            return message;
        }

    }


    const recentMessages =
        await statusChannel.messages.fetch({
            limit: 50
        }).catch(() => null);


    const messages =
        recentMessages?.values
            ? Array.from(
                recentMessages.values()
            )
            : [];


    return messages.find(message =>
        isRaidStatusPanelMessage(
            message,
            client?.user?.id
        )
    ) || null;

}


async function ensureRaidStatusMessage(
    client,
    guildID,
    options = {}
){

    const normalizedGuildID =
        String(guildID || "").trim();


    if(!normalizedGuildID){
        throw new Error(
            "A guild ID is required to initialize the raid status panel."
        );
    }


    const statusChannel =
        await getRaidStatusChannel(
            client
        );


    if(!statusChannel){
        throw new Error(
            `The bot cannot access raid status channel ${RAID_STATUS_CHANNEL_ID}. ` +
            "Give it View Channel, Send Messages, Embed Links, and Read Message History permissions."
        );
    }


    if(
        statusChannel.guildId
        && String(statusChannel.guildId) !==
            normalizedGuildID
    ){
        throw new Error(
            `Raid status channel ${RAID_STATUS_CHANNEL_ID} is not inside guild ${normalizedGuildID}.`
        );
    }


    const guild =
        options.guild
        || statusChannel.guild
        || client?.guilds?.cache?.get?.(
            normalizedGuildID
        )
        || await client?.guilds?.fetch?.(
            normalizedGuildID
        ).catch(() => null);


    if(!guild){
        throw new Error(
            `Could not load guild ${normalizedGuildID} for the raid status panel.`
        );
    }


    const bossWasProvided =
        Object.prototype.hasOwnProperty.call(
            options,
            "boss"
        );


    const boss =
        bossWasProvided
            ? options.boss
            : await bosses.getCurrentBoss(
                normalizedGuildID
            );


    const stateData =
        boss?.stateData
        && typeof boss.stateData === "object"
            ? boss.stateData
            : {};


    if(boss){
        boss.stateData = stateData;
    }


    let statusMessage =
        await findRaidStatusMessage(
            client,
            statusChannel,
            [
                options.statusMessageID,
                stateData.raidStatusMessageID,
                raidStatusMessageIDs.get(
                    normalizedGuildID
                )
            ]
        );


    const payload =
        buildRaidStatusPayload(
            guild,
            boss,
            {
                spawned:
                    Boolean(options.spawned),
                defeated:
                    Boolean(options.defeated),
                expired:
                    Boolean(options.expired)
            }
        );


    if(statusMessage){

        try{
            await statusMessage.edit(
                payload
            );
        }
        catch(error){

            console.error(
                "Could not edit the existing raid status panel; creating a replacement:",
                error
            );


            statusMessage =
                await statusChannel.send(
                    payload
                );

        }

    }
    else{
        statusMessage =
            await statusChannel.send(
                payload
            );
    }


    raidStatusMessageIDs.set(
        normalizedGuildID,
        statusMessage.id
    );


    if(
        boss
        && !options.defeated
        && !options.expired
    ){

        stateData.raidStatusChannelID =
            statusChannel.id;

        stateData.raidStatusMessageID =
            statusMessage.id;


        await database.updateRaidBossState(
            boss
        );

    }


    return statusMessage;

}


async function syncRaidStatusMessage(
    message,
    result
){

    if(
        !result?.boss
        || result.challenge
    ){
        return null;
    }


    return ensureRaidStatusMessage(
        message.client,
        message.guild.id,
        {
            guild:
                message.guild,
            boss:
                result.boss,
            spawned:
                result.spawned,
            defeated:
                result.defeated
        }
    );

}


async function handleExpiredBosses(
    client,
    cleanupResult
){

    for(const boss of cleanupResult?.expiredBosses || []){

        await ensureRaidStatusMessage(
            client,
            boss.guildID,
            {
                boss,
                expired: true,
                statusMessageID:
                    boss.stateData
                        ?.raidStatusMessageID
            }
        ).catch(error => {
            console.error(
                "Could not mark the fixed raid panel as despawned:",
                error
            );
        });

    }

}


function buildInfoEmbeds(){
    const overview = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("ℹ️ Raid Boss — How It Works")
        .setDescription(
            "Raid bosses are **global for the whole server**. Challenges are separate, private solo dungeons. Every listed character is a **canon boss** from the command dialogues."
        )
        .addFields(
            {
                name: "Global spawning",
                value: "Only the **6 RAID BOSSES** can spawn globally; the **21 Challenge Bosses** never enter this pool. After the **4-hour natural-spawn cooldown**, at least **2 users** must earn chat XP within 10 minutes. Each eligible chat reward then rolls the listed spawn chances (1.25% combined). One raid at a time; raids last 1 hour."
            },
            {
                name: "OVERALL",
                value: "OVERALL is the boss's combat power. It strengthens calculations such as Regeneration and Precision, and some abilities temporarily multiply it."
            },
            {
                name: "HP",
                value: "HP is the health that must be removed before the timer ends. Power and Durability can temporarily increase maximum HP while preserving the boss's current health percentage."
            },
            {
                name: "Dealing damage",
                value: "Earned chat XP and positive XP earned from **!roll, !kiss, !steal, !ezwin, !troll, and !fight** deal damage. XP Boosts count. Boss defenses stack multiplicatively."
            },
            {
                name: "Global rewards",
                value: "The **top 3 damage dealers** receive the premium reward set. Every other user who dealt damage receives the contributor set. Every eligible contributor also receives **1 Boss Chest** and boss shards. Rewards are paid once when the boss is defeated."
            },
            {
                name: "Boss Shop",
                value: "After a global raid victory, the Boss Shop has a **35% chance** to open for **20 minutes**. It displays 3 random products, refreshes stock every **10 minutes**, and uses boss shards earned from raids and challenges."
            },
            {
                name: "Challenges",
                value: "A challenge is a solo sequence. Beat each enemy in order inside a private channel within **5 minutes per enemy**. Challenge #2 requires #1; Challenge #3 requires #2. Replays give smaller repeat rewards."
            },
            {
                name: "Challenge #3",
                value: "The first clear permanently unlocks **!fight** and grants **1 free upgrade**, automatically used on the next successful !upgrades purchase."
            }
        );

    const defenses = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("🛡️ Advantages — Defenses")
        .addFields(
            {name: "Chatting Immunity", value: "Reduces chat-XP damage by **25%**. **Mastered:** **35%**."},
            {name: "Critical Immunity", value: "Reduces critical chat damage by **35%**. **Mastered:** **45%**."},
            {name: "Chatting Immortality", value: "All chat XP deals **0 damage**. **Mastered:** heals 10% of incoming chat damage instead. Use commands against this boss."},
            {name: "Critical Immortality", value: "Critical chat hits deal **0 damage**. **Mastered:** heal 10% instead. If Chatting Immortality also applies, healing happens only once."},
            {name: "Commands Immunity", value: "Reduces supported command damage by **50%**. **Mastered:** **60%**."},
            {name: "Commands Immortality", value: "Commands deal **0 damage**. **Mastered:** they instead heal **10%** of incoming command damage. Use chat against this boss."},
            {name: "Rolling Immunity", value: "Reduces **!roll** damage by **30%**. **Mastered:** **40%**."},
            {name: "Degeneration", value: "Removes only **25% of luck-derived bonus damage**, or **35% mastered**. Base damage and XP Boosts remain intact; it no longer cancels critical hits."}
        );

    const abilities = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔥 Advantages — Abilities")
        .addFields(
            {name: "Regeneration", value: "After damage: **1,000 + 0.02% OVERALL/sec** for **15s**, capped at **0.5% base HP per activation**. **Mastered:** 1,500 + 0.03%/sec for **20s**, capped at **1% base HP**. Both have a **10-minute cooldown**."},
            {name: "Power", value: "At **70% / 30% HP** for 3 minutes: +30% OVERALL and +20% maximum HP/healing. Mastered: +35% / +25%."},
            {name: "Durability", value: "At **90% / 50% / 20% HP** for 3 minutes: ×1.5 maximum HP and 50% damage reduction. Mastered: ×1.6 and 60%."},
            {name: "XP Immortality", value: "At **10% HP**, incoming XP heals the boss for 30 seconds. Mastered: 35 seconds and stronger healing."},
            {name: "Fury", value: "At **5% HP**, sharply reduces damage, raises OVERALL, and regenerates for 30 seconds. Mastered improves every value."},
            {name: "Precision", value: "Can dodge a full hit. Chance is **15% + OVERALL ÷ 1,000,000**, capped at 75%; successful dodge has a 30-second cooldown. Mastered starts at 20%."}
        );

    return [overview, defenses, abilities];
}


function getChallengeStatus(challenge, snapshot){
    const progress = snapshot.progress[challenge.key] || {
        stageIndex: 0,
        completions: 0,
        active: false
    };
    const prerequisiteComplete = !challenge.prerequisite
        || Number(
            snapshot.progress[challenge.prerequisite]?.completions
        ) > 0;
    const levelReady = snapshot.level >= challenge.requiredLevel;
    const otherActive = Object.entries(snapshot.progress).some(
        ([key, value]) => key !== challenge.key && value.active
    );

    return {
        progress,
        prerequisiteComplete,
        levelReady,
        locked: !prerequisiteComplete || !levelReady || otherActive,
        otherActive
    };
}


function buildChallengeListPayload(
    snapshot,
    notice = null,
    guild = null
){
    const embed = new EmbedBuilder()
        .setColor(0x7C4DFF)
        .setTitle("🗝️ BOSS CHALLENGES")
        .setDescription(
            `Your level: **${snapshot.level.toLocaleString()}**\n`
            + "Fight every enemy in order. Each private battle lasts **5 minutes**. First clears give the full reward; repeats give a smaller farming reward."
        );

    for(const challenge of bossChallenges.BOSS_CHALLENGES){
        const status = getChallengeStatus(challenge, snapshot);
        const progress = status.progress;
        let statusText = "🔓 Ready";
        if(!status.levelReady){
            statusText = `🔒 Requires level ${challenge.requiredLevel}+`;
        }
        else if(!status.prerequisiteComplete){
            statusText = `🔒 Complete Challenge #${challenge.number - 1}`;
        }
        else if(progress.active){
            statusText = `⚔️ Active — enemy ${progress.stageIndex + 1}/${challenge.stages.length}`;
        }
        else if(progress.completions > 0){
            statusText = `✅ Completed ${progress.completions}x — replay available`;
        }
        else if(status.otherActive){
            statusText = "🔒 Finish your active challenge first";
        }

        embed.addFields({
            name: `Challenge #${challenge.number} — ${challenge.name}`,
            value: `**Requirement:** Level ${challenge.requiredLevel}+\n`
                + `**Boss:** ${challenge.bossName} {CANON}\n`
                + `**Status:** ${statusText}\n`
                + `**First clear:** ${renderChestEmojis(
                    guild,
                    bossChallenges.formatRewardBundle(
                        challenge.firstReward
                    )
                )}`
        });
    }

    embed.setFooter({
        text: snapshot.fightUnlocked
            ? "!fight unlocked • More challenges are coming"
            : "Complete Challenge #3 to unlock !fight • More challenges are coming"
    });

    const challengeButtons = new ActionRowBuilder();
    for(const challenge of bossChallenges.BOSS_CHALLENGES){
        const status = getChallengeStatus(challenge, snapshot);
        const progress = status.progress;
        challengeButtons.addComponents(
            new ButtonBuilder()
                .setCustomId(`raid_challenge_start:${challenge.number}`)
                .setLabel(
                    progress.active
                        ? `Continue #${challenge.number}`
                        : progress.completions > 0
                            ? `Replay #${challenge.number}`
                            : `Start #${challenge.number}`
                )
                .setStyle(
                    progress.active
                        ? ButtonStyle.Success
                        : ButtonStyle.Primary
                )
                .setDisabled(
                    status.locked
                    || Boolean(snapshot.battle && !progress.active)
                )
        );
    }

    return {
        content: notice || null,
        embeds: [embed],
        components: [challengeButtons],
        allowedMentions: {parse: []}
    };
}


function buildChallengeDetailPayload(guild, challenge, snapshot, notice = null){
    const progress = snapshot.progress[challenge.key];
    if(!progress?.active){
        return buildChallengeListPayload(
            snapshot,
            notice,
            guild
        );
    }

    const stageIndex = Math.min(
        challenge.stages.length - 1,
        Math.max(0, progress.stageIndex)
    );
    const definition = bosses.getBossDefinition(
        challenge.stages[stageIndex]
    );
    const path = challenge.stages
        .map((bossKey, index) => {
            const stageBoss = bosses.getBossDefinition(bossKey);
            if(index < stageIndex) return `✅ ~~${stageBoss.name}~~`;
            if(index === stageIndex) return `⚔️ **${stageBoss.name}**`;
            return `🔒 ${stageBoss.name}`;
        })
        .join(" → ");
    const battle = snapshot.battle?.challengeKey === challenge.key
        ? snapshot.battle
        : null;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Challenge #${challenge.number} — ${challenge.name}`)
        .setDescription(
            `${path}\n\n## ${definition.name} {CANON}\n*${definition.act}*`
        )
        .addFields(
            {name: "OVERALL", value: `**${formatNumber(definition.overall)}**`, inline: true},
            {name: "HP", value: `**${formatNumber(definition.hp)}**`, inline: true},
            {name: "Info", value: `*${definition.info}*`},
            {name: "Advantages", value: formatAdvantages(definition)},
            {
                name: "First-clear reward",
                value: renderChestEmojis(
                    guild,
                    bossChallenges.formatRewardBundle(
                        challenge.firstReward
                    )
                )
            },
            {
                name: "Replay reward",
                value: renderChestEmojis(
                    guild,
                    bossChallenges.formatRewardBundle(
                        challenge.repeatReward
                    )
                )
            },
            {
                name: "Current battle",
                value: battle
                    ? `<#${battle.channelID}> • ends <t:${Math.floor(battle.expiresAt / 1000)}:R>`
                    : "No enemy room is open. Press Fight to create your private five-minute battle."
            }
        );

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`raid_challenge_fight:${challenge.number}`)
            .setLabel(
                battle
                    ? "Battle in progress"
                    : `Fight ${definition.name}`
            )
            .setEmoji("⚔️")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(Boolean(battle)),
        new ButtonBuilder()
            .setCustomId(CHALLENGE_LIST_BUTTON_ID)
            .setLabel("All Challenges")
            .setEmoji("↩️")
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        content: notice || null,
        embeds: [embed],
        components: [buttons],
        allowedMentions: {parse: []}
    };
}


function buildChallengeCombatEmbed(guild, boss, battle, options = {}){
    const definition = bosses.getBossDefinition(boss);
    const challenge = bossChallenges.getBossChallenge(battle.challengeKey);
    const expiresAt = Math.floor(battle.expiresAt / 1000);

    const embed = new EmbedBuilder()
        .setColor(
            options.defeated
                ? 0xF1C40F
                : getHealthColor(boss.currentHP, boss.maxHP)
        )
        .setTitle(
            options.defeated
                ? `🏆 ${definition.name} DEFEATED`
                : `⚔️ ${definition.name} {CANON}`
        )
        .setDescription(
            `### Challenge #${challenge.number} — ${challenge.name}\n`
            + `*${definition.act}*\n\n`
            + `${buildHealthBar(guild, boss.currentHP, boss.maxHP)}\n`
            + `**${formatNumber(boss.currentHP)} / ${formatNumber(boss.maxHP)} HP**`
        )
        .addFields(
            {name: "OVERALL", value: `**${formatNumber(boss.overall)}**`, inline: true},
            {name: "Enemy", value: `**${battle.stageIndex + 1}/${challenge.stages.length}**`, inline: true},
            {name: "Advantages — live status", value: formatAdvantageStatuses(boss, definition)},
            {
                name: "Timer",
                value: options.defeated
                    ? "Enemy defeated."
                    : `Despawn <t:${expiresAt}:R> • <t:${expiresAt}:T>`
            }
        );

    const avatarURL = resolveBossAvatarURL(guild, definition);
    if(avatarURL){
        embed
            .setAuthor({name: definition.name, iconURL: avatarURL})
            .setThumbnail(avatarURL);
    }

    return embed;
}


async function createChallengeBattle(interaction, challenge){
    const snapshot = await database.getBossChallengeSnapshot(
        interaction.guildId,
        interaction.user.id
    );
    const progress = snapshot.progress[challenge.key];
    if(!progress?.active){
        return {success: false, status: "not-active"};
    }
    if(snapshot.battle){
        return {
            success: false,
            status: "battle-active",
            battle: snapshot.battle
        };
    }

    const stageIndex = Math.min(
        challenge.stages.length - 1,
        Math.max(0, progress.stageIndex)
    );
    const definition = bosses.getBossDefinition(
        challenge.stages[stageIndex]
    );
    const startedAt = Date.now();
    const expiresAt = startedAt
        + bossChallenges.CHALLENGE_BATTLE_DURATION_MS;
    const bossScope = `challenge:${interaction.guildId}:${interaction.user.id}`;
    const botID = interaction.client.user.id;
    const channel = await interaction.guild.channels.create({
        name: `boss-${challenge.number}`,
        type: ChannelType.GuildText,
        topic: `Private Boss Challenge #${challenge.number} for ${interaction.user.tag || interaction.user.username}`,
        permissionOverwrites: [
            {
                id: interaction.guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: interaction.user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles
                ]
            },
            {
                id: botID,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.EmbedLinks
                ]
            }
        ],
        reason: `Boss Challenge #${challenge.number} for ${interaction.user.id}`
    });

    let battle = null;
    try{
        const creation = await database.createBossChallengeBattle({
            guildID: interaction.guildId,
            userID: interaction.user.id,
            challengeKey: challenge.key,
            stageIndex,
            bossScope,
            channelID: channel.id,
            spawnedAt: startedAt,
            expiresAt
        });
        if(!creation.success){
            await channel.delete(
                "Boss challenge state changed before battle creation"
            ).catch(() => null);
            return creation;
        }

        battle = creation.battle;
        const boss = await bosses.createChallengeBossState(
            battle,
            definition.key,
            startedAt
        );
        if(!boss){
            throw new Error("Could not create the private boss state.");
        }

        const combatMessage = await channel.send({
            content: `<@${interaction.user.id}>, your five-minute fight has begun. Only XP earned in this channel damages this enemy.`,
            embeds: [buildChallengeCombatEmbed(
                interaction.guild,
                boss,
                battle
            )],
            allowedMentions: {users: [interaction.user.id]}
        });
        await database.setBossChallengeBattleMessage(
            interaction.guildId,
            interaction.user.id,
            combatMessage.id
        );

        return {
            success: true,
            status: "created",
            battle: {...battle, messageID: combatMessage.id},
            boss,
            channel
        };
    }
    catch(error){
        await database.deleteBossChallengeBattle(
            interaction.guildId,
            interaction.user.id
        ).catch(() => null);
        await database.deleteRaidBossState(
            bossScope,
            battle?.spawnedAt
        ).catch(() => null);
        await channel.delete("Boss challenge creation failed")
            .catch(() => null);
        throw error;
    }
}


async function execute(message){
    if(!message.guild) return;
    const boss = await bosses.getCurrentBoss(message.guild.id);

    await ensureRaidStatusMessage(
        message.client,
        message.guild.id,
        {
            guild:
                message.guild,
            boss,
            spawned: false,
            defeated: false
        }
    ).catch(error => {
        console.error(
            "Could not refresh the fixed raid status message from !boss:",
            error
        );
    });

    return message.reply(buildBossPayload(message.guild, boss));
}


async function resetChallenges(message){
    const OWNER_ID = "1239975819112353969";

    if(!message.guild){
        return message.reply("❌ This command can only be used in a server.");
    }

    // Hard-coded account allowlist: server permissions cannot override this.
    if(String(message.author?.id) !== OWNER_ID){
        return message.reply({
            content: "⛔ You are not authorized to use this command.",
            allowedMentions: {parse: [], repliedUser: false}
        });
    }

    try{
        const result = await database.resetBossChallengesForGuild(message.guild.id);
        let deletedChannels = 0;
        let failedChannels = 0;

        for(const battle of result.battles){
            if(battle.bossScope){
                await database.deleteRaidBossState(
                    battle.bossScope,
                    battle.spawnedAt
                ).catch(error => {
                    console.error("Could not remove reset challenge boss state:", error);
                });
            }

            if(!battle.channelID) continue;

            const channel = await message.client.channels.fetch(battle.channelID)
                .catch(() => null);
            if(!channel) continue;

            try{
                await channel.delete("Boss challenges reset by the bot owner");
                deletedChannels++;
            }
            catch(error){
                failedChannels++;
                console.error(`Could not delete reset challenge channel ${battle.channelID}:`, error);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x7C4DFF)
            .setTitle("🗝️ BOSS CHALLENGES RESET")
            .setDescription(
                `All personal boss-challenge progress has been reset for this server.\n\n` +
                `**Progress entries cleared:** ${formatNumber(result.progressRows)}\n` +
                `**Active battles removed:** ${formatNumber(result.battles.length)}\n` +
                `**Private battle channels deleted:** ${formatNumber(deletedChannels)}` +
                (failedChannels ? `\n**Channels that could not be deleted:** ${formatNumber(failedChannels)}` : "") +
                `\n\nChallenge completions and Challenge #3's !fight unlock are reset. Other boss rewards and entitlements are preserved.`
            )
            .setFooter({text: `Executed by ${message.author.tag || message.author.id}`});

        return message.reply({
            embeds: [embed],
            allowedMentions: {parse: [], repliedUser: false}
        });
    }
    catch(error){
        console.error("!resetchallenges failed:", error);
        return message.reply({
            content: "❌ The boss challenges could not be reset. Check the bot logs for details.",
            allowedMentions: {parse: [], repliedUser: false}
        }).catch(() => {});
    }
}


async function handleInteraction(interaction){
    if(!interaction.isButton?.()) return false;

    if(interaction.customId === INFO_BUTTON_ID){
        await interaction.reply({
            embeds: buildInfoEmbeds(),
            flags: 64,
            allowedMentions: {parse: []}
        });
        return true;
    }

    if(interaction.customId === BOSS_SHOP_BUTTON_ID){
        await interaction.reply({
            ...await buildBossShopPayload(
                interaction.guildId,
                interaction.user.id,
                null,
                interaction.guild
            ),
            flags: 64
        });
        return true;
    }

    if(
        interaction.customId.startsWith(
            BOSS_SHOP_BUY_PREFIX
        )
    ){
        const slotID =
            interaction.customId.slice(
                BOSS_SHOP_BUY_PREFIX.length
            );

        const purchase =
            await bossShop.purchaseBossShopItem(
                interaction.guildId,
                interaction.user.id,
                slotID
            );

        const notice =
            purchase.success
                ? `✅ Purchased ${renderChestEmojis(
                    interaction.guild,
                    purchase.item.description
                )} for **${formatNumber(purchase.item.price)} shards**.`
                : {
                    "shop-closed":
                        "⏱️ The Boss Shop closed before that purchase could finish.",
                    "sold-out":
                        "❌ That product is sold out or the stock has refreshed.",
                    "not-enough-shards":
                        `❌ You need **${formatNumber(purchase.missing)} more shards** for that product.`
                }[purchase.status]
                || "❌ That Boss Shop purchase could not be completed.";

        await interaction.update(
            await buildBossShopPayload(
                interaction.guildId,
                interaction.user.id,
                notice,
                interaction.guild
            )
        );
        return true;
    }

    if(
        interaction.customId === CHALLENGES_BUTTON_ID
        || interaction.customId === CHALLENGE_LIST_BUTTON_ID
    ){
        const snapshot = await database.getBossChallengeSnapshot(
            interaction.guildId,
            interaction.user.id
        );
        const payload = buildChallengeListPayload(
            snapshot,
            null,
            interaction.guild
        );
        if(interaction.customId === CHALLENGES_BUTTON_ID){
            await interaction.reply({...payload, flags: 64});
        }
        else{
            await interaction.update(payload);
        }
        return true;
    }

    const startMatch = interaction.customId.match(
        /^raid_challenge_start:(\d+)$/
    );
    if(startMatch){
        const challenge = bossChallenges.getBossChallenge(
            Number(startMatch[1])
        );
        if(!challenge){
            await interaction.reply({
                content: "❌ That challenge no longer exists.",
                flags: 64
            });
            return true;
        }

        const result = await database.startBossChallenge({
            guildID: interaction.guildId,
            userID: interaction.user.id,
            challengeKey: challenge.key,
            requiredLevel: challenge.requiredLevel,
            prerequisite: challenge.prerequisite
        });
        const snapshot = await database.getBossChallengeSnapshot(
            interaction.guildId,
            interaction.user.id
        );
        let notice = null;
        if(!result.success){
            notice = {
                "level-locked": `🔒 You need level **${challenge.requiredLevel}+** for this challenge.`,
                "prerequisite-locked": "🔒 Complete the previous challenge first.",
                "battle-active": "⚔️ Finish your current private battle first.",
                "other-challenge-active": "⚔️ Finish your active challenge before starting another one."
            }[result.status] || "❌ This challenge could not be started.";
        }
        const activeChallenge = bossChallenges.getBossChallenge(
            result.challengeKey || challenge.key
        ) || challenge;
        await interaction.update(
            result.success
                ? buildChallengeDetailPayload(
                    interaction.guild,
                    activeChallenge,
                    snapshot,
                    result.status === "started"
                        ? `🗝️ **Challenge #${activeChallenge.number} started.**`
                        : null
                )
                : buildChallengeListPayload(
                    snapshot,
                    notice,
                    interaction.guild
                )
        );
        return true;
    }

    const fightMatch = interaction.customId.match(
        /^raid_challenge_fight:(\d+)$/
    );
    if(fightMatch){
        const challenge = bossChallenges.getBossChallenge(
            Number(fightMatch[1])
        );
        if(!challenge){
            await interaction.reply({
                content: "❌ That challenge no longer exists.",
                flags: 64
            });
            return true;
        }

        await interaction.deferUpdate();
        try{
            const creation = await createChallengeBattle(
                interaction,
                challenge
            );
            const snapshot = await database.getBossChallengeSnapshot(
                interaction.guildId,
                interaction.user.id
            );
            await interaction.editReply(
                buildChallengeDetailPayload(
                    interaction.guild,
                    challenge,
                    snapshot,
                    creation.success
                        ? `⚔️ Your battle is ready in <#${creation.channel.id}>.`
                        : creation.battle
                            ? `⚔️ Your battle is already in <#${creation.battle.channelID}>.`
                            : "❌ The battle could not be created. Refresh the challenge list and try again."
                )
            );
            if(creation.success){
                await interaction.followUp({
                    content: `⚔️ Enter <#${creation.channel.id}> and defeat **${bosses.getBossDefinition(creation.boss).name}** within five minutes.`,
                    flags: 64,
                    allowedMentions: {parse: []}
                });
            }
        }
        catch(error){
            console.error("Could not create Boss Challenge battle:", error);
            await interaction.followUp({
                content: "❌ I could not create the private boss channel. Check my **Manage Channels** permission and try again.",
                flags: 64
            }).catch(() => null);
        }
        return true;
    }

    return false;
}


function getAbilityNarrative(definition, event, userID){
    const bossName = definition.name;
    const mention = `<@${userID}>`;
    if(event.type === "precision"){
        return `*${bossName} studies ${mention}'s attack and slips past it with impossible precision.*`;
    }
    if(event.type !== "ability") return null;
    return {
        regeneration: `*${bossName}, slightly bloodied, steadies their breathing as the wounds begin closing in front of ${mention}.*`,
        power: `*${bossName} keeps watching ${mention}, then screams as a violent surge of power raises their OVERALL and HP!*`,
        durability: `*${bossName}'s body hardens under the pressure. Their durability expands their health and smothers the incoming damage!*`,
        xp_immortality: `*${bossName} refuses to fall. A strange aura turns incoming XP into healing!*`,
        fury: `*${bossName}, heavily injured, erupts in fury and unleashes everything left!*`
    }[event.ability] || null;
}


async function announceAbilityEvents(message, result){
    for(const event of result.events || []){
        const narrative = getAbilityNarrative(
            result.definition,
            event,
            message.author.id
        );
        if(narrative){
            await message.channel.send({
                content: narrative,
                allowedMentions: {users: [message.author.id]}
            }).catch(() => null);
        }
    }
}


function scheduleBattleChannelDeletion(channel, reason){
    require("../utils/channelWork").deleteWhenIdle(channel, reason);
}


async function updateChallengeCombatMessage(message, result, defeated = false){
    const battle = result.challengeBattle;
    if(!battle?.messageID) return;
    const combatMessage = await message.channel.messages.fetch(
        battle.messageID
    ).catch(() => null);
    if(combatMessage){
        await combatMessage.edit({
            embeds: [buildChallengeCombatEmbed(
                message.guild,
                result.boss,
                battle,
                {defeated}
            )],
            allowedMentions: {parse: []}
        }).catch(() => null);
    }
}


async function handleChallengeCombatResult(message, result){
    if(result.expired){
        await message.channel.send(
            "⏱️ This challenge battle already expired. Return to `!boss` and try the stage again."
        ).catch(() => null);
        scheduleBattleChannelDeletion(
            message.channel,
            "Boss Challenge battle expired"
        );
        return;
    }

    await announceAbilityEvents(message, result);
    await updateChallengeCombatMessage(message, result, result.defeated);
    if(!result.defeated) return;

    const battle = result.challengeBattle;
    const challenge = bossChallenges.getBossChallenge(
        battle.challengeKey
    );
    const completion = await database.completeBossChallengeEnemy({
        guildID: message.guild.id,
        userID: message.author.id,
        challengeKey: challenge.key,
        stageIndex: battle.stageIndex,
        stageCount: challenge.stages.length,
        firstReward: challenge.firstReward,
        repeatReward: challenge.repeatReward
    });

    if(!completion.success){
        await message.channel.send(
            "⚠️ The enemy was defeated, but the challenge state had already changed. No duplicate reward was issued."
        ).catch(() => null);
        scheduleBattleChannelDeletion(
            message.channel,
            "Stale Boss Challenge battle"
        );
        return;
    }

    if(!completion.completed){
        const nextDefinition = bosses.getBossDefinition(
            challenge.stages[completion.nextStageIndex]
        );
        await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle("✅ ENEMY DEFEATED")
                    .setDescription(
                        `You defeated **${result.definition.name}**.\n\n`
                        + `Next enemy: **${nextDefinition.name} {CANON}**\n`
                        + "Return to `!boss` → **Challenges** to begin the next fight."
                    )
            ]
        }).catch(() => null);
    }
    else{
        await leveling.syncLevelAndAnnounce(
            message.client,
            message.guild.id,
            message.author.id
        ).catch(error => {
            console.error("Could not sync challenge reward level:", error);
        });
        await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle(`🏆 CHALLENGE #${challenge.number} COMPLETE`)
                    .setDescription(
                        completion.firstClear
                            ? "**First clear rewards claimed!**"
                            : "**Replay rewards claimed!**"
                    )
                    .addFields(
                        {
                            name: "Rewards",
                            value: renderChestEmojis(
                                message.guild,
                                bossChallenges.formatRewardBundle(
                                    completion.rewardBundle
                                )
                            )
                        },
                        {
                            name: "Progress",
                            value: challenge.number === 3
                                && completion.firstClear
                                    ? "**!fight is now permanently unlocked.** Your free-upgrade token will automatically pay for your next successful upgrade."
                                    : challenge.number < 3
                                        ? `Challenge #${challenge.number + 1} is now available if you meet its level requirement.`
                                        : "You may replay this challenge for its reduced repeat reward."
                        }
                    )
            ]
        }).catch(() => null);
    }

    scheduleBattleChannelDeletion(
        message.channel,
        "Boss Challenge enemy defeated"
    );
}


async function handleCombatResult(message, result){
    if(!result) return;
    if(result.challenge){
        return handleChallengeCombatResult(message, result);
    }

    await syncRaidStatusMessage(
        message,
        result
    ).catch(error => {
        console.error(
            "Could not synchronize the fixed raid status message:",
            error
        );
    });

    if(result.definition){
        await announceAbilityEvents(message, result);
    }

    if(result.defeated && result.definition){
        const awarded = await bosses.distributeRaidBossRewards(result);
        const shopOutcome =
            await bossShop.maybeOpenBossShopAfterRaid(
                message.guild.id
            );
        await Promise.allSettled(
            awarded.map(entry => leveling.syncLevelAndAnnounce(
                message.client,
                message.guild.id,
                entry.userID
            ))
        );
        const topThree = awarded
            .filter(entry => entry.topThree)
            .map(entry =>
                `**#${entry.placement}** <@${entry.userID}> — ${formatNumber(entry.damage)} damage\n${renderChestEmojis(message.guild, entry.summary)}`
            )
            .join("\n\n")
            || "No eligible damage contributors.";
        const otherRewards = awarded
            .filter(entry => !entry.topThree)
            .slice(0, 12)
            .map(entry =>
                `<@${entry.userID}> — ${renderChestEmojis(
                    message.guild,
                    entry.summary
                )}`
            )
            .join("\n")
            || "No other contributors.";
        const hiddenContributorCount = Math.max(0, awarded.length - 15);
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("🏆 RAID BOSS DEFEATED")
            .setDescription(
                `The server defeated **${result.definition.name} {CANON}** from *${result.definition.act}*!`
            )
            .addFields(
                {
                    name: "Final hit",
                    value: `<@${message.author.id}> dealt **${formatNumber(result.damage)} XP damage**.`
                },
                {
                    name: "Top 3 damage rewards",
                    value: topThree.slice(0, 1024)
                },
                {
                    name: "Contributor rewards",
                    value: `${otherRewards}${
                        hiddenContributorCount > 0
                            ? `\n…and ${hiddenContributorCount} more rewarded contributors.`
                            : ""
                    }`.slice(0, 1024)
                }
            );

        if(shopOutcome.opened){
            embed.addFields({
                name: "💠 Boss Shop opened",
                value:
                    `Three products are available through \`!boss\` for **20 minutes**. ` +
                    `The shop closes <t:${Math.floor(shopOutcome.shop.expiresAt / 1000)}:R>.`
            });
        }

        await message.channel.send({
            embeds: [embed],
            allowedMentions: {
                users: [...new Set([
                    message.author.id,
                    ...awarded.map(entry => entry.userID)
                ])].slice(0, 100)
            }
        }).catch(error => {
            console.error("Could not announce raid boss defeat:", error);
        });
    }
}


module.exports = {
    INFO_BUTTON_ID,
    CHALLENGES_BUTTON_ID,
    CHALLENGE_LIST_BUTTON_ID,
    BOSS_SHOP_BUTTON_ID,
    BOSS_SHOP_BUY_PREFIX,
    RAID_STATUS_CHANNEL_ID,
    RAID_STATUS_PANEL_FOOTER,
    HEALTH_BAR_SEGMENTS,
    execute,
    resetChallenges,
    handleInteraction,
    handleCombatResult,
    buildHealthBar,
    buildBossEmbed,
    buildNoBossEmbed,
    buildBossPayload,
    buildRaidStatusPayload,
    buildBossShopPayload,
    getRaidStatusChannel,
    isRaidStatusPanelMessage,
    findRaidStatusMessage,
    ensureRaidStatusMessage,
    syncRaidStatusMessage,
    handleExpiredBosses,
    buildInfoEmbeds,
    buildChallengeListPayload,
    buildChallengeDetailPayload,
    buildChallengeCombatEmbed,
    formatAdvantages,
    formatAdvantageStatuses,
    createChallengeBattle
};
