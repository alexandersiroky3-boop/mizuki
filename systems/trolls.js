const database = require("../database");


const TROLL_DURATION = 60 * 60 * 1000;
const LUCK_TRANSFER_DURATION = 5 * 60 * 1000;


const EFFECTS = Object.freeze({
    CHAT_REDUCTION: "chat_reduction",
    ROLL_NEGATIVE: "roll_negative",
    CRITICAL_HALF: "critical_half",
    CHAT_ZERO: "chat_zero",
    MESSAGE_MOG: "message_mog",
    STEAL_BACKFIRE: "steal_backfire",
    MESSAGE_FART: "message_fart",
    KISS_SHARE: "kiss_share",
    CHAT_REDIRECT: "chat_redirect",
    EZWIN_REFLECT: "ezwin_reflect",
    ROLL_REDIRECT: "roll_redirect",
    CRITICAL_FAIL: "critical_fail",
    LUCK_TRANSFER: "luck_transfer",
    IMMEDIATE_TRANSFER: "immediate_transfer",
    IMMEDIATE_LOSS: "immediate_loss"
});


const CHAT_EFFECT_TYPES = new Set([
    EFFECTS.CHAT_REDUCTION,
    EFFECTS.CRITICAL_HALF,
    EFFECTS.CHAT_ZERO,
    EFFECTS.CHAT_REDIRECT,
    EFFECTS.CRITICAL_FAIL
]);


const ROLL_EFFECT_TYPES = new Set([
    EFFECTS.ROLL_NEGATIVE,
    EFFECTS.ROLL_REDIRECT
]);


function randomInteger(min, max, random = Math.random){

    const low = Math.ceil(Number(min));
    const high = Math.floor(Number(max));

    return Math.floor(
        random() * (high - low + 1)
    ) + low;

}


function pickRandom(values, random = Math.random){

    if(!Array.isArray(values) || values.length === 0){
        return undefined;
    }

    return values[
        Math.min(
            values.length - 1,
            Math.floor(random() * values.length)
        )
    ];

}


function rollTrollRarity(random = Math.random){

    const roll = random();

    if(roll < 0.60){
        return "common";
    }

    if(roll < 0.745){
        return "rare";
    }

    if(roll < 0.755){
        return "legendary";
    }

    return "failed";

}


function getLevelRange(level, below100, level100Plus){
    return Number(level) >= 100
        ? level100Plus
        : below100;
}


