const database = require("../database");
const luck = require("../utils/luck");
const bossChallenges = require("./bossChallenges");


const BOSS_DURATION_MS =
    150 * 60 * 1000;

const RAID_BOSS_SPAWN_COOLDOWN_MS =
    4 * 60 * 60 * 1000;

const ACTIVITY_WINDOW_MS =
    10 * 60 * 2 * 1000;

const MINIMUM_ACTIVE_USERS =
    2;


const {ADVANTAGE_NAMES, RAID_BOSSES, CHALLENGE_BOSSES, RAID_REWARDS} = require("./bossRoster");
const CHALLENGE_ONLY_BOSSES = CHALLENGE_BOSSES;
const BOSS_BY_KEY = new Map([...RAID_BOSSES, ...CHALLENGE_BOSSES].map(boss => [boss.key, boss]));


const HOUR_MS =
    60 * 60 * 1000;


function pickRewardOption(
    options,
    random = Math.random
){

    const values =
        Array.isArray(options)
            ? options
            : [options];


    return values[
        Math.min(
            values.length - 1,
            Math.floor(
                Math.max(
                    0,
                    Math.min(
                        0.999999999,
                        Number(random()) || 0
                    )
                ) * values.length
            )
        )
    ];

}


function rewardBoost(
    boostType,
    tier,
    amount
){

    return {
        boostType,
        tier,
        amount:
            Math.max(
                1,
                Math.floor(Number(amount) || 1)
            )
    };

}


function getRaidRewardTier(definition){
    // Kept for callers displaying a broad tier. Rewards are now boss-specific.
    return definition?.category === "raid" ? "apex" : "challenge";
}

function rollRaidRewardBundle(definition, topThree, random = Math.random){
    const config = RAID_REWARDS[definition?.key]?.[topThree ? "top" : "rest"];
    if(!config) throw new Error("No raid rewards configured for " + definition?.key);
    return {
        shards: config.shards,
        chests: [{tier: "boss", amount: 1}],
        boosts: (config.boosts || []).map(([type, tier, amounts]) =>
            rewardBoost(type, tier, pickRewardOption(amounts, random))),
        guaranteedJackpots: config.guaranteedJackpots || 0,
        ...(config.multiHours ? {
            timedAllCommands: {
                extraCount: 2, // 3 TOTAL executions, never four.
                durationMs: pickRewardOption(config.multiHours, random) * HOUR_MS
            }
        } : {})
    };
}

function getRaidRewardPreview(definition){
    const rewards = RAID_REWARDS[definition?.key];
    if(!rewards) return {top: "No raid rewards", rest: "No raid rewards"};
    const labels = {
        "luck:omega": "Luck Ω", "luck:max": "Luck MAX", "luck:tier3": "Luck III",
        "xp:infinity": "XP Boost ထ", "xp:max": "XP Boost MAX", "rune:tier3": "Power Rune III"
    };
    const format = config => [
        ...(config.boosts || []).map(([type, tier, values]) =>
            values.join("/") + "x " + labels[type + ":" + tier]),
        ...(config.guaranteedJackpots ? ["1 guaranteed jackpot roll"] : []),
        ...(config.multiHours ? ["3 total executions per command for " + config.multiHours.join("/") + " hours"] : []),
        "1 Boss Chest",
        config.shards.toLocaleString("en-US") + " shards"
    ].join(" • ");
    return {top: format(rewards.top), rest: format(rewards.rest)};
}


function formatRaidRewardBundle(bundle){

    const base =
        bossChallenges.formatRewardBundle(
            bundle
        );

    const extras = [];

    if(bundle?.guaranteedJackpots){
        extras.push(`${bundle.guaranteedJackpots} guaranteed jackpot roll`);
    }


    if(bundle?.timedAllCommands){
        extras.push(
            `${1 + bundle.timedAllCommands.extraCount} total executions per command for ${Math.round(bundle.timedAllCommands.durationMs / HOUR_MS)}h`
        );
    }

    if(bundle?.timedRoll){
        extras.push(
            `+${bundle.timedRoll.extraCount} rolls for ${Math.round(bundle.timedRoll.durationMs / HOUR_MS)}h`
        );
    }

    if(bundle?.nextHugRepeat){
        extras.push(
            `next !hug performs +${bundle.nextHugRepeat.extraCount} hugs`
        );
    }


    return [base, ...extras]
        .filter(value => value && value !== "No rewards")
        .join(" • ");

}


async function distributeRaidBossRewards(
    combatResult,
    random = Math.random
){

    const definition =
        combatResult?.definition;

    const spawnedAt =
        Number(combatResult?.boss?.spawnedAt) || 0;


    if(!definition || spawnedAt <= 0){
        return [];
    }

    if(definition.category !== "raid") return [];


    const contributions =
        await database.getRaidBossContributions(
            combatResult.boss.guildID,
            spawnedAt
        );

    const awarded = [];


    for(
        let index = 0;
        index < contributions.length;
        index++
    ){

        const contribution =
            contributions[index];

        const bundle =
            rollRaidRewardBundle(
                definition,
                index < 3,
                random
            );

        const claimed =
            await database.grantRaidBossRewardOnce(
                combatResult.boss.guildID,
                spawnedAt,
                contribution.userID,
                bundle
            );


        if(claimed){
            awarded.push({
                ...contribution,
                placement: index + 1,
                topThree: index < 3,
                bundle,
                summary:
                    formatRaidRewardBundle(bundle)
            });
        }

    }


    return awarded;

}


