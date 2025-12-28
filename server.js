const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mineflayer = require('mineflayer');
const fs = require('fs');

app.use(express.static(__dirname));

let bots = {};

function getConfig() {
    try {
        if (fs.existsSync('./config.json')) {
            return JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        }
    } catch (e) {}
    return { sifre: "Santa1234" };
}

io.on('connection', (socket) => {
    socket.on('join', (data) => {
        const botId = String(data.botId);
        const config = getConfig();
        
        if (bots[botId]) { bots[botId].quit(); delete bots[botId]; }

        const bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.username,
            version: false
        });

        bot.pvpActive = false;
        bot.mineActive = false;
        bots[botId] = bot;

        // PvP Sistemi
        bot.pvpInterval = setInterval(() => {
            if (!bot.pvpActive || !bot.entity) return;
            const target = bot.nearestEntity((e) => (e.type === 'player' || e.type === 'mob') && e.id !== bot.entity.id);
            if (target && bot.entity.position.distanceTo(target.position) < 4.5) {
                bot.lookAt(target.position.offset(0, target.height, 0));
                bot.attack(target);
            }
        }, 600);

        // Kazma Sistemi
        bot.mineInterval = setInterval(async () => {
            if (!bot.mineActive || !bot.entity) return;
            const block = bot.blockAtCursor(4);
            if (block && bot.canDigBlock(block)) {
                try { await bot.dig(block); } catch (e) {}
            }
        }, 400);

        bot.on('messagestr', (message) => {
            const msg = message.toLowerCase();
            if (msg.includes("/register") || msg.includes("kayit ol")) bot.chat(`/register ${config.sifre} ${config.sifre}`);
            else if (msg.includes("/login") || msg.includes("giris yap")) bot.chat(`/login ${config.sifre}`);
        });

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<b style="color:#00ff00;">Bot Sunucuda!</b>' }));
        bot.on('message', (jsonMsg) => socket.emit('log', { botId, msg: jsonMsg.toHTML() }));
        bot.on('error', (err) => socket.emit('log', { botId, msg: `<span style="color:red;">Hata: ${err.message}</span>` }));
        
        bot.on('end', () => {
            clearInterval(bot.pvpInterval);
            clearInterval(bot.mineInterval);
            delete bots[botId];
            socket.emit('log', { botId, msg: '<b style="color:red;">Bağlantı Kesildi.</b>' });
        });
    });

    socket.on('send-chat', (data) => {
        const bot = bots[String(data.botId)];
        if (!bot) return;
        const cmd = data.msg.toLowerCase().trim();

        if (cmd === '/pvp aç') {
            bot.pvpActive = true;
            socket.emit('log', { botId: data.botId, msg: '<b style="color:cyan;">[SİSTEM] PvP Başladı.</b>' });
        } else if (cmd === '/pvp kapat') {
            bot.pvpActive = false;
            socket.emit('log', { botId: data.botId, msg: '<b style="color:cyan;">[SİSTEM] PvP Durdu.</b>' });
        } else if (cmd === '/mine aç') {
            bot.mineActive = true;
            socket.emit('log', { botId: data.botId, msg: '<b style="color:orange;">[SİSTEM] Kazma Başladı.</b>' });
        } else if (cmd === '/mine kapat') {
            bot.mineActive = false;
            socket.emit('log', { botId: data.botId, msg: '<b style="color:orange;">[SİSTEM] Kazma Durdu.</b>' });
        } else {
            bot.chat(data.msg);
        }
    });

    socket.on('move', (data) => {
        const bot = bots[String(data.botId)];
        if (bot && bot.entity) bot.setControlState(data.dir, data.state);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor.`));
