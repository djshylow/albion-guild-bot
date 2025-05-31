const { EmbedBuilder } = require('discord.js');
const debug = require('debug')('bot:interactionHandler'); // For debugging this event
debug.enabled = true; // Enable debug messages for this handler

// Import your raid button handler
const handleRaidButton = require('../handlers/raidButtonHandler'); // Adjust path if needed

module.exports = {
    name: 'interactionCreate', // This is the Discord.js event name
    once: false, // This event should run every time an interaction occurs

    async execute(interaction, client) {
        // --- Handle Slash Commands ---
        if (interaction.isChatInputCommand()) {
            debug(`ChatInputCommand received: /${interaction.commandName}`);
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                // If a command isn't found but Discord sent it, something is misconfigured.
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'That command does not exist or is not loaded.', ephemeral: true }).catch(e => console.error("Failed to send followUp for missing command:", e));
                } else {
                    await interaction.reply({ content: 'That command does not exist or is not loaded.', ephemeral: true }).catch(e => console.error("Failed to send reply for missing command:", e));
                }
                return;
            }

            try {
                // Execute the slash command
                await command.execute(interaction, client); // Pass client to command if needed
                debug(`Executed command: /${interaction.commandName}`);
            } catch (error) {
                console.error(`Command error [/${interaction.commandName}]:`, error);

                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Error')
                    .setDescription('There was an error executing this command!')
                    .setFooter({ text: 'Please try again later' });

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(e => console.error("Failed to send command error followUp:", e));
                } else {
                    await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(e => console.error("Failed to send command error reply:", e));
                }
            }
        }
        // --- Handle Button Interactions ---
        else if (interaction.isButton()) {
            debug(`Button interaction received with customId: ${interaction.customId}`);

            // Defer the button interaction update immediately to prevent Discord timeout.
            // This does NOT send a new message, just acknowledges the click.
            await interaction.deferUpdate().catch(e => console.error("Error deferring button update:", e));

            try {
                // You can add more specific button handling here
                // For example, if you have other button types from other commands:
                if (interaction.customId.startsWith('raid_')) {
                    // Call your dedicated raid button handler
                    await handleRaidButton(interaction);
                }
                // else if (interaction.customId.startsWith('another_command_button_')) {
                //     // Call another handler for that command's buttons
                // }
                else {
                    debug(`Unhandled button customId: ${interaction.customId}`);
                    // You might want to send a general ephemeral reply for unhandled button types
                    await interaction.followUp({ content: 'This button is not configured!', ephemeral: true }).catch(e => console.error("Failed to send unhandled button followUp:", e));
                }

            } catch (error) {
                console.error(`Error handling button interaction [${interaction.customId}]:`, error);
                // Send an ephemeral follow-up message if something goes wrong
                await interaction.followUp({ content: '❌ An error occurred while processing your button click.', ephemeral: true }).catch(e => console.error("Failed to send button error followUp:", e));
            }
        }
        // --- Handle Other Interaction Types (e.g., select menus, modals) ---
        // You can add more else if blocks here for other interaction types.
        // else if (interaction.isStringSelectMenu()) { ... }
        // else if (interaction.isModalSubmit()) { ... }
        else {
            debug(`Unhandled interaction type: ${interaction.type}`);
            // No need to reply for every unhandled type, unless you want to debug.
            // await interaction.reply({ content: `This interaction type (${interaction.type}) is not supported yet!`, ephemeral: true });
        }
    }
};