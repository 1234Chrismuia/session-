const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
let router = express.Router();
const pino = require("pino");
const {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers
} = require("@whiskeysockets/baileys");

const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    try {
        fs.rmSync(FilePath, { recursive: true, force: true });
    } catch (err) {
        console.error("Error removing file:", err);
    }
}

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

router.get('/', async (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(path.join(__dirname, '../qr.html'));
});

router.get('/server', async (req, res) => {
    const id = makeid();
    
    async function MALVIN_XD_PAIR_CODE() {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(`./temp/${id}`);
        
        try {
            let sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
            });
            
            sock.ev.on('creds.update', saveCreds);
            
            sock.ev.on("connection.update", async (update) => {
                const { connection, qr, lastDisconnect } = update;
                
                if (qr) {
                    try {
                        const qrBuffer = await QRCode.toBuffer(qr);
                        res.setHeader('Content-Type', 'image/png');
                        res.end(qrBuffer);
                    } catch (error) {
                        console.error("QR generation error:", error);
                    }
                }
                
                if (connection === "open") {
                    console.log("Connected successfully!");
                    
                    try {
                        await delay(3000);
                        
                        const credsPath = path.join(__dirname, `temp/${id}/creds.json`);
                        
                        if (fs.existsSync(credsPath)) {
                            try {
                                const { upload } = require('./mega');
                                const mega_url = await upload(fs.createReadStream(credsPath), `${sock.user.id}.json`);
                                const string_session = mega_url.replace('https://mega.nz/file/', '');
                                let md = "malvin~" + string_session;
                                
                                await sock.sendMessage(sock.user.id, { text: md });
                                
                                let desc = `*Hey there, MALVIN-XD User!* 👋🏻

Thanks for using *MALVIN-XD* — your session has been successfully created!

🔐 *Session ID:* Sent above  
⚠️ *Keep it safe!* Do NOT share this ID with anyone.

——————

*✅ Stay Updated:*  
Join our official WhatsApp Channel:  
https://whatsapp.com/channel/0029VbA6MSYJUM2TVOzCSb2A

*💻 Source Code:*  
Fork & explore the project on GitHub:  
https://github.com/XdKing2/MALVIN-XD

——————

> *© Powered by Malvin King*
Stay cool and hack smart. ✌🏻`;
                                
                                await sock.sendMessage(sock.user.id, {
                                    text: desc,
                                    contextInfo: {
                                        externalAdReply: {
                                            title: "ᴍᴀʟᴠɪɴ-xᴅ",
                                            thumbnailUrl: "https://files.catbox.moe/bqs70b.jpg",
                                            sourceUrl: "https://whatsapp.com/channel/0029VbA6MSYJUM2TVOzCSb2A",
                                            mediaType: 1,
                                            renderLargerThumbnail: true
                                        }  
                                    }
                                });
                                
                            } catch (e) {
                                console.error("Upload error:", e);
                                await sock.sendMessage(sock.user.id, { 
                                    text: `Error: ${e.message}\n\nBut your session is connected! Use /session command to get your session ID.`
                                });
                            }
                        }
                        
                        await delay(1000);
                        await sock.logout();
                        
                    } catch (error) {
                        console.error("Error after connection:", error);
                    } finally {
                        removeFile(`./temp/${id}`);
                        console.log(`👤 ${sock.user.id} Connected ✅`);
                    }
                    
                } else if (connection === "close") {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                    
                    if (shouldReconnect) {
                        console.log("Reconnecting...");
                        await delay(2000);
                        MALVIN_XD_PAIR_CODE();
                    } else {
                        console.log("Connection closed");
                        removeFile(`./temp/${id}`);
                    }
                }
            });
            
        } catch (err) {
            console.error("Error in MALVIN_XD_PAIR_CODE:", err);
            removeFile(`./temp/${id}`);
            
            if (!res.headersSent) {
                res.status(500).send("Service Unavailable");
            }
        }
    }
    
    MALVIN_XD_PAIR_CODE();
});

// Optional: Auto-restart every 30 minutes
setInterval(() => {
    console.log("☘️ Restarting process...");
    // Clean temp directory
    if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach(file => {
            const filePath = path.join(tempDir, file);
            if (fs.statSync(filePath).isDirectory()) {
                const dirAge = Date.now() - fs.statSync(filePath).mtimeMs;
                if (dirAge > 1800000) { // 30 minutes
                    removeFile(filePath);
                }
            }
        });
    }
}, 1800000); // 30 minutes

module.exports = router;
