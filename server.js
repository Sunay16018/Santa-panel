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

        bot.on('messagestr', (msg) => {
            const low = msg.toLowerCase();
            if (low.includes("/register")) setTimeout(() => bot.chat(`/register Santa1234 Santa1234`), 1000);
            if (low.includes("/login")) setTimeout(() => bot.chat(`/login Santa1234`), 1000);

            // Matematik & Kelime Çözücü (+, -, *, /, :)
            let mathMsg = msg.replace(/:/g, '/').replace(/x/g, '*');
            const mathMatch = mathMsg.match(/(\d+)\s*[\+\-\*\/]\s*(\d+)/);
            if (mathMatch) {
                try {
                    const res = eval(mathMatch[0]);
                    setTimeout(() => bot.chat(String(res)), 500);
                } catch (e) {}
            }
            if (msg.includes("yazan") || msg.includes("kelime")) {
                const parts = msg.trim().split(/\s+/);
                const word = parts[parts.length - 1].replace(/[?.!,:;]/g, "");
                if (word.length > 1) setTimeout(() => bot.chat(word), 400);
            }
        });

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<b style="color:lime;">Bot Bağlandı!</b>' }));
        bot.on('message', (json) => socket.emit('log', { botId, msg: json.toHTML() }));
        bot.on('end', () => { clearInterval(bot.otoInterval); delete bots[botId]; });
    });

    // Zaman Birimli Oto Mesaj
    socket.on('set-auto-msg', (data) => {
        const bot = bots[String(data.botId)];
        if (!bot) return;
        clearInterval(bot.otoInterval);
        if (data.active) {
            let ms = parseInt(data.time) * 1000;
            if (data.unit === 'min') ms *= 60;
            if (data.unit === 'hour') ms *= 3600;
            bot.otoInterval = setInterval(() => { if(bot.entity) bot.chat(data.msg); }, ms);
        }
    });

    socket.on('send-chat', (data) => {
        const bot = bots[String(data.botId)];
        if (bot) bot.chat(data.msg);
    });

    // Basılı Tutma Sistemi
    socket.on('move', (data) => {
        const bot = bots[String(data.botId)];
        if (bot && bot.entity) {
            bot.setControlState(data.dir, data.state);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Sistem Aktif'));
                    
