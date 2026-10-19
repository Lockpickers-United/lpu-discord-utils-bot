const {Events, MessageFlags} = require('discord.js')
const {allGuilds} = require('../data/config')

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return

        if (!allGuilds.includes(interaction.guildId)) {
            console.log('Not in an active guild')
            await interaction.reply({content: 'Not in an active guild.', flags: [MessageFlags.Ephemeral]})
            return
        }

        const command = interaction.client.commands.get(interaction.commandName)

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`)
            return
        }

        try {
            await command.execute(interaction)
        } catch (error) {
            console.error(error)
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] })
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] })
            }
        }
    }
}
