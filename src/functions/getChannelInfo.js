const {EmbedBuilder, MessageFlags} = require('discord.js')
const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
dayjs.extend(relativeTime)

async function getChannelInfo(message) {

    const guild = message.guild
    if (!guild) {
        console.error('I could not access the guild :-(')
        return
    }

    const member = message.member
    if (!member.roles.cache.some(r => r.name === 'Mods')) {
        console.log('User is not a mod')
        return
    }
    
    await guild.channels.fetch()

    const allChannels = []

    for (const channel of guild.channels.cache.values()) {
        if (channel.type !== 0) continue
        // https://discord.com/channels/140129091796992000/1360395141822812311/1366055516081491968

        if (
            !channel.isTextBased() ||              // not a text-based channel
            !channel.viewable ||                    // bot can’t VIEW_CHANNEL
            !channel.permissionsFor(channel.client.user).has('ReadMessageHistory')
        ) {
            const parentName = channel.parent ? removeEmoji(channel.parent.name).trim() : 'No Category'
            console.warn(`${parentName}  #${channel.name}  -  missing permissions`)
            continue
        }

        let lastMessage
        try {
            // get the very last message (bypasses lastMessageId if null)
            const fetched = await channel.messages.fetch({limit: 1})
            lastMessage = fetched.first()
            if (!lastMessage) continue
        } catch (err) {
            console.warn(`Skipping ${channel.name}:`, err.message)
            continue
        }

        const lastMessageAge = dayjs(lastMessage.createdAt).fromNow(true)
            .replace(/^an* /, '1 ')
            .replace(/seconds*/, 'sec')
            .replace(/minutes*/, 'min')
            .replace(/hours*/, 'hr')
            .replace(/months*/, 'mo')
            .replace(/years*/, 'yr')
            .replace('1 few', 'a few')

        allChannels.push({
            channelId: channel.id,
            channelName: channel.name,
            channelParent: channel.parent ? removeEmoji(channel.parent.name).trim() : 'No Category',
            lastMessageDate: dayjs(lastMessage.createdAt).format('YYYY-MM-DD'),
            lastMessageAge,
            createdAt: channel.createdAt
        })
    }

    const sortedChannels = allChannels.sort((a, b) => {
        return dayjs(b.lastMessageDate).valueOf() - dayjs(a.lastMessageDate).valueOf()
    })

    console.log('Eligible Channels:')

    sortedChannels.forEach(channel => {
        console.log(`#${channel.channelName} (${channel.channelParent})  ${channel.lastMessageDate}  ${channel.lastMessageAge}`)
    })

    let description = [`\`${'Channel'.padEnd(21)}Last Message\``]

    sortedChannels.forEach(channel => {
        description.push(`\`${channel.channelName.substring(0, 19).padEnd(21)}${channel.lastMessageAge}\``)
    })

    description = description.join('\n')
    console.log('description length', description.length)
    description = description.substring(0, 4096)

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Channel Info')
        .setDescription(description)

    await message.reply({embeds: [embed], flags: [MessageFlags.Ephemeral]})
}

function removeEmoji(str) {
    return str.replace(/\p{Emoji_Presentation}|\p{Emoji}|\u200d|\uFE0F/gu, '')
}


module.exports = getChannelInfo
