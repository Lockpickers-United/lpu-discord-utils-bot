import fs from 'node:fs/promises'
import dayjs from 'dayjs'
import {setDeepPush} from '../util/setDeep.js'

// simple sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchMessagesContaining(channel, substring) {
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
    let tooOld = false

    while (true) { // eslint-disable-line no-constant-condition
        const options = {limit: 100}
        if (lastId) options.before = lastId

        const messages = await channel.messages.fetch(options)
        if (!messages.size) break

        // ^<\@541073446839517194>\s*request
        for (const msg of messages.values()) {
            if (
                /^<@541073446839517194>\s+request/.test(msg.content)
                && msg.content.includes(substring)
                && !['StickyBot#0392', 'LPUBeltBot#5324'].includes(msg.author.tag)
                && !msg.content.includes('approve')
            ) {
                matches.push(msg)
            }

            if (dayjs(msg.createdTimestamp).isBefore(dayjs('2023-01-01'))) {
                tooOld = true
            }

        }

        lastId = messages.last().id

        totalFetched += messages.size
        console.log(`Fetched ${totalFetched} messages`, matches.length, 'matches since ', dayjs(messages.last().createdTimestamp).format('YYYY-MM-DD'))

        // pause 200ms before the next batch
        await sleep(100)


        if (messages.size < 100 || tooOld) break
    }

    return matches
}


export async function findSyncMessages(message, channelId) {
    // get the channel
    const channel = await message.client.channels.fetch(channelId)
    if (!channel.isTextBased()) {
        throw new Error('Not a text channel')
    }

    // fetch all the “sync” messages
    const syncMessages = await fetchMessagesContaining(channel, 'sync')

    // now you can inspect them
    const syncMessageData = syncMessages.reduce((acc, msg) => {
        acc.push({
            id: msg.id,
            createdAt: msg.createdAt,
            tag: msg.author.tag,
            content: msg.content.replaceAll(/<@541073446839517194>\s+/g, '')
        })
        return acc
    }, [])

    try {
        await fs.writeFile('./syncMessageData.json', JSON.stringify(syncMessageData, null, 2))
    } catch (err) {
        console.log(err)
    }

    console.log('sync messages found:', syncMessageData.length)

    console.timeEnd('SyncMessages')

    return syncMessageData
}

