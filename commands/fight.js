const database = require("../database");
const leveling = require("../systems/leveling");
const luck = require("../utils/luck");
const quests = require("../systems/quests");
const boosts = require("../systems/boosts");


// =====================================================
// SETTINGS
// =====================================================

const FIGHT_COOLDOWN_MS =
    3 * 60 * 60 * 1000;


const BOT_NAMES =
    new Set([
        "bot",
        "mizuki"
    ]);


const FIGHT_RESULT_CHANCES =
    Object.freeze({
        win: 84.9,
        loss: 15,
        draw: 0.1
    });


const FIGHT_RARITIES =
    Object.freeze([
        Object.freeze({
            key: "common",
            label: "COMMON",
            minXP: 250000,
            maxXP: 1500000,
            lossMultiplier: 0.90
        }),
        Object.freeze({
            key: "uncommon",
            label: "UNCOMMON",
            minXP: 1500000,
            maxXP: 3000000,
            lossMultiplier: 0.90
        }),
        Object.freeze({
            key: "rare",
            label: "RARE",
            minXP: 3000000,
            maxXP: 12000000,
            lossMultiplier: 0.90
        }),
        Object.freeze({
            key: "epic",
            label: "EPIC",
            minXP: 12000000,
            maxXP: 25000000,
            lossMultiplier: 0.95
        }),
        Object.freeze({
            key: "legendary",
            label: "LEGENDARY",
            minXP: 25000000,
            maxXP: 75000000,
            lossMultiplier: 1.05
        }),
        Object.freeze({
            key: "mythic",
            label: "MYTHIC",
            minXP: 75000000,
            maxXP: 200000000,
            lossMultiplier: 1.20
        }),
        Object.freeze({
            key: "cosmic",
            label: "COSMIC",
            minXP: 200000000,
            maxXP: 1000000000,
            lossMultiplier: 1.20
        })
    ]);


const RARITY_BY_KEY =
    new Map(
        FIGHT_RARITIES.map(rarity => [
            rarity.key,
            rarity
        ])
    );


// The user's base values total 99.99%. The unassigned 0.01% is added to
// Common so none of the rare chances need to be changed.
const FIGHT_RARITY_CHANCES =
    Object.freeze({
        none: Object.freeze({
            common: 75.01,
            uncommon: 20,
            rare: 3.889,
            epic: 0.9,
            legendary: 0.15,
            mythic: 0.05,
            cosmic: 0.001
        }),
        tier1: Object.freeze({
            common: 70,
            uncommon: 23,
            rare: 5.5,
            epic: 1.173,
            legendary: 0.25,
            mythic: 0.075,
            cosmic: 0.002
        }),
        tier2: Object.freeze({
            common: 62,
            uncommon: 28,
            rare: 8,
            epic: 1.345,
            legendary: 0.5,
            mythic: 0.15,
            cosmic: 0.005
        }),
        tier3: Object.freeze({
            common: 50,
            uncommon: 32,
            rare: 14,
            epic: 2.64,
            legendary: 1,
            mythic: 0.35,
            cosmic: 0.01
        }),
        max: Object.freeze({
            common: 35,
            uncommon: 33,
            rare: 23,
            epic: 5.225,
            legendary: 3,
            mythic: 0.75,
            cosmic: 0.025
        }),
        omega: Object.freeze({
            common: 10,
            uncommon: 20,
            rare: 32,
            epic: 20.564285714285713,
            legendary: 14.285714285714286,
            mythic: 3,
            cosmic: 0.15
        })
    });


for(const [tier, chances] of Object.entries(FIGHT_RARITY_CHANCES)){

    const total =
        Object.values(chances)
            .reduce(
                (sum, chance) =>
                    sum + Number(chance),
                0
            );


    if(Math.abs(total - 100) > 0.000001){

        throw new Error(
            `Fight rarity chances for ${tier} total ${total}, not 100.`
        );

    }

}


function clampRandom(randomValue){

    return Math.max(
        0,
        Math.min(
            0.999999999999,
            Number(randomValue) || 0
        )
    );

}


function getLuckTier(profile){

    const tier =
        String(profile?.tier || "")
            .toLowerCase();


    return Object.hasOwn(
        FIGHT_RARITY_CHANCES,
        tier
    )
        ? tier
        : "none";

}


function getFightRarityTable(profile = null){

    const chances =
        FIGHT_RARITY_CHANCES[
            getLuckTier(profile)
        ];


    return FIGHT_RARITIES.map(rarity => ({
        ...rarity,
        chancePercent:
            chances[rarity.key]
    }));

}


function rollFightRarity(
    profile = null,
    random = Math.random
){

    let position =
        clampRandom(random()) * 100;


    for(const rarity of getFightRarityTable(profile)){

        position -= rarity.chancePercent;


        if(position < 0){
            return rarity;
        }

    }


    return FIGHT_RARITIES[
        FIGHT_RARITIES.length - 1
    ];

}


function rollFightResult(random = Math.random){

    const position =
        clampRandom(random()) * 100;


    if(position < FIGHT_RESULT_CHANCES.draw){
        return "draw";
    }


    if(
        position <
        FIGHT_RESULT_CHANCES.draw +
            FIGHT_RESULT_CHANCES.loss
    ){
        return "loss";
    }


    return "win";

}


function getCustomEmoji(
    guild,
    name,
    fallback
){

    const emoji =
        guild?.emojis?.cache?.find?.(
            entry => entry.name === name
        );


    return emoji
        ? emoji.toString()
        : fallback;

}


function getFightEmojis(guild){

    return {
        commonFist:
            getCustomEmoji(
                guild,
                "common_fist",
                "👊"
            ),
        halfGoldenFist:
            getCustomEmoji(
                guild,
                "half_golden_fist",
                "✨👊"
            ),
        goldenFist:
            getCustomEmoji(
                guild,
                "golden_fist",
                "🌟👊"
            ),
        mythicFist:
            getCustomEmoji(
                guild,
                "mythic_fist",
                "🌌👊"
            ),
        cosmicFist:
            getCustomEmoji(
                guild,
                "cosmic_fist",
                "☄️👊"
            ),
        fightCloud:
            getCustomEmoji(
                guild,
                "fight_cloud",
                "💥"
            ),
        stackedMoney:
            getCustomEmoji(
                guild,
                "stacked_money",
                "💵"
            ),
        inevitableGalaxy:
            getCustomEmoji(
                guild,
                "inevitable_galaxy",
                "🌌"
            ),
        evolvedCommonLeaf:
            getCustomEmoji(
                guild,
                "evolved_common_leaf",
                ":evolved_common_leaf:"
            )
    };

}


