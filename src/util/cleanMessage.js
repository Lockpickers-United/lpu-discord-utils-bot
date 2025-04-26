async function cleanMessage(message) {

    let messageContent = message.content
        .replaceAll(`<@${message.client.user.id}>`, '[me]')
        .replaceAll('\n', ' / ')

    if (message.content.includes('@')) { // Checks if the message includes a user mention
        const userIds = messageContent.match(/<@!?(\d+)>/g)
        if (userIds) {
            for (const userId of userIds) {
                const cleanId = userId.replace(/[<@!>]/g, '')
                const userTag = await fetchUserTag(cleanId)
                if (userTag) {
                    messageContent = messageContent.replaceAll(userId, `@${userTag}`)
                }
            }
        }
    }

    return messageContent
        .replaceAll('@everyone', '[everyone]')
        .replaceAll('@here', '[here]')

    async function fetchUserTag(userId) {
        try {
            const usr = await message.client.users.fetch(userId)
            return usr.tag
        } catch (error) {
            console.error(`Error fetching user for ID ${userId}:`, error)
            return null
        }
    }
}

module.exports = cleanMessage