const guildLocks =
    new Map();


function withGuildLock(
    guildID,
    action
){

    const key =
        String(guildID);

    const previous =
        guildLocks.get(key)
        ||
        Promise.resolve();

    const next =
        previous
            .catch(() => {})
            .then(action);


    guildLocks.set(
        key,
        next
    );


    return next.finally(() => {

        if(guildLocks.get(key) === next){
            guildLocks.delete(key);
        }

    });

}


function getBossDefinition(bossOrKey){

    const key =
        typeof bossOrKey === "string"
            ? bossOrKey
            : bossOrKey?.bossKey;


    return BOSS_BY_KEY.get(
        String(key || "")
    ) || null;

}


function getAdvantage(
    definition,
    key
){

    return definition?.advantages.find(
        entry => entry.key === key
    ) || null;

}


function hasAdvantage(
    definition,
    key
){

    return Boolean(
        getAdvantage(
            definition,
            key
        )
    );

}


function ensureStateData(boss){

    const stateData =
        boss.stateData &&
        typeof boss.stateData === "object"
            ? boss.stateData
            : {};


    stateData.buffs =
        Array.isArray(stateData.buffs)
            ? stateData.buffs
            : [];

    stateData.triggered =
        stateData.triggered &&
        typeof stateData.triggered === "object"
            ? stateData.triggered
            : {};


    boss.stateData =
        stateData;


    return stateData;

}


function calculateBossMaxHP(
    definition,
    buffs
){

    let multiplier =
        1;


    for(const buff of buffs){

        multiplier *=
            Math.max(
                1,
                Number(
                    buff.maxHPMultiplier
                ) || 1
            );

    }


    return Math.max(
        1,
        Math.round(
            definition.hp *
            multiplier
        )
    );

}


function calculateBossOverall(
    definition,
    buffs
){

    let multiplier =
        1;


    for(const buff of buffs){

        multiplier *=
            Math.max(
                1,
                Number(
                    buff.overallMultiplier
                ) || 1
            );

    }


    return Math.max(
        1,
        Math.round(
            definition.overall *
            multiplier
        )
    );

}


function isBuffActive(
    boss,
    type,
    now
){

    return ensureStateData(boss)
        .buffs
        .some(
            buff =>
                buff.type === type
                &&
                Number(buff.expiresAt) > now
        );

}


// Formula terms are percentage points, not raw multipliers.
function overallAdvantageBonus(overall){
    const value = Math.max(0, Number(overall) || 0);
    // Guard custom future bosses against the formula's singularity at 200M.
    return Math.min(100, value / Math.max(1, 10000000 - value / 20));
}

function getRegenerationPerSecond(boss, definition){
    const entry = getAdvantage(definition, "regeneration");
    return entry ? Math.floor((entry.mastered ? 1000 : 500) + boss.maxHP / 10000) : 0;
}

function applyTimedHealing(
    boss,
    now,
    activeUntilField,
    lastTickField,
    healingPerSecond
){

    const stateData =
        ensureStateData(boss);

    const activeUntil =
        Number(
            stateData[activeUntilField]
        ) || 0;

    const lastTickAt =
        Number(
            stateData[lastTickField]
        ) || 0;


    if(
        activeUntil <= 0
        ||
        lastTickAt <= 0
        ||
        healingPerSecond <= 0
    ){
        return 0;
    }


    const tickEnd =
        Math.min(
            now,
            activeUntil
        );

    const ticks =
        Math.floor(
            Math.max(
                0,
                tickEnd - lastTickAt
            ) / 1000
        );


    if(ticks <= 0){
        return 0;
    }


    const oldHP =
        boss.currentHP;


    boss.currentHP =
        Math.min(
            boss.maxHP,
            boss.currentHP +
                ticks *
                healingPerSecond
        );

    stateData[lastTickField] =
        lastTickAt +
        ticks * 1000;


    return Math.max(
        0,
        boss.currentHP - oldHP
    );

}


