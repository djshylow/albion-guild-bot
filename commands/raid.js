const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GuildConfig, RaidSetup, RaidPreset } = require('../models');

const debug = require('debug')('bot:raid');
debug.enabled = true;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raid')
        .setDescription('Manage Albion raid CTAs')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Create a new raid CTA')
                .addStringOption(opt =>
                    opt.setName('preset')
                        .setDescription('Choose a raid preset')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(opt =>
                    opt.setName('date')
                        .setDescription('Raid date in YYYY-MM-DD')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('time')
                        .setDescription('Raid time in UTC (HH:MM)')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('description')
                        .setDescription('Short description or instructions')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('gear_requirement')
                        .setDescription('Optional: Gear type requirement (e.g., 6.1)')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('item_power')
                        .setDescription('Optional: Minimum Item Power (IP)')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('preset_create')
                .setDescription('Create a new raid preset')
                .addStringOption(opt => opt.setName('name').setDescription('Name of the preset').setRequired(true))
                .addIntegerOption(opt => opt.setName('tank_slots').setDescription('Number of Tank slots').setRequired(true))
                .addIntegerOption(opt => opt.setName('melee_dps_slots').setDescription('Number of Melee DPS slots').setRequired(true))
                .addIntegerOption(opt => opt.setName('ranged_dps_slots').setDescription('Number of Ranged DPS slots').setRequired(true))
                .addIntegerOption(opt => opt.setName('magic_dps_slots').setDescription('Number of Magic DPS slots').setRequired(true))
                .addIntegerOption(opt => opt.setName('healer_holy_slots').setDescription('Number of Holy Healer slots').setRequired(true))
                .addIntegerOption(opt => opt.setName('healer_nature_slots').setDescription('Number of Nature Healer slots').setRequired(true))
                .addIntegerOption(opt => opt.setName('support_slots').setDescription('Number of Support slots').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('preset_list')
                .setDescription('List all saved raid presets')
        )
        .addSubcommand(sub =>
            sub.setName('preset_delete')
                .setDescription('Delete a preset')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Name of the preset to delete')
                        .setRequired(true)
                        .setAutocomplete(true))
        )
        .addSubcommand(sub =>
            sub.setName('cancel')
                .setDescription('Cancel a raid')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('Message ID of the raid to cancel')
                        .setRequired(true))
        )

	.setDefaultMemberPermissions(0),
    async autocomplete(interaction) {
        try {
            const focusedOption = interaction.options.getFocused(true);
            const guildId = interaction.guild.id;

            if (focusedOption.name === 'preset' || focusedOption.name === 'name') {
                const presets = await RaidPreset.findAll({ where: { guild_id: guildId } });
                const filtered = presets.filter(preset =>
                    preset.name.toLowerCase().includes(focusedOption.value.toLowerCase())
                );
                await interaction.respond(
                    filtered.map(preset => ({ name: preset.name, value: preset.name }))
                );
            }
        } catch (error) {
            console.error('Autocomplete error:', error);
        }
    },

    async execute(interaction) {
        try {
            const sub = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            // Defer reply for the initial command. This will be edited later.
            // Keeping it non-ephemeral so the initial message and follow-up are public.
            await interaction.deferReply(); 

            const member = await interaction.guild.members.fetch(userId).catch(err => {
                console.error(`Error fetching member ${userId}:`, err);
                return null;
            });

            if (!member) {
                return interaction.editReply({ content: '❌ Could not retrieve your Discord member data. Please try again.', ephemeral: true });
            }

            const config = await GuildConfig.findOne({ where: { guildId } }).catch(err => {
                console.error(`Error fetching GuildConfig for guild ${guildId}:`, err);
                return null;
            });

            if (!config) {
                return interaction.editReply({ content: '❌ Guild configuration not found. Please ask an admin to set it up.', ephemeral: true });
            }

			const eventManagerRole = interaction.guild.roles.cache.get('1378416991500636181');
			const modRole = interaction.guild.roles.cache.get(config.modRole);

			const hasPermission = (
				(eventManagerRole && member.roles.cache.has(eventManagerRole.id)) || // Checks if they have the specific Event Manager role
				(modRole && member.roles.highest.position >= modRole.position) ||     // Checks if their highest role is >= mod role
				member.permissions.has(PermissionFlagsBits.Administrator)             // Checks if they are an administrator
			);

			if (!hasPermission) {
				return interaction.editReply({ content: '⛔ You lack permission to use this command.', ephemeral: true });
			}
            // --- Subcommand Handling ---
            if (sub === 'setup') {
                const presetName = interaction.options.getString('preset');
                const preset = await RaidPreset.findOne({ where: { guild_id: guildId, name: presetName } }).catch(err => {
                    console.error(`Error finding preset "${presetName}":`, err);
                    return null;
                });

                if (!preset) {
                    return interaction.editReply({ content: `❌ Preset "${presetName}" not found. Please create it first using \`/raid preset_create\`.`, ephemeral: true });
                }

                const date = interaction.options.getString('date');
                const time = interaction.options.getString('time');
                const description = interaction.options.getString('description');
                const gearRequirement = interaction.options.getString('gear_requirement') || 'Not specified';
                const itemPower = interaction.options.getString('item_power') || 'Not specified';

                const embed = new EmbedBuilder()
                    .setTitle(`📣 Raid CTA: ${presetName}`)
                    .setColor(0xffcc00)
                    .setDescription(description)
                    .addFields(
                        { name: '📅 Date', value: date, inline: true },
                        { name: '🕒 Time (UTC)', value: time, inline: true },
                        { name: '🛡️ Gear Requirement', value: gearRequirement, inline: true },
                        { name: '📈 Min Item Power', value: itemPower, inline: true },
                        { name: '\u200B', value: '**Available Slots**', inline: false }
                    );

                const slotsData = typeof preset.slots === 'string' ? JSON.parse(preset.slots) : preset.slots;
                if (slotsData && typeof slotsData === 'object') {
                    for (const [role, count] of Object.entries(slotsData)) {
                        embed.addFields({
                            name: `${role} (Slots: ${count})`,
                            value: 'No signups yet',
                            inline: true
                        });
                    }
                } else {
                    console.warn(`Warning: preset.slots is not a valid object for preset "${presetName}":`, preset.slots);
                    embed.addFields({ name: 'Slots', value: 'Invalid preset configuration.', inline: false });
                }

                const buttonsRow1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`raid_signup_Tank`)
                        .setLabel('Tank')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`raid_signup_Melee DPS`)
                        .setLabel('Melee DPS')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`raid_signup_Ranged DPS`)
                        .setLabel('Ranged DPS')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`raid_signup_Magic DPS`)
                        .setLabel('Magic DPS')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`raid_signup_Holy Healer`)
                        .setLabel('Holy Healer')
                        .setStyle(ButtonStyle.Primary),
                );

                const buttonsRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`raid_signup_Nature Healer`)
                        .setLabel('Nature Healer')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`raid_signup_Support`)
                        .setLabel('Support')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`raid_cancel_signup`)
                        .setLabel('Cancel Signup')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`raid_delete_cta`)
                        .setLabel('Delete CTA')
                        .setStyle(ButtonStyle.Danger),
                );

                const message = await interaction.editReply({
                    embeds: [embed],
                    components: [buttonsRow1, buttonsRow2],
                    fetchReply: true
                });

                await RaidSetup.create({
                    guild_id: guildId,
                    message_id: message.id,
                    created_by: userId,
                    preset: presetName,
                    raid_date: date,
                    raid_time: time,
                    description,
                    gear_requirement: gearRequirement,
                    item_power: itemPower,
                    participants: {} // Initialize empty participants object
                }).catch(err => {
                    console.error(`Error saving RaidSetup for guild ${guildId}, message ${message.id}:`, err);
                    throw err;
                });

                // --- NEW ADDITION FOR ROLE MENTION ---
                const targetRoleId = '1370905658311970836'; // Your specific role ID
                const guild = interaction.guild;

                try {
                    const roleToMention = await guild.roles.fetch(targetRoleId);
                    if (roleToMention) {
                        await interaction.followUp({
                            content: `${roleToMention} New raid posted!`,
                            ephemeral: false // Visible to everyone
                        });
                        debug(`Successfully mentioned role ${roleToMention.name} for new raid.`);
                    } else {
                        debug(`Role with ID ${targetRoleId} not found in guild ${guild.name}. Cannot mention.`);
                        await interaction.followUp({
                            content: `✅ Raid CTA posted! (Could not find role for mention with ID ${targetRoleId})`,
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    debug(`Error fetching or mentioning role ${targetRoleId}: ${error.message}`);
                    await interaction.followUp({
                        content: `✅ Raid CTA posted! (Error mentioning role)`,
                        ephemeral: true
                    });
                }
                // --- END NEW ADDITION ---

            } else if (sub === 'preset_create') {
                const name = interaction.options.getString('name');
                const tankSlots = interaction.options.getInteger('tank_slots');
                const meleeDpsSlots = interaction.options.getInteger('melee_dps_slots');
                const rangedDpsSlots = interaction.options.getInteger('ranged_dps_slots');
                const magicDpsSlots = interaction.options.getInteger('magic_dps_slots');
                const healerHolySlots = interaction.options.getInteger('healer_holy_slots');
                const healerNatureSlots = interaction.options.getInteger('healer_nature_slots');
                const supportSlots = interaction.options.getInteger('support_slots');

                const slots = {
                    Tank: tankSlots,
                    'Melee DPS': meleeDpsSlots,
                    'Ranged DPS': rangedDpsSlots,
                    'Magic DPS': magicDpsSlots,
                    'Holy Healer': healerHolySlots,
                    'Nature Healer': healerNatureSlots,
                    Support: supportSlots,
                };

                const existingPreset = await RaidPreset.findOne({ where: { guild_id: guildId, name: name } }).catch(err => {
                    console.error(`Error checking for existing preset "${name}":`, err);
                    throw err;
                });

                if (existingPreset) {
                    return await interaction.editReply({ content: `❌ A preset named "${name}" already exists. Please choose a different name.`, ephemeral: true });
                }

                await RaidPreset.create({
                    guild_id: guildId,
                    name: name,
                    slots: slots
                }).catch(err => {
                    console.error(`Error saving new preset "${name}":`, err);
                    throw err;
                });

                await interaction.editReply({ content: `✅ Raid preset "${name}" created successfully!`, ephemeral: true });
            }
            else if (sub === 'preset_list') {
                await interaction.deferReply({ ephemeral: true });
                const presets = await RaidPreset.findAll({ where: { guild_id: guildId } });

                if (presets.length === 0) {
                    return await interaction.editReply({ content: 'No raid presets found for this guild.' });
                }

                const presetList = presets.map(p => {
                    const slots = typeof p.slots === 'string' ? JSON.parse(p.slots) : p.slots;
                    const slotDetails = Object.entries(slots).map(([role, count]) => `${role}: ${count}`).join(', ');
                    return `**${p.name}**: ${slotDetails}`;
                }).join('\n');

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Available Raid Presets')
                            .setDescription(presetList)
                            .setColor('Green')
                    ]
                });
            }
            else if (sub === 'preset_delete') {
                await interaction.deferReply({ ephemeral: true });
                const name = interaction.options.getString('name');

                const presetToDelete = await RaidPreset.findOne({ where: { guild_id: guildId, name: name } });

                if (!presetToDelete) {
                    return await interaction.editReply({ content: `❌ Preset "${name}" not found.` });
                }

                await presetToDelete.destroy();
                await interaction.editReply({ content: `✅ Preset "${name}" deleted successfully!` });
            }
            else if (sub === 'cancel') {
                await interaction.deferReply({ ephemeral: true });
                const messageId = interaction.options.getString('id');

                const raidToCancel = await RaidSetup.findOne({ where: { guild_id: guildId, message_id: messageId } });

                if (!raidToCancel) {
                    return await interaction.editReply({ content: `❌ Raid with message ID "${messageId}" not found.` });
                }

                if (raidToCancel.created_by !== userId && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.editReply({ content: '⛔ You can only cancel raids you created, or if you are an administrator.' });
                }

                await raidToCancel.destroy();
                await interaction.editReply({ content: `✅ Raid CTA with message ID "${messageId}" has been cancelled and removed from the database.` });
                try {
                    const message = await interaction.channel.messages.fetch(messageId);
                    if (message) {
                        await message.delete();
                    }
                } catch (msgError) {
                    console.warn(`Could not delete Discord message ${messageId}:`, msgError.message);
                    await interaction.followUp({ content: '⚠️ Could not delete the Discord message itself (it may have already been deleted or is too old).', ephemeral: true });
                }
            }
            else {
                console.warn(`Unhandled subcommand received: ${sub}`);
                await interaction.editReply({ content: `❌ Unhandled subcommand: \`${sub}\`. This command is not yet implemented or has an issue.` });
            }

        } catch (error) {
            console.error('Unhandled ERROR in /raid command execution:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ An unexpected error occurred while processing your command.', ephemeral: true });
                } else {
                    await interaction.editReply({ content: '❌ An unexpected error occurred while processing your command.', ephemeral: true });
                }
            } catch (replyError) {
                console.error('Failed to send error message to Discord:', replyError);
            }
        }
    }
};