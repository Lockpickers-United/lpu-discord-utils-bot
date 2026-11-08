import cleanMessage from '../util/cleanMessage.js'
import {voteUsers} from '../../keys/users.js'
import parseBeltRequest from '../util/parseBeltRequest.js'
import dayjs from 'dayjs'
import genHexString from '../util/genHexString.js'
import {classificationVotesFile} from '../../keys/botConfig.js'
import fs from 'node:fs/promises'
import writeJsonFileAtomic from '../util/writeJsonFileAtomic.js'
import {MessageFlags} from 'discord.js'


export default async function processClassificationVote(message) {

    const messageContent = (await cleanMessage(message))?.replace(/^\[me] test/i, '[me]').trim()
    const isBotCommand = new RegExp('^\\[me]\\s+', 'i').exec(messageContent)
    if (!isBotCommand || !voteUsers.includes(message.author.id)) return

    const classificationVotes = JSON.parse((await fs.readFile(classificationVotesFile, 'utf8')).toString())

    console.log('parseBeltRequest(messageContent)', parseBeltRequest(messageContent))
    const {id, belt, evidence} = parseBeltRequest(messageContent)

    const newVote = {
        id: genHexString(8),
        username: message.author.username,
        userId: message.author.id,
        belt,
        lockId: id,
        messageContent: evidence ?? messageContent,
        messageId: message?.id,
        source: 'Discord',
        dateAdded: dayjs().format(),
        lastUpdated: dayjs().format(),
        status: 'open',
    }

    const newClassificationVotes = [...classificationVotes, newVote]

    try {
        await writeJsonFileAtomic(classificationVotesFile, newClassificationVotes, {spaces: 2})
        await message.reply({content: `Thanks for your vote ${message.author.username}!`, flags: [MessageFlags.Ephemeral]})
    } catch (error) {
        await message.reply({content: `Sorry, something went wrong: ${error.message}`, flags: [MessageFlags.Ephemeral]})
    }
}