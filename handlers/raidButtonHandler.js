const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { RaidSetup, RaidPreset, GuildConfig, sequelize } = require('../models');
const debug = require('debug')('bot:raidButtonHandler');
debug.enabled = true; // Ensure debug is enabled for clearer logs

// Helper function to safely parse and validate participants
function validateParticipants(participants, slotsData) {
    if (!participants || typeof participants !== 'object') {
        participants = {}; // If it's not an object, it's reset
    }

    // Ensure all roles from slots exist in participants and are arrays
    for (const role in slotsData) {
        if (!participants[role] || !Array.isArray(participants[role])) {
            participants[role] = []; // If a role is missing or not an array, it's reset to an empty array
        }
    }

    // Remove any roles in participants not present in slotsData
    for (const role in participants) {
        if (!slotsData[role]) {
            delete participants[role]; // Deletes unexpected roles
        }
    }
    return participants;
}

// Enhanced raid embed updater with error handling
async function updateRaidEmbed(raidSetup, interaction) {
    try {
        const embed = new EmbedBuilder()
            .setTitle(interaction.message.embeds[0].title || 'Raid CTA')
            .setDescription(interaction.message.embeds[0].description || '')
            .setColor(interaction.message.embeds[0].color || '#0099ff');

        embed.addFields(
            { name: '📅 Date', value: raidSetup.raid_date || 'Not specified', inline: true },
            { name: '🕒 Time (UTC)', value: raidSetup.raid_time || 'Not specified', inline: true },
            { name: '🛡️ Gear Requirement', value: raidSetup.gear_requirement || 'Not specified', inline: true },
            { name: '📈 Min IP', value: raidSetup.item_power || 'Not specified', inline: true },
            { name: '\u200B', value: '**Available Slots**', inline: false }
        );

        const preset = await RaidPreset.findOne({
            where: { guild_id: raidSetup.guild_id, name: raidSetup.preset }
        });

        if (!preset) {
            embed.addFields({ name: 'Error', value: 'Preset not found', inline: false });
            return embed;
        }

        const slotsData = typeof preset.slots === 'string' ? JSON.parse(preset.slots) : preset.slots;
        
        // Ensure participants is properly parsed
        let participants = raidSetup.participants;
        if (typeof participants === 'string') {
            try {
                participants = JSON.parse(participants);
            } catch (e) {
                participants = {};
            }
        }
        
        // Validate the structure
        participants = validateParticipants(participants, slotsData);

        for (const [role, maxSlots] of Object.entries(slotsData)) {
            const signedUp = participants[role] || [];
            
            const value = signedUp.length > 0
                ? signedUp.map(id => `<@${id}>`).join(', ')
                : 'No signups yet';
            
            embed.addFields({
                name: `${role} (${signedUp.length}/${maxSlots})`,
                value: value,
                inline: true
            });
        }

        return embed;
    } catch (error) {
        debug('Error updating embed:', error);
        return null;
    }
}
module.exports = async (interaction) => {
    const { customId, user, message } = interaction;
    // No deferUpdate here, it should be handled by interactionCreate.js

    const transaction = await sequelize.transaction();

    try {
        // Find the raid setup
        const raidSetup = await RaidSetup.findOne({
            where: { message_id: message.id },
            transaction
        });

        if (!raidSetup) {
            await interaction.followUp({
                content: '❌ Raid not found. It may have been deleted.',
                ephemeral: true
            });
            await transaction.rollback(); // Rollback if raidSetup not found
            return;
        }

        // Handle different button types
        if (customId.startsWith('raid_signup_')) {
            await handleSignup(interaction, raidSetup, transaction);
        }
        else if (customId === 'raid_cancel_signup') {
            await handleCancelSignup(interaction, raidSetup, transaction);
        }
        else if (customId === 'raid_delete_cta') {
            await handleDeleteCTA(interaction, raidSetup, transaction);
        }
        else {
            await interaction.followUp({
                content: '❌ Unknown button action',
                ephemeral: true
            });
        }

        await transaction.commit(); // Commit the transaction only if all operations succeed
    } catch (error) {
        await transaction.rollback(); // Rollback if any error occurs
        debug('Error in button handler (rolled back transaction):', error);
        
        // Attempt to send a generic error message to the user
        try {
            // Check if interaction was already replied/followed up by a sub-handler
            if (!interaction.replied && !interaction.deferred) {
                await interaction.followUp({
                    content: '❌ An unexpected error occurred. Please try again.',
                    ephemeral: true
                });
            }
        } catch (followUpError) {
            debug('Failed to send error follow-up (interaction already replied/errored?):', followUpError);
        }
    }
};