function createEffectDefinition(
    rarity,
    level,
    random = Math.random,
    allowedEffectTypes = null
){

    const definitions = {
        common: [
            () => {
                const total = pickRandom([10, 20, 25], random);
                return {
                    effectType: EFFECTS.CHAT_REDUCTION,
                    payload: {
                        percent: pickRandom([10, 15, 25], random),
                        total,
                        remaining: total
                    }
                };
            },
            () => ({
                effectType: EFFECTS.ROLL_NEGATIVE,
                payload: {total: 1, remaining: 1}
            }),
            () => ({
                effectType: EFFECTS.CRITICAL_HALF,
                payload: {total: 1, remaining: 1}
            }),
            () => ({
                effectType: EFFECTS.CHAT_ZERO,
                payload: {total: 5, remaining: 5}
            }),
            () => {
                const [min, max] = getLevelRange(
                    level,
                    [10000, 25000],
                    [25000, 100000]
                );
                return {
                    effectType: EFFECTS.MESSAGE_MOG,
                    payload: {min, max}
                };
            }
        ],
        rare: [
            () => {
                const total = pickRandom([10, 20, 25], random);
                return {
                    effectType: EFFECTS.CHAT_REDUCTION,
                    payload: {
                        percent: pickRandom([50, 75], random),
                        total,
                        remaining: total
                    }
                };
            },
            () => {
                const total = pickRandom([2, 4, 6], random);
                return {
                    effectType: EFFECTS.ROLL_NEGATIVE,
                    payload: {total, remaining: total}
                };
            },
            () => ({
                effectType: EFFECTS.STEAL_BACKFIRE,
                payload: {total: 1, remaining: 1}
            }),
            () => {
                const [min, max] = getLevelRange(
                    level,
                    [25000, 50000],
                    [50000, 150000]
                );
                return {
                    effectType: EFFECTS.MESSAGE_FART,
                    payload: {min, max}
                };
            },
            () => ({
                effectType: EFFECTS.KISS_SHARE,
                payload: {total: 1, remaining: 1}
            })
        ],
        legendary: [
            () => {
                const total = pickRandom([25, 40, 50], random);
                return {
                    effectType: EFFECTS.CHAT_REDIRECT,
                    payload: {total, remaining: total}
                };
            },
            () => ({
                effectType: EFFECTS.EZWIN_REFLECT,
                payload: {total: 1, remaining: 1}
            }),
            () => ({
                effectType: EFFECTS.ROLL_REDIRECT,
                payload: {total: 5, remaining: 5}
            }),
            () => ({
                effectType: EFFECTS.CRITICAL_FAIL,
                payload: {total: 1, remaining: 1}
            }),
            () => ({
                effectType: EFFECTS.LUCK_TRANSFER,
                payload: {activated: false}
            })
        ],
        failed: [
            () => {
                const [min, max] = getLevelRange(
                    level,
                    [25000, 50000],
                    [100000, 250000]
                );
                return {
                    effectType: EFFECTS.IMMEDIATE_TRANSFER,
                    payload: {amount: randomInteger(min, max, random)}
                };
            },
            () => ({
                effectType: EFFECTS.CHAT_REDIRECT,
                payload: {total: 10, remaining: 10}
            }),
            () => ({
                effectType: EFFECTS.CRITICAL_FAIL,
                payload: {total: 1, remaining: 1}
            }),
            () => {
                const [min, max] = getLevelRange(
                    level,
                    [50000, 125000],
                    [250000, 400000]
                );
                return {
                    effectType: EFFECTS.IMMEDIATE_LOSS,
                    payload: {amount: randomInteger(min, max, random)}
                };
            },
            () => ({
                effectType: EFFECTS.ROLL_NEGATIVE,
                payload: {total: 10, remaining: 10}
            })
        ]
    };


    let pool = definitions[String(rarity)] || [];

    if(allowedEffectTypes){
        const allowed = new Set(allowedEffectTypes);

        if(String(rarity) === "failed"){
            const failedIndexes = {
                [EFFECTS.IMMEDIATE_TRANSFER]: 0,
                [EFFECTS.CHAT_REDIRECT]: 1,
                [EFFECTS.CRITICAL_FAIL]: 2,
                [EFFECTS.IMMEDIATE_LOSS]: 3,
                [EFFECTS.ROLL_NEGATIVE]: 4
            };

            pool = Array.from(allowed)
                .map(type => definitions.failed[failedIndexes[type]])
                .filter(Boolean);
        }
    }


    const factory = pickRandom(pool, random);
    return factory ? factory() : null;

}


async function hasActiveEffect(guildID, userID){
    return Boolean(
        await database.getActiveTrollEffect(
            guildID,
            userID
        )
    );
}


