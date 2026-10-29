// Raid and challenge catalogs are deliberately separate. Only RAID_BOSSES can spawn globally.
const ADVANTAGE_NAMES = Object.freeze({
    chatting_immunity: "Chatting Immunity",
    critical_immunity: "Critical Immunity",
    chatting_immortality: "Chatting Immortality",
    critical_immortality: "Critical Immortality",
    regeneration: "Regeneration",
    commands_immunity: "Commands Immunity",
    commands_immortality: "Commands Immortality",
    rolling_immunity: "Rolling Immunity",
    degeneration: "Degeneration",
    power: "Power",
    durability: "Durability",
    xp_immortality: "XP Immortality",
    fury: "Fury",
    precision: "Precision"
});

function defineBoss(category, key, name, act, overall, hp, advantages, info, chancePercent = 0){
    return Object.freeze({
        category, key, name, act, overall, hp, info, chancePercent,
        advantages: Object.freeze(advantages.map(value => {
            const mastered = value.endsWith("*");
            const key = mastered ? value.slice(0, -1) : value;
            if(!ADVANTAGE_NAMES[key]) throw new Error("Unknown boss advantage: " + key);
            return Object.freeze({key, name: ADVANTAGE_NAMES[key], mastered});
        }))
    });
}

const raid = (...args) => defineBoss("raid", ...args);
const challenge = (...args) => defineBoss("challenge", ...args);

const RAID_BOSSES = Object.freeze([
    raid("raid_mrhacker_fp", "Mrhacker FP (with gauntlet)", "Successful Mrhacker's Act",
        43945012, 389002912,
        ["chatting_immunity*", "critical_immunity*", "commands_immunity*", "durability", "xp_immortality*", "degeneration", "fury*", "power"],
        "Mrhacker at his perfected version. Succeeded in getting all of the XP from all beings and killed off the crew with no mercy.", 0.1),
    raid("raid_kape_fp", "Kape FP (with gauntlet)", "Successful Early Act",
        39108883, 603194423,
        ["chatting_immunity*", "critical_immunity", "commands_immortality*", "durability*", "precision", "power*", "fury*"],
        "Kape at his full potential. The true chosen administrator. In this timeline Mrhacker's act never happened: Kape killed Mrhacker and Mizuki. The crew and administrators remained safe.", 0.2),
    raid("raid_mizuki_fp", "Mizuki FP", "Early Act",
        20068545, 174862941,
        ["commands_immortality", "precision*", "regeneration"],
        "Mizuki at her fullest. Mizuki used 100% of her power against Kape with Mrhacker. She is truly a remarkable robot.", 0.5),
    raid("raid_mizuki_broken_fp", "Mizuki FP (broken)", "Successful Mrhacker's Act",
        31745901, 205430625,
        ["commands_immortality*", "precision*", "fury", "regeneration*"],
        "Mizuki at her fullest. Boosted by Mrhacker at the Conclusion Act.", 0.3),
    raid("raid_gorjezz_one_percent", "Gorjezz (1%)", "Early Act",
        50000000, 1000000000,
        ["precision*"],
        "Hmm..... Secretly something beyond a human?", 0.05),
    raid("raid_frampto_fp", "Frampto FP", "Early Act",
        73923015, 782019711,
        ["chatting_immortality", "critical_immortality*", "power*", "precision*"],
        "The right-hand man of thy Great Leader. Frampto using 100% of his power. Trying to keep his multiverse safe from bad little guys like Mrhacker.", 0.1)
]);

