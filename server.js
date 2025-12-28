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

        bot.pvpActive = false;
        bot.mineActive = false;
        bot.otoMesajInterval = null;
        bots[botId] = bot;

        // --- GELİŞMİŞ YARIŞMA ÇÖZÜCÜ ---
        bot.on('messagestr', (message) => {
            const msg = message.trim();
            const lowerMsg = msg.toLowerCase();

            // 1. Otomatik Giriş/Kayıt
            if (lowerMsg.includes("/register") || lowerMsg.includes("kayit ol")) bot.chat(`/register Santa1234 Santa1234`);
            else if (lowerMsg.includes("/login") || lowerMsg.includes("giris yap")) bot.chat(`/login Santa1234`);

            // 2. Her Türlü Matematik İşlemi (+, -, *, /, :)
            // "50 : 2" veya "100 / 5" gibi ifadeleri yakalar
            let mathMsg = msg.replace(/:/g, '/').replace(/x/g, '*'); 
            const mathMatch = mathMsg.match(/(\d+)\s*[\+\-\*\/]\s*(\d+)/);
            
            if (mathMatch) {
                try {
                    const result = eval(mathMatch[0]);
                    setTimeout(() => bot.chat(String(result)), 250); // 0.25 saniye hız
                } catch (e) {}
            }

            // 3. Kelime Yarışması (En Hızlı Mod)
            if (msg.includes("yazan") || msg.includes("yaziniz") || msg.includes("kelime")) {
                const words = msg.split(/\s+/);
                // Mesajın sonundaki kelimeyi temizleyerek alır
                const targetWord = words[words.length - 1].replace(/[?.!,:;]/g, "");
                if (targetWord.length > 1 && !targetWord.includes("/")) {
                    setTimeout(() => bot.chat(targetWord), 200); 
                }
            }
        });

        // --- Harita Konum Takibi ---
        bot.on('move', () => {
            if (bot.entity) {
                socket.emit('pos', {
                    botId,
                    x: Math.round(bot.entity.position.x),
                    y: Math.round(bot.entity.position.y),
                    z: Math.round(bot.entity.position.z)
                });
            }
        });

        // --- PvP & Mine Döngüleri ---
        bot.pvpLoop = setInterval(() => {
            if (!bot.pvpActive || !bot.entity) return;
            const target = bot.nearestEntity((e) => (e.type === 'player' || e.type === 'mob') && e.id !== bot.entity.id);
            if (target && bot.entity.position.distanceTo(target.position) < 4.5) {
                bot.lookAt(target.position.offset(0, target.height, 0));
                bot.attack(target);
                bot.swingArm();
            }
        }, 500);

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<b style="color:#00ff00;">Bot Sunucuda!</b>' }));
        bot.on('message', (jsonMsg) => socket.emit('log', { botId, msg: jsonMsg.toHTML() }));
        bot.on('death', () => bot.respawn());
        
        bot.on('end', () => {
            clearInterval(bot.pvpLoop);
            if(bot.otoMesajInterval) clearInterval(bot.otoMesajInterval);
            delete bots[botId];
            socket.emit('log', { botId, msg: '<b style="color:red;">Bağlantı Kesildi.</b>' });
        });
    });

    socket.on('set-auto-msg', (data) => {
        const bot = bots[String(data.botId)];
        if (!bot) return;
        if (bot.otoMesajInterval) clearInterval(bot.otoMesajInterval);
        if (data.active) {
            let ms = parseInt(data.time) * 1000;
            if (data.unit === 'min') ms *= 60;
            if (data.unit === 'hour') ms *= 3600;
            bot.otoMesajInterval = setInterval(() => { if(bot.entity) bot.chat(data.msg); }, ms);
            socket.emit('log', { botId: data.botId, msg: `<b style="color:yellow;">Oto-Mesaj Başlatıldı.</b>` });
        }
    });

    socket.on('send-chat', (data) => {
        const bot = bots[String(data.botId)];
        if (!bot) return;
        const cmd = data.msg.toLowerCase().trim();
        if (cmd === '/pvp aç') bot.pvpActive = true;
        else if (cmd === '/pvp kapat') bot.pvpActive = false;
        else bot.chat(data.msg);
    });

    socket.on('move', (data) => {
        const bot = bots[String(data.botId)];
        if (bot && bot.entity) bot.setControlState(data.dir, data.state);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server aktif: ${PORT}`));
