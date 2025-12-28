const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

io.on('connection', (socket) => {
    socket.on('join', (data) => {
        const botId = String(data.botId);
        if (bots[botId]) { bots[botId].quit(); delete bots[botId]; }

        const bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.username,
            version: false
        });

        bot.otoInterval = null;
        bots[botId] = bot;

        // Anti-AFK: Her 30 saniyede bir zıpla ve sağa-sola bak
        const afkInterval = setInterval(() => {
            if (bot.entity) {
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 500);
                bot.look(bot.entity.yaw + 0.5, 0);
            }
        }, 30000);

        bot.on('messagestr', (msg) => {
            const low = msg.toLowerCase();
            if (low.includes("/register")) bot.chat(`/register Santa1234 Santa1234`);
            if (low.includes("/login")) bot.chat(`/login Santa1234`);
        });

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<b>Bot AFK Modunda Aktif!</b>' }));
        bot.on('message', (json) => socket.emit('log', { botId, msg: json.toHTML() }));
        
        bot.on('end', () => { 
            clearInterval(bot.otoInterval); 
            clearInterval(afkInterval);
            delete bots[botId]; 
        });
    });

    socket.on('set-auto-msg', (data) => {
        const bot = bots[String(data.botId)];
        if (!bot) return;
        clearInterval(bot.otoInterval);
        if (data.active) {
            bot.otoInterval = setInterval(() => { if(bot.entity) bot.chat(data.msg); }, data.time * 1000);
        }
    });

    socket.on('send-chat', (data) => {
        const bot = bots[String(data.botId)];
        if (bot) bot.chat(data.msg);
    });
});

http.listen(process.env.PORT || 3000);
