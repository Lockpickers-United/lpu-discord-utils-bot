import {handleBeltRequest} from './processBeltMessage.js'
import {handleAnnounce} from './handleMessageRespond.js'


export async function processBotRequest(message, requestEmbed) {

    const fields = (requestEmbed?.data?.fields || []).reduce((acc, field) => {
        acc[field.name] = field.value
        return acc
    }, {})

    console.log('processBotRequest', fields)

    const {requestId, source, username, belt, platform,currentBelt, syncTo, syncUsername, messageContent} = fields
    const userId = fields.userId || `${source.toLowerCase()}-${username}`

    try {
        if (platform === 'Discord') {
            const user = await message.guild.members.fetch(userId)
            user?.user?.username && console.log(`Found user: ${user?.user?.username}`)

            if (!user) throw new Error('User not found')
            if (user.user?.username !== username) throw new Error('Wrong user')
        }

        let announceText

        const response = await handleBeltRequest({
            message,
            params: {
                source,
                platform,
                userId,
                username,
                belt,
                messageContent,
                currentBelt,
                requestId,
                syncTo,
                syncUsername
            }
        })

            if (response) {
                const replaceText = response.replaceText
                    ? `\nThis replaces your previous ${belt} request.`
                    : ''
                const sourceText = source === 'Reddit'
                    ? `*Request from Reddit: u/${username}*\n`
                    : '*Request from lpubelts.com/request*\n'

                announceText = source !== 'Reddit'
                    ? `<@${userId}> thanks for your ${belt} request!\n`
                    : syncUsername
                        ? `@${syncUsername} thanks for your ${belt} request!\n`
                        : `u/${username} thanks for your ${belt} request!\n`
                announceText += `Details: ${messageContent}${replaceText}\n`
                    + sourceText
                    + `(id: ${response.id})`
            }

        await handleAnnounce({message, beltRequest: response.beltRequest, platform: 'Discord', announceText})

    } catch (error) {
        console.error(`belt request error. (${error})`)
        // TODO: save error entry
    }
}
