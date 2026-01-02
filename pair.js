const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const { makeWASocket, useMultiFileAuthState, delay, Browsers, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')

const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;
    
    if (!num) {
        return res.status(400).json({ error: "Number is required" });
    }

    async function MALVIN_XD_PAIR_CODE() {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(`./temp/${id}`);
        
        try {
            var items = ["Safari"];
            function selectRandomItem(array) {
                var randomIndex = Math.floor(Math.random() * array.length);
                return array[randomIndex];
            }
            var randomItem = selectRandomItem(items);
            
            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                syncFullHistory: false,
                browser: Browsers.macOS(randomItem)
            });

            sock.ev.on('creds.update', saveCreds);
            
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === "open") {
                    try {
                        await delay(2000);
                        
                        // Request pairing code
                        num = num.replace(/[^0-9]/g, '');
                        const code = await sock.requestPairingCode(num);
                        
                        if (!res.headersSent) {
                            return res.json({ code });
                        }
                        
                        // Cleanup
                        await delay(100);
                        await sock.logout();
                        removeFile(`./temp/${id}`);
                        
                    } catch (error) {
                        console.error("Error in pairing:", error);
                        if (!res.headersSent) {
                            return res.status(500).json({ error: "Failed to get pairing code" });
                        }
                    }
                    
                } else if (connection === "close") {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                    
                    if (shouldReconnect) {
                        console.log("Reconnecting...");
                        await delay(2000);
                        MALVIN_XD_PAIR_CODE();
                    } else {
                        console.log("Connection closed permanently");
                        removeFile(`./temp/${id}`);
                    }
                }
            });

        } catch (err) {
            console.error("Error in MALVIN_XD_PAIR_CODE:", err);
            removeFile(`./temp/${id}`);
            
            if (!res.headersSent) {
                return res.status(500).json({ code: "Service Unavailable" });
            }
        }
    }
    
    return MALVIN_XD_PAIR_CODE();
});

module.exports = router;
