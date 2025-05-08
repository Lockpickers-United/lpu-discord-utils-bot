import fs, {appendFile} from 'node:fs/promises'
import {setDeepPush} from '../util/setDeep.js'
import {uniqueBelts} from '../util/belts.js'
import {jsonIt} from '../util/jsonIt.js'
import dayjs from 'dayjs'

// simple sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchMessagesContaining(channel) {

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

    //console.log('admin:', admin)

    const matches = []
    let lastId
    let totalFetched = 0

    const debug = false
    while (true) { // eslint-disable-line no-constant-condition
        const options = {limit: 100}
        if (lastId) options.before = lastId

        const messages = await channel.messages.fetch(options)

        if (!messages.size) break

        for (const msg of messages.values()) {

            msg.embeds.forEach((embed, i) => {

                if (!['Role added', 'Roles updated'].some(sub => embed.title?.toLowerCase().includes(sub.toLowerCase()))) return
                if (debug) console.log(`- Embed #${i + 1}:`)

                let cleanedRole = undefined

                if (embed.description) {
                    // 1) log the raw description
                    //console.log('  Description raw:', embed.description)

                    // 2) replace any role-mentions with the actual role name
                    const cleaned = embed.description.replace(/<@&(\d+)>/g, (_, id) => {
                        const role = msg.guild.roles.cache.get(id)
                        return role ? `@${role.name}` : `<unknown role ${id}>`
                    })
                    const addedMatch = cleaned.match(/\*\*Added:\*\*\s*(\S+)/)

                    cleanedRole = addedMatch ? addedMatch[1] : cleaned

                    if (debug) console.log('  cleanedRole:', cleanedRole)
                }

                if (debug) console.log('  User:', embed?.author?.name)

                // Common properties:
                if (debug && embed.title) console.log('  Title:', embed.title)

                if (debug) console.log('  User:', embed?.footer?.text.replace('ID: ','').trim())


                if (uniqueBelts.some(sub => cleanedRole.toLowerCase().includes(sub.toLowerCase() + ' '))) {
                    matches.push({
                        id: msg.id,
                        createdAt: embed.timestamp ? embed.timestamp : msg.createdAt,
                        tag: embed?.author?.name,
                        addedRole: cleanedRole,
                        userId: embed?.footer?.text?.replace('ID: ','').trim()
                    })
                }
            })
        }

        lastId = messages.last().id

        const logline = `${messages.last().id}\t${dayjs(messages.last().createdTimestamp).format('YYYY-MM-DD HH:mm:ss')}\t${messages.last().createdTimestamp}\n`
        try {
            await appendFile('discordMessagelog.txt', logline)
        } catch (err) {
            console.error('Error writing to file', err)
        }

        totalFetched += messages.size
        console.log(`Fetched ${totalFetched} messages`, matches.length, 'matches since ', dayjs(messages.last().createdTimestamp).format('YYYY-MM-DD'))

        // pause 200ms before the next batch
        await sleep(100)

        if (messages.size < 100 || matches.length > 999999999) break
    }

    return matches
}


export async function getModRequestsBelts(message) {
    // get the channel

    const channelId = '647550275631972362' // mod-logs

    const channel = await message.client.channels.fetch(channelId)
    if (!channel.isTextBased()) {
        throw new Error('Not a text channel')
    }

    const discordMessages = await fetchMessagesContaining(channel)

    try {
        await fs.writeFile('./allModUpdates.json', JSON.stringify(discordMessages, null, 2))
    } catch (err) {
        console.log(err)
    }

    console.log('relevant messages found:', discordMessages.length)

    console.timeEnd('SyncMessages')

    return discordMessages
}

