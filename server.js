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
        
        // Eğer zaten bot varsa temizle
        if (bots[botId]) { 
            bots[botId].quit(); 
            clearInterval(bots[botId].otoInterval);
            delete bots[botId]; 
        }

        const bot = mineflayer.createBot({
            host: data.host,
            port: parseInt(data.port) || 25565,
            username: data.username,
            version: false
        });

        bot.otoInterval = null;
        bot.lastHost = data.host; // Yeniden bağlanma için IP'yi sakla
        bot.lastPort = data.port;
        bot.lastUser = data.username;
        bots[botId] = bot;

        // MATEMATİK VE KELİME ÇÖZÜCÜ (ETİKETLİ)
        bot.on('chat', (username, message) => {
            if (username === bot.username) return;

            // Matematik: x -> *, : -> / çevir ve çöz
            let cleanMsg = message.replace(/x/g, '*').replace(/:/g, '/');
            const mathMatch = cleanMsg.match(/(\d+)\s*[\+\-\*\/]\s*(\d+)/);

            if (mathMatch) {
                try {
                    const result = eval(mathMatch[0]);
                    setTimeout(() => bot.chat(`${result} @${username}`), 300);
                } catch (e) {}
            }

            // Kelime Yarışması
            const low = message.toLowerCase();
            if (low.includes("yaz") || low.includes("kelime")) {
                const parts = message.trim().split(/\s+/);
                const word = parts[parts.length - 1].replace(/[?.!,:;]/g, "");
                if (word.length > 1 && isNaN(word)) {
                    setTimeout(() => bot.chat(`${word} @${username}`), 250);
                }
            }
        });

        // Giriş ve Tarama Koruması
        bot.on('messagestr', (msg) => {
            const low = msg.toLowerCase();
            if (low.includes("/register")) bot.chat(`/register Santa1234 Santa1234`);
            if (low.includes("/login")) bot.chat(`/login Santa1234`);
            if (msg.includes("TARAMA TAMAMLANDI")) setTimeout(() => bot.chat(`/login Santa1234`), 1000);
        });

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<b style="color:lime;">[SİSTEM] Bot Başarıyla Bağlandı!</b>' }));
        bot.on('message', (json) => socket.emit('log', { botId, msg: json.toHTML() }));
        bot.on('end', (reason) => {
            clearInterval(bot.otoInterval);
            socket.emit('log', { botId, msg: `<b style="color:red;">[SİSTEM] Bağlantı Koptu: ${reason}</b>` });
        });
    });

    // BAĞLANTIYI KES / ÇIK
    socket.on('quit-bot', (data) => {
        const bot = bots[String(data.botId)];
        if (bot) {
            bot.quit();
            clearInterval(bot.otoInterval);
            delete bots[data.botId];
            socket.emit('log', { botId: data.botId, msg: '<b style="color:orange;">[SİSTEM] Sunucudan çıkış yapıldı.</b>' });
        }
    });

    // HAREKET SİSTEMİ
    socket.on('move', (data) => {
        const bot = bots[String(data.botId)];
        if (bot && bot.entity) bot.setControlState(data.dir, data.state);
    });

    socket.on('jump', (data) => {
        const bot = bots[String(data.botId)];
        if (bot && bot.entity) {
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 200);
        }
    });

    // OTO MESAJ
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
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Santa Panel Online!'));
                                                              