// Signup handler
async function handleSignup(interaction, raidSetup, transaction) {
    const role = interaction.customId.substring('raid_signup_'.length);
    const userId = interaction.user.id;
    
    // Get preset data
    const preset = await RaidPreset.findOne({
        where: { guild_id: raidSetup.guild_id, name: raidSetup.preset },
        transaction
    });

    if (!preset) {
        await interaction.followUp({
            content: '❌ Preset not found for this raid.',
            ephemeral: true
        });
        return;
    }

    const slotsData = typeof preset.slots === 'string' ? JSON.parse(preset.slots) : preset.slots;
    raidSetup.participants = validateParticipants(raidSetup.participants, slotsData);

    let currentRole = null;
    for (const [r, users] of Object.entries(raidSetup.participants)) {
        if (users.includes(userId)) {
            currentRole = r;
            break;
        }
    }

    if (currentRole === role) {
        await interaction.followUp({
            content: `ℹ️ You're already signed up as ${role}`,
            ephemeral: true
        });
        return;
    }

    if (currentRole) {
        raidSetup.participants[currentRole] = raidSetup.participants[currentRole].filter(id => id !== userId);
        raidSetup.changed('participants', true); // Mark as changed after filtering
        debug(`User ${interaction.user.username} removed from ${currentRole} to switch roles.`);
    }

    const maxSlots = slotsData[role];
    if (maxSlots === undefined) {
        await interaction.followUp({
            content: `❌ The role '${role}' is not a valid role in this raid's preset.`,
            ephemeral: true
        });
        return;
    }

    if (!raidSetup.participants[role]) {
        raidSetup.participants[role] = [];
    }

    if (raidSetup.participants[role].length >= maxSlots) {
        await interaction.followUp({
            content: `⛔ ${role} slots are full`,
            ephemeral: true
        });
        if (currentRole) {
            raidSetup.participants[currentRole].push(userId);
            raidSetup.changed('participants', true); // Mark as changed if pushed back
            await raidSetup.save({ transaction });
            await interaction.followUp({
                content: `Returning you to your previous role: ${currentRole}`,
                ephemeral: true
            });
        }
        return;
    }

    raidSetup.participants[role].push(userId); // User is added here
    raidSetup.changed('participants', true); // <--- ADDED THIS LINE HERE for signup
    await raidSetup.save({ transaction });
    
    // IMPORTANT: Reload the instance to ensure it has the very latest data committed
    await raidSetup.reload({ transaction }); // <-- This should update the object in memory

    // ADD THIS DEBUG LINE
    debug(`handleSignup: raidSetup.participants AFTER reload and BEFORE embed update: ${JSON.stringify(raidSetup.participants)}`);

	// Update message
    const embed = await updateRaidEmbed(raidSetup, interaction); // Pass the reloaded raidSetup
    // NEW DEBUG LINE HERE:
    debug(`handleSignup: Final embed fields before edit: ${JSON.stringify(embed.data.fields)}`); // Add this line
    if (embed) {
        await interaction.message.edit({ embeds: [embed], components: interaction.message.components }).catch(e => {
            debug('Error updating message with embed:', e);
        });
    }

    await interaction.followUp({
        content: `✅ Signed up as ${role}!`,
        ephemeral: true
    });
}

// Cancel signup handler
async function handleCancelSignup(interaction, raidSetup, transaction) {
    const userId = interaction.user.id;
    let removed = false;
    let originalRole = null;

    // Fetch preset to validate participants structure
    const preset = await RaidPreset.findOne({
        where: { guild_id: raidSetup.guild_id, name: raidSetup.preset },
        transaction
    });

    // Parse participants if it's a string
    let participants = raidSetup.participants;
    if (typeof participants === 'string') {
        try {
            participants = JSON.parse(participants);
        } catch (e) {
            participants = {};
        }
    }

    if (preset) {
        const slotsData = typeof preset.slots === 'string' ? JSON.parse(preset.slots) : preset.slots;
        participants = validateParticipants(participants, slotsData);
    } else {
        debug('Warning: Preset not found for cancel signup, attempting to remove user without full validation.');
    }

    debug(`Cancel Signup: User ${interaction.user.username} (${userId}). Participants before modification:`, JSON.stringify(participants));

    // Remove user from all roles
    for (const role in participants) {
        // Ensure participants[role] is an array before trying to filter
        if (Array.isArray(participants[role])) {
            const initialLength = participants[role].length;
            participants[role] = participants[role].filter(id => id !== userId);
            if (participants[role].length < initialLength) {
                removed = true;
                originalRole = role; // Store the role they were removed from
            }
        }
    }

    if (removed) {
        // Update the raidSetup with the modified participants
        raidSetup.participants = participants;
        raidSetup.changed('participants', true);
        
        await raidSetup.save({ transaction });
        await raidSetup.reload({ transaction }); 
        
        // Update message
        const embed = await updateRaidEmbed(raidSetup, interaction);
        if (embed) {
            await interaction.message.edit({ embeds: [embed], components: interaction.message.components }).catch(e => {
                debug('Error updating message with embed:', e);
            });
        }

        await interaction.followUp({
            content: `✅ Signup cancelled from ${originalRole || 'a role'}!`,
            ephemeral: true
        });
    } else {
        await interaction.followUp({
            content: 'ℹ️ You were not signed up for this raid.',
            ephemeral: true
        });
    }
}

// Delete CTA handler
async function handleDeleteCTA(interaction, raidSetup, transaction) {
    const member = interaction.guild.members.cache.get(interaction.user.id);
    const guildConfig = await GuildConfig.findOne({
        where: { guild_id: interaction.guild.id },
        transaction
    });

    // Check permissions
    const isCreator = raidSetup.created_by === interaction.user.id;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const isMod = guildConfig && guildConfig.modRole && member.roles.cache.has(guildConfig.modRole);

    if (!isCreator && !isAdmin && !isMod) {
        await interaction.followUp({
            content: '⛔ You lack permission to delete this.',
            ephemeral: true
        });
        return;
    }

    // Delete the raid setup from DB
    await raidSetup.destroy({ transaction });
    
    // Attempt to delete the message from Discord
    try {
        await interaction.message.delete();
        await interaction.followUp({
            content: '✅ Raid deleted successfully.',
            ephemeral: true
        });
    } catch (deleteError) {
        debug('Error deleting Discord message (might be already deleted):', deleteError.message);
        await interaction.followUp({
            content: '✅ Raid deleted from database. (Discord message might have been deleted manually).',
            ephemeral: true
        });
    }
}