function formatXP(amount){

    return Math.max(
        0,
        Math.floor(
            Math.abs(Number(amount) || 0)
        )
    ).toLocaleString();

}


function formatLossRelationship(multiplier){

    const difference =
        Math.round(
            Math.abs(
                Number(multiplier) - 1
            ) * 100
        );


    if(difference === 0){
        return "the same as the winner's XP";
    }


    return Number(multiplier) < 1
        ? `${difference}% less than the winner's XP`
        : `${difference}% more than the winner's XP`;

}


function splitLongMessage(
    content,
    maxLength = 1900
){

    const normalized =
        String(content || "")
            .replace(/\r\n/g, "\n");

    const chunks = [];
    let remaining = normalized;


    while(remaining.length > maxLength){

        let splitAt =
            remaining.lastIndexOf(
                "\n\n",
                maxLength
            );


        if(splitAt < Math.floor(maxLength * 0.45)){

            splitAt =
                remaining.lastIndexOf(
                    "\n",
                    maxLength
                );

        }


        if(splitAt < Math.floor(maxLength * 0.45)){

            splitAt =
                remaining.lastIndexOf(
                    " ",
                    maxLength
                );

        }


        if(splitAt <= 0){
            splitAt = maxLength;
        }


        chunks.push(
            remaining.slice(0, splitAt)
        );

        remaining =
            remaining.slice(splitAt)
                .replace(/^\s+/, "");

    }


    if(remaining){
        chunks.push(remaining);
    }


    return chunks;

}


async function sendLongDialogue(
    channel,
    content,
    allowedUserIDs = []
){

    const chunks =
        splitLongMessage(content);

    let sentMessage = null;


    for(
        let index = 0;
        index < chunks.length;
        index++
    ){

        sentMessage =
            await channel.send({
                content:
                    chunks[index],
                allowedMentions: {
                    users:
                        index === 0
                            ? allowedUserIDs
                            : [],
                    repliedUser: false
                }
            });

    }


    return sentMessage;

}


function renderStory(
    template,
    fighter,
    target
){

    return String(template || "")
        .replaceAll(
            "@user2",
            `<@${target.id}>`
        )
        .replaceAll(
            "@user",
            `<@${fighter.id}>`
        );

}


function getRarityHeader(
    rarity,
    evolved,
    emojis
){

    const config = {
        common: [emojis.commonFist, "🌿"],
        uncommon: [emojis.commonFist, "🍃"],
        rare: [emojis.commonFist, "💫"],
        epic: [emojis.halfGoldenFist, "✨"],
        legendary: [emojis.goldenFist, "🌠"],
        mythic: [emojis.mythicFist, "🌃"],
        cosmic: [
            emojis.cosmicFist,
            emojis.inevitableGalaxy
        ]
    }[rarity.key];


    const evolvedLabel =
        evolved
            ? ` ${emojis.evolvedCommonLeaf} **(EVOLVED)**`
            : "";


    return `${config[0]} **${rarity.label}**${evolvedLabel} ${config[1]}`;

}


function formatCooldown(milliseconds){

    const expiresAt =
        Math.ceil(
            (Date.now() + milliseconds) /
            1000
        );


    return `<t:${expiresAt}:R>`;

}


// =====================================================
// STORY DIALOGUES
// =====================================================

const COMMON_FIGHT_STORY = String.raw`*@user & @user2 were in the midst of a fight. They argued about Kape and Mrhacker and who was stronger...

The argument went so far that they ended up fighting.

@user landed a hard kick to @user2's rib cage, sending them crashing into a nearby tree—which caused the tree to fall onto the crew's apartment.

@user2 tanked the hit and the crash...

@user2 then ran at @user with incredible speed.

@user tried punching @user2 in the head. @user2 precisely dodged the incoming attack and counterattacked with a high uppercut to @user's jawline...

But @user saw it coming and grabbed @user2's punch, stopping it with force.

@user then used the other hand to heavily punch @user2 in the face several times while still holding @user2's hand...

making @user2 fall to the ground, heavily bleeding from the nose and mouth...*`;


const RARE_FIGHT_STORY = String.raw`### Kape VS @user & @user2

*beyondborder_08386 and kdc were still working on the teleportation gun until they finally finished it...*

*beyondborder_08386 grabbed the teleportation gun in his hands and, with a slight smile and joy, said:*

"It's finished!.."

*kdc watched beyondborder_08386 with a slight smile as well...

Kape, thezdrink and gorjezz were almost finished fixing the whole apartment after the earlier big incident that was still not sorted out...

beyondborder_08386 was about to use the teleportation gun and travel to Mrhacker, Mizuki and especially user3—but before he could, a huge tree crashed into the apartment, breaking everything that Kape, thezdrink and gorjezz were fixing...

Kape gritted his teeth and, in anguish, walked next to the tree and looked outside at @user and @user2.*

"You...?! You did that?! RAAAH!" *Kape screamed as he jumped from the apartment and stared both of them down.*

*@user2 got up from the ground, still bleeding heavily from the nose and mouth...

Kape flew at them and delivered a heavy punch to @user.

@user saw it coming and blocked it—but strangely tilted their head, sensing that Kape's punch was much weaker than it used to be...

@user2 tried to counterattack Kape with a kick, but Kape dodged by jumping backwards into the air. Kape flew at @user again, this time landing a kick into @user's stomach...

@user groaned in pain and spat out blood while crashing through a house and all the way into a tree...

@user2 charged at Kape and tried a sweep kick. Kape blocked it with his leg, then sent a storm of fast, heavy punches into @user2's stomach...

@user tried to save @user2 by kicking Kape away, but Kape saw it coming, grabbed @user2 by the hand and threw @user2 directly at @user—causing both of them to fall over one another...

Kape walked closer. Even without his administrator powers, he was still incredibly strong...

@user and @user2 were both bleeding, but they managed to get up. As Kape approached, both of them powered up.*

"AAAAAAAAAAAAAAAAAAAAAAAAAAAH!" *@user and @user2 screamed.*

*A white aura surrounded them both...

Then @user and @user2 charged two beams and fired them at Kape.

The beams collided, becoming exponentially bigger and stronger...

Kape stopped walking and caught the combined, white-glowing beam with both hands.

Kape groaned as the beam pushed him farther and farther back.*

"aaaaaaaaaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAR!!" *@user and @user2 screamed as they powered up even further, reaching their absolute limits.*

*The beam grew wider, bigger and stronger...

Kape's eyes widened. He screamed in pain before his hands finally failed to contain it, making all of the surroundings EXPLODE!...*`;