function refreshTimedBossState(
    boss,
    definition,
    now
){

    const stateData =
        ensureStateData(boss);

    let changed =
        false;


    const regenerationHealing =
        applyTimedHealing(
            boss,
            now,
            "regenerationActiveUntil",
            "regenerationLastTickAt",
            getRegenerationPerSecond(
                boss,
                definition
            )
        );


    if(regenerationHealing > 0){
        changed = true;
    }


    const immortality = getAdvantage(definition, "xp_immortality");
    if(immortality && applyTimedHealing(
        boss, now, "immortalityActiveUntil", "immortalityLastTickAt",
        Math.floor((immortality.mastered ? 300 : 100) + boss.maxHP / 50000)
    ) > 0) changed = true;

    const previousMaxHP =
        Math.max(
            1,
            Number(boss.maxHP) ||
                definition.hp
        );

    const activeBuffs =
        stateData.buffs.filter(
            buff =>
                Number(buff.expiresAt) > now
        );


    if(
        activeBuffs.length !==
        stateData.buffs.length
    ){

        stateData.buffs =
            activeBuffs;


        const newMaxHP =
            calculateBossMaxHP(
                definition,
                activeBuffs
            );


        boss.currentHP =
            Math.max(
                0,
                Math.min(
                    newMaxHP,
                    Math.round(
                        boss.currentHP *
                        newMaxHP /
                        previousMaxHP
                    )
                )
            );

        boss.maxHP =
            newMaxHP;

        changed = true;

    }


    const calculatedMaxHP =
        calculateBossMaxHP(
            definition,
            stateData.buffs
        );


    if(boss.maxHP !== calculatedMaxHP){

        boss.currentHP =
            Math.max(
                0,
                Math.min(
                    calculatedMaxHP,
                    Math.round(
                        boss.currentHP *
                        calculatedMaxHP /
                        Math.max(
                            1,
                            boss.maxHP
                        )
                    )
                )
            );

        boss.maxHP =
            calculatedMaxHP;

        changed = true;

    }


    const calculatedOverall =
        calculateBossOverall(
            definition,
            stateData.buffs
        );


    if(boss.overall !== calculatedOverall){
        boss.overall = calculatedOverall;
        changed = true;
    }


    if(
        Number(stateData.regenerationActiveUntil) > 0
        &&
        Number(stateData.regenerationActiveUntil) <= now
    ){
        stateData.regenerationActiveUntil = 0;
        stateData.regenerationLastTickAt = 0;
        changed = true;
    }


    if(
        Number(stateData.immortalityActiveUntil) > 0
        &&
        Number(stateData.immortalityActiveUntil) <= now
    ){
        stateData.immortalityActiveUntil = 0;
        changed = true;
    }


    if(
        Number(stateData.furyActiveUntil) > 0
        &&
        Number(stateData.furyActiveUntil) <= now
    ){
        stateData.furyActiveUntil = 0;
        stateData.furyLastTickAt = 0;
        changed = true;
    }


    return changed;

}


function activateBuff(
    boss,
    definition,
    buff,
    healthMode = "scale"
){

    const stateData =
        ensureStateData(boss);

    const oldMaxHP =
        Math.max(
            1,
            boss.maxHP
        );


    stateData.buffs.push(
        buff
    );


    const newMaxHP =
        calculateBossMaxHP(
            definition,
            stateData.buffs
        );


    if(healthMode === "power"){

        boss.currentHP =
            Math.min(
                newMaxHP,
                boss.currentHP +
                    Math.round(
                        oldMaxHP *
                        Math.max(
                            0,
                            Number(
                                buff.healthGainRate
                            ) || 0
                        )
                    )
            );

    }
    else{

        boss.currentHP =
            Math.min(
                newMaxHP,
                Math.round(
                    boss.currentHP *
                    newMaxHP /
                    oldMaxHP
                )
            );

    }


    boss.maxHP =
        newMaxHP;

    boss.overall =
        calculateBossOverall(
            definition,
            stateData.buffs
        );

}


function rollBossDefinition(
    random = Math.random
){

    const rolledPercent =
        Math.max(
            0,
            Math.min(
                99.999999999,
                Number(random()) * 100
            )
        );

    let cumulativeChance =
        0;


    for(const definition of RAID_BOSSES){

        cumulativeChance +=
            definition.chancePercent;


        if(rolledPercent < cumulativeChance){
            return definition;
        }

    }


    return null;

}


function rollGuaranteedBossDefinition(
    random = Math.random
){

    const totalWeight =
        RAID_BOSSES.reduce(
            (sum, definition) =>
                sum + Math.max(
                    0,
                    Number(definition.chancePercent) || 0
                ),
            0
        );

    let cursor =
        Math.max(
            0,
            Math.min(0.999999999, Number(random()) || 0)
        ) * totalWeight;

    for(const definition of RAID_BOSSES){
        cursor -= Math.max(
            0,
            Number(definition.chancePercent) || 0
        );
        if(cursor < 0){
            return definition;
        }
    }

    return RAID_BOSSES[RAID_BOSSES.length - 1];

}


function createBossState(
    guildID,
    definition,
    now
){

    return {
        guildID:
            String(guildID),
        bossKey:
            definition.key,
        currentHP:
            definition.hp,
        maxHP:
            definition.hp,
        overall:
            definition.overall,
        spawnedAt:
            now,
        expiresAt:
            now +
            BOSS_DURATION_MS,
        stateData: {
            version: 1,
            buffs: [],
            triggered: {},
            regenerationActiveUntil: 0,
            regenerationCooldownUntil: 0,
            regenerationLastTickAt: 0,
            immortalityActiveUntil: 0,
            furyActiveUntil: 0,
            furyLastTickAt: 0,
            precisionCooldownUntil: 0
        }
    };

}


async function createChallengeBossState(
    battle,
    bossKey,
    now = Date.now()
){

    const definition =
        getBossDefinition(
            bossKey
        );


    if(!definition || definition.category !== "challenge"){
        throw new Error(
            `Unknown challenge boss: ${bossKey}`
        );
    }


    const state =
        createBossState(
            battle.bossScope,
            definition,
            now
        );


    state.expiresAt =
        Math.max(
            now + 1000,
            Number(battle.expiresAt)
            || now +
                bossChallenges
                    .CHALLENGE_BATTLE_DURATION_MS
        );


    return database.createRaidBossState(
        state
    );

}


