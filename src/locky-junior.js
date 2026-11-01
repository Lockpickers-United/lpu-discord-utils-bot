import {fileURLToPath, pathToFileURL} from 'node:url'
// From: https://discordjs.guide/creating-your-bot/main-file.html
import fs from 'node:fs'
import path from 'node:path'
import {token} from '../keys/keys.js'

import {Client, Collection, GatewayIntentBits, Partials} from 'discord.js'

//const MONITOR_CHANNEL_ID = '1364738104640147509'
//const LOG_CHANNEL_ID = '1364738135749169172'

/**
 * @prop Guilds
 * @prop GuildMessages
 * @prop GuildMembers
 * @prop DirectMessages
 * @prop MessageContent
 * @prop GuildMessageReactions
 */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
})

client.commands = new Collection()

const foldersPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'commands')
const commandFolders = fs.readdirSync(foldersPath).filter(f => !f.includes('DS_Store'))
for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder)
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file)
        const {default: command} = await import(pathToFileURL(filePath).href)
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command)
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
        }
    }
}

const eventsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'events')
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'))
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file)
    const {default: event} = await import(pathToFileURL(filePath).href)
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args))
    } else {
        client.on(event.name, (...args) => event.execute(...args))
    }
}


client.login(token).then()