const EPIC_FIGHT_STORY = String.raw`### Shadow067972's origin

*Thezdrink, shadow067972 and @user were walking, chatting and giggling...

Until three random guys appeared in front of them...

thezdrink, shadow067972 and @user looked at one another, then back at the strangers in confusion.*

"Give me all of your XP—or else..." *said the first stranger, Mrnoob.*

*Back then Mrnoob, beyondborder_08386 and @user2 stole from other people. Since thezdrink, shadow067972 and @user were strangers to them, they looked like their next targets...

But beyondborder_08386 did not like being evil or stealing power from innocent people—not that he told Mrnoob that.*

"Well, we refuse..." *@user said calmly as thezdrink and shadow067972 nodded.*

*beyondborder_08386 looked at Mrnoob and @user2, waiting to see what they would do. Mrnoob stepped forward.*

"I am more capable than both of YOU noobs...." *Mrnoob said confidently.*

*thezdrink became angry and ran at Mrnoob, trying to punch him in the face.

Mrnoob trapped thezdrink's punch in his armpit and threw him to the ground.

When thezdrink recovered and tried to kick Mrnoob in the torso, @user2 stepped in and kicked thezdrink away.*

"HEY!" *@user screamed, leaping into the air and trying a tornado kick at @user2's head.*

*@user landed the kick, sending @user2 crashing into a nearby wall.

@user then ran at Mrnoob with an upward punch aimed at his chin.

Mrnoob grabbed @user's hand and stopped the attack. While holding it, Mrnoob aggressively punched @user several times in the gut, then struck the back of @user's head and sent them to the ground.*

"Hey!.. That's enough, Mrnoob!..." *beyondborder_08386 said coldly, clearly unhappy with what Mrnoob was doing.*

*beyondborder_08386 slowly walked toward Mrnoob. Mrnoob tilted his head in confusion.*

"We are meant to get STRONGER together... What do you mean that's enough?!" *Mrnoob said, annoyance building inside him.*

*beyondborder_08386 stopped in front of Mrnoob and watched him coldly.*

"Tell me, noob... Either you're good or evil... Which do you think you are?"

*Mrnoob blinked, then responded in a low, dangerous voice.*

"I will do everything in my power to be stronger than everyone..." *Mrnoob paused.* "That includes you too..."

*Before beyondborder_08386 could comprehend it, Mrnoob punched him in the face, making him stumble back.

Mrnoob rushed in with another punch. It landed on beyondborder_08386's cheek, turning his head—but beyondborder_08386 slowly looked back while the fist was still against his face and slightly smirked...

Mrnoob tried a left hook. beyondborder_08386 precisely moved his head out of the way and coldly kicked Mrnoob in the chest, sending him through a building and ragdolling across the ground.

Mrnoob gritted his teeth, blood at his mouth.

At never-before-seen speed, Mrnoob flew at beyondborder_08386 and kicked at his upper body. beyondborder_08386 ducked, stepped back from another kick, then punched toward Mrnoob's stomach. Mrnoob blocked in time, but the impact still sent him sliding away.

Mrnoob breathed heavily and watched beyondborder_08386. Then he saw thezdrink, shadow067972 and @user walk up beside beyondborder_08386, while @user2 watched from the ground.

Mrnoob stepped back and took a breath.*

"I-I swear... You will pay for this..." *Mrnoob said directly to beyondborder_08386.*

*Then he looked at thezdrink, shadow067972 and @user.*

"All of YOU will one day pay... You fought the strongest NOOBS in history..."

*Mrnoob paused.*

"The Leader of All!"

*Mrnoob simply flew away. Since that day, beyondborder_08386 has always been cold toward him...*`;


const MYTHIC_FIGHT_STORY = String.raw`### Beforemath of Mrhacker's conclusion at the Universal Palace

*The Great Leader sat on his throne after calling every administrator to the Palace...*

"I sense danger in the multiverse..." *The Great Leader paused.* "And I brought every single one of you here to debate it...."

*The Great Leader raised one finger. A blue telepathic image appeared above it: Mrhacker with Kape's gauntlet, and in the background @user and @user2 battling it out—with @user clearly winning.*

"He defeated one of our chosen administrators... And then stole his gauntlet, stealing everybody's XP..." *The Great Leader said as the administrators acknowledged it.*

*The Great Leader lowered his finger and the image vanished.*

"Does any of you have the will to stop the multiversal threat?"

*Frampto raised his hand.*

"I can take care of him, thy Great Leader..."

*The Great Leader watched Frampto and smiled slightly.*

"Great... They're on the planet Arkholem. Good luck..."

*Frampto nodded. The administrators gave him space, and Frampto teleported away to the planet...*`;


