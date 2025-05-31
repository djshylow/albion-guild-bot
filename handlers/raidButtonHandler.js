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
        
        // --- START: Robust parsing for participants in updateRaidEmbed ---
        let participants;
        try {
            let tempParticipants = raidSetup.participants;
            if (typeof tempParticipants === 'string') {
                tempParticipants = JSON.parse(tempParticipants);
            }
            if (typeof tempParticipants === 'string') {
                participants = JSON.parse(tempParticipants);
            } else {
                participants = tempParticipants;
            }
            if (typeof participants !== 'object' || participants === null) {
                participants = {};
            }
        } catch (e) {
            debug('Error during robust parsing of participants in updateRaidEmbed:', e);
            participants = {};
        }
        // --- END: Robust parsing for participants in updateRaidEmbed ---
        
        // Validate the structure (this function is good)
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
        debug('Error caught in updateRaidEmbed, returning null:', error); // Added more specific debug
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

    // --- START: Robust parsing for participants in handleSignup ---
    let participants;
    try {
        let tempParticipants = raidSetup.participants;
        // Attempt to parse once
        if (typeof tempParticipants === 'string') {
            tempParticipants = JSON.parse(tempParticipants);
        }

        // If after the first parse, it's still a string, parse again
        if (typeof tempParticipants === 'string') {
            participants = JSON.parse(tempParticipants);
        } else {
            // Otherwise, it's already an object or null/undefined, use it directly
            participants = tempParticipants;
        }

        // Ensure participants is an object if it ended up null/undefined
        if (typeof participants !== 'object' || participants === null) {
            participants = {};
        }

    } catch (e) {
        debug('Error during robust parsing of participants:', e);
        participants = {}; // Fallback if anything goes wrong during parsing
    }
    // --- END: Robust parsing for participants in handleSignup ---
    
    // Now 'participants' should definitively be a JavaScript object or an empty object
    participants = validateParticipants(participants, slotsData);

    // Find if user is already signed up for any role
    let currentRole = null;
    for (const [r, users] of Object.entries(participants)) { // Use the 'participants' local variable
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
        // Remove user from their current role
        participants[currentRole] = participants[currentRole].filter(id => id !== userId); // Use 'participants' local variable
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

    if (!participants[role]) { // Use 'participants' local variable
        participants[role] = [];
    }

    if (participants[role].length >= maxSlots) { // Use 'participants' local variable
        await interaction.followUp({
            content: `⛔ ${role} slots are full`,
            ephemeral: true
        });
        if (currentRole) {
            // If slots are full, put them back in their original role
            participants[currentRole].push(userId); // Use 'participants' local variable
            debug(`Returning user ${interaction.user.username} to previous role ${currentRole} due to full slots.`);
        }
        // Save the participants state BEFORE returning, as we might have put the user back
        raidSetup.participants = JSON.stringify(participants); // Update raidSetup instance before saving
        raidSetup.changed('participants', true);
        await raidSetup.save({ transaction });
        return;
    }

    // Add user to the new role
    participants[role].push(userId); // Use 'participants' local variable

    // Save the modified participants back to the database
    raidSetup.participants = JSON.stringify(participants); // Convert back to JSON string
    raidSetup.changed('participants', true);
    await raidSetup.save({ transaction });

    // IMPORTANT: Reload the instance to ensure it has the very latest data committed
    // This reload is still useful if you have multiple instances of your bot running or if there's
    // any delay in database write propagation, ensuring local object is synced.
    await raidSetup.reload({ transaction });

    debug(`handleSignup: raidSetup.participants AFTER reload and BEFORE embed update: ${JSON.stringify(raidSetup.participants)}`);

    // Update message
    const embed = await updateRaidEmbed(raidSetup, interaction); // Pass the reloaded raidSetup
    
    // Check if embed is null before trying to access its properties
    if (embed) {
        debug(`handleSignup: Final embed fields before edit: ${JSON.stringify(embed.data.fields)}`);
        // Ensure you're only editing the embed, not the components unless they've changed
        await interaction.message.edit({ embeds: [embed], components: interaction.message.components }).catch(e => {
            debug('Error updating message with embed:', e);
        });
    } else {
        debug('handleSignup: Embed was null, cannot update message.');
        // Optionally, send a user-facing error if the embed couldn't be generated
        await interaction.followUp({
            content: '❌ An error occurred while updating the raid display. Please try again or notify an admin.',
            ephemeral: true
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

    // --- START: Robust parsing for participants in handleCancelSignup ---
    let participants;
    try {
        let tempParticipants = raidSetup.participants;
        if (typeof tempParticipants === 'string') {
            tempParticipants = JSON.parse(tempParticipants);
        }
        if (typeof tempParticipants === 'string') {
            participants = JSON.parse(tempParticipants);
        } else {
            participants = tempParticipants;
        }
        if (typeof participants !== 'object' || participants === null) {
            participants = {};
        }
    } catch (e) {
        debug('Error during robust parsing of participants in handleCancelSignup:', e);
        participants = {};
    }
    // --- END: Robust parsing for participants in handleCancelSignup ---

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
        raidSetup.participants = JSON.stringify(participants); // Stringify before saving
        raidSetup.changed('participants', true);
        
        await raidSetup.save({ transaction });
        await raidSetup.reload({ transaction }); 
        
        // Update message
        const embed = await updateRaidEmbed(raidSetup, interaction);
        if (embed) {
            await interaction.message.edit({ embeds: [embed], components: interaction.message.components }).catch(e => {
                debug('Error updating message with embed:', e);
            });
        } else {
            debug('handleCancelSignup: Embed was null, cannot update message.');
            await interaction.followUp({
                content: '❌ An error occurred while updating the raid display after cancelling signup. Please try again or notify an admin.',
                ephemeral: true
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