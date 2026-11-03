import {Client, Collection, GatewayIntentBits, Partials} from 'discord.js'

/**
 * @prop Guilds
 * @prop GuildMessages
 * @prop GuildMembers
 * @prop DirectMessages
 * @prop MessageContent
 * @prop GuildMessageReactions
 */

export const client = new Client({
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