const COSMIC_FIGHT_STORY = String.raw`### Aftermath of Mrhacker's conclusion

*Mrhacker watched in shock before looking at Mizuki and @user2, seeing both of them evaporate into ashes and fade into the air...

Mrhacker breathed loudly. After a few seconds, he sat on a rock and acknowledged the beautiful view for the last time...

Then he slowly evaporated into the air as well...*

**MRHACKER, MIZUKI & @user2 have died....**

*They really won...

beyondborder_08386 took a shaky breath and dropped to the ground, terribly injured by gamma radiation, his face overheated...

thezdrink came up to beyondborder_08386 and asked the artificial bot he created in a shaky voice:*

"Life functions...?"

*The artificial bot answered in his ear.*

"Life functions critical, losing a heartbeat..."

*thezdrink stepped back in shock. gorjezz quickly ran over and sat beside beyondborder_08386.*

"Beyondborder_08386, we won... we won.... Beyond-..." *gorjezz said while crying.*

*shadow067972 walked over with a sad face and knelt beside him.*

"Look at me, beyondborder_08386..."

*beyondborder_08386 struggled, but managed to move his eyes toward him.*

"You did great..." *shadow067972 paused.* "You c-can... rest now..."

*shadow067972 put a hand on beyondborder_08386's chest.

beyondborder_08386 moved his eyes away and took his last breath...

In a sign of respect, every crew member knelt—even Frampto. They remembered beyondborder_08386 as a legend...*

*...*`;


