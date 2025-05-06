import fs from 'node:fs/promises'

// simple sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchMessagesContaining(channel, substring) {

    console.time('SyncMessages')

    const matches = []
    let lastId
    let totalFetched = 0

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
        }

        lastId = messages.last().id

        totalFetched += messages.size
        console.log(`Fetched ${totalFetched} messages`, matches.length, 'matches')

        // pause 200ms before the next batch
        await sleep(200)


        if (messages.size < 100) break
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
    //const syncMessages = await fetchFirst100Containing(channel, 'sync')

    // now you can inspect them
    const syncMessageData = syncMessages.reduce((acc, msg) => {
        acc.push({createdAt: msg.createdAt, tag: msg.author.tag, content: msg.content.replaceAll(/<@541073446839517194>\s+/g, '')})
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