async function createTrollAttempt({
    guildID,
    actorID,
    targetID,
    actorLevel,
    targetLevel,
    random = Math.random
}){

    const rarity = rollTrollRarity(random);
    const now = Date.now();


    if(rarity !== "failed"){

        const definition = createEffectDefinition(
            rarity,
            targetLevel,
            random
        );

        const effect = await database.createTrollEffect({
            guildID,
            sourceUserID: actorID,
            targetUserID: targetID,
            rarity,
            effectType: definition.effectType,
            payload: definition.payload,
            createdAt: now,
            expiresAt: now + TROLL_DURATION
        });

        if(!effect){
            return {success: false, status: "target-active"};
        }


        if(definition.effectType === EFFECTS.LUCK_TRANSFER){

            const currentLuck = await database.getLuckBoost(
                guildID,
                targetID
            );

            if(
                currentLuck
                && Number(currentLuck.expiresat) > now
                && currentLuck.role
            ){
                const activeUntil = now + LUCK_TRANSFER_DURATION;
                const activated = await database.activateTrollLuckTransfer(
                    effect.id,
                    currentLuck.role,
                    activeUntil
                );

                if(activated){
                    return {
                        success: true,
                        rarity,
                        effect: activated,
                        changedUserIDs: []
                    };
                }
            }

        }


        return {
            success: true,
            rarity,
            effect,
            changedUserIDs: []
        };

    }


    const actorAlreadyAffected = await hasActiveEffect(
        guildID,
        actorID
    );

    const definition = createEffectDefinition(
        "failed",
        actorLevel,
        random,
        actorAlreadyAffected
            ? [
                EFFECTS.IMMEDIATE_TRANSFER,
                EFFECTS.IMMEDIATE_LOSS
            ]
            : null
    );


    if(definition.effectType === EFFECTS.IMMEDIATE_TRANSFER){

        const amount = await database.applyTrollXPTransfer(
            guildID,
            actorID,
            targetID,
            definition.payload.amount
        );

        return {
            success: true,
            rarity,
            immediate: true,
            effectType: definition.effectType,
            amount,
            publicDescription:
                `The troll backfired: <@${actorID}> lost **${amount.toLocaleString()} XP**, and <@${targetID}> received it.`,
            changedUserIDs: [actorID, targetID]
        };

    }


    if(definition.effectType === EFFECTS.IMMEDIATE_LOSS){

        const amount = await database.applyTrollXPLoss(
            guildID,
            actorID,
            definition.payload.amount
        );

        return {
            success: true,
            rarity,
            immediate: true,
            effectType: definition.effectType,
            amount,
            publicDescription:
                `<@${targetID}> mogged <@${actorID}>, making them lose **${amount.toLocaleString()} XP**.`,
            changedUserIDs: [actorID]
        };

    }


    const effect = await database.createTrollEffect({
        guildID,
        sourceUserID: targetID,
        targetUserID: actorID,
        rarity,
        effectType: definition.effectType,
        payload: definition.payload,
        createdAt: now,
        expiresAt: now + TROLL_DURATION
    });


    if(!effect){
        // A simultaneous command may have added an effect to the actor. Use
        // an immediate backfire so the command still resolves atomically.
        const fallback = createEffectDefinition(
            "failed",
            actorLevel,
            random,
            [EFFECTS.IMMEDIATE_TRANSFER, EFFECTS.IMMEDIATE_LOSS]
        );

        if(fallback.effectType === EFFECTS.IMMEDIATE_TRANSFER){
            const amount = await database.applyTrollXPTransfer(
                guildID,
                actorID,
                targetID,
                fallback.payload.amount
            );
            return {
                success: true,
                rarity,
                immediate: true,
                effectType: fallback.effectType,
                amount,
                publicDescription:
                    `The troll backfired: <@${actorID}> lost **${amount.toLocaleString()} XP**, and <@${targetID}> received it.`,
                changedUserIDs: [actorID, targetID]
            };
        }

        const amount = await database.applyTrollXPLoss(
            guildID,
            actorID,
            fallback.payload.amount
        );
        return {
            success: true,
            rarity,
            immediate: true,
            effectType: fallback.effectType,
            amount,
            publicDescription:
                `<@${targetID}> mogged <@${actorID}>, making them lose **${amount.toLocaleString()} XP**.`,
            changedUserIDs: [actorID]
        };
    }


    const descriptions = {
        [EFFECTS.CHAT_REDIRECT]:
            `Your next **10 chat XP rewards** will go to <@${targetID}> instead.`,
        [EFFECTS.CRITICAL_FAIL]:
            "Your next chat critical is guaranteed to fail.",
        [EFFECTS.ROLL_NEGATIVE]:
            "Your next **10 rolls** are guaranteed to be negative."
    };

    return {
        success: true,
        rarity,
        effect,
        publicDescription: descriptions[definition.effectType],
        changedUserIDs: []
    };

}


async function getEffectByType(guildID, userID, effectTypes){

    const effect = await database.getActiveTrollEffect(
        guildID,
        userID
    );

    if(!effect){
        return null;
    }

    const allowed = effectTypes instanceof Set
        ? effectTypes
        : new Set(effectTypes);

    return allowed.has(effect.effectType)
        ? effect
        : null;

}


async function getChatEffect(guildID, userID){
    return getEffectByType(
        guildID,
        userID,
        CHAT_EFFECT_TYPES
    );
}


function resolveChatEffect(effect, earnedXP){

    const safeXP = Math.max(
        0,
        Math.floor(Number(earnedXP) || 0)
    );

    if(!effect){
        return {targetXP: safeXP, redirectedXP: 0};
    }

    if(effect.effectType === EFFECTS.CHAT_REDUCTION){
        const percent = Math.max(
            0,
            Math.min(100, Number(effect.payload.percent) || 0)
        );
        return {
            targetXP: Math.floor(safeXP * (1 - percent / 100)),
            redirectedXP: 0
        };
    }

    if(effect.effectType === EFFECTS.CHAT_ZERO){
        return {targetXP: 0, redirectedXP: 0};
    }

    if(effect.effectType === EFFECTS.CHAT_REDIRECT){
        return {targetXP: 0, redirectedXP: safeXP};
    }

    return {targetXP: safeXP, redirectedXP: 0};

}


