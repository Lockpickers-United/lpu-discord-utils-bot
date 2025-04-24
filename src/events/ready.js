const {Events} = require('discord.js')

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`)
        client.users.fetch('671828049540677682').then(user => {
            //user.send('Bot is online!'); // Customize the message
        }).catch(console.error)
    }
}
