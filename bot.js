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
    {   // lb (same as leaderboard)
        name: 'lb',
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
                description: 'Take a look at someone\'s account!',
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
            },
            {
                name: 'airdrop',
                description: 'Find out what Airdrops are & how they work',
                type: 1
            }
        ]
    },
    {   // Profile (same as /account view)
        name: 'profile',
        description: 'Take a look at someone\'s profile!',
        options: [
            { type: 6, name: 'player', description: 'The player to look up.', required: false }
        ]
    },
    {   // Changelog
        name: 'changelog', 
        description: 'See what\'s changed recently'
    },
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

    if (interaction.replied === false) { interaction.reply({ embeds: [ embed ] }); }
    else { interaction.editReply({ embeds: [ embed ] }); }
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



// GENERATOR FUNCTIONS -----------------------------------------------------------------
/** Generate the Profile embed */
async function generateProfile(userInfo, botInfo) { 

    // Get that user's account
    var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
    if (response.status !== 200) { return [false, 'Internal server error']; }

    // Get the inventory
    const userAccountInfo = await response.json();
    const inventory = userAccountInfo.inventory;
    const userAvatar = await userInfo.member.avatarURL() || await userInfo.member.user.avatarURL();

    // Create the profile embed
    let profileEmbed = {
        title: `**@${userInfo.displayName}**`,
        color: botInfo.displayColor,
        thumbnail: { url: userAvatar },
        description: `ඞ${userAccountInfo.dollars} \n ${userAccountInfo.hp} HP`,
        fields: []
    }

    if (userAccountInfo.faction) { 
        profileEmbed.footer = { text: `Part of ${userAccountInfo.faction.emojiName} ${userAccountInfo.faction.name}` }
    }

    // Show equipped items
    const equippedItems = inventory.filter(item => item.isEquipped === true);
    // console.log(equippedItems);
    if (equippedItems.length === 0) { 
        profileEmbed.fields.push({
            name: 'Equipped items!',
            value: 'There are no items equipped!',
            inline: false
        });
    } else {

        const itemsText = equippedItems.reduce((acc, curr) => {
            return acc + `${curr.rarity.emojiName} ${curr.type.emojiName} *${curr.name}* \n`
        }, '');

        profileEmbed.fields.push({
            name: `**Equipped items**`,
            value: itemsText,
            inline: false
        });
    }

    return profileEmbed;
}

/** Generate the Inventory embeds 
 * @param {UserInfo} userInfo Discord generated user information
 * @param {BotInfo} botInfo standard bot information
 * @param {UUID} itemID server-generated item ID
*/
async function generateInventory(userInfo, botInfo, itemID, actionTitle, actionDescription) { 

    // Get that user's account
    var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
    if (response.status !== 200) { return [false, 'Internal server error']; }

    // Get the inventory
    const userAccountInfo = await response.json();
    const inventory = userAccountInfo.inventory;

    // Assemble embeds
    const embeds = [];

    // Get the user's profile
    embeds.push(await generateProfile(userInfo, botInfo));

    // Get the selected item, if relevant
    const selectedItem = inventory.find(x => x.id === itemID);
    if (selectedItem) { 
        console.log(selectedItem);

        // Generate item attributes text
        let attributesText = '';
        for (const attribute of selectedItem.attributes) { 
            if (attribute.value < 0) { attributesText += ` | ${attribute.value} ${attribute.name}` }
            else { attributesText += ` | +${attribute.value} ${attribute.name}` }

            if (attribute.duration && attribute.duration > 1) { attributesText += `, ${attribute.duration} duration`; }
        }

        // Add an embed for that item
        let itemEmbed = {
            title: `${selectedItem.type.emojiName} *${selectedItem.name}*`,
            color: botInfo.displayColor,
            description: '',
            fields: [
                { 
                    name: '**Item stats**', 
                    value: `${selectedItem.rarity.emojiName} **${capitalize(selectedItem.rarity.name)} ${selectedItem.type.name}** ${attributesText}` 
                }
            ]
        };
        embeds.push(itemEmbed);

        // Add lore
        if (selectedItem.description != '' && selectedItem.description != null) { 
            itemEmbed.description = `*${selectedItem.description}*`;
        }

        // Add title modifiers
        if (selectedItem.amount > 1) { itemEmbed.title += ` (${selectedItem.amount})`; }
        if (selectedItem.isEquipped) { itemEmbed.title += ` (equipped)`; }
    }


    // Action 
    if (actionTitle) { 
        let actionEmbed = {
            title: actionTitle,
            color: botInfo.displayColor,
            timestamp: Date.now()
        }

        if (actionDescription) { actionEmbed.description = actionDescription; }
        embeds.push(actionEmbed);
    }


    // Compose options & get other items
    const selectOptions = [];
    for (item of inventory) {

        const option = { 
            emoji: { name: item.type.emojiName },
            label: item.name,
            value: item.id,
            description: capitalize(item.rarity.name) + ' ' + item.type.name,
        }

        if (selectedItem && item.id === selectedItem.id) {
            option.default = true;
        }

        selectOptions.push(option);
    }

    // Compile message components 
    const messageComponents = [];
    if (selectOptions.length > 0) { 
        messageComponents.push({ 
            type: 1, 
            components: [
                {
                    type: 3,
                    customId: 'item_select',
                    options: selectOptions,
                    placeholder: 'Choose an item...'
                }
            ]
        });
    }


    // Add buttons
    if (selectedItem) {
        const buttonList = [{
            type: 2,
            style: 4,
            label: 'Drop',
            customId: 'item_drop_' + selectedItem.id,
        }];
        for (item of selectedItem.type.functions) {
            let button = {
                type: 2,
                style: item.style,
                label: capitalize(item.label),
                customId: item.id + selectedItem.id,
                disabled: false
            }

            // EQUIP/UNEQUIP ARMOUR
            if (item.id === 'item_equip_') { button.disabled = selectedItem.isEquipped; } 
            else if (item.id === 'item_unequip_') { button.disabled = !selectedItem.isEquipped; }

            // CONSUME button
            if (item.id === 'item_consume_') {
                
                // Calculate how much health this item might add
                const hp = selectedItem.attributes.find(s => s.name == 'health');
                if (hp) { 
                    const healthAdd = Math.min(hp.value, 100 - userAccountInfo.hp);
                    if (healthAdd <= 0) { button.disabled = true; }
                    else { button.label += ` (+${healthAdd} HP)`}
                } else { 
                    button.disabled = true;
                }
            }

            // SWING button
            if (item.id === 'weapon_swing_') {

                // If <=0, don't allow
                const durability = selectedItem.attributes.find(s => s.name == 'durability');
                if (!durability || durability.value <= 0) { button.disabled = true; }
            }

            buttonList.push(button);
        }

        messageComponents.push({
            type: 1,
            components: buttonList
        })
    }



    // Return message content
    return ({ 
        embeds: embeds,
        components: messageComponents
    });

}



