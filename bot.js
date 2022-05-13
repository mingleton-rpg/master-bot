require('dotenv').config();

// MODULES ----------------------------------------------------------------------------
/** Discord.JS */
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Permissions, Intents, ThreadChannel, DiscordAPIError, MessageEmbed } = require('discord.js');
const client = new Client({ intents: [
    Intents.FLAGS.GUILDS, 
    Intents.FLAGS.GUILD_VOICE_STATES, 
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_PRESENCES
] });

/** Chance.JS */
const Chance = require('chance');
const chance = new Chance();

/* Node-fetch */
const fetch = require('node-fetch');



// FILES ------------------------------------------------------------------------------
const config = require('./json/config.json');



// COMMANDS ---------------------------------------------------------------------------
const commands = [
    {   // Send
        name: 'send',
        description: 'Sends ඞmoney to the user you @. This action is irreversible.',
        options: [
            { type: 6, name: 'recipient', description: 'The user to send your ඞmoney to.', required: true },
            { type: 4, name: 'amount', description: 'The amount to send', required: true }
        ]
    },
    {   // Leaderboard
        name: 'leaderboard',
        description: 'Displays a leaderboard of the top users in the server.',
    },
    {   // Inventory
        name: 'inventory', 
        description: 'Check the items in your inventory'
    },
    {   // Account
        name: 'account',
        description: 'Create or check your account information',
        options: [ 
            {
                name: 'create',
                description: 'Create a new Mingleton RPG account with ඞ100.',
                type: 1
            },
            {
                name: 'view',
                description: 'Retrieves another person\'s account, or yours if left blank',
                type: 1,
                options: [
                    { type: 6, name: 'player', description: 'The player to look up.', required: false }
                ]
            }
        ]
    },
    {   // Factions
        name: 'faction',
        description: 'Create or join a faction',
        options: [
            {
                name: 'create',
                description: 'Creates a new faction',
                type: 1,
                options: [
                    { type: 3, name: 'name', description: 'The name of your new faction.', required: true },
                    { type: 3, name: 'emoji', description: 'Your faction\'s special emoji.', required: true }
                ]
            },
            {
                name: 'view',
                description: 'See information about a faction \'f-<faction name>\'',
                type: 1,
                options: [
                    { type: 8, name: 'faction', description: 'The faction to view.', required: true }
                ]
            },
            {
                name: 'invite',
                description: 'Invite a new member to your faction',
                type: 1,
                options: [
                    { type: 6, name: 'player', description: 'The player to invite.', required: true }
                ]
            },
            {
                name: 'leave',
                description: 'Leave the faction you\'re currently in',
                type: 1,
            }
        ]
    },
    {   // Help
        name: 'help',
        description: 'Get help on a particular subject',
        options: [
            { 
                name: 'rarity',
                description: 'Find out what rarities are and how they affect your items',
                type: 1
            },
            { 
                name: 'type',
                description: 'Find out what item types are and how they work',
                type: 1
            },
            {
                name: 'faction',
                description: 'Find out what factions are, how they work, and how to join one',
                type: 1
            }
        ]
    }
];

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_API_KEY);

