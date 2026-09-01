// noinspection JSCheckFunctionSignatures

const fs = require('fs')
const dayjs = require('dayjs')
const {readFile, writeFile} = fs.promises

const {SlashCommandBuilder, MessageFlags} = require('discord.js')
const setDiscordRole = require('../../functions/setDiscordRole.js')
const setRedditFlair = require('../../functions/setRedditFlair.js')
const isValidEvent = require('../../functions/isValidEvent')

const {localUser, prodUser} = require('../../../keys/users.js')
const prodEnvironment = process.env.USER !== localUser
const dataDir = prodEnvironment
    ? `/home/${prodUser}/discord-utils-bot-logs`
    : `/Users/${localUser}/Documents/GitHub/lpu-discord-utils-bot/data`

const subredditName = 'lockpicking'
const debugLogging = true

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync')
        .setDescription('Sync belt approval')
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Target platform')
                .setRequired(true)
                .addChoices(
                    {name: 'Discord', value: 'Discord'},
                    {name: 'Reddit', value: 'Reddit'}
                ))
        .addStringOption(option =>
            option
                .setName('username')
                .setDescription('Platform username to sync')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('belt')
                .setDescription('Belt rank to assign.')
                .setRequired(true)
                .addChoices(
                    {name: 'White', value: 'White'},
                    {name: 'Yellow', value: 'Yellow'},
                    {name: 'Orange', value: 'Orange'},
                    {name: 'Green', value: 'Green'},
                    {name: 'Blue', value: 'Blue'},
                    {name: 'Purple', value: 'Purple'},
                    {name: 'Brown', value: 'Brown'},
                    {name: 'Red', value: 'Red'},
                    {name: 'Black', value: 'Black'},
                    {name: '1st Dan', value: '1st Dan'},
                    {name: '2nd Dan', value: '2nd Dan'},
                    {name: '3rd Dan', value: '3rd Dan'},
                    {name: '4th Dan', value: '4th Dan'},
                    {name: '5th Dan', value: '5th Dan'},
                    {name: '6th Dan', value: '6th Dan'}
                ))
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Message to add to sync annnouncement (optional)')
        ),

    async execute(interaction) {

        const roles = interaction.member.roles.cache
        if (!roles.some(role => (role.name === 'Mods' || role.name === 'Staff'))) {
            console.log('User is not a mod or staff')
            await interaction.editReply({content: 'You do not have permission to use this command.'})
            return
        }

        const check = await isValidEvent(interaction)
        if (!check.valid) {
            await interaction.reply({content: check.reason, flags: [MessageFlags.Ephemeral]})
            return
        }

        await interaction.deferReply()
        await interaction.editReply({content: 'Processing sync request...'})

        const {options} = interaction
        const platform = options.getString('platform')
        const username = options.getString('username')
        const belt = options.getString('belt')
        const message = options.getString('message')
        const role = belt.includes('Dan') ? belt : `${belt} Belt`

        const eventOptions = {
            platform,
            username,
            belt,
            message
        }


        // TODO remove other belt/dan roles
        const transaction = platform === 'Discord'
            ? await setDiscordRole(interaction, eventOptions)
            : await setRedditFlair(subredditName, username, belt)

        if (transaction.status === 'success') {
            let statusMessages = ''
            if (debugLogging) {
                const logEntry = {
                    date: dayjs().toISOString(),
                    platform: 'discord',
                    username,
                    role,
                    message: message
                }
                try {
                    const syncLog = JSON.parse(await readFile(`${dataDir}/syncLog.json`, 'utf8'))
                    const newSyncLog = [...syncLog, logEntry]
                    await writeFile(`${dataDir}/syncLog.json`, JSON.stringify(newSyncLog, null, 2), 'utf8')
                    console.log(`Logged sync for ${username}`)
                } catch (err) {
                    console.error(`Set ${role} role for ${username} but failed to write sync log.`, err)
                    statusMessages = ' (failed to write sync log)'
                }
            }
            let replyText = `Successfully set ${role} for **${username}** on ${platform}.${statusMessages}`
            if (transaction.message) {
                replyText = replyText + '\n  messages: ' + transaction.message
            }

            if (transaction.alert) {
                replyText = replyText + '\n  ALERT: ' + transaction.alert
            }
            
            await interaction.editReply({content: replyText, flags: [MessageFlags.Ephemeral]})
        } else {
            await interaction.editReply({
                content: transaction.error || 'An error occurred' + transaction.message,
                flags: [MessageFlags.Ephemeral]
            })
        }

    }
}