const CHALLENGE_BOSSES = Object.freeze([
    challenge("challenge_crew_shadow", "shadow067972", "Early Act",
        754923, 1892405, ["rolling_immunity"],
        "Main member of the crew. shadow067972 with strong and undeniable potential."),
    challenge("challenge_crew_thezdrink", "thezdrink", "Early Act",
        1143274, 2324004, ["critical_immunity", "fury"],
        "Main member of the crew. thezdrink in his early stages. Learning and trying to improve from every mistake in battle."),
    challenge("challenge_crew_gorjezz", "Gorjezz (0.05%)", "Early Act",
        2500000, 5000000, ["precision"],
        "Main member of the crew. Gorjezz is an extremely powerful being, only using 0.05% of her power. The crew doesn't even know how much power she has inside her."),
    challenge("challenge_crew_mrnoob", "Mrnoob", "Early Act",
        4792102, 12834018, ["durability", "fury"],
        "Main member of the crew. Mrnoob in his noobie stage. Considered one of the strongest and tankiest noobs there is right now."),
    challenge("challenge_crew_beyondborder", "beyondborder_08386 (sleepy state)", "Early Act",
        2500000, 30000000, ["precision"],
        "Main member of the crew. beyondborder_08386 in his sleepy state, heavily weakening his power. Definitely has one of the greatest potentials ever."),
    challenge("challenge_crew_kape", "Kape", "Early Act",
        3792224, 11589310, ["durability", "power"],
        "Kape before being selected as an administrator. Strong and durable for a human."),
    challenge("challenge_crew_mizuki", "Mizuki (20%)", "Early Act",
        4013709, 17486294, ["commands_immunity", "precision*"],
        "A bot created by Kape whose sole purpose is to protect the crew and act as a human. Mizuki cannot get physically stronger unless boosted because she's a bot."),

    challenge("challenge_arrival_kdc", "kdc", "Early Act",
        1287005, 932815, [],
        "Uhh... there's not much info about kdc. He just ran away before the Mrhacker act even started."),
    challenge("challenge_arrival_thezdrink", "thezdrink", "Mrhacker's Act",
        4685912, 15002142, ["chatting_immunity", "critical_immunity*", "fury", "power"],
        "Thezdrink's angrier version. Always trying to think of a way out of the situation and be protective. Still thinks there's some good in Mrhacker."),
    challenge("challenge_arrival_shadow", "shadow067972", "Mrhacker's Act",
        4295671, 9505328, ["rolling_immunity*", "durability"],
        "Shadow067972's awakened version. He trained and tries his best to keep peace between the crew and Mrhacker."),
    challenge("challenge_arrival_beyondborder", "beyondborder_08386", "Mrhacker's Act",
        6367244, 112924002, ["precision*", "durability"],
        "Beyondborder_08386's awakening at the early Mrhacker's Act. He wants to stop Mrhacker from destroying everything. Extremely durable and precise in fighting, with the potential to be stronger than an administrator."),
    challenge("challenge_arrival_kape", "Kape (with gauntlet)", "Mrhacker's Act",
        27995012, 197523244, ["commands_immunity*", "degeneration", "durability*", "power*", "fury*", "precision"],
        "Kape fighting to save the crew from both Mrhacker and Mizuki. The chosen Administrator, using the gauntlet Thy Chosen One gave him to protect the multiverse."),
    challenge("challenge_arrival_mizuki", "Mizuki (broken)", "Mrhacker's Act",
        12105992, 74912015, ["commands_immortality", "fury", "precision*", "regeneration"],
        "Kape's bot who's gone insane. Fighting beside Mrhacker to destroy and kill the crew. Boosted by Mrhacker, making her even stronger, more durable and furious."),
    challenge("challenge_arrival_mrhacker", "Mrhacker (with gauntlet)", "Mrhacker's Act",
        30504332, 112004994, ["chatting_immunity", "critical_immunity", "commands_immunity", "durability", "fury*", "xp_immortality"],
        "Mrhacker with the stolen gauntlet. Evolved from a noob to a hacker. His goal is to eliminate the crew and be the ruler of Administrators!"),

    challenge("challenge_conclusion_kape", "Kape (injured)", "Mrhacker's Conclusion Act",
        563912, 2504212, [],
        "Kape's administrator powers were wiped by Mrhacker's snap, leaving him exponentially weaker and injured. He didn't even participate in the final battle. Kape is at his end."),
    challenge("challenge_conclusion_gorjezz", "Gorjezz (0.5%)", "Mrhacker's Conclusion Act",
        25000000, 500000000, ["precision*"],
        "Gorjezz's angrier and more serious version because of what Mrhacker did. Using 0.5% of her power at Mrhacker's Conclusion. Hmmm, interesting, I gotta say."),
    challenge("challenge_conclusion_shadow", "shadow067972", "Mrhacker's Conclusion Act",
        13120872, 84223801, ["rolling_immunity*", "durability*", "power"],
        "shadow067972's power at the limit. Really sad and angry for the crew because of what Mrhacker did. This is their last chance to kill Mrhacker."),
    challenge("challenge_conclusion_thezdrink", "thezdrink", "Mrhacker's Conclusion Act",
        22128374, 314912010, ["chatting_immunity*", "critical_immunity*", "durability", "fury*", "power*", "precision"],
        "Thezdrink's hard-fought battle at Mrhacker's Conclusion Act. He tried everything to kill Mrhacker once and for all."),
    challenge("challenge_conclusion_mrhacker", "Mrhacker (with gauntlet)", "Mrhacker's Conclusion Act",
        54717246, 797423454, ["chatting_immunity", "critical_immunity", "commands_immunity*", "durability*", "fury*", "power", "xp_immortality*"],
        "Mrhacker's fullest and mastered version at his Conclusion Act. Trying to kill off the crew once and for all by snapping his fingers again, making them cease to exist."),
    challenge("challenge_conclusion_frampto", "Frampto", "Mrhacker's Conclusion Act",
        69921002, 702194001, ["chatting_immortality*", "critical_immortality*", "power*", "precision*"],
        "The right-hand man of thy Great Leader. Appeared to help the crew beat Mrhacker at Mrhacker's Conclusion Act."),
    challenge("challenge_conclusion_beyondborder", "beyondborder_08386 (with gauntlet)", "Mrhacker's Conclusion Act",
        100000000, 3000000000, ["commands_immunity", "precision*", "durability*", "power"],
        "Beyondborder_08386's last battle at Mrhacker's Conclusion Act. Wielded all of the Infinity Stones to kill Mrhacker and Mizuki. beyondborder_08386 will always be remembered as a legend.")
]);

