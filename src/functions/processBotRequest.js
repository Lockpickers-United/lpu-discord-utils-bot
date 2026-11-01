import {announce, handleBeltRequest, saveAction} from './processBeltMessage.js'
import dayjs from 'dayjs'


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

        await handleBeltRequest({
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
            .then(response => {
                if (response.error) throw new Error(response.error)
                const replaceText = response.replaceResponse
                    ? `\nThis replaces your previous ${belt} request.`
                    : ''
                const sourceText = (source === 'Reddit')
                    ? `*Request from Reddit: u/${username}*\n`
                    : '*Request from lpubelts.com/request*\n'

                announceText = (source !== 'Reddit')
                    ? `<@${userId}> thanks for your ${belt} request!\n`
                    : syncUsername
                        ? `@${syncUsername} thanks for your ${belt} request!\n`
                        : `u/${username} thanks for your ${belt} request!\n`

                announceText += `Details: ${messageContent}${replaceText}\n`
                    + sourceText
                    + `(id: ${response.id})`
            })

        await announce(message, announceText)

    } catch (error) {
        console.error(`belt request error. (${error})`)
        await saveAction({
            status: 'error',
            id: genHexString(8),
            dateAdded: dayjs().format(),
            lastUpdated: dayjs().format(),
            source,
            username,
            userId,
            belt,
            syncTo,
            syncUsername,
            error: error.message ?? error
        })
    }
}

function genHexString(len) {
    const hex = '0123456789ABCDEF'
    let output = ''
    for (let i = 0; i < len; ++i) {
        output += hex.charAt(Math.floor(Math.random() * hex.length))
    }
    return output.toLowerCase()
}