// SETUP COMMANDS
(async () => { 
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(config.bot.botID, config.bot.guildID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();



// ASSISTANT FUNCTIONS -----------------------------------------------------------------
/** Return an error message from the interaction */
async function returnEmbed(interaction, botInfo, title, description, errorCode) { 
    var embed = new MessageEmbed({ 
        title: title,
        description: description,
        color: botInfo.displayColor
    });

    if (errorCode) { embed.footer = { text: `Error ${errorCode}` } }
    interaction.editReply({ embeds: [ embed ] });
}

/** Get a random number between the min & max */
function getRandomArbitrary(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

/** Capitalise the first letter of a string */
function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/** Normalises a number to at least n digits, prepending with 0s if necessary
 * @param {Number} number - number to normalise.
 * @param {Number} digits - number of digits to normalise, defaults to 2.
 */
 function normaliseNumber(number, digits = 2) { 
    // Make a fixed-length number to the number of digits
    // If a number has less digits, it will be padded with zeros

    let string = number.toString();
    let length = string.length;

    if (length < digits) {
        for (let i = 0; i < digits - length; i++) {
            string = '0' + string;
        }
    }

    return string;
}

/** Convert a value of seconds to hours minutes, etc. */
function convertHMS(value) {
    const sec = parseInt(value, 10); // convert value to number if it's string
    let hours   = normaliseNumber(Math.floor(sec / 3600));                  // get hours
    let minutes = normaliseNumber(Math.floor((sec - (hours * 3600)) / 60)); // get minutes
    let seconds = normaliseNumber(sec - (hours * 3600) - (minutes * 60));   //  get seconds

    if (hours === 0) { return `${minutes}:${seconds}`;} 
    else { return `${hours}:${minutes}:${seconds}`; }
}



// VARIABLES ---------------------------------------------------------------------------
var currentAirdrop = {
    prizeMoney: 0,
    dropDate: null
};

const isProduction = true;
const serverDomain = isProduction === true ? config.apiServer.productionServerDomain : config.apiServer.devServerDomain;
const passKeySuffix = '?passKey=joe_mama';



// ASYNC - SEND AN AIRDROP -------------------------------------------------------------
/* 
    Has a chance to drop a reward based on the number of users with the role online.
    Equation is curently y = 0.00049x + 0.003. https://www.desmos.com/calculator/gtb2zddoe6
    At the moment this just contains a random amount of cash, but will eventually include cards and other valuable items.
*/
(async () => {

    // Set an interval
    var intervalID = setInterval(async function () {

        // Find out how many people with the mingleton-rp role are online
        const guild = client.guilds.cache.get(config.bot.guildID);
        const role = await guild.roles.fetch('962205339728633876');
        
        const roleMembers = role.members.toJSON();
        const onlineRoleMembers = roleMembers.filter(member => {
            return (member.presence && (member.presence.status === 'online' || member.presence.status === 'dnd'));
        });
        console.log(onlineRoleMembers.length, roleMembers.length)

        // Calculate the weighting
        // y = 0.00049x + 0.003
        const weighting = (0.00049 * onlineRoleMembers.length) + 0.0013;
        console.log(weighting);

        // Run a chance check with the calculated weight
        if(chance.weighted([true, false], [weighting, 1]) === false) { return; }
        // clearInterval(intervalID);

        console.log('SENDING AIRDROP --------------------------------------------------------');

        // Get the channel
        const channel = await guild.channels.fetch(config.airdrop.channelID);

        // Generate a random prize
        currentAirdrop.prizeMoney = getRandomArbitrary(50, 100);

        // Set timer
        currentAirdrop.dropDate = new Date().getTime();

        // Assemble an embed
        const embed = {
            title: '💰 An Airdrop has appeared!',
            color: guild.me.displayColor,
            description: `The first person to claim this airdrop will receive **ඞ${currentAirdrop.prizeMoney}**!`,
            footer: { text: `This will disappear in ${Math.round(config.airdrop.expirationMs / 60000)} minutes!` }
        }

        const airdropMessage = await channel.send({ 
            embeds: [ embed ], 
            components: [
                { type: 1, components: [
                    { type: 2, label: 'Claim now!', style: 1, custom_id: 'claimAirdrop' }
                ]}
            ]
        });

        // Expire the airdrop
        currentAirdrop.timeout = setTimeout(function () {
            // Clear the prize money - no cheating!
            currentAirdrop.prizeMoney = 0;

            // Delete the message
            if (airdropMessage) { airdropMessage.delete(); }

        }, config.airdrop.expirationMs);
    }, config.airdrop.intervalMs);
})();



// CLIENT EVENTS -----------------------------------------------------------------------
client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    client.user.setPresence({
        activities: [{ 
            name: 'with your finances',
            type: 'PLAYING'
        }],
        status: 'online'
    });
});



client.on('interactionCreate', async interaction => {

    if (interaction.guild) {

        // Assemble bot & user information
        const botInfo = { 
            displayColor: interaction.guild.me.displayColor,
        }
        const userInfo = { 
            displayName: interaction.member.displayName,
            id: interaction.member.id,
            guild: interaction.guild,
            isBot: (interaction.member.user.bot)
        }
        console.log('NEW COMMAND ------------------------------------------------------------');

        if (interaction.isCommand()) {              // COMMAND INTERACTIONS
            console.log('COMMAND INTERACTION');
            await interaction.deferReply();

            if (interaction.commandName === 'send') {

                const recipient = interaction.options.getMember('recipient', false);
                const dollarAmount = interaction.options.getInteger('amount', false);

                if (dollarAmount <= 0) { 
                    await returnEmbed(interaction, botInfo, 'Not so fast', `You must send at least 1ඞ. And, no, you can't put someone else in a crippling financial crisis for your own gain.`);
                    return;
                }

                // Get the user's account & check their balance
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
                if (response.status === 404) { 
                    await returnEmbed(interaction, botInfo, 'You don\'t have an account!', `You can create one with \`/account create\` (error: ${response.status}).`);
                    return;
                } else if (response.status !== 200) { 
                    await returnEmbed(interaction, botInfo, 'Something went wrong', `An internal server error occurred (error: ${response.status}).`);
                    return;
                }
                const userAccountInfo = await response.json();
                console.log(userAccountInfo);

                if (userAccountInfo.dollars < dollarAmount) { 
                    await returnEmbed(interaction, botInfo, 'Cries in poor', `You only have **ඞ${userAccountInfo.dollars}**, but need **ඞ${dollarAmount - userAccountInfo.dollars}** more to make that transaction. Try again when you have money, loser.`);
                    return;
                }

                // Get the recipient's account
                var response = await fetch(`${serverDomain}accounts/${recipient.id}/${passKeySuffix}`);
                if (response.status === 404) { 
                    await returnEmbed(interaction, botInfo, 'That person doesn\'t have an account!', `They can create one with \`/account create\` (error: ${response.status}).`);
                    return;
                } else if (response.status !== 200) { 
                    await returnEmbed(interaction, botInfo, 'Something went wrong', `An internal server error occurred (error: ${response.status}).`);
                    return;
                }
                const recipientAccountInfo = await response.json();
                console.log(recipientAccountInfo);

                // Update everyone's balance
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/add-dollars/-${dollarAmount}/${passKeySuffix}`, {
                    method: 'POST'
                });
                if (response.status !== 200) { 
                    await returnEmbed(interaction, botInfo, 'Something went wrong', `An internal server error occurred (error: ${response.status}).`);
                    return;
                }

                var response = await fetch(`${serverDomain}accounts/${recipient.id}/add-dollars/${dollarAmount}/${passKeySuffix}`, {
                    method: 'POST'
                });
                if (response.status !== 200) { 
                    await returnEmbed(interaction, botInfo, 'Something went wrong', `An internal server error occurred (error: ${response.status}).`);
                    return;
                }

                await returnEmbed(interaction, botInfo, 'Sent ඞmoney!', `**ඞ${dollarAmount}** has been send to **@${recipient.displayName}**. Enjoy your new cash! \n \n @${userInfo.displayName}, your balance is now ඞ${userAccountInfo.dollars - dollarAmount}. \n  @${recipient.displayName}, your balance is now ඞ${recipientAccountInfo.dollars + dollarAmount}!`);

            } else if (interaction.commandName === 'leaderboard') {

                var response = await fetch(`${serverDomain}accounts/leaderboard/?passKey=${config.apiServer.passKey}`);
                if (response.status !== 200) { returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return; }
                const accountList = await response.json();

                let description = '';
                let index = 1;
                for (member of accountList) { 
                    const memberInfo = await userInfo.guild.members.fetch(member.id)
                    description += '**' + index + ')** ' + memberInfo.displayName + ', ඞ' + member.dollars + ' \n';
                    index += 1;
                }

                console.log(description);
                
                let embed = {
                    title: `Current leaderboard`,
                    color: botInfo.displayColor,
                    description: description
                }

                await interaction.editReply({ embeds: [ embed ] });
            } else if (interaction.commandName === 'inventory') {

                // Get that user's account
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/?passKey=${config.apiServer.passKey}`);
                if (response.status !== 200) { returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return; }
                const userAccountInfo = await response.json();

                // Get the inventory
                const inventory = userAccountInfo.inventory;

                let embed = {
                    title: 'Your inventory',
                    color: botInfo.displayColor,
                    fields: []
                }

                let armourField = {
                    name: '🛡 Equipped Armour',
                    value: 'You have no armour equipped!',
                    inline: false
                }
                embed.fields.push(armourField);

                // Compose options & get other items
                let selectOptions = [];
                for (item of inventory) {

                    const option = { 
                        emoji: { name: item.type.emojiName },
                        label: item.name,
                        value: item.id,
                        description: capitalize(item.rarity.name) + ' ' + item.type.name
                    }
                    selectOptions.push(option);
                }

                let messageComponents = [];
                if (selectOptions.length > 0) { 
                    messageComponents.push({ 
                        type: 1, 
                        components: [
                            {
                                type: 3,
                                customId: 'classSelect1',
                                options: selectOptions,
                                placeholder: 'Choose an item...'
                            }
                        ]
                    });
                }

                // Send message
                await interaction.editReply({ 
                    embeds: [ embed ],
                    components: messageComponents
                });

            } else if (interaction.commandName === 'account') {

                const interactionSubCommand = interaction.options.getSubcommand(false);

                if (interactionSubCommand === 'create') {

                    // Create this user
                    var response = await fetch(`${serverDomain}accounts/create/${userInfo.id}/?passKey=${config.apiServer.passKey}`, { method: 'POST' });

                    if (response.status === 403) { 
                        returnEmbed(interaction, botInfo, 'You already have an account', `You already have an account in the Mingleton RPG! Use \`/account view\` to see your stats.`, response.status); return; 
                    } else if (response.status !== 200) {
                        returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return;
                    }

                    // Add the mingleton-RPG Role to the user
                    const role = await userInfo.guild.roles.fetch(config.bot.roleID);
                    await interaction.member.roles.add([config.bot.roleID, role]);

                    // Create the embed
                    const embed = {
                        title: 'Account created! Welcome to Mingleton RPG!',
                        color: botInfo.displayColor,
                        description: 'Your account has been created. \n You have **ඞ100** (currency), **100 HP**.',
                        footer: { text: 'use /account view to get your account information' }
                    }

                    await interaction.editReply({ embeds: [ embed ] });

                } else if (interactionSubCommand === 'view') {

                    const player = interaction.options.getMember('player', false) || interaction.member;

                    // Get this user
                    var response = await fetch(`${serverDomain}accounts/${player.id}/?passKey=${config.apiServer.passKey}`);

                    if (response.status === 404) { 
                        returnEmbed(interaction, botInfo, 'You already have an account', `That player doesn't have an account. Use \`/account create\` to create one.`, response.status); return; 
                    } else if (response.status !== 200) { 
                        returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return;
                    }

                    const userAccountInfo = await response.json();
                    const userAvatar = await player.avatarURL() || await player.user.avatarURL();

                    // Create the embed
                    let embed = {
                        title: `**@${player.displayName}**`,
                        color: botInfo.displayColor,
                        thumbnail: { url: userAvatar },
                        description: `ඞ${userAccountInfo.dollars} \n ${userAccountInfo.hp} HP`
                    }

                    if (userAccountInfo.faction) { 
                        embed.footer = { text: `Part of ${userAccountInfo.faction.emojiName} ${userAccountInfo.faction.name}` }
                    }

                    await interaction.editReply({ embeds: [ embed ] });
                }
            } else if (interaction.commandName === 'help') { 

                const interactionSubCommand = interaction.options.getSubcommand(false);

                if (interactionSubCommand === 'rarity') {

                    // Get item rarities
                    var response = await fetch(`${serverDomain}attributes/rarity/list/?passKey=${config.apiServer.passKey}`);
                    const rarityList = await response.json();


                    const rarityText = rarityList.reduce(function(acc, cur) { 
                        return acc + ' ' + cur.emojiName + ' ' + capitalize(cur.name) + '\n';
                    }, '');

                    // Create the embed
                    const embed = {
                        title: '<:aldi:963312717542871081> About item rarities • Help',
                        color: botInfo.displayColor,
                        description: 'Every item is assigned a rarity, which can modify how much damage, durability, protection, etc. that item can deal. "Standard" rarity items are default; items lower than that have a reduced stat capacity, and conversely for those with a high rarity rating. The exact stats that rarity will affect on an item depends on the type of item.',
                        fields: [
                            {
                                name: 'Rarity ratings (lowest to highest)',
                                value: rarityText
                            }
                        ]
                    }

                    await interaction.editReply({ embeds: [ embed ] });

                } else if (interactionSubCommand === 'type') { 

                    // Get item types
                    var response = await fetch(`${serverDomain}attributes/type/list/?passKey=${config.apiServer.passKey}`);
                    const typeList = await response.json();

                    const typeText = typeList.reduce(function(acc, cur) { 
                        return acc + ' ' + cur.emojiName + ' ' + capitalize(cur.name) + '\n';
                    }, '');

                    // Create the embed
                    const embed = {
                        title: '🗡 About item types • Help',
                        color: botInfo.displayColor,
                        description: 'Items can be categorised into types, with each type affecting what that item can be used for and the stats it can have.',
                        fields: [
                            {
                                name: 'Item types',
                                value: typeText
                            }
                        ]
                    }

                    await interaction.editReply({ embeds: [ embed ] });

                } else if (interactionSubCommand === 'faction') { 

                    // Create the embed
                    const embed = {
                        title: '🛡 About factions • Help',
                        color: botInfo.displayColor,
                        description: 'Factions are small, private groups that you and your close mates can join. When in a faction, you get a custom role that gives you access to a private channel in the "MRPG - FACTIONS" section. You can only be a part of one faction at a time, so pick wisely!',
                        fields: [
                            {
                                name: 'Creating a faction',
                                value: 'To create a new faction, use `/faction create` and follow the subsequent setup instructions! Once you have created a faction, you can invite more members with `/faction invite`.'
                            },
                            {
                                name: 'Joining a faction',
                                value: 'You can only join a faction via an invite from another member of that faction; keep an eye on your DMs to see if you get an invite!'
                            },
                            {
                                name: 'Leaving a faction',
                                value: 'You can leave a faction at anytime using `/faction leave`. Once you have left a faction, you must wait for an invite before you can join another (or you can create your own).'
                            }
                        ]
                    }

                    await interaction.editReply({ embeds: [ embed ] });

                }

            } else if (interaction.commandName === 'faction') { 

                const interactionSubCommand = interaction.options.getSubcommand(false);

                if (interactionSubCommand === 'create') {

                    // Collect variables
                    const name = interaction.options.getString('name', false).toLowerCase();
                    var emojiName = interaction.options.getString('emoji', false)
                    if (!name || !emojiName) { returnEmbed(interaction, botInfo, 'Your faction needs a name & emoji!'); return; }

                    // Test for emoji
                    var emoji_regex = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])+$/;
                    const emojiCheck = emoji_regex.test(emojiName);
                    console.log(emojiCheck);
                    if (!emojiCheck) {
                        returnEmbed(interaction, botInfo, 'That\'s an invalid emoji!'); return;
                    }

                    // Check if the player is in a faction
                    var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
                    if (response.status === 404) { 
                        returnEmbed(interaction, botInfo, `You don't have a Mingleton RPG account!`, null, response.status); return; 
                    } else if (response.status !== 200) { 
                        returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                    }
                    const userAccountInfo = await response.json();
                    console.log(userAccountInfo);

                    if (userAccountInfo.faction !== null) { 
                        returnEmbed(interaction, botInfo, `You're already part of a faction!`); return;
                    }

                    // Send to server
                    var response = await fetch(`${serverDomain}factions/create/${name}/${emojiName}/${passKeySuffix}`, { method: 'POST' });
                    if (response.status === 403) { 
                        returnEmbed(interaction, botInfo, 'A faction with that name already exists!', null, response.status); return;
                    } else if (response.status !== 200) { 
                        returnEmbed(interaction, botInfo, 'An error occurred', null, response.status); return;
                    }

                    const factionID = await response.json();

                    // Add user to faction
                    var response = await fetch(`${serverDomain}factions/${factionID.factionID}/join/${userInfo.id}/${passKeySuffix}`, { method: 'POST'});
                    if (response.status !== 200) { 
                        returnEmbed(interaction, botInfo, 'An error occurred', null, response.status); return;
                    }

                    // Create a new role
                    const factionRole = await interaction.guild.roles.create({
                        name: `f-${name}`,
                        reason: 'Faction creation'
                    });

                    // Give the role to the user
                    interaction.member.roles.add(factionRole);

                    // Create a new channel
                    const factionChannel = await interaction.guild.channels.create(`${emojiName}-${name}`, {
                        type: 'GUILD_TEXT'
                    });

                    // Set the parent
                    await factionChannel.setParent('970662777616236575', { lockPermissions: true });
                    await factionChannel.edit({
                        permissionOverwrites: [
                            {
                                id: factionRole.id,
                                allow: [ Permissions.FLAGS.VIEW_CHANNEL ],
                            },
                            {
                                id: '618748256028983326',
                                deny: [ Permissions.FLAGS.VIEW_CHANNEL ],
                            }
                        ]
                    })

                    // Done!
                    await returnEmbed(interaction, botInfo, `Welcome to your new faction, ${emojiName} ${name}!`, `You can now view your faction's private channel!`);

                } else if (interactionSubCommand === 'invite') { 

                    const player = interaction.options.getMember('player', false);
                    if (!player) { returnEmbed(interaction, botInfo, 'That\'s not a valid user!'); return; }

                    // Check if the player is in a faction
                    var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
                    if (response.status === 404) { 
                        returnEmbed(interaction, botInfo, `You don't have a Mingleton RPG account!`, null, response.status); return; 
                    } else if (response.status !== 200) { 
                        returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                    }
                    const userAccountInfo = await response.json();

                    if (userAccountInfo.faction === null) { 
                        returnEmbed(interaction, botInfo, `You're not part of a faction!`); return;
                    }

                    // Check if the other player is in a faction
                    var response = await fetch(`${serverDomain}accounts/${player.id}/${passKeySuffix}`);
                    if (response.status === 404) { 
                        returnEmbed(interaction, botInfo, `That user doesn't have a Mingleton RPG account!`, null, response.status); return; 
                    } else if (response.status !== 200) { 
                        returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                    }
                    const playerAccountInfo = await response.json();

                    if (playerAccountInfo.faction !== null) { 
                        returnEmbed(interaction, botInfo, `They're already part of a faction!`); return;
                    }

                    // Create embed
                    const embed = {
                        title: `${userAccountInfo.faction.emojiName} You have an invite!`,
                        color: botInfo.displayColor,
                        description: `You've been invited by **@${userInfo.displayName}** to join ${userAccountInfo.faction.emojiName} **${userAccountInfo.faction.name}**!`
                    }

                    // Create a DM
                    const dmChannel = await player.createDM();
                    
                    await dmChannel.send({ 
                        embeds: [ embed ], 
                        components: [
                            { type: 1, components: [
                                { type: 2, label: 'Accept', style: 1, custom_id: 'join_faction_' + userAccountInfo.faction.id },
                                { type: 2, label: 'Decline', style: 2, custom_id: 'decline_faction_' + userAccountInfo.faction.id }
                            ]}
                        ]
                    });

                    // Send an update to that faction's channel
                    const factionChannel = userInfo.guild.channels.cache.find(channel => channel.name.includes(userAccountInfo.faction.name.replace(/ /g, '-')));
                    if (factionChannel && factionChannel.id !== interaction.channel.id) { 
                        await factionChannel.send({ embeds: [{
                            title: `@${player.displayName} has been invited to this faction!`,
                            description: `I'll let you know if they accept or decline the request!`,
                            footer: { text: `Invited by @${userInfo.displayName}`},
                            color: botInfo.displayColor
                        }]});
                    }

                    // Return to user
                    returnEmbed(interaction, botInfo, 'Invite sent!', `I'll let you know if they accepts or declines your request!`);


                } else if (interactionSubCommand === 'leave') { 

                    // Get the player's current faction
                    var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
                    if (response.status === 404) { 
                        returnEmbed(interaction, botInfo, `You don't have a Mingleton RPG account!`, null, response.status); return; 
                    } else if (response.status !== 200) { 
                        returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                    }
                    const userAccountInfo = await response.json();
                    console.log(userAccountInfo);

                    // Check if they're in a faction
                    if (userAccountInfo.faction === null) { 
                        returnEmbed(interaction, botInfo, `You're not part of a faction!`); return;
                    }

                    // Leave that faction
                    var response = await fetch(`${serverDomain}factions/${userAccountInfo.faction.id}/leave/${userInfo.id}/${passKeySuffix}`, { method: 'POST' });
                    if (response.status === 404) { 
                        returnEmbed(interaction, botInfo, `That faction no longer exists!`, null, response.status); return; 
                    } else if (response.status !== 200 && response.status !== 201) { 
                        returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                    }
                    const leaveResponse = response.status;
                    
                    // Remove the role from the user
                    const role = interaction.guild.roles.cache.find(role => role.name == 'f-' + userAccountInfo.faction.name);
                    if (role) { interaction.member.roles.remove(role); }

                    // Check for other users with this role
                    if (leaveResponse === 201) { 
                        // Delete this role
                        if (role) { await role.delete('Faction closed; cleaning up'); }

                        // Find the associated channel & delete it
                        const channel = interaction.guild.channels.cache.find(channel => channel.name.includes(userAccountInfo.faction.name.toLowerCase().replace(/ /g, '-')));
                        console.log(channel);

                        if (channel) { await channel.delete('Faction closed; cleaning up'); }

                        await returnEmbed(interaction, botInfo, `You've now left ${userAccountInfo.faction.emojiName} ${userAccountInfo.faction.name}!`, `You were also the last member of this faction, so I've gone ahead and deleted that faction.`);
                    } else {
                        await returnEmbed(interaction, botInfo, `You've now left ${userAccountInfo.faction.emojiName} ${userAccountInfo.faction.name}!`);
                    }
                } else if (interactionSubCommand === 'view') { 

                    // Collect variables
                    const role = interaction.options.getRole('faction', false);
                    const factionName = role.name.split('-')[1];
                    if (!factionName) { 
                        returnEmbed(interaction, botInfo, `That's not a valid faction!`, null); return;
                    }

                    // Find the faction
                    var response = await fetch(`${serverDomain}factions/name/${factionName}/${passKeySuffix}`);
                    if (response.status === 404) { 
                        returnEmbed(interaction, botInfo, `That faction doesn't exist!`, null, response.status); return;
                    } else if (response.status !== 200) { 
                        returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                    }
                    const factionInfo = await response.json();
                    console.log(factionInfo);

                    const netWorth = factionInfo.members.reduce((acc, cur) => {
                        return acc + cur.dollars
                    }, 0);

                    // Assemble the embed
                    let embed = { 
                        title: `${factionInfo.emojiName} **${factionInfo.name}**`,
                        color: botInfo.displayColor,
                        description: `Net worth: ඞ${netWorth}`,
                        fields: []
                    }

                    for (member of factionInfo.members) { 
                        const memberInfo = await userInfo.guild.members.fetch(member.id)

                        embed.fields.push({
                            name: `@${memberInfo.displayName}`,
                            value: `ඞ${member.dollars} & ${member.hp} HP`, 
                            inline: true
                        });
                    }

                    interaction.editReply({ embeds: [ embed ] });
                }
            }

        } else if (interaction.isButton()) {        // BUTTON INTERACTIONS
            console.log('BUTTON INTERACTION');

            // console.log(interaction);
            
            if (interaction.customId === 'claimAirdrop') {

                // Clear the airdrop expiration timeout
                clearTimeout(currentAirdrop.timeout);

                const interactionMessage = interaction.message;

                await interactionMessage.edit({ components: [] });

                // Calculate time between drop and claim
                const claimDelay = Math.abs((new Date().getTime() - currentAirdrop.dropDate) / 1000);

                // Add the prize to the user's account
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/add-dollars/${currentAirdrop.prizeMoney}/?passKey=${config.apiServer.passKey}`, { method: 'POST' });
                if (response.status !== 200) { interactionMessage.edit('Something went wrong. Sorry!'); return; }
                const accountBalance = await response.json();
                console.log(accountBalance);

                // Edit the original message
                const embed = { 
                    title: `💰 Claimed by @${userInfo.displayName}!`,
                    color: botInfo.displayColor,
                    description: `You've won **ඞ${currentAirdrop.prizeMoney}**! Your balance is now **ඞ${accountBalance.dollars}**.`,
                    footer: { text: `It took @${userInfo.displayName} ${convertHMS(claimDelay)} to claim this drop.`}
                }

                await interactionMessage.edit({ embeds: [ embed ], components: [] });

            } else if (interaction.customId.includes('unequip_armour')) {

                // Get that user's account
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/?passKey=${config.apiServer.passKey}`);
                if (response.status !== 200) { returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return; }
                const userAccountInfo = await response.json();

                // Get item
                const itemID = interaction.customId.split('_')[2];
                const item = userAccountInfo.inventory.find(x => x.id === itemID);
                if (!item) { return }   // The user interacting was not the owner of this item

                await interaction.deferReply();

                if (item.isEquipped === false) { returnEmbed(interaction, botInfo, 'That item isn\'t equipped'); return; }    // The item is already unequipped

                // Equip this item
                var response = await fetch(`${serverDomain}items/${item.id}/equip/false/?passKey=${config.apiServer.passKey}`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: {'Content-Type': 'application/json'}
                });
                if (response.status === 404) { 
                    returnEmbed(interaction, botInfo, 'This item does not exist', `It looks like this item no longer exists (error ${response.status}).`); return; 
                } else if (response.status === 403) { 
                    returnEmbed(interaction, botInfo, 'This item cannot be unequipped', `This item can't be unequipped (error ${response.status}).`); return;
                } else if (response.status !== 200) { 
                    returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong (error ${response.status}).`); return; 
                }

                returnEmbed(interaction, botInfo, 'Item un-equipped!');

            } else if (interaction.customId.includes('equip_armour')) { 

                // Get that user's account
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/?passKey=${config.apiServer.passKey}`);
                if (response.status !== 200) { returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return; }
                const userAccountInfo = await response.json();

                // Get item
                const itemID = interaction.customId.split('_')[2];
                const item = userAccountInfo.inventory.find(x => x.id === itemID);
                if (!item) { return }   // The user interacting was not the owner of this item

                await interaction.deferReply();

                if (item.isEquipped === true || item.type.isEquippable === false) { returnEmbed(interaction, botInfo, 'That item can\'t be equipped'); return; }    // The item can't be equipped

                // Equip this item
                var response = await fetch(`${serverDomain}items/${item.id}/equip/true/?passKey=${config.apiServer.passKey}`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: {'Content-Type': 'application/json'}
                });
                if (response.status === 404) { 
                    returnEmbed(interaction, botInfo, 'This item does not exist', `It looks like this item no longer exists (error ${response.status}).`); return; 
                } else if (response.status === 403) { 
                    returnEmbed(interaction, botInfo, 'This item cannot be equipped', `This item can't be equipped (error ${response.status}).`); return;
                } else if (response.status !== 200) { 
                    returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong (error ${response.status}).`); return; 
                }

                returnEmbed(interaction, botInfo, 'Item equipped!');
            }

        } else if (interaction.isMessageComponent()) { 

            // Get that user's account
            let response = await fetch(`${serverDomain}accounts/${userInfo.id}/?passKey=${config.apiServer.passKey}`);
            if (response.status !== 200) { returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return; }
            const userAccountInfo = await response.json();

            const selectedItem = userAccountInfo.inventory.find(x => x.id === interaction.values[0]);

            if (!selectedItem) { return; }

            console.log(selectedItem);

            // Generate item embed
            let attributesText = '';
            for (const attribute of selectedItem.attributes) { 
                if (attribute.value < 0) { attributesText += ` | ${attribute.value} ${attribute.name}` }
                else { attributesText += ` | +${attribute.value} ${attribute.name}` }
            }

            let embed = {
                title: `${selectedItem.type.emojiName} *${selectedItem.name}*`,
                color: botInfo.displayColor,
                description: '',
                fields: [
                    { 
                        name: '**Item stats**', 
                        value: `${selectedItem.rarity.emojiName} **${capitalize(selectedItem.rarity.name)} ${selectedItem.type.name}** ${attributesText}` 
                    }
                ]
            }

            if (selectedItem.description !== '' || selectedItem !== null) { 
                embed.description = `*${selectedItem.description}*`; 
            }
            if (selectedItem.amount > 1) { embed.title += ` (${selectedItem.amount})`; }
            if (selectedItem.isEquipped) { embed.title += ` (equipped)`; }

            // Compose options & get other items
            let selectOptions = [];
            for (item of userAccountInfo.inventory) {

                const option = { 
                    emoji: { name: item.type.emojiName },
                    label: item.name,
                    value: item.id,
                    description: capitalize(item.rarity.name) + ' ' + item.type.name,
                    default: (item.id === selectedItem.id)
                }
                selectOptions.push(option);
            }

            // Compose buttons
            let buttonList = [{
                type: 2,
                style: 4,
                label: 'Drop',
                customId: 'drop_item_' + selectedItem.id,
            }];
            for (item of selectedItem.type.functions) {
                let button = {
                    type: 2,
                    style: item.style,
                    label: capitalize(item.label),
                    customId: item.id + selectedItem.id,
                    disabled: false
                }

                // Make individual decisions
                if (item.id === 'equip_armour_') { button.disabled = selectedItem.isEquipped; } 
                else if (item.id === 'unequip_armour_') { button.disabled = !selectedItem.isEquipped; }

                buttonList.push(button);
            }

            // Add buttons to the message components
            let components = [
                { 
                    type: 1, 
                    components: [
                        {
                            type: 3,
                            customId: 'classSelect1',
                            options: selectOptions,
                            placeholder: 'Choose an item...'
                        }
                    ]
                },
                {
                    type: 1, 
                    components: buttonList
                }
            ]


            await interaction.update({
                embeds: [ embed ],
                components: components
            });

        } else {                                    // OTHER
            console.log('Interaction of type ' + interaction.type + ' unaccounted for.');
        }
    } else {

        const guild = await client.guilds.fetch(config.bot.guildID);
        const botInfo = { 
            displayColor: guild.me.displayColor,
        }
        const userInfo = { 
            displayName: interaction.user.username,
            id: interaction.user.id,
            guild: null,
            isBot: (interaction.user.bot)
        }

        console.log('NEW DM COMMAND ---------------------------------------------------------');

        if (interaction.isButton()) { 
            console.log('BUTTON INTERACTION');

            console.log(interaction);

            if (interaction.customId.includes('join_faction_')) {
                await interaction.deferReply();

                const factionID = interaction.customId.split('_')[2];

                // Get faction info
                var response = await fetch(`${serverDomain}factions/id/${factionID}/${passKeySuffix}`);
                if (response.status === 404) { 
                    returnEmbed(interaction, botInfo, `That faction doesn't exist!`, null, response.status); return;
                } else if (response.status !== 200) { 
                    returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                }
                const factionInfo = await response.json();
                console.log(factionInfo);

                // Check if the player is in a faction
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
                if (response.status === 404) { 
                    returnEmbed(interaction, botInfo, `You don't have a Mingleton RPG account!`, null, response.status); return; 
                } else if (response.status !== 200) { 
                    returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                }
                const userAccountInfo = await response.json();

                if (userAccountInfo.faction !== null) { 
                    returnEmbed(interaction, botInfo, `You're already part of a faction!`); return;
                }

                // Join the faction
                var response = await fetch(`${serverDomain}factions/${factionInfo.id}/join/${userInfo.id}/${passKeySuffix}`, { method: 'POST' });
                if (response.status !== 200) { 
                    returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                }

                // Give the associated member the role
                const guild = await client.guilds.fetch(config.bot.guildID);
                const member = await guild.members.fetch(userInfo.id);
                const role = guild.roles.cache.find(role => role.name == 'f-' + factionInfo.name);
                if (role) { member.roles.add(role); }

                // Send an update to that faction's channel
                const factionChannel = guild.channels.cache.find(channel => channel.name.includes(factionInfo.name.replace(/ /g, '-')));
                if (factionChannel) { 
                    await factionChannel.send({ embeds: [{
                        title: `Welcome @${member.displayName}!`,
                        color: botInfo.displayColor
                    }]});
                }

                returnEmbed(interaction, botInfo, `Invite accepted!`);
            } else if (interaction.customId.includes('decline_faction_')) {
                await interaction.deferReply();

                const factionID = interaction.customId.split('_')[2];

                // Get faction info
                var response = await fetch(`${serverDomain}factions/id/${factionID}/${passKeySuffix}`);
                if (response.status === 404) { 
                    returnEmbed(interaction, botInfo, `That faction doesn't exist!`, null, response.status); return;
                } else if (response.status !== 200) { 
                    returnEmbed(interaction, botInfo, `An error occurred`, null, response.status); return; 
                }
                const factionInfo = await response.json();
                console.log(factionInfo);

                // Send an update to that faction's channel
                const guild = await client.guilds.fetch(config.bot.guildID);
                const member = await guild.members.fetch(userInfo.id);
                const factionChannel = guild.channels.cache.find(channel => channel.name.includes(factionInfo.name.replace(/ /g, '-')));
                if (factionChannel) { 
                    await factionChannel.send({ embeds: [{
                        title: `@${member.displayName} has declined the request to join.`,
                        color: botInfo.displayColor
                    }]});
                }

                await returnEmbed(interaction, botInfo, 'Request declined!');
            }
        }
    }
});



// RUN BOT ----------------------------------------------------------------------------
client.login(process.env.DISCORD_API_KEY);



// (async () => {      // Remove money from my account
//     const response = await fetch(`${serverDomain}accounts/285171615690653706/add-dollars/-125/${passKeySuffix}`, { method: 'POST' });

//     console.log(response);
// })();