// Filled from the attached Legendary dialogue file. It deliberately ends at
// the snap so the win, loss and draw branches can each resolve differently.
const LEGENDARY_FIGHT_STORY = String.raw`
### Mrhacker's conclusion

*beyondborder_08386 & @user finally finished working on the teleportation gun...

beyondborder_08386 is holding the teleportation gun proudly, as the crew assembles behind beyondborder_08386...

except Kape who is laying on the couch, injured...

beyondborder_08386 used the teleportation gun, a blue beam coming from it which is creating a portal to Mrhacker, Mizuki and @user2...

A portal starting to occur infront of the crew.... a blue dim light on the crew's faces, while beyondborder_08386 speaks...*

"This our last chance... We either kill him, or we die..."

*thezdrink & gorjezz both nods, while shadow067972 is smiling as if he's ready, Kape is sleeping, kdc ran away cuz he was scared....................*



"..." *theres uncomfortable quiet in the world wheres Mrhacker until a portal started to errupt infront of them...*

*Mrhacker was still sitting on the broken tree, while Mizuki & @user2 walked and standed beside Mrhacker... looking at the blue portal...

Until beyondborder_08386 came first through the portal, Mrhacker watching him silently....

and then thezdrink, shadow067972, gorjezz and @user came through the portal, all standing beside beyondborder_08386, looking at the enemy.... MRHACKER.. and Mizuki & @user2...

After the minute long silence, Mrhacker speaks*

"Long time no see, 'friends'..." *Mrhacker said with a slight evil crooked smile, saying 'friends' sarcastically*

*beyondborder_08386 keeps watching Mrhacker, Mizuki and @user2*

"We're not friends anymore... You simply are a multiversal threat to everyone, who needs to be... wiped out..." *beyondborder_08386 says coldly*

*Mizuki then speaks*

"You wi- w- with your sha-" *glitches* "D- DAD-!" *glitches* "-shameless words..." *Mizuki pauses* "Mrhacker was meant to be...." *Mizuki says while she smiles slightly*

*beyondborder_08386 takes a step closer while taking a look on Mrhacker, he sees the gauntlet, its overheated from the previous battle on Mrhacker's hand.... making Mrhacker not able to snap his fingers yet...*

"You will die for your actions, noob..." *beyondborder_08386 says while looking at Mrhacker*

*Mrhacker sighs and stands up from sitting on the broken tree, starting to get slightly annoyed*

"I'm not a noob... I evolved to being something greater than a noob.... a hacker...." *Mrhacker says coldly*

*beyondborder_08386 screams while charging at Mrhacker with immense speed, and lands a hit which Mrhacker blocked with 2 hands then Mrhacker sended him flying by punching beyondborder_08386 whilst using the power stone, making beyondborder_08386 fly to trees, before the surroundings explode from the impact...

While thats happening, Mizuki charged at thezdrink, giving a knee on thezdrink's chin, making thezdrink ragdoll through the air and then fall to the ground, when shadow067972 appeared infront of Mizuki, trying to punch her in the face, Mizuki grabs shadow067972's punch and by rotating, creating velocity, throws shadow067972 away into the air... , immedietly when @user saw the crew attack, @user attacks with them by charging at @user2, trying to punch @user2 in the face but @user2 blocks...*

*When thezdrink & shadow067972 were ragdolled away, Mizuki's eyes laid on gorjezz and immedietly flies at her with immense speed, gorjezz screams while flying at Mizuki too, Mizuki trying to punch gorjezz in the stomach but gorjezz easily dodged by moving her body out of the way, Mizuki then tries to kick her at her side which gorjezz dodged aswell by jumping in the air and doing a backflip then again Mizuki tries to punch her in the face but this time, gorjezz again dodges by moving her head away and lands a hit on her own, to Mizuki's stomach, and then kicks Mizuki away with not force but speed, making Mizuki crash to the nearby broken tree, dust forming around Mizuki*

While that was going on

Mrhacker flew straight at beyondborder_08386 not waiting till he recovers, Mrhacker appeared infront of beyondborder_08386 in a split second, while already charging up a punch at beyondborder_08386's body, which he was able to dodge, by moving his whole body away, Mrhacker then continued with a quickly rotated kick to the ribs, which beyondborder_08386 blocked, sending beyondborder_08386 sliding away on the ground from the impact...

Mrhacker then raised his fist which where the gauntlet is on, and he was about to send a destonating beam by using the infinity stones but when gorjezz quickly looked at her other crew members, she saw it and instantly moved...

Gorjezz stopped Mrhacker by kicking him on the side of his face, making Mrhacker stumble to the side a bit before Mrhacker trying to punch gorjezz, but gorjezz dodged by again backflipping over Mrhacker's kick before giving him another kick to the side of his face, which made Mrhacker stumble to the side again and Mrhacker groans in annoyance before quickly grabbing gorjezz's hand, making her not able to dodge, and lands several HEAVY and critical hits to her face, making her bleed, before just using the power stone on the last punch, making her fly in the air from the force and crashing through multiple trees, before dropping to the ground, gorjezz is bleeding severly...

When Mrhacker was about to lock his eyes back to beyondborder_08386, beyondborder_08386 appeared infront of him as he kicks Mrhacker in the leg, making Mrhacker drop on his knees, before giving a devistating full-force rotated kick to his face, making Mrhacker almost fall to his side but most importantly, beyondborder_08386 made Mrhacker bleed again from his cheek...

But Mrhacker grits his teeth before in anger quickly getting up from being on his knees before quickly kicking beyondborder_08386 away..

Mrhacker then raised his hand fist up with the gauntlet on and by combining 2 infinity stones (power, space), he sends an entire moon at the crew...

beyondborder_08386, gorjezz, shadow067972 and thezdrink watched in shock while the moon hits them, destroying the ground and gravity...

After the dust, the destruction settled off... Mrhacker can be seen walking unharmed, then thezdrink drops from the sky and lands infront of Mrhacker, while looking at him with a furious look*

"Y- You took everything.. from me..." *thezdrink says with a quiet furious tone before charging his power to his absolute MAX, even surpassing his limits*

*Mrhacker watches as he smiles slightly while thezdrink sends his most powerful ki blasts ever at Mrhacker*

"Well COME ON!.." *Mrhacker says as he blocks the ki blasts with the gauntlet...*

*thezdrink screams as he stops sending ki-blasts and then flies at Mrhacker with unimaginable speed, actually hittin Mrhacker with a punch and then thezdrink does a full on with 2 kicks a kick to his stomach, sending Mrhacker crash to the near tree...

thezdrink then without letting Mrhacker even breath, kicks him with 2 kicks again to his stomach, sending him once again crash to the same tree before Mrhacker quickly grabbing thezdrink's fist and smashes him to the ground, before grabbing him by the neck with the other hand, and by using the gauntlet powerstone on Mrhacker's right hand, sends thezdrink get a slight knockback and falls down on his knees, and with a worried expression, looks up at Mrhacker

Before thezdrink just highering 2 both of his hands, sending a desperatable beam at him, trying to stop Mrhacker...

But Mrhacker just raises his hand with the gauntlet and blocks it....

While Mrhacker is blocking it with one hand with the gauntlet, Mrhacker starts to close the distance between them, thezdrink blinks with widened & nervous expression as he sees Mrhacker infront of him...

Then Mrhacker slaps thezdrink's hand with the gauntlet, stopping the beam from thezdrink, thezdrink then grabs with 2 hands Mrhacker's hand with the gauntlet one, trying to stop him and push Mrhacker away...

Mrhacker then punches with his other hand right to thezdrink's face, making thezdrink almost fall to his side & then thezdrink pulls out from his pocket a small dagger of some sort and tries to kill Mrhacker by attacking it to his neck but Mrhacker sees it coming & stops the incoming attack with his hand and then snatches the dagger away, Mrhacker then stabs thezdrink in the left upper torso....

thezdrink looks up at Mrhacker with a shocked face....

Mrhacker keeps looking at thezdrink with a neutral expression as he watches thezdrink heavily bleed from his mouth..

Mrhacker deepens the stab in thezdrink's left upper torso by walking forward, making thezdrink walk backward with gasps and more blood coming out of his mouth...

Mrhacker then made thezdrink, by walking further back, sit down on a broken rock...

*Mrhacker then lets go of the dagger which is still in thezdrink's left upper torso & by leaning down places a hand on thezdrink's head*

"You really amaze me, thezdrink..." *Mrhacker pauses before continuing to speak*

"For your sake, after im done, Kape is still going to be alive..."

*Mrhacker then stood up and took a step back while looking at thezdrink's shocked and really nervous/injured expression, as more blood comes from thezdrink's mouth...*

"I hope they remember you...." *Mrhacker points out by pointing with his head at the rest of the injured crew...*

*Mrhacker then raises the gauntlet at thezdrink and then all of the infinity stones started glowing and when Mrhacker almost turned thezdrink to ashes by killing him with a really strong beam...

A light suddenly drops down like a beam from the sky, 20 meters away from Mrhacker....

Mrhacker stops the attack on thezdrink as he watches the unknown beam from the sky...

Then a tall guy with a black hood hiding his face comes out of the beam as the beam evaporates into thin air....

You see that guy is Frampto, Kape met him, he's the right hand man of the Great Ruler, The second chosen administrator....

"Who are you...?" *Mrhacker asks while watching the unknown figure float closer in the air to him...*

"I was send to kill you, Mrhacker..." *Frampto answers with a cold & serious expression*

*Mrhacker just blinks at Frampto and smiles while he realizes in his head that this guy is another administrator*

"The one who meant to die, is YOU...." *Mrhacker says with a mocking smile...*

*Frampto frowns and with calculated movements, flies insanely fast at Mrhacker, kicking him to his torso, making Mrhacker get heavily knockbacked, Mrhacker ragdolling on the ground and ends up down on his knees, Mrhacker quickly looks up at Frampto and not even hesitating, gets up from his knees and raises the gauntlet at Frampto, by using every infinity stone, sends a powerful beam directly at Frampto...

Frampto doesnt care and flies straight at the beam, the beeam hits Frampto but it didnt knock him away, infact it just slowed him down and Frampto keeps flying, slowly reaching Mrhacker...

Mrhacker watches in shock and then Frampto reached him and while still flying at him, punched Mrhacker in the jaw, sending Mrhacker up in the air before dropping down on the ground..

Mrhacker groans in pain, bleeding from his mouth, Frampto doesnt waste a second and flies at Mrhacker with insane speed, Mrhacker quickly gets up and widens up a punch with his gauntlet, using the power stone, but unfortunately for Mrhacker, Frampto dodges precisely & easily, Frampto then grabs the gauntlet on Mrhacker's hand, trying to pull it off, Mrhacker screams as he widens up a punch with his other hand and hits Frampto's head, but Frampto doesnt budge at all and contnues to pull off the gauntlet, actually almost pulled it off but Mrhacker groans and pulls out the power stone with his other hand and makes a fist with it, groaning in pain, feeling the gamma radiation from the stone in his fist, then Mrhacker punches Frampto with that power stone, sending Frampto crash to a big rock, Mrhacker then puts the power stone back to the gauntlet...

Mrhacker notices the gauntlet is not overheated anymore and as he winded up the hand with his gauntlet and was boutta snap his fingers again, meaning it would kill everyone, but before Mrhacker could snap, beyondborder_08386 appeared infront of Mrhacker, and grabs the gauntlet once again...

Mrhacker reacts by slap punching beyondborder_08386 several times, before kicking him in the torso, sending beyondborder_08386 ragdoll away...

Then Mrhacker looks with a smile at the injured crew as he highers his gauntlet...*

"I am the Great Leader of All Administrators..." *Mrhacker says as he...*

**SNAPS HIS FINGERS...**

*...*

*Nothing seems to happen, Mrhacker looks confusingly at the gauntlet and there are no infinity stones, You see beyondborder_08386 had a backup plan, while he was creating the teleportation gun, beyondborder_08386 realized that thezdrink was right, he created a small gauntlet on his hand that looked like a glove for the infinity stones...

Mrhacker with widened eyes, looks at beyondborder_08386, as he sees the infinity stones settle magnetically to beyondborder_08386 glove, immedietly after all of the infinity stoness settled to beyondborder_08386's glove, beyondborder_08386 gasps and slightly groans in pain, already feeling the gamma radiation...

"W- we told you... y- you're g- goi- going to die fo- for that..." *beyondborder_08386 says in pain as he raises his glove with the infinity stones...*

*And* **SNAPS HIS FINGERS...**
`;