async function consumeCountedEffect(effect){

    if(!effect){
        return null;
    }

    const payload = {...effect.payload};
    const current = Math.max(
        1,
        Number(payload.remaining) || 1
    );
    payload.remaining = current - 1;

    return database.updateTrollEffect(
        effect.id,
        payload,
        payload.remaining <= 0
    );

}


async function consumeChatEffect(effect){
    return consumeCountedEffect(effect);
}


async function getRollEffect(guildID, userID){
    return getEffectByType(
        guildID,
        userID,
        ROLL_EFFECT_TYPES
    );
}


async function consumeRollEffect(effect){
    return consumeCountedEffect(effect);
}


async function getCommandEffect(
    guildID,
    userID,
    effectType
){
    return getEffectByType(
        guildID,
        userID,
        [effectType]
    );
}


async function completeEffect(effect){
    if(!effect){
        return null;
    }
    return database.completeTrollEffect(
        effect.id,
        effect.payload
    );
}


async function applyStealBackfire(
    guildID,
    userID,
    reward
){

    const effect = await getCommandEffect(
        guildID,
        userID,
        EFFECTS.STEAL_BACKFIRE
    );

    if(!effect){
        return null;
    }

    const amount = await database.applyTrollXPLoss(
        guildID,
        userID,
        reward
    );

    await database.completeTrollEffect(
        effect.id,
        {
            ...effect.payload,
            actualLoss: amount
        }
    );

    return {effect, amount};

}


async function applyKissShare(
    guildID,
    userID,
    reward
){

    const effect = await getCommandEffect(
        guildID,
        userID,
        EFFECTS.KISS_SHARE
    );

    if(!effect){
        return null;
    }

    const amount = Math.max(
        0,
        Math.floor(Number(reward) || 0)
    );

    if(amount > 0){
        await database.giveXP(
            guildID,
            effect.sourceUserID,
            amount
        );
    }

    await database.completeTrollEffect(
        effect.id,
        {
            ...effect.payload,
            sharedXP: amount
        }
    );

    return {
        effect,
        amount,
        sourceUserID: effect.sourceUserID
    };

}


async function activatePendingLuckTransfer(
    guildID,
    userID,
    roleID
){

    const effect = await getCommandEffect(
        guildID,
        userID,
        EFFECTS.LUCK_TRANSFER
    );

    if(!effect || effect.payload.activated){
        return null;
    }

    return database.activateTrollLuckTransfer(
        effect.id,
        roleID,
        Date.now() + LUCK_TRANSFER_DURATION
    );

}


async function getLuckModifiers(guildID, userID){

    const effects = await database.getActiveTrollLuckModifiers(
        guildID,
        userID
    );

    let suppressed = false;
    const bonusRoleIDs = [];

    for(const effect of effects){
        if(effect.targetUserID === String(userID)){
            suppressed = true;
        }
        if(
            effect.sourceUserID === String(userID)
            && effect.payload.roleID
        ){
            bonusRoleIDs.push(String(effect.payload.roleID));
        }
    }

    return {
        suppressed,
        bonusRoleIDs: Array.from(new Set(bonusRoleIDs)),
        effects
    };

}


function describeCompletedEffect(effect){

    const p = effect.payload || {};
    const descriptions = {
        [EFFECTS.CHAT_REDUCTION]:
            `earned **${p.percent}% less chat XP** for **${p.total} chat XP rewards**`,
        [EFFECTS.ROLL_NEGATIVE]:
            `had **${p.total} roll${Number(p.total) === 1 ? "" : "s"}** forced negative`,
        [EFFECTS.CRITICAL_HALF]:
            "had their next chat critical chance cut in half",
        [EFFECTS.CHAT_ZERO]:
            `earned **0 XP** from **${p.total} chat XP rewards**`,
        [EFFECTS.MESSAGE_MOG]:
            `got mogged and lost **${Number(p.actualLoss || 0).toLocaleString()} XP**`,
        [EFFECTS.STEAL_BACKFIRE]:
            `had a successful **!steal** backfire for **${Number(p.actualLoss || 0).toLocaleString()} XP**`,
        [EFFECTS.MESSAGE_FART]:
            `got farted on and lost **${Number(p.actualLoss || 0).toLocaleString()} XP**`,
        [EFFECTS.KISS_SHARE]:
            `made their troller earn **${Number(p.sharedXP || 0).toLocaleString()} XP** from their next successful **!kiss**`,
        [EFFECTS.CHAT_REDIRECT]:
            `redirected **${p.total} chat XP rewards** to their troller`,
        [EFFECTS.EZWIN_REFLECT]:
            "had their next **!ezwin** reflected onto their troller",
        [EFFECTS.ROLL_REDIRECT]:
            `redirected **${p.total} rolls** to their troller`,
        [EFFECTS.CRITICAL_FAIL]:
            "had their next chat critical guaranteed to fail",
        [EFFECTS.LUCK_TRANSFER]:
            "lost the effect of a Luck Boost while their troller stole it for **5 minutes**"
    };

    return descriptions[effect.effectType]
        || "received a secret troll effect";

}