async function loadActiveBossLocked(
    guildID,
    now
){

    const boss =
        await database.getRaidBossState(
            guildID
        );


    if(!boss){
        return null;
    }


    if(boss.expiresAt <= now){

        await database.deleteRaidBossState(
            guildID,
            boss.spawnedAt
        );

        return null;

    }


    const definition =
        getBossDefinition(boss);


    if(!definition){

        await database.deleteRaidBossState(
            guildID,
            boss.spawnedAt
        );

        return null;

    }


    if(
        refreshTimedBossState(
            boss,
            definition,
            now
        )
    ){
        await database.updateRaidBossState(
            boss
        );
    }


    return boss;

}


function calculatePrecisionChance(boss, definition){
    const entry = getAdvantage(definition, "precision");
    return entry ? Math.min(100, (entry.mastered ? 10 : 5) + overallAdvantageBonus(boss.overall)) : 0;
}

function calculateNeutralCommandXP(
    earnedXP,
    luckProfile
){

    const safeXP =
        Math.max(
            0,
            Math.floor(
                Number(earnedXP) || 0
            )
        );

    const tier =
        String(
            luckProfile?.tier ||
            "none"
        ).toLowerCase();

    const fallbackPower = {
        none: 1,
        tier1: 0.75,
        tier2: 0.5,
        tier3: 0.3,
        max: 0.12,
        omega: 0.03
    }[tier] ?? 1;

    const rewardBiasPower =
        Number.isFinite(
            Number(
                luckProfile?.commandRewardBiasPower
            )
        )
        &&
        Number(
            luckProfile?.commandRewardBiasPower
        ) > 0
            ? Number(
                luckProfile.commandRewardBiasPower
            )
            : fallbackPower;

    const neutralExpectedPosition =
        0.5;

    const boostedExpectedPosition =
        1 /
        (
            rewardBiasPower +
            1
        );

    const neutralFactor =
        Math.max(
            0.05,
            Math.min(
                1,
                neutralExpectedPosition /
                    boostedExpectedPosition
            )
        );


    return Math.max(
        safeXP > 0
            ? 1
            : 0,
        Math.floor(
            safeXP *
            neutralFactor
        )
    );

}


function getDamageReduction(
    advantageEntry,
    normalReduction,
    masteredReduction
){

    if(!advantageEntry){
        return 0;
    }


    return advantageEntry.mastered
        ? masteredReduction
        : normalReduction;

}


function activateThresholdAbilities(boss, definition, healthPercent, now, events, random = Math.random){
    const state = ensureStateData(boss);
    const triggered = state.triggered;
    const chance = percent => Number(random()) * 100 < percent;
    const emit = entry => events.push({type: "ability", ability: entry.key, mastered: entry.mastered});
    const durability = getAdvantage(definition, "durability");
    if(durability && !isBuffActive(boss, "durability", now)
        && (Number(state.durabilityCooldownUntil) || 0) <= now
        && chance(durability.mastered ? 10 : 5)){
        activateBuff(boss, definition, {
            type: "durability", expiresAt: now + (durability.mastered ? 180 : 60) * 1000,
            maxHPMultiplier: 1, overallMultiplier: 1
        });
        state.durabilityCooldownUntil = now + (durability.mastered ? 180 : 300) * 1000;
        emit(durability);
    }
    const power = getAdvantage(definition, "power");
    if(power && !triggered.powerOnce && !triggered.power70 && !triggered.power30
        && healthPercent < 50 && chance(power.mastered ? 6 : 3)){
        triggered.powerOnce = true;
        activateBuff(boss, definition, {
            type: "power", expiresAt: now + (power.mastered ? 120 : 60) * 1000,
            maxHPMultiplier: power.mastered ? 1.15 : 1.05,
            overallMultiplier: 1 + ((power.mastered ? 15 : 10) + overallAdvantageBonus(boss.overall)) / 100,
            healthGainRate: ((power.mastered ? 10 : 5) + boss.maxHP / 100000000) / 100
        }, "power");
        emit(power);
    }
    const fury = getAdvantage(definition, "fury");
    if(fury && !triggered.furyOnce && !triggered.fury5
        && healthPercent < 30 && chance(fury.mastered ? 6 : 3)){
        triggered.furyOnce = true;
        state.furyActiveUntil = now + (fury.mastered ? 120 : 60) * 1000;
        state.furyDamageReduction = Math.min(1,
            ((fury.mastered ? 10 : 5) + overallAdvantageBonus(boss.overall)) / 100);
        emit(fury);
    }
    const immortality = getAdvantage(definition, "xp_immortality");
    if(immortality && healthPercent < 10
        && (Number(state.immortalityActiveUntil) || 0) <= now
        && chance(immortality.mastered ? 30 : 20)){
        state.immortalityActiveUntil = now + (immortality.mastered ? 60 : 30) * 1000;
        state.immortalityLastTickAt = now;
        emit(immortality);
    }
}

