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
        bot.isScanning = false; // Tarama durumu kontrolü
        bot.otoMesajInterval = null;
        bots[botId] = bot;

        bot.on('messagestr', (message) => {
            const msg = message.trim();
            const low = msg.toLowerCase();

            // --- Tarama Kontrolü ---
            if (msg.includes("TARAMA MODU AKTİF")) {
                bot.isScanning = true;
                socket.emit('log', { botId, msg: '<b style="color:orange;">[!] Sunucu tarama yapıyor, bekleniyor...</b>' });
            }

            if (msg.includes("TARAMA TAMAMLANDI") || msg.includes("komutları kullanabilirsiniz")) {
                bot.isScanning = false;
                socket.emit('log', { botId, msg: '<b style="color:lime;">[!] Tarama bitti! Giriş yapılıyor...</b>' });
                // Tarama bittikten 2 saniye sonra giriş yap
                setTimeout(() => { bot.chat(`/login Santa1234`); }, 2000);
            }

            // --- Giriş & Kayıt (Eğer tarama yoksa) ---
            if (!bot.isScanning) {
                if (low.includes("/register") || low.includes("kayit ol")) {
                    setTimeout(() => { bot.chat(`/register Santa1234 Santa1234`); }, 1500);
                }
                if (low.includes("/login") || (low.includes("giris yap") && !msg.includes("TAMAMLANDI"))) {
                    setTimeout(() => { bot.chat(`/login Santa1234`); }, 1500);
                }

                // --- Yarışma Çözücü ---
                // Matematik (+, -, *, /, :)
                let mathMsg = msg.replace(/:/g, '/').replace(/x/g, '*');
                const mathMatch = mathMsg.match(/(\d+)\s*[\+\-\*\/]\s*(\d+)/);
                if (mathMatch) {
                    try {
                        const result = eval(mathMatch[0]);
                        setTimeout(() => bot.chat(String(result)), 600);
                    } catch (e) {}
                }

                // Kelime Yarışması
                if (msg.includes("yazan") || msg.includes("kelime") || msg.includes("yaziniz")) {
                    const parts = msg.split(/\s+/);
                    const word = parts[parts.length - 1].replace(/[?.!,:;]/g, "");
                    if (word.length > 1 && !word.includes("/")) {
                        setTimeout(() => bot.chat(word), 500);
                    }
                }
            }
        });

        // --- Konum & Harita ---
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

        // --- PvP Döngüsü ---
        const pvpInterval = setInterval(() => {
            if (!bot.pvpActive || !bot.entity) return;
            const target = bot.nearestEntity((e) => (e.type === 'player' || e.type === 'mob') && e.id !== bot.entity.id);
            if (target && bot.entity.position.distanceTo(target.position) < 4.2) {
                bot.lookAt(target.position.offset(0, target.height, 0));
                bot.attack(target);
                bot.swingArm();
            }
        }, 500);

        bot.on('spawn', () => socket.emit('log', { botId, msg: '<b style="color:cyan;">Bot Spawnlandı!</b>' }));
        bot.on('message', (jsonMsg) => socket.emit('log', { botId, msg: jsonMsg.toHTML() }));
        bot.on('death', () => bot.respawn());
        
        bot.on('end', (reason) => {
            clearInterval(pvpInterval);
            if(bot.otoMesajInterval) clearInterval(bot.otoMesajInterval);
            delete bots[botId];
            socket.emit('log', { botId, msg: `<b style="color:red;">Bağlantı Kesildi: ${reason}</b>` });
        });
    });

    socket.on('set-auto-msg', (data) => {
        const bot = bots[String(data.botId)];
        if (!bot) return;
        if (bot.otoMesajInterval) clearInterval(bot.otoMesajInterval);
        if (data.active && data.time > 0) {
            let time = parseInt(data.time) * 1000;
            if (data.unit === 'min') time *= 60;
            bot.otoMesajInterval = setInterval(() => { if(bot.entity) bot.chat(data.msg); }, time);
            socket.emit('log', { botId: data.botId, msg: '<b>Oto-Mesaj Aktif.</b>' });
        }
    });

    socket.on('send-chat', (data) => {
        const bot = bots[String(data.botId)];
        if (!bot) return;
        if (data.msg === '/pvp aç') { bot.pvpActive = true; socket.emit('log', {botId: data.botId, msg: 'PvP Modu Açıldı'}); }
        else if (data.msg === '/pvp kapat') { bot.pvpActive = false; }
        else { bot.chat(data.msg); }
    });

    socket.on('move', (data) => {
        const bot = bots[String(data.botId)];
        if (bot && bot.entity) bot.setControlState(data.dir, data.state);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Sunucu aktif.`));