const STORY_BY_RARITY =
    Object.freeze({
        common: COMMON_FIGHT_STORY,
        uncommon: COMMON_FIGHT_STORY,
        rare: RARE_FIGHT_STORY,
        epic: EPIC_FIGHT_STORY,
        legendary: LEGENDARY_FIGHT_STORY,
        mythic: MYTHIC_FIGHT_STORY,
        cosmic: COSMIC_FIGHT_STORY
    });


const OUTCOME_SCENES =
    Object.freeze({
        common: Object.freeze({
            win:
                "*@user stayed on their feet as the dust finally settled...*",
            loss:
                "*Just when the fight looked finished, @user2 forced themselves back up, slipped past @user's final punch and landed a crushing counterattack. @user hit the ground first...*",
            draw:
                "*@user2 forced themselves back up for one final exchange. Both fighters landed at exactly the same moment—and both collapsed before either could stand again...*"
        }),
        uncommon: Object.freeze({
            win:
                "*@user's last combination proved too much. @user2 tried to rise, but fell back to the ground...*",
            loss:
                "*@user2 suddenly caught @user's wrist, reversed the hold and unleashed a final barrage. @user was sent through the fallen tree and could not continue...*",
            draw:
                "*Neither fighter accepted defeat. Their final punches collided, the shockwave split the fallen tree, and both dropped at the exact same time...*"
        }),
        rare: Object.freeze({
            win:
                "*The crew rushed toward Kape in shock. @user and @user2 looked at each other and realized they had gone far too far. From that day onward, both apologized to Kape 24/7...*",
            loss:
                "*The smoke cleared—but Kape was still standing. @user lost focus for one second. @user2 recovered first, redirected the fading beam and knocked @user out of the fight before helping Kape back to his feet...*",
            draw:
                "*The combined beam shattered into white sparks. Kape was thrown backward, while @user and @user2 fell on opposite sides of the crater. None of them had enough power left to continue...*"
        }),
        epic: Object.freeze({
            win:
                "*@user stood beside beyondborder_08386 as Mrnoob disappeared into the distance. @user2 could no longer continue the fight...*",
            loss:
                "*As everyone watched Mrnoob fly away, @user2 suddenly recovered and rushed @user. One precise counter sent @user into the broken wall, ending the fight before the crew could react...*",
            draw:
                "*@user and @user2 charged one last time. Their attacks collided between the two groups, throwing both fighters backward. Neither one could rise before the others called the fight...*"
        }),
        legendary: Object.freeze({
            win:
                "*The snap thundered across the battlefield. Mrhacker, Mizuki and @user2 began fading as the crew finally realized that beyondborder_08386's impossible plan had worked...*",
            loss:
                "*The snap thundered across the battlefield—but @user2 resisted it for a few final seconds. With everything left, @user2 struck @user down before the battlefield went silent. @user could not get back up...*",
            draw:
                "*The snap split the sky. Its shockwave caught @user and @user2 equally, throwing them to opposite ends of the battlefield. When the light faded, neither had the strength to continue...*"
        }),
        mythic: Object.freeze({
            win:
                "*On Arkholem, the vision became reality. @user broke through @user2's defence and landed the deciding blow just as Frampto arrived...*",
            loss:
                "*On Arkholem, the vision suddenly shifted. @user2 read @user's attack, countered perfectly and ended the fight before Frampto arrived...*",
            draw:
                "*On Arkholem, @user and @user2 unleashed everything at once. The attacks cancelled each other out, leaving both fighters standing—but neither able to move...*"
        }),
        cosmic: Object.freeze({
            win:
                "*When the cosmic light finally faded, @user remained standing. @user2's last attack had failed...*",
            loss:
                "*Then the ashes around @user2 suddenly reversed. @user2 re-formed through the cosmic energy, appeared behind @user and landed one final universe-shaking blow. @user fell...*",
            draw:
                "*A final pulse crossed the ruined world. @user2 briefly re-formed as @user's remaining strength disappeared. Both dropped at the same moment, and the universe declared no winner...*"
        })
    });


function getRequestedFightDeltas(
    rarity,
    result,
    reward
){

    const safeReward =
        Math.max(
            0,
            Math.floor(Number(reward) || 0)
        );

    const lossAmount =
        Math.max(
            0,
            Math.floor(
                safeReward *
                rarity.lossMultiplier
            )
        );


    if(result === "loss"){

        return {
            fighterDelta: -lossAmount,
            targetDelta: safeReward,
            intendedLoss: lossAmount
        };

    }


    if(result === "draw"){

        return {
            fighterDelta: safeReward,
            targetDelta: safeReward,
            intendedLoss: 0
        };

    }


    // The supplied Rare story is cooperative: both users defeat Kape and
    // receive the same reward. Every other winning rarity is competitive.
    if(rarity.key === "rare"){

        return {
            fighterDelta: safeReward,
            targetDelta: safeReward,
            intendedLoss: 0
        };

    }


    return {
        fighterDelta: safeReward,
        targetDelta: -lossAmount,
        intendedLoss: lossAmount
    };

}