async function revealCompletedEffects(
    message,
    preparedPending = null
){

    const pending = preparedPending
        || await database.getPendingTrollReveals(
            message.guild.id,
            message.author.id
        );

    if(pending.length === 0){
        return [];
    }

    const lines = pending.map(effect =>
        `🎭 <@${effect.sourceUserID}>'s troll was revealed: <@${effect.targetUserID}> ${describeCompletedEffect(effect)}.`
    );

    await message.reply({
        content: lines.join("\n"),
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });

    await database.markTrollEffectsRevealed(
        pending.map(effect => effect.id)
    );

    return pending;

}


async function triggerMessageEffect(
    message,
    preparedEffect = undefined
){

    const effect = preparedEffect === undefined
        ? await database.getActiveTrollEffect(
            message.guild.id,
            message.author.id
        )
        : preparedEffect;

    if(
        !effect
        || ![
            EFFECTS.MESSAGE_MOG,
            EFFECTS.MESSAGE_FART
        ].includes(effect.effectType)
    ){
        return null;
    }

    const requested = randomInteger(
        effect.payload.min,
        effect.payload.max
    );
    const actualLoss = await database.applyTrollXPLoss(
        message.guild.id,
        message.author.id,
        requested
    );

    const payload = {
        ...effect.payload,
        actualLoss
    };

    const content = effect.effectType === EFFECTS.MESSAGE_MOG
        ? `*"HA! I mog..." Mizuki says as she takes **${actualLoss.toLocaleString()} XP** from <@${message.author.id}>!*`
        : `*Mizuki farts on <@${message.author.id}>, making them lose **${actualLoss.toLocaleString()} XP**.*`;

    await database.completeTrollEffect(
        effect.id,
        payload
    );

    await message.reply({
        content,
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });

    return {
        effect,
        actualLoss,
        changedUserIDs: [message.author.id]
    };

}


async function handleMessageStart(message){

    if(!message.guild || message.author?.bot){
        return {changedUserIDs: []};
    }

    const changedUserIDs = [];

    let state;

    try{
        state = await database.getTrollMessageState(
            message.guild.id,
            message.author.id
        );
    }
    catch(error){
        console.error("Could not load troll message state:", error);
        return {changedUserIDs};
    }

    try{
        await revealCompletedEffects(
            message,
            state.pending
        );
    }
    catch(error){
        console.error("Could not reveal completed troll effect:", error);
    }

    try{
        const triggered = await triggerMessageEffect(
            message,
            state.active
        );
        if(triggered){
            changedUserIDs.push(...triggered.changedUserIDs);
        }
    }
    catch(error){
        console.error("Could not trigger troll message effect:", error);
    }

    return {
        changedUserIDs: Array.from(new Set(changedUserIDs))
    };

}


module.exports = {
    EFFECTS,
    TROLL_DURATION,
    LUCK_TRANSFER_DURATION,
    randomInteger,
    pickRandom,
    rollTrollRarity,
    createEffectDefinition,
    hasActiveEffect,
    createTrollAttempt,
    getChatEffect,
    resolveChatEffect,
    consumeChatEffect,
    getRollEffect,
    consumeRollEffect,
    getCommandEffect,
    completeEffect,
    applyStealBackfire,
    applyKissShare,
    activatePendingLuckTransfer,
    getLuckModifiers,
    describeCompletedEffect,
    revealCompletedEffects,
    triggerMessageEffect,
    handleMessageStart
};
