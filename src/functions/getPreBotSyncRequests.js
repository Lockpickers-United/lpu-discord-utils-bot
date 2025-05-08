import fs, {appendFile} from 'node:fs/promises'
import {setDeepPush} from '../util/setDeep.js'
import {uniqueBelts} from '../util/belts.js'

import dayjs from 'dayjs'

// simple sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchMessagesContaining(channel, substring = undefined) {

    console.time('SyncMessages')

    const guild = channel.guild
    if (!guild) {
        console.error('I could not access the guild :-(')
        return
    }
    await guild.members.fetch()

    const admin = guild.members.cache.reduce((acc, member) => {
        member.roles.cache.forEach(role => {
            if (role.name === '@everyone') return
            if (role.name === 'Staff') {
                setDeepPush(acc, ['mods'], member.user.username)
            } else if (role.name === 'Bots') {
                setDeepPush(acc, ['bots'], member.user.username)
            }
        })
        return acc
    }, {})

    console.log('admin:', admin)

    const matches = []
    let lastId
    let totalFetched = 0

    while (true) { // eslint-disable-line no-constant-condition
        const options = {limit: 100, before: '812354106768228403'}
        if (lastId) options.before = lastId

        const messages = await channel.messages.fetch(options)
        if (!messages.size) break

        // ^<\@541073446839517194>\s*request
        for (const msg of messages.values()) {


            if (
                !(substring && msg.content.toLowerCase().includes(substring.toLowerCase()))
                && !msg.content.includes('<@541073446839517194>')
                && !admin.mods.includes(msg.author.username)
                && !admin.bots.includes(msg.author.username)
                && uniqueBelts.some(sub => msg.content.toLowerCase().includes(sub.toLowerCase() + ' '))

                //&& dayjs(msg.createdTimestamp).isBefore(dayjs('2025-04-01 21:14:55'))
            ) {
                //console.log(dayjs(msg.createdTimestamp).format('YYYY-MM-DD HH:mm:ss'), msg.id, msg.author.tag, msg.content)
                matches.push(msg)
            }
        }

        lastId = messages.last().id

        const logline = `${messages.last().id}\t${dayjs(messages.last().createdTimestamp).format('YYYY-MM-DD HH:mm:ss')}\t${messages.last().createdTimestamp}\n`
        try {
            await appendFile('discordMessagelog.txt', logline)
        } catch (err) {
            console.error('Error writing to file', err)
        }

        totalFetched += messages.size
        console.log(`Fetched ${totalFetched} messages`, matches.length, 'matches')

        // pause 200ms before the next batch
        await sleep(200)

        if (messages.size < 100) break
    }

    return matches
}


export async function findPreBotSyncMessages(message, channelId) {
    // get the channel
    const channel = await message.client.channels.fetch(channelId)
    if (!channel.isTextBased()) {
        throw new Error('Not a text channel')
    }

    //const searchTerm = 'reddit'
    const searchTerm = undefined
    const discordMessages = await fetchMessagesContaining(channel, searchTerm)

    // now you can inspect them
    const syncMessageData = discordMessages.reduce((acc, msg) => {
        acc.push({
            id: msg.id,
            createdAt: msg.createdAt,
            tag: msg.author.tag,
            content: msg.content.replaceAll(/<@541073446839517194>\s+/g, '')
        })
        return acc
    }, [])

    try {
        await fs.writeFile('./preBotAllMessageData.json', JSON.stringify(syncMessageData, null, 2))
    } catch (err) {
        console.log(err)
    }

    console.log('pre bot sync messages found:', syncMessageData.length)

    console.timeEnd('SyncMessages')

    return syncMessageData
}

