const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { GuildConfig, RaidSetup, RaidPreset } = require('../models');

const RAID_ROLE_ID = '1378416991500636181'; // Your raid manager role ID (previously Event Manager)
const RAID_NOTIFICATION_ROLE_ID = '1370905658311970836';
const debug = require('debug')('bot:raid');
debug.enabled = true;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('raid')
        .setDescription('Manage Albion raid CTAs')
        // Setup subcommand
        .addSubcommand(sub => sub
            .setName('setup')
            .setDescription('Create a new raid CTA')
            .addStringOption(opt => opt
                .setName('preset')
                .setDescription('Choose a raid preset')
                .setRequired(true)
                .setAutocomplete(true))
            .addStringOption(opt => opt
                .setName('date')
                .setDescription('Raid date in YYYY-MM-DD')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('time')
                .setDescription('Raid time in UTC (HH:MM)')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('description')
                .setDescription('Short description or instructions')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('gear_requirement')
                .setDescription('Optional: Gear type requirement (e.g., 6.1)')
                .setRequired(false))
            .addStringOption(opt => opt
                .setName('item_power')
                .setDescription('Optional: Minimum Item Power (IP)')
                .setRequired(false))
        )
        // Preset create subcommand
        .addSubcommand(sub => sub
            .setName('preset_create')
            .setDescription('Create a new raid preset')
            .addStringOption(opt => opt
                .setName('name')
                .setDescription('Name of the preset')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('tank_slots')
                .setDescription('Number of Tank slots')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('melee_dps_slots')
                .setDescription('Number of Melee DPS slots')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('ranged_dps_slots')
                .setDescription('Number of Ranged DPS slots')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('magic_dps_slots')
                .setDescription('Number of Magic DPS slots')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('healer_holy_slots')
                .setDescription('Number of Holy Healer slots')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('healer_nature_slots')
                .setDescription('Number of Nature Healer slots')
                .setRequired(true))
            .addIntegerOption(opt => opt
                .setName('support_slots')
                .setDescription('Number of Support slots')
                .setRequired(true))
        )
        // Other subcommands
        .addSubcommand(sub => sub
            .setName('preset_list')
            .setDescription('List all saved raid presets'))
        .addSubcommand(sub => sub
            .setName('preset_delete')
            .setDescription('Delete a preset')
            .addStringOption(opt => opt
                .setName('name')
                .setDescription('Name of the preset to delete')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(sub => sub
            .setName('cancel')
            .setDescription('Cancel a raid')
            .addStringOption(opt => opt
                .setName('id')
                .setDescription('Message ID of the raid to cancel')
                .setRequired(true))),
        // .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages), // Set to 0 to handle permissions in code

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
			
			if (sub === 'preset_list') {
				await interaction.deferReply({ ephemeral: true });
			} else {
				await interaction.deferReply({ ephemeral: false });
			}


            // Fetch member with error handling
            const member = await interaction.guild.members.fetch(userId).catch(err => {
                console.error(`Error fetching member ${userId}:`, err);
                return null;
            });

            if (!member) {
                return interaction.editReply({ // Use editReply as deferReply was called
                    content: '❌ Could not retrieve your Discord member data. Please try again.',
                    ephemeral: true
                });
            }

            const guild = interaction.guild;
            const raidRole = guild.roles.cache.get(RAID_ROLE_ID);

            // --- Consolidated Permission Check ---
            // Check if the user has Administrator permission OR
            // if the RAID_ROLE_ID role exists AND the user's highest role position is >= the RAID_ROLE_ID's position
            const hasPermission = (
                member.permissions.has(PermissionFlagsBits.Administrator) ||
                (raidRole && member.roles.highest.position >= raidRole.position)
            );

            if (!hasPermission) {
                return interaction.editReply({ // Use editReply as deferReply was called
                    content: '⛔ You must have the Raid Manager role or Administrator permission to use this command.',
                    ephemeral: true
                });
            }

            // If raidRole isn't found but user is not admin, still block with a warning.
            // This is redundant if hasPermission check already passed, but good for clarity on config issues.
            if (!raidRole) {
                return interaction.editReply({
                    content: '⚠️ Raid manager role not found in the server. Please ensure the bot is configured correctly.',
                    ephemeral: true
                });
            }
            // --- End Permission Check ---


            const config = await GuildConfig.findOne({ where: { guildId } }).catch(err => {
                console.error(`Error fetching GuildConfig for guild ${guildId}:`, err);
                return null;
            });

            if (!config) {
                return interaction.editReply({
                    content: '❌ Guild configuration not found. Please ask an admin to set it up.',
                    ephemeral: true
                });
            }

            // Handle subcommands
            switch (sub) {
                case 'setup':
                    await this.handleSetup(interaction, guildId, userId);
                    break;
                case 'preset_create':
                    await this.handlePresetCreate(interaction, guildId);
                    break;
                case 'preset_list':
                    await this.handlePresetList(interaction, guildId);
                    break;
                case 'preset_delete':
                    await this.handlePresetDelete(interaction, guildId);
                    break;
                case 'cancel':
                    await this.handleCancel(interaction, guildId, userId, member);
                    break;
                default:
                    await interaction.editReply({
                        content: `❌ Unknown subcommand: ${sub}`,
                        ephemeral: true
                    });
            }

        } catch (error) {
            console.error('Error in raid command:', error);
            await this.handleError(interaction, error);
        }
    },

    // Subcommand handlers (remain exactly the same as before)
    async handleSetup(interaction, guildId, userId) {
        const presetName = interaction.options.getString('preset');
        const preset = await RaidPreset.findOne({
            where: { guild_id: guildId, name: presetName }
        });

        if (!preset) {
            return interaction.editReply({
                content: `❌ Preset "${presetName}" not found. Use \`/raid preset_create\` first.`,
                ephemeral: true
            });
        }

        // Create embed with raid details
        const embed = new EmbedBuilder()
            .setTitle(`📣 Raid CTA: ${presetName}`)
            .setColor(0xffcc00)
            .setDescription(interaction.options.getString('description'))
            .addFields(
                { name: '📅 Date', value: interaction.options.getString('date'), inline: true },
                { name: '🕒 Time (UTC)', value: interaction.options.getString('time'), inline: true },
                { name: '🛡️ Gear Requirement', value: interaction.options.getString('gear_requirement') || 'Not specified', inline: true },
                { name: '📈 Min Item Power', value: interaction.options.getString('item_power') || 'Not specified', inline: true },
                { name: '\u200B', value: '**Available Slots**', inline: false }
            );

        // Add slot fields
		const slotsData = typeof preset.slots === 'string' ? JSON.parse(preset.slots) : preset.slots;

		if (slotsData && typeof slotsData === 'object') {
			const slotFields = [];

			for (const [role, count] of Object.entries(slotsData)) {
				slotFields.push({
					name: `${role} (Slots: ${count})`,
					value: 'No signups yet',
					inline: true
				});
			}

			// Pad to multiple of 3 for clean row layout
			while (slotFields.length % 3 !== 0) {
				slotFields.push({ name: '\u200B', value: '\u200B', inline: true });
			}

			embed.addFields(slotFields);
		}


        // Create action rows with buttons
        const buttonsRow1 = new ActionRowBuilder().addComponents(
            ['Tank', 'Melee DPS', 'Ranged DPS', 'Magic DPS', 'Holy Healer'].map(role =>
                new ButtonBuilder()
                    .setCustomId(`raid_signup_${role}`)
                    .setLabel(role)
                    .setStyle(ButtonStyle.Primary))
        );

        const buttonsRow2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('raid_signup_Nature Healer')
                .setLabel('Nature Healer')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('raid_signup_Support')
                .setLabel('Support')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('raid_cancel_signup')
                .setLabel('Cancel Signup')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('raid_delete_cta')
                .setLabel('Delete CTA')
                .setStyle(ButtonStyle.Danger)
        );

        // Send the raid CTA
        const message = await interaction.editReply({
            embeds: [embed],
            components: [buttonsRow1, buttonsRow2],
            fetchReply: true
        });

        // Save to database
        await RaidSetup.create({
            guild_id: guildId,
            message_id: message.id,
            created_by: userId,
            preset: presetName,
            raid_date: interaction.options.getString('date'),
            raid_time: interaction.options.getString('time'),
            description: interaction.options.getString('description'),
            gear_requirement: interaction.options.getString('gear_requirement') || 'Not specified',
            item_power: interaction.options.getString('item_power') || 'Not specified',
            participants: {}
        });

        // Mention notification role
        await this.mentionNotificationRole(interaction, RAID_NOTIFICATION_ROLE_ID);
    },

    async handlePresetCreate(interaction, guildId) {
        const name = interaction.options.getString('name');
        const slots = {
            Tank: interaction.options.getInteger('tank_slots'),
            'Melee DPS': interaction.options.getInteger('melee_dps_slots'),
            'Ranged DPS': interaction.options.getInteger('ranged_dps_slots'),
            'Magic DPS': interaction.options.getInteger('magic_dps_slots'),
            'Holy Healer': interaction.options.getInteger('healer_holy_slots'),
            'Nature Healer': interaction.options.getInteger('healer_nature_slots'),
            Support: interaction.options.getInteger('support_slots')
        };

        const existing = await RaidPreset.findOne({ where: { guild_id: guildId, name } });
        if (existing) {
            return interaction.editReply({
                content: `❌ Preset "${name}" already exists.`,
                ephemeral: true
            });
        }

        await RaidPreset.create({ guild_id: guildId, name, slots });
        await interaction.editReply({
            content: `✅ Preset "${name}" created successfully!`,
            ephemeral: true
        });
    },

	async handlePresetList(interaction, guildId) {
		const presets = await RaidPreset.findAll({ where: { guild_id: guildId } });

		if (!presets.length) {
			return interaction.editReply({ content: 'No raid presets found.' });
		}

		const embed = new EmbedBuilder()
			.setTitle('Available Raid Presets')
			.setColor('Green');

		for (const preset of presets) {
			const slots = typeof preset.slots === 'string' ? JSON.parse(preset.slots) : preset.slots;

			const formattedLine = Object.entries(slots)
				.map(([role, count]) => `${role.split(' ')[0]}: ${count}`) // Show short role names
				.join(', ');

			embed.addFields({
				name: preset.name,
				value: formattedLine || 'No slot data',
				inline: false
			});
		}

		await interaction.editReply({ embeds: [embed] });
	},



    async handlePresetDelete(interaction, guildId) {
        const name = interaction.options.getString('name');
        const preset = await RaidPreset.findOne({ where: { guild_id: guildId, name } });

        if (!preset) {
            return interaction.editReply({ content: `❌ Preset "${name}" not found.` });
        }

        await preset.destroy();
        await interaction.editReply({ content: `✅ Preset "${name}" deleted.` });
    },

    async handleCancel(interaction, guildId, userId, member) {
        const messageId = interaction.options.getString('id');
        const raid = await RaidSetup.findOne({ where: { guild_id: guildId, message_id: messageId } });

        if (!raid) {
            return interaction.editReply({ content: `❌ Raid with ID "${messageId}" not found.` });
        }

        if (raid.created_by !== userId && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({
                content: '⛔ You can only cancel raids you created (unless you\'re an admin).',
                ephemeral: true
            });
        }

        await raid.destroy();

        try {
            const message = await interaction.channel.messages.fetch(messageId);
            if (message) await message.delete();
        } catch (err) {
            console.warn(`Couldn't delete message ${messageId}:`, err.message);
        }

        await interaction.editReply({
            content: `✅ Raid CTA (ID: ${messageId}) cancelled and removed.`
        });
    },

    async mentionNotificationRole(interaction, roleId) {
        try {
            const role = await interaction.guild.roles.fetch(roleId);
            if (role) {
                await interaction.followUp({
                    content: `${role} New raid posted!`,
                    ephemeral: false
                });
                debug(`Mentioned role ${role.name} for new raid.`);
            } else {
                debug(`Role ${roleId} not found for mention.`);
                await interaction.followUp({
                    content: '✅ Raid posted (role mention failed)',
                    ephemeral: true
                });
            }
        } catch (error) {
            debug(`Error mentioning role: ${error.message}`);
            await interaction.followUp({
                content: '✅ Raid posted (mention error)',
                ephemeral: true
            });
        }
    },

    async handleError(interaction, error) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred. Please try again.',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: '❌ An error occurred. Please try again.',
                    ephemeral: true
                });
            }
        } catch (err) {
            console.error('Failed to send error message:', err);
        }
    }
};