// VARIABLES ---------------------------------------------------------------------------
var currentAirdrop = {
    typeID: 0,
    dropDate: null,
    payout: 0,
    claimants: []
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
    const isDebuggingAirdrop = false;        // CHANGE BEFORE PRODUCTION

    // Set an interval
    var intervalID = setInterval(async function () {

        // DEBUG ONLY - CLEAR INTERVAL
        if (isDebuggingAirdrop) { clearInterval(intervalID); }

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
        if(isDebuggingAirdrop === false && chance.weighted([true, false], [weighting, 1]) === false) { return; }

        console.log('SENDING AIRDROP --------------------------------------------------------');

        // Choose a random Airdrop to send
        const airdropType = config.airdrop.types[chance.natural({min: 0, max: config.airdrop.types.length - 1})];
        // const airdropType = config.airdrop.types[1];
        console.log(airdropType);

        currentAirdrop = { 
            typeID: airdropType.id,
            dropDate: new Date().getTime(),
            payout: chance.natural({ min: airdropType.payout.min, max: airdropType.payout.max }), 
            claimants: []
        }

        // Assemble the embed
        let embed = {
            title: `${airdropType.emoji} ${airdropType.name} Airdrop has appeared!`,
            color: guild.me.displayColor,
            footer: { text: `This will disappear in ${Math.round(airdropType.expirationMs / 60000)} minutes!` }
        }

        // Determine claimants
        if (airdropType.maxClaimants === -1) { 
            embed.description = `**Anybody** can claim this Airdrop and receive **ඞ${currentAirdrop.payout}**!`
        } else if (airdropType.maxClaimants === 1) { 
            embed.description = `The **first person** to claim this Airdrop will receive **ඞ${currentAirdrop.payout}**!`
        } else {
            embed.description = `The first **${airdropType.maxClaimants} people** to claim this Airdrop will and receive **ඞ${currentAirdrop.payout}**!`
        }

        // Send the message
        const channel = await guild.channels.fetch(isDebuggingAirdrop ? config.airdrop.debugChannelID : config.airdrop.channelID);
        const airdropMessage = await channel.send({ 
            embeds: [ embed ], 
            components: [
                { type: 1, components: [
                    { type: 2, label: 'Claim now!', style: 1, custom_id: 'claim_airdrop' }
                ]}
            ]
        });

        // Expire the airdrop
        currentAirdrop.timeout = setTimeout(function () {
            // Clear the prize money - no cheating!
            currentAirdrop.payout = 0;

            // Delete the message
            if (airdropMessage) { airdropMessage.edit({ components: [], embeds: [{
                title: `${airdropType.emoji} Time's up!`,
                color: guild.me.displayColor,
                content: `The time has come and gone to claim this Airdrop of **ඞ${currentAirdrop.payout}**`
            }]}) }

        }, config.airdrop.types[currentAirdrop.typeID].expirationMs);

    }, isDebuggingAirdrop ? 3000 : config.airdrop.intervalMs);
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
            isBot: (interaction.member.user.bot),
            member: interaction.member
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

            } else if (interaction.commandName === 'leaderboard' || interaction.commandName === 'lb') {

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

                await interaction.editReply(await generateInventory(userInfo, botInfo, null));

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

                    const player = interaction.options.getMember('player', false);
                    let playerInfo = userInfo;
                    if (player) { 
                        playerInfo = { 
                            displayName: player.displayName,
                            id: player.id,
                            guild: userInfo.guild,
                            isBot: (player.user.bot),
                            member: player
                        }
                    }

                    await interaction.editReply({ embeds: [ await generateProfile(playerInfo, botInfo) ] });
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

                } else if (interactionSubCommand === 'airdrop') { 

                    const embedFields = []
                    for (const type of config.airdrop.types) { 
                        embedFields.push({
                            name: `${type.emoji} ${type.name} Airdrop`,
                            value: `
                            **Payout:** ${type.payout.min} - ${type.payout.max}
                            **Maximum claimants:** ${type.maxClaimants === -1 ? '∞' : type.maxClaimants}
                            **Expiration:** ${Math.round(type.expirationMs / 60000)} minutes
                            `, inline: true
                        });
                    }

                    // Create the embeds
                    const embeds = [];
                    embeds.push({
                        title: '🪂 About Airdrops • Help',
                        color: botInfo.displayColor,
                        description: `Airdrops are an excellent and competitive way to earn income in the Mingleton world. At random times throughout the day, an Airdrop will appear in the **#🪂-airdrops** channel. Read on to find out about each type, and how often they appear`,
                        fields: [
                            {
                                name: '**Appearance rarity**',
                                value: `
                                Airdrops have a probability of appearing proportional to the number of people online. The equation is \`y = 0.00049x + 0.0031\`, where:
                                • \`y\` is the probability of an Airdrop appearing, and
                                • \`x\` is the number of people Online or DnD
                                This will be calculated once every ${Math.round(config.airdrop.intervalMs / 60000)} minute/s.
                                `
                            }
                        ]
                    });

                    embeds.push({
                        title: 'Airdrop types',
                        color: botInfo.displayColor,
                        fields: [ embedFields ]
                    })

                    await interaction.editReply({ embeds: embeds });

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
                    returnEmbed(interaction, botInfo, 'Invite sent!', `I'll let you know if they accept or decline your request!`);


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
            } else if (interaction.commandName === 'profile') { 

                const player = interaction.options.getMember('player', false);
                let playerInfo = userInfo;
                if (player) { 
                    playerInfo = { 
                        displayName: player.displayName,
                        id: player.id,
                        guild: userInfo.guild,
                        isBot: (player.user.bot),
                        member: player
                    }
                }

                await interaction.editReply({ embeds: [ await generateProfile(playerInfo, botInfo) ] });

            } else if (interaction.commandName === 'changelog') { 

                let embeds = [];

                embeds.push({
                    color: botInfo.displayColor,
                    title: 'Inventory v2 Update • 22w07a', 
                    description: `Rebuilt the inventory and account system to handle new items, and allowed for basic interactions with weapons and items in the world.`,
                    fields: [
                        {
                            name: 'Inventory v2',
                            value: `
                                • Items bought from both Baunders & Sons and Bruh United will now work seamlessly together, and can be interacted with.
                                • Weapons can be swung, thrown and shot, producing various results. A number of small easter-eggs are hidden here, too.
                                • Health-giving potions and items can be consumed.
                                • Weapons & armour can be equipped! Only one of each type of item can be equipped at a time.
                            `,
                            inline: false
                        },
                        {
                            name: 'Bug fixes & improvements',
                            value: `
                                • Improved the payouts from lower-tier Airdrops.
                                • Added \`/lb\` and \`/profile\` as shorthand alternatives to \`/leaderboard\` and \`/account view\`, respectively.
                                • The account/profile page will now display equipped weapons & armour to everyone.
                            `,
                            inline: false
                        },
                    ],
                    footer: { text: 'Released 22/05/2022'}
                });
    
                embeds.push({
                    color: botInfo.displayColor,
                    title: 'Airdrop v2 Update • 22w06a', 
                    description: `Introduced a vastly-improved Airdrop system, as well as a few minor bug fixes & improvements.`,
                    fields: [
                        {
                            name: 'Airdrops v2',
                            value: `
                                There are now **3 Airdrop types**, each with unique behaviour:
                                • 💰 The Ultra Airdrop: The one you know and love, but now with a payout of up to ඞ200!
                                • 🤑 The Super Airdrop: 4 people can collect up to ඞ70!
                                • 💸 The Regular Airdrop: Everybody can collect up to ඞ30 before this Airdrop expires!
                                For more help, use \`/help airdrop\`
                            `,
                            inline: false
                        },
                        {
                            name: 'Bug fixes & improvements',
                            value: `
                                • Fixed various spelling errors
                                • Added an 'Airdrop claim in progress' state to reduce confusion about claims
                                • Patched multi-user claiming of Airdrops
                            `,
                            inline: false
                        },
                    ],
                    footer: { text: 'Released 20/05/2022'}
                });
    
                await interaction.editReply({ embeds: embeds });
            }

        } else if (interaction.isButton()) {        // BUTTON INTERACTIONS
            console.log('BUTTON INTERACTION');

            // console.log(interaction);
            
            if (interaction.customId === 'claim_airdrop') {
                const interactionMessage = interaction.message;

                // Get the type of Airdrop
                const airdropType = config.airdrop.types.find(ad => ad.id === currentAirdrop.typeID);

                // Check if this user has already claimed the Airdrop
                const claimCheckUser = currentAirdrop.claimants.find(user => user.id === userInfo.id);
                if (claimCheckUser) { return }

                // Add user to that list
                currentAirdrop.claimants.push({
                    id: userInfo.id,
                    displayName: userInfo.displayName
                });

                // Calculate time between drop and claim
                const claimDelay = Math.abs((new Date().getTime() - currentAirdrop.dropDate) / 1000);

                // Update the embed
                if (airdropType.maxClaimants !== -1 && currentAirdrop.claimants.length >= airdropType.maxClaimants) { 
                    
                    // Edit the message   
                    await interactionMessage.edit({ components: [], embeds: [{
                        title: `${airdropType.emoji} This Airdrop is being claimed!`,
                        color: botInfo.displayColor,
                        description: `Check back in a second, when this claim has been processed.`,
                        footer: { text: `It took @${userInfo.displayName} ${convertHMS(claimDelay)} to claim this drop.`}
                    }] });

                    // Clear the airdrop expiration timeout
                    clearTimeout(currentAirdrop.timeout);
                }

                // Add the prize to the user's account
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/add-dollars/${currentAirdrop.payout}/?passKey=${config.apiServer.passKey}`, { method: 'POST' });
                if (response.status !== 200) { interactionMessage.edit('Something went wrong. Sorry! (error: ' + response.status); return; }
                const accountBalance = await response.json();

                // Send a DM to the user
                if (airdropType.maxClaimants !== 1) { 
                    const dmChannel = await interaction.member.createDM();
                    await dmChannel.send({ 
                        embeds: [{
                            title: `${airdropType.emoji} You claimed an Airdrop!`,
                            color: botInfo.displayColor,
                            description: `You claimed **ඞ${currentAirdrop.payout}**! Your balance is now **ඞ${accountBalance.dollars}**.`
                        }]
                    });
                }

                // Update the message
                if (airdropType.maxClaimants === 1) { 
                    const embed = { 
                        title: `💰 Claimed by @${userInfo.displayName}!`,
                        color: botInfo.displayColor,
                        description: `You've won **ඞ${currentAirdrop.payout}**! Your balance is now **ඞ${accountBalance.dollars}**.`,
                        footer: { text: `It took @${userInfo.displayName} ${convertHMS(claimDelay)} to claim this drop.`}
                    }

                    await interactionMessage.edit({ embeds: [ embed ], components: [] });
                } else if (airdropType.maxClaimants === -1 || currentAirdrop.claimants.length < airdropType.maxClaimants) { 
                    await interactionMessage.edit({ content: `Claimed by **${currentAirdrop.claimants.length}** people so far!` });
                } else { 
                    let claimants = currentAirdrop.claimants.reduce((acc, curr) => { 
                        return acc + `**@${curr.displayName}**, `
                    }, '');
                    claimants = claimants.slice(0, -2);

                    const embed = { 
                        title: `${airdropType.emoji} This Airdrop has been claimed!`,
                        color: botInfo.displayColor,
                        description: `This Airdrop of **ඞ${currentAirdrop.payout}** was claimed by ${claimants}!`,
                        footer: { text: `The last claimant took ${convertHMS(claimDelay)} to claim this drop.`}
                    }

                    await interactionMessage.edit({ embeds: [ embed ], components: [], content: null });
                }

            } else if (interaction.customId.includes('item_')) { 

                await interaction.deferUpdate();
                const interactionMessage = interaction.message;

                if (interaction.customId.includes('_equip_')) {

                    // Check if the original user sent this message
                    if (interaction.message.interaction.user.id !== userInfo.id) { return; }
                    
                    // Get that user's account
                    var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
                    if (response.status !== 200) { return; }
                    const userAccountInfo = await response.json();

                    // Get item
                    const itemID = interaction.customId.split('_')[2];
                    const item = userAccountInfo.inventory.find(x => x.id === itemID);

                    // Check for errors
                    if (!item) { return }                               // The item can't be found
                    if (item.isEquipped === true) { return; }           // The item is already equipped
                    if (item.type.isEquippable === false) { return; }   // The item can't be equipped

                    // const interactionMessage = interaction.message;

                    // Check if an item with the same type has been equipped
                    const typeEquipCheck = userAccountInfo.inventory.find(i => i.type.id === item.type.id && i.isEquipped === true);
                    if (typeEquipCheck) { 
                        
                        // Re-render the inventory
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            `You already have a ${item.type.emojiName} ${item.type.name} equipped.`,
                            'You must unequip it to equip a new item.'
                        ));
                        return
                    }

                    // Equip the item
                    var response = await fetch(`${serverDomain}items/${item.id}/equip/true/${passKeySuffix}`, {
                        method: 'POST',
                        body: JSON.stringify({}),
                        headers: {'Content-Type': 'application/json'}
                    });
                    if (response.status !== 200) { 
                        // Re-render the inventory
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            `Something went wrong (error ${response.status})`
                        ));
                        return;
                    }

                    // Re-render the inventory
                    await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                        `Item equipped!`    
                    ));
                
                } else if (interaction.customId.includes('_unequip_')) {

                    // Check if the original user sent this message
                    if (interaction.message.interaction.user.id !== userInfo.id) { return; }

                    // Get that user's account
                    var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
                    if (response.status !== 200) { return; }
                    const userAccountInfo = await response.json();

                    // Get item
                    const itemID = interaction.customId.split('_')[2];
                    const item = userAccountInfo.inventory.find(x => x.id === itemID);

                    // Check for errors
                    if (!item) { return }                               // The item can't be found
                    if (item.isEquipped === false) { return; }          // The item is already unequipped
                    if (item.type.isEquippable === false) { return; }   // The item can't be unequipped
;
                    // const interactionMessage = interaction.message;

                    // Unequip this item
                    var response = await fetch(`${serverDomain}items/${item.id}/equip/false/${passKeySuffix}`, {
                        method: 'POST',
                        body: JSON.stringify({}),
                        headers: {'Content-Type': 'application/json'}
                    });
                    if (response.status !== 200) { 
                        // Re-render the inventory
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            `Something went wrong (error ${response.status})`
                        ));
                        return;
                    }

                    // Re-render the inventory
                    await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                        `Item unequipped!`    
                    ));

                } else if (interaction.customId.includes('_drop_')) { 

                    // Check if the original user sent this message
                    if (interaction.message.interaction.user.id !== userInfo.id) { return; }

                    // Get that user's account
                    var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
                    if (response.status !== 200) { return; }
                    const userAccountInfo = await response.json();

                    // Get item
                    const itemID = interaction.customId.split('_')[2];
                    const item = userAccountInfo.inventory.find(x => x.id === itemID);

                    // Check for errors
                    if (!item) { return }                               // The item can't be found

                    // Attempt to unequip the item
                    var response = await fetch(`${serverDomain}items/${item.id}/equip/false/${passKeySuffix}`, {
                        method: 'POST',
                        body: JSON.stringify({}),
                        headers: {'Content-Type': 'application/json'}
                    });

                    // "Drop" the item
                    await interaction.channel.send({
                        embeds: [{
                            title: `@${userInfo.displayName} has dropped their ${item.rarity.emojiName} ${item.type.emojiName} *${item.name}*`,
                            description: `The first person to collect this item can keep it!`,
                            color: botInfo.displayColor
                        }],
                        components: [
                            { type: 1, components: [
                                { type: 2, label: 'Collect', style: 1, custom_id: `item_collect_${itemID}` }
                            ]}
                        ]
                    });

                    // Re-render the inventory
                    await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                        `Item dropped!`
                    ));

                } else if (interaction.customId.includes('_collect_')) { 

                    // Get item
                    const itemID = interaction.customId.split('_')[2];

                    var response = await fetch(`${serverDomain}items/${itemID}/false/${passKeySuffix}`);
                    if (response.status !== 200) { return; }
                    const itemInfo = (await response.json())[0];

                    // Send to the user
                    var response = await fetch(`${serverDomain}items/${itemID}/transfer/${userInfo.id}/true/${passKeySuffix}`, { method: 'POST' });
                    if (response.status !== 200) { return; }

                    console.log(itemInfo);
                    await interactionMessage.edit({ embeds: [{
                        title: `@${userInfo.displayName} has picked up ${itemInfo.rarity.emojiName} ${itemInfo.type.emojiName} *${itemInfo.name}*`, 
                        color: botInfo.displayColor
                    }], components: []})
                } else if (interaction.customId.includes('_consume_')) {

                    // Check if the original user sent this message
                    if (interaction.message.interaction.user.id !== userInfo.id) { return; }
                    
                    // Get that user's account
                    var response = await fetch(`${serverDomain}accounts/${userInfo.id}/${passKeySuffix}`);
                    if (response.status !== 200) { return; }
                    const userAccountInfo = await response.json();

                    // Get item
                    const itemID = interaction.customId.split('_')[2];
                    const item = userAccountInfo.inventory.find(x => x.id === itemID);

                    // Check for errors
                    if (!item) { return }                               // The item can't be found

                    const interactionMessage = interaction.message;

                    console.log(item);

                    // Add any attributes
                    for (const attribute of item.attributes) { 

                        if (attribute.name === 'health') {              // HEALTH
                            
                            // Calculate HP to add
                            let addHp = attribute.value;
                            if (attribute.duration) { addHp = addHp * attribute.duration; } // Add the entire effect to this

                            // Get that user's account
                            var response = await fetch(`${serverDomain}accounts/${userInfo.id}/add-hp/${addHp}/${passKeySuffix}`, { method: 'POST' });
                            if (response.status !== 200) {  
                                // Re-render the inventory
                                await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                    `An error occurred while adding health (error ${response.status})`
                                ));
                                return;
                            }

                            // Remove that item
                            var response = await fetch(`${serverDomain}items/${itemID}/delete/${passKeySuffix}`, { method: 'POST' });
                            if (response.status !== 200) {  
                                // Re-render the inventory
                                await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                    `An error occurred while removing item (error ${response.status})`
                                ));
                                return;
                            }

                            // Re-render the inventory
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `Consumed *${item.name}*! Added **+${addHp} HP**.`
                            ));
                        }

                    }

                }

            } else if (interaction.customId.includes('weapon_')) { 

                // Check if the original user sent this message
                if (interaction.message.interaction.user.id !== userInfo.id) { return; }
                
                // await interaction.deferUpdate();
                interaction.deferUpdate();
                const interactionMessage = interaction.message;

                if (interaction.customId.includes('_swing_')) {

                    // Get the item
                    const itemID = interaction.customId.split('_')[2];
                    var response = await fetch(`${serverDomain}items/${itemID}/false/${passKeySuffix}`);
                    if (response.status !== 200) { 
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            `An error occurred while finding your item (error ${response.status})`
                        )); return;
                    }
                    const itemInfo = (await response.json())[0];

                    // Remove 1 durability
                    itemInfo.attributes.find(att => att.name === 'durability').value -= 1;
                    console.log(itemInfo.attributes.find(att => att.name === 'durability'));

                    var response = await fetch(`${serverDomain}items/${itemID}/edit/${passKeySuffix}`, {
                        method: 'POST',
                        body: JSON.stringify({
                            name: itemInfo.name,
                            description: itemInfo.description,
                            rarityID: itemInfo.rarity.id,
                            typeID: itemInfo.type.id,
                            ownerID: itemInfo.ownerID,
                            attributes: itemInfo.attributes
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (response.status !== 200) { 
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            `An error occurred while removing item durability (error ${response.status})`
                        )); return;
                    }

                    const result = chance.weighted(
                        [ 'a', 'b', 'c', 'd' ],
                        [ 0.9, 0.09, 0.01, 0.000000001 ]
                    );

                    if (result === 'a') {           // Nothing

                        const message = '...and nothing happened. ' + chance.weighted(
                            [ 
                                'Well, that was awkward...', 
                                'What a waste of durability.', 
                                'You could\'ve sworn something cool was going to happen.', 
                                'Well, you feel like a fucking idiot now, don\'t you?',
                                'Just keep going, there\'s something cool here...'
                            ],
                            [ 0.3, 0.3, 0.3, 0.1, 0.001 ]
                        )
                        
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'You swung your weapon!', 
                            message
                        ));

                    } else if (result === 'b') {    // Drop apple

                        // Generate apple
                        var response = await fetch(`${serverDomain}items/create/${passKeySuffix}`, {
                            method: 'POST',
                            body: JSON.stringify({
                                name: 'Apple',
                                rarityID: 1,
                                typeID: 3,
                                amount: 1,
                                ownerID: userInfo.id,
                                attributes: [ { "name" : "health", "value": 5 } ]
                            }),
                            headers: { 'Content-Type': 'application/json' }
                        });
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while generating an apple (error ${response.status})`
                            )); return;
                        }

                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'You swung your weapon!', 
                            `...and hit a tree, and it dropped an apple!`
                        ));
                    
                    } else if (result === 'c') {    // Hit another player

                        var response = await fetch(`${serverDomain}accounts/leaderboard/${passKeySuffix}`);
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while getting the leaderboard (error ${response.status})`
                            )); return;
                        }
                        const accounts = await response.json();

                        // Pick a random user
                        const attackPlayer = accounts[chance.natural({ min: 0, max: accounts.length - 1 })];
                        // const attackPlayer = { id: '312163345874550784' }

                        // Remove HP (deal 1/3 the damage of that weapon), min of 1
                        const damage = Math.ceil(itemInfo.attributes.find(i => i.name === 'damage').value / 3);
                        var response = await fetch(`${serverDomain}accounts/${attackPlayer.id}/add-hp/${0 - damage}/${passKeySuffix}`, { method: 'POST' });
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while attacking a player (error ${response.status})`
                            )); return;
                        }
                        const newHealth = await response.json();

                        // Get teh attacked player's info
                        const attackPlayerInfo = await userInfo.guild.members.fetch(attackPlayer.id)

                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'You swung your weapon!', 
                            `...and hit **@${attackPlayerInfo.displayName}**! They now have **${newHealth.hp} HP**.`
                        ));

                    } else if (result === 'd') {    // Give the most powerful melee weapon

                        // Generate apple
                        var response = await fetch(`${serverDomain}items/create/${passKeySuffix}`, {
                            method: 'POST',
                            body: JSON.stringify({
                                name: '/KILL',
                                description: `A weapon of mass destruction gifted to you by the devs themselves. Use it wisely. 1 in 1B chance of dropped when you swing your weapon.`,
                                rarityID: 14,
                                typeID: 0,
                                amount: 1,
                                ownerID: userInfo.id,
                                attributes: [ 
                                    { "name" : "dev access", "value": 1 },
                                    { "name" : "damage", "value": 420 },
                                    { "name" : "speed", "value": 420 },
                                    { "name" : "durability", "value": 69 }
                                ]
                            }),
                            headers: { 'Content-Type': 'application/json' }
                        });
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while giving you the most powerful weapon (error ${response.status})`
                            )); return;
                        }

                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'YOU SWUNG YOUR WEAPON!', 
                            '...AND THE DEVS GAVE YOU THE ABILITY TO /KILL!'
                        ));

                    }

                } else if (interaction.customId.includes('_shoot_')) {

                    // Get the item
                    const itemID = interaction.customId.split('_')[2];
                    var response = await fetch(`${serverDomain}items/${itemID}/false/${passKeySuffix}`);
                    if (response.status !== 200) { 
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            `An error occurred while finding your item (error ${response.status})`
                        )); return;
                    }
                    const itemInfo = (await response.json())[0];

                    // Remove 1 durability
                    itemInfo.attributes.find(att => att.name === 'durability').value -= 1;
                    console.log(itemInfo.attributes.find(att => att.name === 'durability'));

                    var response = await fetch(`${serverDomain}items/${itemID}/edit/${passKeySuffix}`, {
                        method: 'POST',
                        body: JSON.stringify({
                            name: itemInfo.name,
                            description: itemInfo.description,
                            rarityID: itemInfo.rarity.id,
                            typeID: itemInfo.type.id,
                            ownerID: itemInfo.ownerID,
                            attributes: itemInfo.attributes
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (response.status !== 200) { 
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            `An error occurred while removing item durability (error ${response.status})`
                        )); return;
                    }

                    const result = chance.weighted(
                        [ 'a', 'b', 'c', 'd' ],
                        [ 0.9, 0.09, 0.01, 0.000000001 ]
                    );

                    if (result === 'a') {           // Nothing

                        const message = '...and nothing happened. ' + chance.weighted(
                            [ 
                                'Well, that was awkward...', 
                                'What a waste of ammo.', 
                                'You could\'ve sworn something cool was going to happen.', 
                                'Well, you feel like a fucking idiot now, don\'t you?',
                                'Keep going, there\'s something cool around here, somewhere...'
                            ],
                            [ 0.3, 0.3, 0.3, 0.1, 0.001 ]
                        )
                        
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'You shot your weapon!', 
                            message
                        ));

                    } else if (result === 'b') {    // Drop apple

                        // Generate apple
                        var response = await fetch(`${serverDomain}items/create/${passKeySuffix}`, {
                            method: 'POST',
                            body: JSON.stringify({
                                name: 'Apple',
                                rarityID: 1,
                                typeID: 3,
                                amount: 1,
                                ownerID: userInfo.id,
                                attributes: [ { "name" : "health", "value": 5 } ]
                            }),
                            headers: { 'Content-Type': 'application/json' }
                        });
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while creating an apple (error ${response.status})`
                            )); return;
                        }

                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'You shot your weapon!', 
                            `...and it hit a tree, and dropping an apple!`
                        ));
                    
                    } else if (result === 'c') {    // Hit another player

                        var response = await fetch(`${serverDomain}accounts/leaderboard/${passKeySuffix}`);
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while getting the leaderboard (error ${response.status})`
                            )); return;
                        }
                        const accounts = await response.json();

                        // Pick a random user
                        // const attackPlayer = accounts[chance.natural({ min: 0, max: accounts.length - 1 })];
                        const attackPlayer = { id: '312163345874550784' }
                        console.log(attackPlayer);

                        // Remove HP (deal 1/3 the damage of that weapon), min of 1
                        const damage = Math.ceil(itemInfo.attributes.find(i => i.name === 'damage').value / 3);
                        var response = await fetch(`${serverDomain}accounts/${attackPlayer.id}/add-hp/${0 - damage}/${passKeySuffix}`, { method: 'POST' });
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while attacking a player (error ${response.status})`
                            )); return;
                         }
                        const newHealth = await response.json();

                        // Get teh attacked player's info
                        const attackPlayerInfo = await userInfo.guild.members.fetch(attackPlayer.id)

                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'You shot your weapon!', 
                            `...and it hit **@${attackPlayerInfo.displayName}**! They now have **${newHealth.hp} HP**.`
                        ));

                    } else if (result === 'd') {    // Give the most powerful ranged weapon

                        // Generate apple
                        var response = await fetch(`${serverDomain}items/create/${passKeySuffix}`, {
                            method: 'POST',
                            body: JSON.stringify({
                                name: 'ADMIN ABUSE',
                                description: `With great power comes great responsibility. 1 in 1B chance of dropped when you shoot a ranged weapon.`,
                                rarityID: 14,
                                typeID: 1,
                                amount: 1,
                                ownerID: userInfo.id,
                                attributes: [ 
                                    { "name" : "dev access", "value": 1 },
                                    { "name" : "damage", "value": 420 },
                                    { "name" : "speed", "value": 420 },
                                    { "name" : "durability", "value": 69 }
                                ]
                            }),
                            headers: { 'Content-Type': 'application/json' }
                        });
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while giving you the most powerful weapon (error ${response.status})`
                            )); return;
                        }

                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'YOU SHOT YOUR WEAPON!', 
                            '...AND THE DEVS PROVIDED YOU WITH THE POWER TO ABUSE!!!'
                        ));

                    }
                } else if (interaction.customId.includes('_throw_')) {

                    // Get the item
                    const itemID = interaction.customId.split('_')[2];
                    var response = await fetch(`${serverDomain}items/${itemID}/false/${passKeySuffix}`);
                    if (response.status !== 200) { 
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            `An error occurred while finding your item (error ${response.status})`
                        )); return;
                    }
                    const itemInfo = (await response.json())[0];

                    // Remove 1 durability
                    itemInfo.attributes.find(att => att.name === 'durability').value -= 1;
                    console.log(itemInfo.attributes.find(att => att.name === 'durability'));

                    var response = await fetch(`${serverDomain}items/${itemID}/edit/${passKeySuffix}`, {
                        method: 'POST',
                        body: JSON.stringify({
                            name: itemInfo.name,
                            description: itemInfo.description,
                            rarityID: itemInfo.rarity.id,
                            typeID: itemInfo.type.id,
                            ownerID: itemInfo.ownerID,
                            attributes: itemInfo.attributes
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (response.status !== 200) { 
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            `An error occurred while removing item durability (error ${response.status})`
                        )); return;
                    }

                    const result = chance.weighted(
                        [ 'a', 'b', 'c', 'd' ],
                        [ 0.9, 0.09, 0.01, 0.000000001 ]
                    );

                    if (result === 'a') {           // Nothing

                        const message = '...and nothing happened. ' + chance.weighted(
                            [ 
                                'Well, that was awkward...', 
                                'What a waste of durability.', 
                                'You could\'ve sworn something cool was going to happen.', 
                                'Well, you feel like a fucking idiot now, don\'t you?',
                                'Keep going, there\'s something cool around here, somewhere...'
                            ],
                            [ 0.3, 0.3, 0.3, 0.1, 0.001 ]
                        )
                        
                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'You threw your weapon!', 
                            message
                        ));

                    } else if (result === 'b') {    // Drop apple

                        // Generate apple
                        var response = await fetch(`${serverDomain}items/create/${passKeySuffix}`, {
                            method: 'POST',
                            body: JSON.stringify({
                                name: 'Apple',
                                rarityID: 1,
                                typeID: 3,
                                amount: 1,
                                ownerID: userInfo.id,
                                attributes: [ { "name" : "health", "value": 5 } ]
                            }),
                            headers: { 'Content-Type': 'application/json' }
                        });
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while creating an apple (error ${response.status})`
                            )); return;
                        }

                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'You threw your weapon!', 
                            `...and it hit a tree, and dropping an apple!`
                        ));
                    
                    } else if (result === 'c') {    // Hit another player

                        var response = await fetch(`${serverDomain}accounts/leaderboard/${passKeySuffix}`);
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while getting the leaderboard (error ${response.status})`
                            )); return;
                        }
                        const accounts = await response.json();

                        // Pick a random user
                        // const attackPlayer = accounts[chance.natural({ min: 0, max: accounts.length - 1 })];
                        const attackPlayer = { id: '312163345874550784' }
                        console.log(attackPlayer);

                        // Remove HP (deal 1/3 the damage of that weapon), min of 1
                        const damage = Math.ceil(itemInfo.attributes.find(i => i.name === 'damage').value / 3);
                        var response = await fetch(`${serverDomain}accounts/${attackPlayer.id}/add-hp/${0 - damage}/${passKeySuffix}`, { method: 'POST' });
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while attacking a player (error ${response.status})`
                            )); return;
                         }
                        const newHealth = await response.json();

                        // Get teh attacked player's info
                        const attackPlayerInfo = await userInfo.guild.members.fetch(attackPlayer.id)

                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'You threw your weapon!', 
                            `...and it hit **@${attackPlayerInfo.displayName}**! They now have **${newHealth.hp} HP**.`
                        ));

                    } else if (result === 'd') {    // Give the most powerful throwable weapon

                        // Generate weapon
                        var response = await fetch(`${serverDomain}items/create/${passKeySuffix}`, {
                            method: 'POST',
                            body: JSON.stringify({
                                name: 'THE YEET-O-MATIC 69420',
                                description: `In this world, it's either yeet or be yeeted. 1 in 1B chance of dropped when you yeet a throwable weapon.`,
                                rarityID: 14,
                                typeID: 2,
                                amount: 1,
                                ownerID: userInfo.id,
                                attributes: [ 
                                    { "name" : "dev access", "value": 1 },
                                    { "name" : "damage", "value": 420 },
                                    { "name" : "speed", "value": 420 },
                                    { "name" : "durability", "value": 69 }
                                ]
                            }),
                            headers: { 'Content-Type': 'application/json' }
                        });
                        if (response.status !== 200) { 
                            await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                                `An error occurred while giving you the most powerful weapon (error ${response.status})`
                            )); return;
                        }

                        await interactionMessage.edit(await generateInventory(userInfo, botInfo, itemID, 
                            'YOU THREW YOUR WEAPON!', 
                            '...AND THE DEVS PROVIDED YOU WITH THE ULTIMATE YEETER!!!'
                        ));

                    }
                }
            }

        } else if (interaction.isMessageComponent()) { 

            if (interaction.customId === 'item_select') {

                // Check if the original user sent this message
                if (interaction.message.interaction.user.id !== userInfo.id) { return; }

                await interaction.deferUpdate();
                const interactionMessage = interaction.message;

                await interactionMessage.edit(await generateInventory(userInfo, botInfo, interaction.values[0]));
            }

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
//     const id = 'e5005708-b6fc-4b51-9d43-6586ea88dcaf';
//     const response = await fetch(`${serverDomain}items/${id}/delete/${passKeySuffix}`, { method: 'POST' });

//     console.log(response);
// })();