function buildOutcomeTitle(
    rarity,
    result,
    fighter,
    target,
    emojis
){

    const fighterMention =
        `<@${fighter.id}>`;

    const targetMention =
        `<@${target.id}>`;


    if(result === "draw"){

        return `**${emojis.fightCloud} ${fighterMention} & ${targetMention} fought to a draw!**`;

    }


    if(result === "loss"){

        return `**${emojis.fightCloud} ${targetMention} wins the fight against ${fighterMention}!**`;

    }


    if(rarity.key === "rare"){

        return `**${emojis.fightCloud} ${fighterMention} & ${targetMention} win the fight against Kape!**`;

    }


    if(rarity.key === "epic"){

        return `**${emojis.fightCloud} ${fighterMention} wins the fight against Mrnoob and ${targetMention}!**`;

    }


    if(rarity.key === "legendary"){

        return `**${emojis.fightCloud} The crew & ${fighterMention} win the fight against Mrhacker, Mizuki and ${targetMention}!**`;

    }


    return `**${emojis.fightCloud} ${fighterMention} wins the fight against ${targetMention}!**`;

}


function buildPayoutLines({
    rarity,
    result,
    fighter,
    target,
    reward,
    fighterDelta,
    targetDelta,
    botTarget,
    emojis
}){

    const fighterMention =
        `<@${fighter.id}>`;

    const targetMention =
        `<@${target.id}>`;


    if(botTarget){

        if(result === "loss"){

            return `**${emojis.fightCloud} ${fighterMention} lost ${formatXP(fighterDelta)} XP.**\n*Bot opponents do not keep an economy balance.*`;

        }


        return `**${emojis.stackedMoney} ${fighterMention} receives ${formatXP(fighterDelta)} XP!**\n*Bot opponents do not keep an economy balance.*`;

    }


    if(result === "draw"){

        return `**${emojis.stackedMoney} ${fighterMention} & ${targetMention} each receive ${formatXP(reward)} XP!**`;

    }


    if(result === "loss"){

        return `**${emojis.stackedMoney} ${targetMention} receives ${formatXP(targetDelta)} XP!**\n**${emojis.fightCloud} whilst ${fighterMention} lost ${formatXP(fighterDelta)} XP (${formatLossRelationship(rarity.lossMultiplier)}).**`;

    }


    if(rarity.key === "rare"){

        return `**${emojis.stackedMoney} ${fighterMention} & ${targetMention} each receive ${formatXP(reward)} XP!**`;

    }


    return `**${emojis.stackedMoney} ${fighterMention} receives ${formatXP(fighterDelta)} XP!**\n**${emojis.fightCloud} whilst ${targetMention} lost ${formatXP(targetDelta)} XP (${formatLossRelationship(rarity.lossMultiplier)}).**`;

}


function buildFightDialogue({
    rarity,
    result,
    evolved,
    fighter,
    target,
    reward,
    fighterDelta,
    targetDelta,
    botTarget = false,
    extras = "",
    guild = null
}){

    const emojis =
        getFightEmojis(guild);

    const header =
        getRarityHeader(
            rarity,
            evolved,
            emojis
        );

    const story =
        renderStory(
            STORY_BY_RARITY[rarity.key],
            fighter,
            target
        );

    const outcomeScene =
        renderStory(
            OUTCOME_SCENES[rarity.key][result],
            fighter,
            target
        );

    const outcomeTitle =
        buildOutcomeTitle(
            rarity,
            result,
            fighter,
            target,
            emojis
        );

    const payoutLines =
        buildPayoutLines({
            rarity,
            result,
            fighter,
            target,
            reward,
            fighterDelta,
            targetDelta,
            botTarget,
            emojis
        });


    return `${header}\n\n${story}\n\n${outcomeScene}\n\n${outcomeTitle}\n\n${payoutLines}${extras}`;

}


async function resolveFightTarget(
    message,
    targetInput
){

    const normalizedInput =
        String(targetInput || "")
            .trim()
            .toLowerCase();


    if(BOT_NAMES.has(normalizedInput)){

        return {
            user: message.client.user,
            botTarget: true
        };

    }


    let target =
        message.mentions.users.first();


    if(
        !target
        &&
        /^\d{17,20}$/.test(normalizedInput)
    ){

        target =
            await message.client.users.fetch(
                normalizedInput
            ).catch(() => null);

    }


    if(!target){
        return null;
    }


    return {
        user: target,
        botTarget: Boolean(target.bot)
    };

}


async function syncFightParticipant(
    message,
    userID,
    actualDelta
){

    if(!actualDelta){
        return null;
    }


    try{

        const levelResult =
            await leveling.syncLevelAndAnnounce(
                message.client,
                message.guild.id,
                userID,
                actualDelta < 0
                    ? {
                        announceLevelUps: false,
                        allowLevelIncrease: false
                    }
                    : {}
            );


        await quests.recordLevelChange(
            message,
            levelResult,
            userID
        );


        return levelResult;

    }
    catch(error){

        // The payout is already committed. A temporary role or level-sync
        // failure must not replace the actual fight result with an error.
        console.error(
            `Could not sync !fight level for ${userID}:`,
            error
        );


        return null;

    }

}


async function recordFightXP(
    message,
    userID,
    actualDelta
){

    if(actualDelta <= 0){
        return;
    }


    await quests.recordEvent(
        message,
        "earn_xp",
        actualDelta,
        {
            userID
        }
    );

}


