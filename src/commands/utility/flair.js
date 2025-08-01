/* eslint-disable no-shadow */

const {SlashCommandBuilder} = require('discord.js')
const snoowrap = require('snoowrap')
const {client_id, client_secret, refresh_token} = require('../../../keys/reddit-keys.js')
const {flairDetails} = require('../../util/flairs.js')
const {approvedChannels, allGuilds} = require('../../data/approvedChannels.js')

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
                    {name: 'Black', value: 'Black'}
                ))
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Mod message to include with flair change - default used if empty.')
        ),

    async execute(interaction) {

        if (interaction.user.username !== 'mgsecure') {
            //console.log('request from', interaction.user.username)
            //return
        }
        if (interaction.user.bot) return
        const roles = interaction.member.roles.cache
        if (!roles.some(role => (role.name === 'Mods' || role.name === 'Staff'))) {
            console.log('User is not a mod or staff')
            await interaction.reply({content: 'You do not have permission to use this command.'})
            return
        }
        if (!allGuilds.includes(interaction.guildId)) {
            console.log('Not in an active guild')
            return
        }
        if (!approvedChannels[interaction.channelId.toString()]) {
            console.log('Not in an approved channel')
            await interaction.reply({content: 'You are not in an approved channel.'})
            return
        }

        const {options} = interaction
        const conversationId = options.getString('conversation')
        const belt = options.getString('belt')
        const message = options.getString('message')
        const {text, cssClass, defaultMessage} = flairDetails[belt]

        const subredditName = 'lockpicking'
        let username = undefined
        let newFlair = undefined
        let error = undefined

        console.log('flair', conversationId, belt, text, cssClass, message)

        const reddit = new snoowrap({
            userAgent: 'modmail-sync-checker by u/mgsecure',
            clientId: client_id,
            clientSecret: client_secret,
            refreshToken: refresh_token
        })
        await reddit.getMe()

        async function getModmailUsername(conversationId) {
            await reddit.getMe()
            const convo = await reddit.getNewModmailConversation(conversationId)
            const details = await convo.fetch()
            return details?.messages[0]?.author?.name?.name
        }

        async function setFlair(subredditName, username, belt) {
            await reddit.getMe()
            const token = reddit.accessToken

            const {id} = flairDetails[belt]

            const url = `https://oauth.reddit.com/r/${subredditName}/api/selectflair`
            const body = new URLSearchParams({
                api_type: 'json',
                name: username,
                flair_template_id: id,
            })

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'User-Agent': reddit._config.userAgent,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body.toString()
            })

            const json = await res.json()
            if (!res.ok || (json.json?.errors?.length)) {
                throw new Error(`Flair API error: ${JSON.stringify(json.json?.errors || res.status)}`)
            }
            return json
        }

        // doesn't set cssClass for anyone other than me.
        async function setFlairSnoo(subredditName, username, belt) { //eslint-disable-line no-unused-vars
            const {text, cssClass} = flairDetails[belt]
            await reddit.getMe()
            await reddit
                .getSubreddit(subredditName)
                .setMultipleUserFlairs([
                    {
                        name: username,
                        text: text,
                        cssClass: cssClass
                    }
                ])
            return belt
        }

        async function modmailReply(conversationId, belt, replyText = undefined, isAuthorHidden = true) {
            if (!replyText) {
                replyText = defaultMessage
            }
            await reddit.getMe()
            const convo = await reddit.getNewModmailConversation(conversationId)
            await convo.reply(replyText, isAuthorHidden, false)
        }

        try {
            username = await getModmailUsername(conversationId)
        } catch (err) {
            console.error('Failed to get modmail username', err.error)
            error = err.error
        }

        if (username) try {
            newFlair = await setFlair(subredditName, username, belt)
        } catch (err) {
            console.error('Failed to set user flair', err)
            error = 'Failed to set user flair'
        }

        if (newFlair) try {
            await modmailReply(conversationId, belt, message)
        } catch (err) {
            console.error('Failed to reply to modmail', err.error)
            error = 'Failed to reply to modmail'
        }

        if (error) {
            console.error('Error occurred:', error)
            await interaction.reply('Error occurred:', error)
        } else {
            console.log(`Successfully set flair for ${username} to ${newFlair} in subreddit ${subredditName}`)
            await interaction.reply(`Successfully set Reddit flair for u/${username} to ${belt} Belt`)
        }
    }
}
