import {SlashCommandBuilder} from 'discord.js'
import {processListRequest} from '../../functions/processListRequest.js'

export default {
    category: 'requests',
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('View open belt requests'),

    async execute(interaction) {
        if (interaction.user.bot) return
        const replyEmbeds = await processListRequest({listType: 'embeds'})
        await interaction.reply(replyEmbeds)
    }
}