async function execute(
    message,
    options = {}
){

    if(!message.guild){
        return;
    }


    const guildID =
        message.guild.id;

    const fighterUserID =
        message.author.id;

    const random =
        typeof options.random === "function"
            ? options.random
            : Math.random;


    const fightUnlocked =
        options.skipUnlock
        || await database.isFightUnlocked(
            guildID,
            fighterUserID
        );


    if(!fightUnlocked){

        return message.reply({
            content:
                "🔒 **!fight is locked.** Complete `!boss` Challenge #3 — **Mrhacker's Conclusion** — to unlock it permanently.",
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });

    }


    const remaining =
        options.skipCooldown
            ? 0
            : await database.getCommandCooldownRemaining(
                guildID,
                fighterUserID,
                "fight"
            );


    if(remaining > 0){

        return message.reply({
            content:
                `⏳ You can use **!fight** again ${formatCooldown(remaining)}.`,
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });

    }


    const targetInput =
        message.content
            .trim()
            .split(/\s+/)[1];


    if(!targetInput){

        return message.reply({
            content:
                "👊 Usage: `!fight @user`, `!fight userID`, or `!fight bot`",
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });

    }


    const resolvedTarget =
        await resolveFightTarget(
            message,
            targetInput
        );


    if(!resolvedTarget){

        return message.reply({
            content:
                "❌ I couldn't find that user.",
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });

    }


    const target =
        resolvedTarget.user;

    const botTarget =
        resolvedTarget.botTarget;


    if(target.id === fighterUserID){

        return message.reply({
            content:
                "💀 You cannot fight yourself.",
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });

    }


    if(!options.questRepeatChild){

        const repeatCount =
            await quests.getSocialCommandRepeatCount(
                guildID,
                fighterUserID,
                "fight"
            );


        if(repeatCount > 1){

            const appliedRepeatCount =
                await quests.consumeSocialCommandRepeat(
                    guildID,
                    fighterUserID,
                    "fight"
                );


            for(
                let repeatIndex = 0;
                repeatIndex < appliedRepeatCount;
                repeatIndex++
            ){
                await execute(
                    message,
                    {
                        questRepeatChild: true,
                        skipCooldown:
                            repeatIndex > 0,
                        skipXPBoostDrop:
                            repeatIndex > 0
                    }
                );
            }


            await boosts.tryOmegaDropFromBoostUpgrade(
                message,
                "!fight"
            );


            return;

        }

    }


    const cooldownClaimed =
        options.skipCooldown
            ? false
            : await database.claimCommandCooldown(
                guildID,
                fighterUserID,
                "fight",
                Date.now() + FIGHT_COOLDOWN_MS
            );


    if(
        !options.skipCooldown
        &&
        !cooldownClaimed
    ){

        const newlyRemaining =
            await database.getCommandCooldownRemaining(
                guildID,
                fighterUserID,
                "fight"
            );


        return message.reply({
            content:
                `⏳ You can use **!fight** again ${formatCooldown(Math.max(1000, newlyRemaining))}.`,
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });

    }


    let activeLuck;
    let rarity;
    let evolved;
    let reward;
    let result;
    let payout;


    try{

        activeLuck =
            await luck.getActiveLuckBoost(
                message.member
            );

        rarity =
            rollFightRarity(
                activeLuck,
                random
            );

        // Evolved is always rolled after the normal rarity. It multiplies
        // that rarity's XP by 10 and never promotes it into a new rarity.
        evolved =
            luck.rollEvolvedCommandRarity(
                activeLuck,
                random
            );

        reward =
            luck.applyEvolvedXP(
                luck.rollCommandXP(
                    rarity.minXP,
                    rarity.maxXP,
                    activeLuck
                ),
                evolved
            );

        result =
            rollFightResult(random);

        const requestedDeltas =
            getRequestedFightDeltas(
                rarity,
                result,
                reward
            );


        payout =
            await database.performFightOutcome(
                guildID,
                fighterUserID,
                botTarget
                    ? null
                    : target.id,
                requestedDeltas.fighterDelta,
                botTarget
                    ? 0
                    : requestedDeltas.targetDelta
            );

    }
    catch(error){

        if(cooldownClaimed){

            await database.clearCommandCooldown(
                guildID,
                fighterUserID,
                "fight"
            ).catch(clearError => {

                console.error(
                    "Could not release a failed !fight cooldown:",
                    clearError
                );

            });

        }


        throw error;

    }


    await Promise.all([
        syncFightParticipant(
            message,
            fighterUserID,
            payout.fighterDelta
        ),
        botTarget
            ? Promise.resolve(null)
            : syncFightParticipant(
                message,
                target.id,
                payout.targetDelta
            ),
        recordFightXP(
            message,
            fighterUserID,
            payout.fighterDelta
        ),
        botTarget
            ? Promise.resolve(null)
            : recordFightXP(
                message,
                target.id,
                payout.targetDelta
            )
    ]);


    const usedLuckExtra =
        luck.buildUsedCommandLuckExtra(
            activeLuck
        );

    const evolvedExtra =
        luck.buildEvolvedCommandExtra(
            evolved,
            rarity.label
        );

    const sentMessage =
        await sendLongDialogue(
            message.channel,
            buildFightDialogue({
                rarity,
                result,
                evolved,
                fighter: message.author,
                target,
                reward,
                fighterDelta:
                    payout.fighterDelta,
                targetDelta:
                    payout.targetDelta,
                botTarget,
                extras:
                    `${evolvedExtra}${usedLuckExtra}`,
                guild: message.guild
            }),
            [
                fighterUserID,
                target.id
            ]
        );


    if(!options.skipXPBoostDrop){

        await boosts.tryAndAnnounceXPBoostDrop(
            message,
            "social",
            "!fight"
        );

    }


    if(!options.questRepeatChild){
        await boosts.tryOmegaDropFromBoostUpgrade(
            message,
            "!fight"
        );
    }


    return sentMessage;

}


module.exports = {
    execute,
    FIGHT_COOLDOWN_MS,
    FIGHT_RESULT_CHANCES,
    FIGHT_RARITIES,
    FIGHT_RARITY_CHANCES,
    getFightRarityTable,
    rollFightRarity,
    rollFightResult,
    getRequestedFightDeltas,
    getFightEmojis,
    splitLongMessage,
    sendLongDialogue,
    buildFightDialogue,
    resolveFightTarget
};



