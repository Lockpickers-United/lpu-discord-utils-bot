import {announce, handleBeltRequest, saveAction} from './processBeltMessage.js'


export async function processBotRequest(message, requestEmbed) {

    console.log('processBotRequest', requestEmbed?.data?.fields)

    const fields = (requestEmbed?.data?.fields || []).reduce((acc, field) => {
        acc[field.name] = field.value
        return acc
    }, {})

    console.log('fields', fields)

    const requestId = fields.requestId
    const source = fields.source
    const username = fields.username
    const userId = fields.userId || `${source.toLowerCase()}-${username}`
    const belt = fields.belt
    const messageContent = fields.messageContent
    const platform = fields.platform
    const currentBelt = fields.currentBelt

    const syncTo = fields.syncTo
    const syncUsername = fields.syncUsername

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
                const sourceText = source === 'Reddit'
                    ? `*Request from Reddit: u/${username}*\n`
                    : '*Request from lpubelts.com/request*\n'

                announceText = `<@${userId}> thanks for your ${belt} request!\n`
                    + `Details: ${messageContent}${replaceText}\n`
                    + sourceText
                    + `(id: ${response.id})`
            })

        await announce(message, announceText)

    } catch (error) {
        console.error(`belt request error. (${error})`)
        await saveAction({
            status: 'error',
            id: genHexString(8),
            source,
            username,
            userId,
            belt,
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