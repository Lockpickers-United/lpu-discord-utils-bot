import {handleBeltRequest} from './processBeltMessage.js'
import {handleAnnounce} from './handleMessageRespond.js'
import {defaults} from '../data/config.js'
import {client} from '../client.js'

export async function processIncomingRequest({message, requestEmbed, incomingRecord}) {

    const fields = incomingRecord
        ? {...incomingRecord}
        : (requestEmbed?.data?.fields || []).reduce((acc, field) => {
            acc[field.name] = field.value
            return acc
        }, {})

    console.log('processIncomingRequest', fields)

    const {source, username, belt, platform, syncUsername, messageContent} = fields
    const userId = fields.userId || `${source.toLowerCase()}-${username}`

    try {
        if (platform === 'Discord') {
            const guildId = message?.guildId ?? defaults.guildId
            let guild
            try {
                guild = await client.guilds.fetch(guildId);
            } catch (error) {
                throw new Error(`Could not find or access the guild: ${error}`);
            }

            const user = await guild.members.fetch(userId)
            user?.user?.username && console.log(`Found user: ${user?.user?.username}`)
            if (!user) throw new Error('User not found')
            if (user.user?.username !== username) throw new Error('Wrong user')
        }

        let announceText

        const response = await handleBeltRequest({
            message,
            params: {...fields},
            incomingRecord
        })

        let announcement = {}
        if (response && platform === 'Discord') {
            announceText = source !== 'Reddit'
                ? `<@${userId}> thanks for your ${belt} request!\n`
                : syncUsername
                    ? `@${syncUsername} thanks for your ${belt} request!\n`
                    : `u/${username} thanks for your ${belt} request!\n`

            const replaceText = response.replaceText
                ? `\nThis replaces your previous ${belt} request.`
                : ''
            const sourceText = source === 'Reddit'
                ? `*Request from Reddit: u/${username}*\n`
                : '*Request from lpubelts.com/request*\n'

            announceText += `Details: ${messageContent}${replaceText}\n`
                + sourceText
                + `(id: ${incomingRecord.id ?? response.id})`

            const announceResponse = await handleAnnounce({message, platform: 'Discord', announceText})
            announcement = announceResponse?.messageId ? {messageId: announceResponse.messageId} : {}
        }

        return {success: 'announcement posted', ...announcement}


    } catch (error) {
        console.error(`belt request error. (${error})`)

        // TODO: save error entry
    }
}
