import dayjs from 'dayjs'
import {announce, saveAction} from './processBeltMessage.js'


export async function processBotRequest(message, requestEmbed) {

    const userName = requestEmbed?.data?.fields?.find(field => field.name === 'username')?.value
    const guild = message.guild
    const members = await guild.members.fetch({query: userName, limit: 1})
    const member = members.first()
    if (member) {
        console.log('member lookup', member.user.username, member.user.id)
    }
    const belt = requestEmbed?.data?.fields?.find(field => field.name === 'belt')?.value
    const redditUsernameVal = requestEmbed?.data?.fields?.find(field => field.name === 'redditUsername')?.value
    const redditUsername = redditUsernameVal ? {redditUsername: redditUsernameVal} : null

    const id = genHexString(8)
    const action = {
        status: 'requested',
        dateAdded: dayjs().format('YYYY-MM-DD HH:mm'),
        id,
        belt,
        userName,
        ...redditUsername,
        userId: member?.user?.id,
        messageId: message.id
    }

    try {

        let announceText

        await saveAction(action).then(response => {
            if (response.error) throw new Error(response.error)
            const replaceText = response.replaceResponse
                ? `\nThis replaces your previous ${belt} request.`
                : ''
            announceText = `<@${member?.user?.id}> thanks for your ${belt} request!${replaceText}\n(id: ${response.id})`
        })

        await announce(message, announceText)

    } catch (error) {
        console.error(`belt request error. (${error})`)
    }

    // {...action, ...response, replaceResponse}


}

function genHexString(len) {
    const hex = '0123456789ABCDEF'
    let output = ''
    for (let i = 0; i < len; ++i) {
        output += hex.charAt(Math.floor(Math.random() * hex.length))
    }
    return output.toLowerCase()
}