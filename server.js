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
        if (bots[botId]) { bots[botId].quit(); clearInterval(bots[botId].afkInt); delete bots[botId]; }

        const bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.username,
            version: false
        });

        bot.otoInt = null;
        // Anti-AFK: 25 saniyede bir ufak hareket ve zıplama
        bot.afkInt = setInterval(() => {
            if (bot.entity) {
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 400);
                bot.look(bot.entity.yaw + 0.2, 0);
            }
        }, 25000);

        bots[botId] = bot;

        bot.on('messagestr', (msg) => {
            const low = msg.toLowerCase();
            if (low.includes("/register")) bot.chat(`/register Santa1234 Santa1234`);
            if (low.includes("/login")) bot.chat(`/login Santa1234`);
        });

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<span style="color:#2ecc71">● Bağlantı Başarılı</span>' }));
        bot.on('message', (json) => socket.emit('log', { botId, msg: json.toHTML() }));
        bot.on('end', () => { socket.emit('log', { botId, msg: '<span style="color:#e74c3c">● Bağlantı Kesildi</span>' }); });
    });

    socket.on('quit-bot', (data) => {
        if (bots[data.botId]) {
            bots[data.botId].quit();
            clearInterval(bots[data.botId].afkInt);
            clearInterval(bots[data.botId].otoInt);
            delete bots[data.botId];
            socket.emit('log', { botId: data.botId, msg: '<span style="color:#f1c40f">● Bot Kapatıldı.</span>' });
        }
    });

    socket.on('set-auto-msg', (data) => {
        const bot = bots[data.botId];
        if (!bot) return;
        clearInterval(bot.otoInt);
        if (data.active) {
            bot.otoInt = setInterval(() => { if(bot.entity) bot.chat(data.msg); }, data.time * 1000);
        }
    });

    socket.on('send-chat', (data) => {
        if (bots[data.botId]) bots[data.botId].chat(data.msg);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Santa AFK v2 Ready'));
