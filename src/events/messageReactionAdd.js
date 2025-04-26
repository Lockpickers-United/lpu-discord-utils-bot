const {Events} = require('discord.js')

const MONITOR_CHANNEL_ID = '282170926064336907'
const LOG_CHANNEL_ID = '1360395141822812311'

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (reaction.partial) {
            try {
                await reaction.fetch()
            } catch (error) {
                console.error('Error fetching the reaction:', error)
                return
            }
        }

        const client = reaction.client

        if (reaction.message.channel.id === MONITOR_CHANNEL_ID) {
            const messageContent = reaction.message.content
                .replaceAll('@everyone', '[everyone]')
                .replaceAll('@here', '[here]')
                .replaceAll('\n', ' / ')

            if (messageContent.includes('@')) { // Checks if the message includes a user mention
                const userIds = messageContent.match(/<@!?(\d+)>/g)
                if (userIds) {
                    for (const userId of userIds) {
                        const cleanId = userId.replace(/[<@!>]/g, '')
                        const userTag = await fetchUserTag(cleanId)
                        if (userTag) {
                            //console.log(`User ID ${userId}: ${userTag}`)
                        }
                    }
                }
            }

            const logMessage = `${user.tag} reacted ${reaction.emoji.name} to: ${messageContent.substring(0, 100)}`
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID)
            if (!logChannel) {
                console.error(`Log channel with ID ${LOG_CHANNEL_ID} not found.`)
                return
            }
            logChannel.send(logMessage)
                .then(() => console.log('Logged reaction:', logMessage))
                .catch(console.error)
        }

        async function fetchUserTag(userId) {
            try {
                const usr = await client.users.fetch(userId)
                return usr.tag
            } catch (error) {
                console.error(`Error fetching user for ID ${userId}:`, error)
                return null
            }
        }

    }
}

