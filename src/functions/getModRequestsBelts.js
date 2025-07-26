import fs, {appendFile} from 'node:fs/promises'
import {beltRoles} from '../util/belts.js'
import dayjs from 'dayjs'

// simple sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchMessagesContaining(channel) {

    console.time('BeltChanges')

    const guild = channel.guild
    if (!guild) {
        console.error('I could not access the guild :-(')
        return
    }
    await guild.members.fetch()

    const userTags = guild.members.cache.reduce((acc, member) => {
        acc[member.id] = {username: member.user.username, displayName: member.displayName}
        return acc
    }, {})

    const matches = []
    let lastId
    let totalFetched = 0
    let stopFlag = 0

    const debug = false

    while (true) { // eslint-disable-line no-constant-condition
        const options = {limit: 100}
        if (lastId) options.before = lastId

        const messages = await channel.messages.fetch(options)

        if (!messages.size) break


        for (const msg of messages.values()) {

            msg.embeds.forEach((embed, i) => {

                if (!['Role added', 'Roles updated', 'Role removed'].some(sub => embed.title?.toLowerCase().includes(sub.toLowerCase()))) return
                if (debug) console.log(`- Embed #${i + 1}:`)

                const tag = embed?.author?.name
                const userId = embed?.footer?.text?.replace('ID: ', '').trim()

                //replace any role-mentions with the actual role name
                const cleaned = embed.description?.replace(/<@&(\d+)>/g, (_, id) => {
                    const role = msg.guild.roles.cache.get(id)
                    return role ? `${role.name}` : `<unknown role ${id}>`
                })

                let cleanedRole = cleaned


                if (debug && embed.title === 'Roles updated') console.log('\nRoles Updated')


                const regex = /\*\*(Added|Removed):\*\*\s([\w\s]+?\s(?:Belt|Dan))\b/g
                const updateMatches = [...cleaned.matchAll(regex)].map(([_, action, title]) => ({action, title})) // eslint-disable-line
                if (updateMatches.length > 0) {
                    if (debug) console.log('updateMatches', updateMatches)
                    const removedRole = updateMatches.find(match => match.action === 'Removed')?.title
                    const addedRole = updateMatches.find(match => match.action === 'Added')?.title

                    cleanedRole = addedRole ? addedRole : cleaned

                    if (beltRoles.includes(removedRole)) {
                        if (debug) console.log('BELT roles updated', msg.id, 'added:', addedRole, ' removed:', removedRole)
                        stopFlag++
                        const createdAt = dayjs(embed.timestamp ? embed.timestamp : msg.createdAt).subtract(1, 'second').toISOString()
                        matches.push({
                            changeType: 'removed',
                            role: removedRole,
                            username: userTags[userId]?.username || tag,
                            displayName: userTags[userId]?.displayName || tag,
                            createdAt: createdAt,
                            userId,
                            msgId: msg.id
                        })
                    }
                }

                if (debug) console.log('  cleanedRole:', cleanedRole)
                if (debug) console.log('  User:', embed?.author?.name)
                if (debug && embed.title) console.log('  Title:', embed.title)
                if (debug) console.log('  User:', embed?.footer?.text.replace('ID: ', '').trim())


                if (beltRoles.includes(cleanedRole)) {
                    matches.push({
                        changeType: embed.title === 'Role removed' ? 'removed' : 'added',
                        role: cleanedRole,
                        username: userTags[userId]?.username || tag,
                        displayName: userTags[userId]?.displayName || tag,
                        createdAt: dayjs(embed.timestamp ? embed.timestamp : msg.createdAt).toISOString(),
                        userId,
                        msgId: msg.id

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

        await sleep(200)

        if (messages.size < 100) break
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

    console.timeEnd('BeltChanges')

    return discordMessages
}