async function applyDamageLocked(
    boss,
    attack
){

    const definition =
        getBossDefinition(boss);

    const now =
        attack.now;

    const stateData =
        ensureStateData(boss);

    const events = [];

    let baseDamage =
        Math.max(
            0,
            Math.floor(
                Number(attack.earnedXP) || 0
            )
        );

    let isCritical =
        Boolean(attack.critical);


    const degeneration =
        getAdvantage(
            definition,
            "degeneration"
        );


    if(degeneration){
        // Retain XP boosts and 75% (mastered: 65%) of luck-derived damage.
        // Never increase a hit when its neutral estimate is larger.
        const neutralDamage = attack.xpWithoutLuck == null
            ? baseDamage
            : Math.max(0, Number(attack.xpWithoutLuck) || 0);
        const luckBonus = Math.max(0, baseDamage - neutralDamage);
        baseDamage = Math.max(0, Math.floor(
            baseDamage - luckBonus * (degeneration.mastered ? 0.35 : 0.25)
        ));
    }


    if(baseDamage <= 0){

        return {
            boss,
            definition,
            attemptedXP: 0,
            damage: 0,
            healed: 0,
            dodged: false,
            defeated: false,
            events
        };

    }


    const precision =
        getAdvantage(
            definition,
            "precision"
        );


    if(
        precision
        &&
        Number(
            stateData.precisionCooldownUntil
        ) <= now
    ){

        const precisionChance =
            calculatePrecisionChance(
                boss,
                definition
            );


        if(
            Number(attack.random()) *
                100 <
            precisionChance
        ){

            stateData.precisionCooldownUntil =
                now +
                (precision.mastered ? 60 : 120) * 1000;

            await database.updateRaidBossState(
                boss
            );

            await database.recordRaidBossContribution(
                boss.guildID,
                boss.spawnedAt,
                attack.userID,
                0,
                now
            );

            return {
                boss,
                definition,
                attemptedXP:
                    baseDamage,
                damage: 0,
                healed: 0,
                dodged: true,
                precisionChance,
                defeated: false,
                events: [{
                    type: "precision",
                    mastered:
                        precision.mastered
                }]
            };

        }

    }


    const immortality =
        getAdvantage(
            definition,
            "xp_immortality"
        );


    if(
        immortality
        &&
        Number(
            stateData.immortalityActiveUntil
        ) > now
    ){

        // Healing is time-based, never proportional to the blocked attack.
        const healed = 0;

        await database.updateRaidBossState(
            boss
        );

        await database.recordRaidBossContribution(
            boss.guildID,
            boss.spawnedAt,
            attack.userID,
            0,
            now
        );


        return {
            boss,
            definition,
            attemptedXP:
                baseDamage,
            damage: 0,
            healed,
            dodged: false,
            defeated: false,
            events: [{
                type: "xp_immortality_block",
                mastered:
                    immortality.mastered
            }]
        };

    }


    const isCommand =
        attack.source === "command"
        ||
        attack.source === "roll";

    // Immortality blocks only its own damage source. If both chat defenses
    // apply, use the strongest once rather than double-healing a critical.
    const sourceImmortality = (isCommand
        ? [getAdvantage(definition, "commands_immortality")]
        : attack.source === "chat"
            ? [
                getAdvantage(definition, "chatting_immortality"),
                isCritical ? getAdvantage(definition, "critical_immortality") : null
            ]
            : []
    ).filter(Boolean).sort((a, b) => Number(b.mastered) - Number(a.mastered))[0];


    if(sourceImmortality){

        let healed =
            0;


        if(sourceImmortality.mastered){

            const oldHP =
                boss.currentHP;


            boss.currentHP =
                Math.min(
                    boss.maxHP,
                    boss.currentHP +
                        Math.floor(
                            baseDamage *
                            0.1
                        )
                );

            healed =
                boss.currentHP -
                oldHP;

        }


        await database.updateRaidBossState(
            boss
        );

        await database.recordRaidBossContribution(
            boss.guildID,
            boss.spawnedAt,
            attack.userID,
            0,
            now
        );


        return {
            boss,
            definition,
            attemptedXP:
                baseDamage,
            damage: 0,
            healed,
            dodged: false,
            defeated: false,
            events: [{
                type: sourceImmortality.key,
                mastered:
                    sourceImmortality.mastered
            }]
        };

    }


    let damageMultiplier =
        1;


    if(attack.source === "chat"){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "chatting_immunity"
                ),
                0.25,
                0.35
            );

    }


    if(attack.source === "chat" && isCritical){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "critical_immunity"
                ),
                0.35,
                0.45
            );

    }


    if(isCommand){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "commands_immunity"
                ),
                0.25,
                0.4
            );

    }


    if(attack.source === "roll"){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "rolling_immunity"
                ),
                0.3,
                0.4
            );

    }


    if(
        isBuffActive(
            boss,
            "durability",
            now
        )
    ){

        damageMultiplier *=
            1 -
            getDamageReduction(
                getAdvantage(
                    definition,
                    "durability"
                ),
                0.25,
                0.4
            );

    }


    if(
        Number(
            stateData.furyActiveUntil
        ) > now
    ){

        damageMultiplier *= 1 - Math.min(1, Math.max(0, Number(stateData.furyDamageReduction) || 0));

    }


    const finalDamage =
        Math.max(
            0,
            Math.floor(
                baseDamage *
                Math.max(
                    0,
                    damageMultiplier
                ) +
                0.0000001
            )
        );


    const actualDamage =
        Math.min(
            boss.currentHP,
            finalDamage
        );


    boss.currentHP =
        Math.max(
            0,
            boss.currentHP -
                actualDamage
        );


    await database.recordRaidBossContribution(
        boss.guildID,
        boss.spawnedAt,
        attack.userID,
        actualDamage,
        now
    );


    if(boss.currentHP <= 0){

        await database.deleteRaidBossState(
            boss.guildID,
            boss.spawnedAt
        );


        return {
            boss,
            definition,
            attemptedXP:
                baseDamage,
            damage:
                actualDamage,
            healed: 0,
            dodged: false,
            defeated: true,
            events
        };

    }


    const regeneration =
        getAdvantage(
            definition,
            "regeneration"
        );


    if(
        actualDamage > 0 && regeneration
        &&
        Number(
            stateData.regenerationActiveUntil
        ) <= now
        &&
        Number(
            stateData.regenerationCooldownUntil
        ) <= now
        && Number(attack.random()) * 100 < (regeneration.mastered ? 20 : 15)
    ){

        stateData.regenerationActiveUntil =
            now +
            (regeneration.mastered ? 30 : 15) * 1000;

        stateData.regenerationCooldownUntil = stateData.regenerationActiveUntil;

        stateData.regenerationLastTickAt =
            now;

        events.push({
            type: "ability",
            ability: "regeneration",
            mastered:
                regeneration.mastered
        });

    }


    const postDamageHealthPercent =
        boss.currentHP /
        Math.max(
            1,
            boss.maxHP
        ) *
        100;


    if(actualDamage > 0) activateThresholdAbilities(
        boss,
        definition,
        postDamageHealthPercent,
        now,
        events,
        attack.random
    );


    await database.updateRaidBossState(
        boss
    );


    return {
        boss,
        definition,
        attemptedXP:
            baseDamage,
        damage:
            actualDamage,
        healed: 0,
        dodged: false,
        defeated: false,
        events
    };

}


