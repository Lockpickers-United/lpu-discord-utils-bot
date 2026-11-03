import {fileURLToPath, pathToFileURL} from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import {token} from '../keys/keys.js'

import {client} from './client.js'

//const MONITOR_CHANNEL_ID = '1364738104640147509'
//const LOG_CHANNEL_ID = '1364738135749169172'

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
    try {
        const filePath = path.join(eventsPath, file)
        console.log(`[INFO] Loading file ${filePath}`)

        const {default: event} = await import(pathToFileURL(filePath).href)
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args))
        } else {
            client.on(event.name, (...args) => event.execute(...args))
        }
        console.log(`[INFO] - Loaded event ${file}`)
    } catch (error) {
        console.error(`[ERROR] Failed to load event ${file}: ${error}`)
    }
}

client.login(token).then()
