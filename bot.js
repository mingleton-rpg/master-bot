// MODULES ----------------------------------------------------------------------------
/** Discord.JS */
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents, ThreadChannel, DiscordAPIError, MessageEmbed } = require('discord.js');
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
    {   // Gamble
        name: 'gamble',
        description: 'Gamble for a chance to win ඞmoney. Has an equal chance to return more or less than you gambled.',
        options: [
            { type: 4, name: 'amount', description: 'The amount to gamble', required: true }
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
                description: 'Creates you a new Dawson RP account with ඞ100.',
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
                description: 'Find out what item types there are and how they work',
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

        // Find out how many people with the dawson-rp role are online
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

        } else if (interaction.commandName === 'gamble') { 
            
            const gambleAmount = interaction.options.getInteger('amount', false);

            if (gambleAmount < 10) { returnEmbed(interaction, botInfo, 'You need to gamble at least **ඞ10**'); return; }

            // Get the user's info
            var response = await fetch(`${serverDomain}accounts/${userInfo.id}/?passKey=${config.apiServer.passKey}`); 
            if (response.status !== 200) { returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return; }
            const userAccountInfo = await response.json();

            // Check if they have enough money
            if (gambleAmount > userAccountInfo.dollars) { returnEmbed(interaction, botInfo, 'You do not have enough ඞ Dawson Dollars'); return; }

            // Gamble that money
            const finalAmount = getRandomArbitrary(0, gambleAmount * 2);

            // Add/remove from account
            if (finalAmount > gambleAmount) { 
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/add-dollars/${finalAmount - gambleAmount}/?passKey=${config.apiServer.passKey}`, { method: 'POST' }); 
            } else { 
                var response = await fetch(`${serverDomain}accounts/${userInfo.id}/add-dollars/${0 - gambleAmount}/?passKey=${config.apiServer.passKey}`, { method: 'POST' }); 
            }

            if (response.status !== 200) { returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return; }

            if (finalAmount > gambleAmount) { 
                const embed = { 
                    title: `Congratulations! You won **ඞ${finalAmount - gambleAmount}**!`,
                    color: botInfo.displayColor,
                    description: `Depositing **ඞ${finalAmount - gambleAmount}** into your account.`
                }

                await interaction.editReply({ embeds: [ embed ] });
            } else {
                const embed = { 
                    title: `Aw, bummer :( You didn't win anything!`, 
                    color: botInfo.displayColor,
                    description: `Taking **ඞ${gambleAmount}** from your account.`
                }

                await interaction.editReply({ embeds: [ embed ] });
            }
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
                    returnEmbed(interaction, botInfo, 'You already have an account', `You already have an account in the Dawson RP! Use \`/account view\` to see your stats.`, response.status); return; 
                } else if (response.status !== 200) {
                    returnEmbed(interaction, botInfo, 'An error ocurred', `Something went wrong.`, response.status); return;
                }

                // Add the Dawson-RP Role to the user
                const role = await userInfo.guild.roles.fetch(config.bot.roleID);
                await interaction.member.roles.add([config.bot.roleID, role]);

                // Create the embed
                const embed = {
                    title: 'Account created! Welcome to Dawson RP!',
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

                // Create the embed
                const embed = {
                    title: `Statistics for @${player.displayName}`,
                    color: botInfo.displayColor,
                    description: `**@${player.displayName}** has **ඞ${userAccountInfo.dollars}** & **${userAccountInfo.hp} HP**.`
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

            }

        }

    } else if (interaction.isButton()) {        // BUTTON INTERACTIONS
        console.log('BUTTON INTERACTION');

        // console.log(interaction);
        
        if (interaction.customId === 'claimAirdrop') {

            // Clear the airdrop expiration timeout
            clearTimeout(currentAirdrop.timeout);

            // Add the prize to the user's account
            var response = await fetch(`${serverDomain}accounts/${userInfo.id}/add-dollars/${currentAirdrop.prizeMoney}/?passKey=${config.apiServer.passKey}`, { method: 'POST' });
            if (response.status !== 200) { interaction.update('Something went wrong. Sorry!'); return; }
            const accountBalance = await response.json();
            console.log(accountBalance);

            // Calculate time between drop and claim
            const claimDelay = Math.abs((new Date().getTime() - currentAirdrop.dropDate) / 1000);

            // Edit the original message
            const embed = { 
                title: `💰 Claimed by @${userInfo.displayName}!`,
                color: botInfo.displayColor,
                description: `You've won **ඞ${currentAirdrop.prizeMoney}**! Your balance is now **ඞ${accountBalance.dollars}**.`,
                footer: { text: `It took @${userInfo.displayName} ${convertHMS(claimDelay)} to claim this drop.`}
            }

            await interaction.update({ embeds: [ embed ], components: [] });

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
        for (value of selectedItem.attributes) { 
            attributesText += `**${capitalize(value.name)}:** ${value.value} \n`
        }

        let embed = {
            title: `${selectedItem.type.emojiName} *${selectedItem.name}*`,
            color: botInfo.displayColor,
            description: `${selectedItem.rarity.emojiName} ${capitalize(selectedItem.rarity.name)} ${selectedItem.type.name}.`,
            fields: [
                { name: 'Item stats', value: attributesText || 'This item has no stats' }
            ]
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
});



// RUN BOT ----------------------------------------------------------------------------
client.login(process.env.DISCORD_API_KEY);