async function getCurrentBoss(
    guildID,
    now = Date.now()
){

    return withGuildLock(
        guildID,
        () => loadActiveBossLocked(
            guildID,
            now
        )
    );

}


async function spawnGuaranteedBoss(
    guildID,
    userID,
    options = {}
){

    const now =
        Math.max(
            0,
            Math.floor(Number(options.now) || Date.now())
        );

    const random =
        typeof options.random === "function"
            ? options.random
            : Math.random;


    return withGuildLock(
        guildID,
        async () => {
            const activeBoss =
                await loadActiveBossLocked(
                    guildID,
                    now
                );

            if(activeBoss){
                return {
                    success: false,
                    status: "boss-active",
                    boss: activeBoss,
                    definition:
                        getBossDefinition(activeBoss)
                };
            }

            const consumption =
                await database.consumeSpawnBossUse(
                    guildID,
                    userID,
                    now
                );

            if(!consumption.consumed){
                return {
                    success: false,
                    status: consumption.cooldownUntil > now ? "cooldown" : "no-use",
                    cooldownUntil: consumption.cooldownUntil
                };
            }

            const definition =
                rollGuaranteedBossDefinition(
                    random
                );

            const requestedBoss =
                createBossState(
                    guildID,
                    definition,
                    now
                );

            let boss;
            try {
                boss = await database.createRaidBossState(requestedBoss);
            } catch(error){
                await database.refundSpawnBossUse(guildID, userID, consumption.cooldownUntil);
                throw error;
            }

            if(!boss){
                await database.refundSpawnBossUse(
                    guildID,
                    userID,
                    consumption.cooldownUntil
                );

                return {
                    success: false,
                    status: "spawn-conflict",
                    boss:
                        await loadActiveBossLocked(
                            guildID,
                            now
                        )
                };
            }

            const spawnCooldown =
                await database.recordRaidBossSpawn(
                    guildID,
                    boss.spawnedAt,
                    RAID_BOSS_SPAWN_COOLDOWN_MS
                );

            return {
                success: true,
                status: "spawned",
                spawned: true,
                boss,
                definition,
                spawnCooldown,
                remainingUses:
                    consumption.remaining,
                damage: 0,
                defeated: false,
                events: []
            };
        }
    );

}


async function handleChallengeAttack(
    message,
    source,
    earnedXP,
    options = {}
){

    const now =
        Math.max(
            0,
            Math.floor(
                Number(options.now) || Date.now()
            )
        );

    const battle =
        await database.getActiveBossChallengeBattle(
            message.guild.id,
            message.author.id,
            message.channel.id,
            now
        );


    if(!battle){
        return null;
    }


    const random =
        typeof options.random === "function"
            ? options.random
            : Math.random;


    return withGuildLock(
        battle.bossScope,
        async () => {

            const boss =
                await loadActiveBossLocked(
                    battle.bossScope,
                    now
                );


            if(!boss){

                await database.deleteBossChallengeBattle(
                    message.guild.id,
                    message.author.id
                );

                return {
                    challenge: true,
                    challengeBattle: battle,
                    expired: true,
                    damage: 0,
                    defeated: false,
                    events: []
                };

            }


            const definition =
                getBossDefinition(boss);

            let xpWithoutLuck =
                options.xpWithoutLuck == null
                    ? earnedXP
                    : Math.max(
                        0,
                        Math.floor(
                            Number(options.xpWithoutLuck) || 0
                        )
                    );


            if(
                source !== "chat"
                && hasAdvantage(
                    definition,
                    "degeneration"
                )
            ){

                const luckProfile =
                    await luck.getActiveLuckBoost(
                        message.member
                    ).catch(() => null);

                xpWithoutLuck =
                    calculateNeutralCommandXP(
                        earnedXP,
                        luckProfile
                    );

            }


            const combat =
                await applyDamageLocked(
                    boss,
                    {
                        source,
                        commandName:
                            options.commandName,
                        earnedXP,
                        xpWithoutLuck,
                        critical:
                            Boolean(options.critical),
                        criticalWithoutLuck:
                            options.criticalWithoutLuck == null
                                ? Boolean(options.critical)
                                : Boolean(
                                    options.criticalWithoutLuck
                                ),
                        userID:
                            message.author.id,
                        now,
                        random
                    }
                );


            return {
                ...combat,
                challenge: true,
                challengeBattle: battle,
                spawned: false,
                commandName:
                    options.commandName || null
            };

        }
    );

}


