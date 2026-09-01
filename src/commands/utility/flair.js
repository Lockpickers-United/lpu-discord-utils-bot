// noinspection JSCheckFunctionSignatures

const {SlashCommandBuilder, PermissionFlagsBits, MessageFlags} = require('discord.js')
const fs = require('fs')
const dayjs = require('dayjs')
const {readFile, writeFile} = fs.promises
const isValidEvent = require('../../functions/isValidEvent')
const setRedditFlair = require('../../functions/setRedditFlair.js')
const setDiscordRole = require('../../functions/setDiscordRole')

const snoowrap = require('snoowrap')
const {client_id, client_secret, refresh_token} = require('../../../keys/reddit-keys.js')
const {flairDetails} = require('../../util/flairs.js')
const {localUser, prodUser} = require('../../../keys/users.js')
const prodEnvironment = process.env.USER !== localUser
const dataDir = prodEnvironment
    ? `/home/${prodUser}/discord-utils-bot-logs`
    : `/Users/${localUser}/Documents/GitHub/lpu-discord-utils-bot/data`



module.exports = {
    data: new SlashCommandBuilder()
        .setName('flair')
        .setDescription('Set belt flair on Reddit')
        .addStringOption(option =>
            option
                .setName('conversation')
                .setDescription('Modmail ID to set flair from')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('belt')
                .setDescription('Belt rank to flair.')
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
                    {name: '6th Dan', value: '6th Dan'},
                ))
        .addStringOption(option =>
            option
                .setName('discord-username')
                .setDescription('Discord username to sync with approval. (optional)')
        ),

    async execute(interaction) {

        await interaction.deferReply()
        await interaction.editReply({content: 'Processing flair request...'})

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

        const {options} = interaction
        const conversationId = options.getString('conversation')
        const discordUsername = options.getString('discord-username')
        const belt = options.getString('belt')
        const role = belt.includes('Dan') ? belt : `${belt} Belt`
        const {defaultMessage} = flairDetails[belt]
        const subredditName = 'lockpicking'
        let discordSyncMessage = ''
        let discordAlert = ''

        const debugLogging = true

        if (discordUsername) {
            const eventOptions = {
                username: discordUsername,
                belt,
            }
            const transaction = await setDiscordRole(interaction, eventOptions)
            if (transaction.status === 'success') {
                discordSyncMessage = `Synced ${role} for Discord user ${discordUsername}.`
            }

            if (transaction.alert) {
                discordAlert = ` DISCORD ALERT: ${transaction.alert}.`
            }

        }

        let username = undefined
        let userId = undefined
        let newFlair = undefined
        let error = undefined

        const reddit = new snoowrap({
            userAgent: 'modmail-sync-checker by u/mgsecure',
            clientId: client_id,
            clientSecret: client_secret,
            refreshToken: refresh_token
        })
        await reddit.getMe()

        async function getModmailUserInfo(conversationId) {
            await reddit.getMe()
            const convo = await reddit.getNewModmailConversation(conversationId)
            const details = await convo.fetch()
            return {
                username: details?.messages[0]?.author?.name?.name,
                id: details?.messages[0]?.author?.name?.id
            }
        }
        
        async function modmailReply(conversationId, belt, isAuthorHidden = true) {
            const fullReply = !discordSyncMessage ? defaultMessage : `${defaultMessage} ${discordSyncMessage}`
            await reddit.getMe()
            const convo = await reddit.getNewModmailConversation(conversationId)
            await convo.reply(fullReply, isAuthorHidden, false)
        }

        try {
            const userInfo = await getModmailUserInfo(conversationId)
            userId = userInfo.id
            username = userInfo.username
        } catch (err) {
            console.error('Failed to get modmail user info', err.error)
            error = err.error
        }

        if (username) try {
            newFlair = await setRedditFlair(subredditName, username, belt)
        } catch (err) {
            console.error('Failed to set user flair', err)
            error = 'Failed to set user flair'
        }

        if (newFlair) try {
            await modmailReply(conversationId, belt)
        } catch (err) {
            console.error('Failed to reply to modmail', err.error)
            error = 'Failed to reply to modmail'
        }

        if (error) {
            console.error('Error occurred:', error)
            await interaction.editReply('A general error occurred:', error.toString())
        } else {
            console.log(`Successfully set flair for ${username} to ${belt} in subreddit ${subredditName}`)

            if (debugLogging) {
                const logEntry = {
                    username,
                    userId,
                    belt,
                    conversationId,
                    date: dayjs().toISOString(),
                    message: defaultMessage,
                    discordUsername
                }
                try {
                    const flairLog = JSON.parse(await readFile(`${dataDir}/flairLog.json`, 'utf8'))
                    const newFlairLog = [...flairLog, logEntry]
                    await writeFile(`${dataDir}/flairLog.json`, JSON.stringify(newFlairLog, null, 2), 'utf8')
                    console.log(`Logged flair for ${username}`)
                } catch (err) {
                    console.error('Failed to write flair log:', err)
                    await interaction.editReply(`Set flair for u/${username} to ${belt} Belt but failed to write flair log.`)
                    return
                }
            }

            try {
                const logChannel = await interaction.client.channels.fetch('647550275631972362')
                if (!logChannel?.isTextBased()) return console.error('Log channel not text-based')

                const perms = logChannel.permissionsFor(interaction.client.user)
                if (!logChannel.viewable || !perms?.has(PermissionFlagsBits.SendMessages)) {
                    console.error('Missing access to log channel')
                }
                await logChannel.send(
                    `${interaction.user.username} successfully set Reddit flair for u/${username} to ${belt} Belt`
                )
            } catch (err) {
                console.error('Failed to log:', err)
                await interaction.editReply(`Set flair for u/${username} to ${belt} Belt but failed to post log.`)
                return
            }

            try {
                await interaction.editReply(`Successfully set Reddit flair for u/${username} to ${belt} Belt. ${discordSyncMessage ? discordSyncMessage : ''} ${discordAlert}`)
            } catch (err) {
                console.error('Failed to send edited reply:', err)
                return
            }

            (await reddit.getNewModmailConversation(conversationId)).archive()
                .then(() => {
                    console.log(`Modmail conversation ${conversationId} archived successfully.`)
                })
                .catch(error => {
                    console.error(`Error archiving Modmail conversation ${conversationId}:`, error)
                })

        }
    }
}
