import {announce, handleBeltRequest, saveAction} from './processBeltMessage.js'


export async function processBotRequest(message, requestEmbed) {

    console.log('processBotRequest', requestEmbed?.data?.fields)

    //Deprecated, remove after testing
    //const guild = message.guild
    //const members = await guild.members.fetch({query: userName, limit: 1})
    //const member = members.first()
    //if (member) console.log('member lookup', member.user.username, member.user.id)

    const fields = requestEmbed?.data?.fields || []
    const userId = fields.find(field => field.name === 'userId')?.value
    const userName = fields.find(field => field.name === 'userName')?.value
    const requestedBelt = fields.find(field => field.name === 'requestedBelt')?.value
    const messageContent = fields.find(field => field.name === 'messageContent')?.value

    const redditUsernameVal = fields.find(field => field.name === 'redditUsername')?.value
    const redditUsername = redditUsernameVal ? {redditUsername: redditUsernameVal} : null

    try {
        const user = await message.guild.members.fetch(userId)
        console.log(`Found user: ${user.user.username}`)
        if (!user) throw new Error('User not found')
        if (user.user?.username !== userName) throw new Error('Wrong user')
    } catch (error) {
        console.error('User error:', error)
        await saveAction({
            status: 'error',
            id: genHexString(8),
            userId,
            userName,
            belt: requestedBelt,
            error: error.message ?? error
        })
        return
    }

    try {

        let announceText

        await handleBeltRequest({
            message,
            userId,
            userName,
            requestedBelt,
            messageContent,
            ...redditUsername
        })
            .then(response => {
                if (response.error) throw new Error(response.error)
                const replaceText = response.replaceResponse
                    ? `\nThis replaces your previous ${requestedBelt} request.`
                    : ''
                announceText = `<@${userId}> thanks for your ${requestedBelt} request!\n`
                    + `Details: ${messageContent}${replaceText}\n`
                    + '*Request from lpubelts.com/request*\n'
                    + `(id: ${response.id})`
            })

        await announce(message, announceText)

    } catch (error) {
        console.error(`belt request error. (${error})`)
        await saveAction({
            status: 'error',
            id: genHexString(8),
            userId,
            userName,
            belt: requestedBelt,
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