async function handleChatXP(
    message,
    xpResult,
    options = {}
){

    const earnedXP =
        Math.max(
            0,
            Math.floor(
                Number(
                    xpResult?.earnedXP
                ) || 0
            )
        );


    if(
        !message?.guild
        ||
        earnedXP <= 0
    ){
        return null;
    }


    const now =
        Math.max(
            0,
            Math.floor(
                Number(options.now) ||
                Date.now()
            )
        );

    const random =
        typeof options.random === "function"
            ? options.random
            : Math.random;

    const challengeResult =
        await handleChallengeAttack(
            message,
            "chat",
            earnedXP,
            {
                now,
                random,
                xpWithoutLuck:
                    xpResult?.bossXPWithoutLuck == null
                        ? earnedXP
                        : Number(
                            xpResult.bossXPWithoutLuck
                        ) || 0,
                critical:
                    Boolean(xpResult?.critical),
                criticalWithoutLuck:
                    xpResult?.bossCriticalWithoutLuck == null
                        ? Boolean(xpResult?.critical)
                        : Boolean(
                            xpResult.bossCriticalWithoutLuck
                        )
            }
        );


    if(challengeResult){
        return challengeResult;
    }

    const activeUsers =
        await database.recordRaidBossActivity(
            message.guild.id,
            message.author.id,
            now,
            ACTIVITY_WINDOW_MS
        );


    return withGuildLock(
        message.guild.id,
        async () => {

            let boss =
                await loadActiveBossLocked(
                    message.guild.id,
                    now
                );

            let spawned =
                false;

            let spawnCooldown =
                null;


            if(
                !boss
                &&
                activeUsers >=
                    MINIMUM_ACTIVE_USERS
            ){

                spawnCooldown =
                    await database.getRaidBossSpawnCooldown(
                        message.guild.id,
                        now
                    );


                if(!spawnCooldown.ready){
                    return {
                        activeUsers,
                        spawned: false,
                        spawnCooldown,
                        boss: null,
                        damage: 0,
                        defeated: false,
                        events: []
                    };
                }

                const definition =
                    rollBossDefinition(
                        random
                    );


                if(definition){

                    const requestedBoss =
                        createBossState(
                            message.guild.id,
                            definition,
                            now
                        );

                    boss =
                        await database.createRaidBossState(
                            requestedBoss
                        );


                    if(boss){
                        spawned = true;

                        spawnCooldown =
                            await database.recordRaidBossSpawn(
                                message.guild.id,
                                boss.spawnedAt,
                                RAID_BOSS_SPAWN_COOLDOWN_MS
                            );
                    }
                    else{
                        boss =
                            await loadActiveBossLocked(
                                message.guild.id,
                                now
                            );
                    }

                }

            }


            if(!boss){

                return {
                    activeUsers,
                    spawned: false,
                    spawnCooldown,
                    boss: null,
                    damage: 0,
                    defeated: false,
                    events: []
                };

            }


            const combat =
                await applyDamageLocked(
                    boss,
                    {
                        source: "chat",
                        earnedXP,
                        xpWithoutLuck:
                            Math.max(
                                0,
                                Math.floor(
                                    xpResult
                                        ?.bossXPWithoutLuck == null
                                        ? earnedXP
                                        : Number(
                                            xpResult
                                                .bossXPWithoutLuck
                                        ) || 0
                                )
                            ),
                        critical:
                            Boolean(
                                xpResult?.critical
                            ),
                        criticalWithoutLuck:
                            xpResult
                                ?.bossCriticalWithoutLuck == null
                                ? Boolean(
                                    xpResult?.critical
                                )
                                : Boolean(
                                    xpResult
                                        .bossCriticalWithoutLuck
                                ),
                        userID:
                            message.author.id,
                        now,
                        random
                    }
                );


            return {
                ...combat,
                activeUsers,
                spawned,
                spawnCooldown
            };

        }
    );

}


