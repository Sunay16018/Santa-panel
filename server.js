const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');

app.use(express.static(__dirname));
let bots = {};

// Render'ın uyumasını engellemek için self-ping sistemi
setInterval(() => {
    http.get(`http://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:3000'}`);
}, 1000 * 60 * 5); // 5 dakikada bir

io.on('connection', (socket) => {
    socket.on('join', (data) => {
        const botId = String(data.botId);
        if (bots[botId]) { 
            bots[botId].quit(); 
            clearInterval(bots[botId].afkInt); 
            delete bots[botId]; 
        }

        const bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.username,
            version: false,
            checkTimeoutInterval: 60000 // Bağlantı zaman aşımı süresi
        });

        bot.otoInt = null;
        
        // AGRESİF ANTİ-AFK (Sunucudan atılmayı %100 engeller)
        bot.afkInt = setInterval(() => {
            if (bot.entity) {
                // Rastgele Hareket: İleri git, zıpla, geri gel
                bot.setControlState('forward', true);
                bot.setControlState('jump', true);
                setTimeout(() => {
                    bot.setControlState('forward', false);
                    bot.setControlState('jump', false);
                    bot.setControlState('back', true);
                    setTimeout(() => bot.setControlState('back', false), 500);
                }, 500);
                
                // Rastgele Bakış
                bot.look(bot.entity.yaw + (Math.random() * 0.4), (Math.random() * 0.2));
            }
        }, 20000); // Her 20 saniyede bir

        bots[botId] = bot;

        bot.on('messagestr', (msg) => {
            const low = msg.toLowerCase();
            if (low.includes("/register")) bot.chat(`/register Santa1234 Santa1234`);
            if (low.includes("/login")) bot.chat(`/login Santa1234`);
        });

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<span style="color:#2ecc71">✔ BAĞLANTI AKTİF</span>' }));
        bot.on('message', (json) => socket.emit('log', { botId, msg: json.toHTML() }));
        
        bot.on('error', (err) => socket.emit('log', { botId, msg: `<span style="color:red">✘ HATA: ${err.message}</span>` }));
        
        bot.on('end', (reason) => {
            clearInterval(bot.afkInt);
            clearInterval(bot.otoInt);
            socket.emit('log', { botId, msg: `<span style="color:#e74c3c">● KOPMA: ${reason}</span>` });
        });
    });

    socket.on('quit-bot', (data) => {
        if (bots[data.botId]) {
            bots[data.botId].quit();
            delete bots[data.botId];
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
http.listen(PORT, () => console.log('Santa AFK v3 Online'));
              
