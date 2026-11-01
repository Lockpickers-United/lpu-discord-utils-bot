import {fileURLToPath, pathToFileURL} from 'node:url'
// from: https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands

import {REST, Routes} from 'discord.js'
import fs from 'node:fs'
import path from 'node:path'
import {token, clientId} from '../keys/keys.js'
const lpuGuildId = '140129091796992000'

const commands = []
// Grab all the command files from the commands directory you created earlier
const foldersPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'commands')
const commandFolders = fs.readdirSync(foldersPath).filter(f => !f.includes('DS_Store'))

for (const folder of commandFolders) {
    // Grab all the command files from the commands directory you created earlier
    const commandsPath = path.join(foldersPath, folder)
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))

    // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file)
        const {default: command} = await import(pathToFileURL(filePath).href)
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON())
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
        }
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(token)

// and deploy your commands!
const deploy = async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`)

        // Deploy to all servers
        // const data = await rest.put(Routes.applicationCommands(clientId), {body: commands})

        // Target deploy to LPU server
        const data = await rest.put(Routes.applicationCommands(clientId, lpuGuildId), {body: commands})

        console.log(`Successfully reloaded ${data.length} application (/) commands.`)
    } catch (error) {
        console.error(error)
    }
}
deploy()
