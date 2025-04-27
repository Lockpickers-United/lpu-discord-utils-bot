const {beltRoles, beltRoleSort} = require('../util/belts.js')
const {EmbedBuilder} = require('discord.js')
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
    const allChannels = await guild.channels.cache.reduce(async (acc, channel) => {

        if (channel.type !== 0) return acc
        // https://discord.com/channels/140129091796992000/1360395141822812311/1366055516081491968

        if (
            !channel.isTextBased() ||              // not a text-based channel
            !channel.viewable ||                    // bot can’t VIEW_CHANNEL
            !channel.permissionsFor(channel.client.user).has('ReadMessageHistory')
        ) {
            console.warn(`${removeEmoji(channel.parent.name).trim()}  #${channel.name}  -  missing permissions`)

            return acc
        }


// 3) Either use the cached lastMessageId…

        let lastMessage
        try {
            // get the very last message (bypasses lastMessageId if null)
            const fetched = await channel.messages.fetch({limit: 1})
            lastMessage = fetched.first()
            if (!lastMessage) return acc
        } catch (err) {
            console.warn(`Skipping ${channel.name}:`, err.message)
            return acc
        }

        console.log(`${removeEmoji(channel.parent.name).trim()}  #${channel.name}  ${dayjs(lastMessage.createdAt).format('YYYY-MM-DD')}  ${dayjs(lastMessage.createdAt).fromNow()}`)

        acc[channel.name] = {
            channelId: channel.id,
            channelName: channel.name,
            channelParent: removeEmoji(channel.parent.name).trim(),
            lastMessageDate: dayjs(lastMessage.createdAt).format('YYYY-MM-DD'),
            lastMessageAge: dayjs(lastMessage.createdAt).fromNow(),
            createdAt: channel.createdAt
        }
        return acc
    })
   // console.log('allChannels', allChannels)
    return


    // Create an embed to display the role counts
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Belt Counts')
        .setDescription('Current members for each role:')
        .addFields(
            {
                name: 'Role Counts',
                value: Object.entries(roleCounts)
                    .filter((role) => beltRoles.includes(role[0]))
                    .sort((a, b) => {
                        return beltRoleSort(a[0], b[0])
                            || a[0].localeCompare(b[0])
                    })
                    .map(([role, count]) => {
                        return outputFormat === 'table'
                            ? role !== 'Black Belt'
                                ? `\`${role.padEnd(13)}${count.toString().padEnd(5, ' ')}\``
                                : `\`${role.padEnd(13)}${count.toString().padEnd(5, ' ')}\``
                                + `\n\`${'Total'.padEnd(13)}${roleCounts['Total'].toString().padEnd(5, ' ')}\``
                                + '\n\n**Dan Levels**'
                            : `${role},${count.toString()}`
                    }).join('\n'),
                inline: false
            }
        )

    // Send the embed as a reply
    await message.reply({embeds: [embed]})



}

function removeEmoji(str) {
    return str.replace(/[\p{Emoji_Presentation}\p{Emoji}\u200d\uFE0F]/gu, '')
}


module.exports = getChannelInfo
