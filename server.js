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
            version: false // Otomatik sürüm algılama en güvenlisidir
        });

        bot.pvpActive = false;
        bot.otoMesajInterval = null;
        bots[botId] = bot;

        // --- Yarışma Çözücü & Giriş Sistemi ---
        bot.on('messagestr', (message) => {
            const msg = message.trim();
            const low = msg.toLowerCase();

            // Giriş Yapma
            if (low.includes("/register") || low.includes("kayit ol")) bot.chat(`/register Santa1234 Santa1234`);
            if (low.includes("/login") || low.includes("giris yap")) bot.chat(`/login Santa1234`);

            // Matematik (+, -, *, /, :)
            const mathMsg = msg.replace(/:/g, '/').replace(/x/g, '*');
            const mathMatch = mathMsg.match(/(\d+)\s*[\+\-\*\/]\s*(\d+)/);
            if (mathMatch) {
                try {
                    const result = eval(mathMatch[0]);
                    setTimeout(() => bot.chat(String(result)), 400);
                } catch (e) {}
            }

            // Kelime Yarışması
            if (msg.includes("yazan") || msg.includes("kelime")) {
                const parts = msg.split(" ");
                const word = parts[parts.length - 1].replace(/[?.!,]/g, "");
                if (word.length > 1) setTimeout(() => bot.chat(word), 300);
            }
        });

        // --- Harita Verisi ---
        bot.on('move', () => {
            if (bot.entity && socket.connected) {
                socket.emit('pos', {
                    botId,
                    x: Math.round(bot.entity.position.x),
                    y: Math.round(bot.entity.position.y),
                    z: Math.round(bot.entity.position.z)
                });
            }
        });

        // --- PvP Döngüsü (Hata Düzeltildi) ---
        const pvpInterval = setInterval(() => {
            if (!bot.pvpActive || !bot.entity) return;
            const target = bot.nearestEntity((e) => (e.type === 'player' || e.type === 'mob') && e.id !== bot.entity.id);
            if (target && bot.entity.position.distanceTo(target.position) < 4.2) {
                bot.lookAt(target.position.offset(0, target.height, 0));
                bot.attack(target);
            }
        }, 500);

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<b style="color:lime;">Bağlantı Başarılı!</b>' }));
        bot.on('message', (jsonMsg) => socket.emit('log', { botId, msg: jsonMsg.toHTML() }));
        bot.on('death', () => bot.respawn());
        bot.on('kicked', (reason) => socket.emit('log', { botId, msg: `<b style="color:orange;">Atıldı: ${reason}</b>` }));
        
        bot.on('end', () => {
            clearInterval(pvpInterval);
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
            let time = parseInt(data.time) * 1000;
            if (data.unit === 'min') time *= 60;
            if (data.unit === 'hour') time *= 3600;
            bot.otoMesajInterval = setInterval(() => { if(bot.entity) bot.chat(data.msg); }, time);
        }
    });

    socket.on('send-chat', (data) => {
        const bot = bots[String(data.botId)];
        if (!bot) return;
        if (data.msg === '/pvp aç') bot.pvpActive = true;
        else if (data.msg === '/pvp kapat') bot.pvpActive = false;
        else bot.chat(data.msg);
    });

    socket.on('move', (data) => {
        const bot = bots[String(data.botId)];
        if (bot && bot.entity) bot.setControlState(data.dir, data.state);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Port: ${PORT}`));
              
