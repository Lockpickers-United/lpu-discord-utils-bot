import {randomUUID} from 'node:crypto'
import { SlashCommandBuilder, MessageFlags} from 'discord.js'

export default {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads a command.')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to reload.')
                .setRequired(true)),
    async execute(interaction) {
        const commandName = interaction.options.getString('command', true).toLowerCase()
        const command = interaction.client.commands.get(commandName)

        const member = interaction.member
        if (!member.roles.cache.some(role => role.name === 'Mods')) {
            return interaction.reply({
                content: 'You can\'t do that.',
                flags: 64 // Setting the response as ephemeral using flags
            })
        }

        if (!command) {
            return interaction.reply(`There is no command with name \`${commandName}\`!`)
        }

        try {
            const commandUrl = new URL(`../${command.category}/${command.data.name}.js`, import.meta.url)
            // A unique URL reloads this command; shared dependencies stay cached.
            commandUrl.searchParams.set('reload', randomUUID())
            const {default: newCommand} = await import(commandUrl.href)
            await interaction.client.commands.set(newCommand.data.name, newCommand)
            await interaction.reply(`Command \`${newCommand.data.name}\` was reloaded!`, {flags: [MessageFlags.Ephemeral]})
        } catch (error) {
            console.error(error)
            await interaction.reply(`There was an error while reloading a command \`${command.data.name}\`:\n\`${error.message}\``)
        }
    },
}