// Each boost tuple is [boostType, tier, allowed quantities]. Reward sets are
// independent per contributor; premium winners do not also receive the rest set.
const RAID_REWARDS = {
    raid_mrhacker_fp: {
        top: {shards: 100000, boosts: [["luck", "omega", [2, 3, 4]]]},
        rest: {shards: 10000, boosts: [["luck", "omega", [1]]]}
    },
    raid_kape_fp: {
        top: {shards: 80000, guaranteedJackpots: 1, boosts: [["luck", "omega", [3]], ["xp", "infinity", [3, 6, 9]], ["rune", "tier3", [5, 10, 20]]]},
        rest: {shards: 8000, boosts: [["xp", "infinity", [1, 2]], ["rune", "tier3", [1, 2, 3]]]}
    },
    raid_mizuki_fp: {
        top: {shards: 50000, multiHours: [12, 18], freeUpgradeTokens: 1},
        rest: {shards: 5000, multiHours: [12, 18]}
    },
    raid_mizuki_broken_fp: {
        top: {shards: 75000, boosts: [["luck", "tier3", [100]]], multiHours: [12, 18], freeUpgradeTokens: 1},
        rest: {shards: 7500, multiHours: [12, 18]}
    },
    raid_gorjezz_one_percent: {
        top: {shards: 1000000},
        rest: {shards: 100000}
    },
    raid_frampto_fp: {
        top: {shards: 125000, boosts: [["luck", "max", [20, 25, 30]], ["xp", "max", [25, 30, 35]]]},
        rest: {shards: 12500, boosts: [["luck", "max", [5, 10]], ["xp", "max", [7, 11]]]}
    }
};

module.exports = {ADVANTAGE_NAMES, RAID_BOSSES, CHALLENGE_BOSSES, RAID_REWARDS};

