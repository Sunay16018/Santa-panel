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

        // --- Yarışma Çözücü Sistemi ---
        bot.on('messagestr', (message) => {
            const msg = message.trim();
            
            // 1. Matematik Çözücü (Örn: "47 + 96" veya "47+96 kaçtır?")
            const mathMatch = msg.match(/(\d+)\s*[\+\-\*\/]\s*(\d+)/);
            if (mathMatch) {
                try {
                    const result = eval(mathMatch[0]);
                    setTimeout(() => bot.chat(String(result)), 500); // 0.5 saniye sonra cevap ver
                } catch (e) {}
            }

            // 2. Kelime Yazma Yarışması (Örn: "Kelimeyi ilk yazan kazanır: lmase")
            if (msg.includes("yazan kazanır") || msg.includes("doğru yaz")) {
                const words = msg.split(" ");
                const lastWord = words[words.length - 1].replace(/[?.!]/g, ""); // Son kelimeyi al
                if (lastWord.length > 2) {
                    setTimeout(() => bot.chat(lastWord), 400);
                }
            }
        });

        // --- PvP Döngüsü ---
        bot.pvpInterval = setInterval(() => {
            if (!bot.pvpActive || !bot.entity) return;
            const target = bot.nearestEntity((e) => (e.type === 'player' || e.type === 'mob') && e.id !== bot.entity.id);
            if (target && bot.entity.position.distanceTo(target.position) < 4.2) {
                bot.lookAt(target.position.offset(0, target.height, 0));
                bot.attack(target);
                bot.swingArm();
            }
        }, 550);

        // --- Kazma Döngüsü ---
        bot.mineInterval = setInterval(async () => {
            if (!bot.mineActive || !bot.entity) return;
            const block = bot.blockAtCursor(4);
            if (block && bot.canDigBlock(block)) {
                try { await bot.dig(block); } catch (e) {}
            }
        }, 300);

        // --- Auto-Respawn (Ölünce Doğma) ---
        bot.on('death', () => {
            socket.emit('log', { botId, msg: '<b style="color:red;">Bot Öldü, Yeniden Doğuluyor...</b>' });
            bot.respawn();
        });

        // --- Kayıt / Giriş ---
        bot.on('messagestr', (message) => {
            const msg = message.toLowerCase();
            if (msg.includes("/register") || msg.includes("kayit ol")) bot.chat(`/register ${config.sifre} ${config.sifre}`);
            else if (msg.includes("/login") || msg.includes("giris yap")) bot.chat(`/login ${config.sifre}`);
        });

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<b style="color:#00ff00;">Bot Sunucuda!</b>' }));
        bot.on('message', (jsonMsg) => socket.emit('log', { botId, msg: jsonMsg.toHTML() }));
        
        bot.on('end', () => {
            clearInterval(bot.pvpInterval);
            clearInterval(bot.mineInterval);
            delete bots[botId];
        });
    });

    socket.on('send-chat', (data) => {
        const bot = bots[String(data.botId)];
        if (!bot) return;
        const cmd = data.msg.toLowerCase().trim();

        if (cmd === '/pvp aç') { bot.pvpActive = true; socket.emit('log', { botId: data.botId, msg: 'PvP Aktif.' }); }
        else if (cmd === '/pvp kapat') { bot.pvpActive = false; socket.emit('log', { botId: data.botId, msg: 'PvP Kapalı.' }); }
        else if (cmd === '/mine aç') { bot.mineActive = true; socket.emit('log', { botId: data.botId, msg: 'Mine Aktif.' }); }
        else if (cmd === '/mine kapat') { bot.mineActive = false; socket.emit('log', { botId: data.botId, msg: 'Mine Kapalı.' }); }
        else { bot.chat(data.msg); }
    });

    socket.on('move', (data) => {
        const bot = bots[String(data.botId)];
        if (bot && bot.entity) bot.setControlState(data.dir, data.state);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Sunucu ${PORT} portunda hazır.`));