async function handleCommandXP(
    message,
    commandName,
    earnedXP,
    options = {}
){

    const safeEarnedXP =
        Math.max(
            0,
            Math.floor(
                Number(earnedXP) || 0
            )
        );


    if(
        !message?.guild
        ||
        safeEarnedXP <= 0
    ){
        return null;
    }


    const now =
        Math.max(
            0,
            Math.floor(
                Number(options.now) ||
                Date.now()
            )
        );

    const random =
        typeof options.random === "function"
            ? options.random
            : Math.random;

    const challengeResult =
        await handleChallengeAttack(
            message,
            String(commandName).toLowerCase() === "!roll"
                ? "roll"
                : "command",
            safeEarnedXP,
            {
                now,
                random,
                commandName,
                xpWithoutLuck:
                    safeEarnedXP,
                critical: false,
                criticalWithoutLuck: false
            }
        );


    if(challengeResult){
        return challengeResult;
    }


    return withGuildLock(
        message.guild.id,
        async () => {

            const boss =
                await loadActiveBossLocked(
                    message.guild.id,
                    now
                );


            if(!boss){
                return null;
            }


            const definition =
                getBossDefinition(boss);

            let xpWithoutLuck =
                safeEarnedXP;


            if(
                hasAdvantage(
                    definition,
                    "degeneration"
                )
            ){

                const luckProfile =
                    await luck.getActiveLuckBoost(
                        message.member
                    ).catch(() => null);

                xpWithoutLuck =
                    calculateNeutralCommandXP(
                        safeEarnedXP,
                        luckProfile
                    );

            }


            const combat =
                await applyDamageLocked(
                    boss,
                    {
                        source:
                            String(commandName)
                                .toLowerCase() ===
                                "!roll"
                                ? "roll"
                                : "command",
                        commandName,
                        earnedXP:
                            safeEarnedXP,
                        xpWithoutLuck,
                        critical: false,
                        criticalWithoutLuck: false,
                        userID:
                            message.author.id,
                        now,
                        random
                    }
                );


            return {
                ...combat,
                spawned: false,
                commandName
            };

        }
    );

}


async function cleanupExpiredBosses(
    client = null,
    now = Date.now()
){

    if(typeof client === "number"){
        now = client;
        client = null;
    }


    const expiredBattles =
        await database.expireBossChallengeBattles(
            now
        );


    for(const battle of expiredBattles){

        await database.deleteRaidBossState(
            battle.bossScope,
            battle.spawnedAt
        );


        if(client?.channels?.fetch){

            const channel =
                await client.channels.fetch(
                    battle.channelID
                ).catch(() => null);


            if(channel){

                await channel.send({
                    content:
                        `⏱️ <@${battle.userID}> ran out of time. The enemy despawned, but the challenge stage can be attempted again.`,
                    allowedMentions: {
                        users: [battle.userID]
                    }
                }).catch(() => null);


                require("../utils/channelWork").deleteWhenIdle(channel, "Boss challenge battle expired", 15000);

            }

        }

    }


    const expiredBosses =
        await database.cleanupExpiredRaidBossStates(
            now
        );


    return {
        expiredBattles,
        expiredBosses
    };

}


function getActiveAbilityStatuses(
    boss,
    now = Date.now()
){

    if(!boss){
        return [];
    }


    const stateData =
        ensureStateData(boss);

    const statuses = [];


    if(
        Number(
            stateData.regenerationActiveUntil
        ) > now
    ){
        statuses.push({
            name: "Regeneration",
            expiresAt:
                Number(
                    stateData.regenerationActiveUntil
                )
        });
    }


    if(
        Number(
            stateData.immortalityActiveUntil
        ) > now
    ){
        statuses.push({
            name: "XP Immortality",
            expiresAt:
                Number(
                    stateData.immortalityActiveUntil
                )
        });
    }


    if(
        Number(
            stateData.furyActiveUntil
        ) > now
    ){
        statuses.push({
            name: "Fury",
            expiresAt:
                Number(
                    stateData.furyActiveUntil
                )
        });
    }


    for(const type of [
        "power",
        "durability"
    ]){

        const matching =
            stateData.buffs.filter(
                buff =>
                    buff.type === type
                    &&
                    Number(buff.expiresAt) > now
            );


        if(matching.length > 0){

            statuses.push({
                name:
                    ADVANTAGE_NAMES[type],
                stacks:
                    matching.length,
                expiresAt:
                    Math.max(
                        ...matching.map(
                            buff =>
                                Number(
                                    buff.expiresAt
                                ) || 0
                        )
                    )
            });

        }

    }


    return statuses;

}


module.exports = {
    BOSS_DURATION_MS,
    RAID_BOSS_SPAWN_COOLDOWN_MS,
    ACTIVITY_WINDOW_MS,
    MINIMUM_ACTIVE_USERS,
    ADVANTAGE_NAMES,
    RAID_BOSSES,
    CHALLENGE_ONLY_BOSSES,
    CHALLENGE_BOSSES,
    getBossDefinition,
    getAdvantage,
    hasAdvantage,
    rollBossDefinition,
    rollGuaranteedBossDefinition,
    calculatePrecisionChance,
    calculateNeutralCommandXP,
    getRaidRewardTier,
    getRaidRewardPreview,
    rollRaidRewardBundle,
    formatRaidRewardBundle,
    distributeRaidBossRewards,
    getCurrentBoss,
    spawnGuaranteedBoss,
    createChallengeBossState,
    handleChatXP,
    handleCommandXP,
    cleanupExpiredBosses,
    getActiveAbilityStatuses,
    refreshTimedBossState,
    createBossState
};
