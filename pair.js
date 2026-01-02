[file content begin]
const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pino = require("pino");
const { 
    makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    Browsers,
    makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');

// Clean temp directory
function cleanTemp() {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        const now = Date.now();
        fs.readdirSync(tempDir).forEach(folder => {
            const folderPath = path.join(tempDir, folder);
            try {
                if (fs.statSync(folderPath).isDirectory()) {
                    const folderAge = now - fs.statSync(folderPath).mtimeMs;
                    if (folderAge > 300000) { // 5 minutes
                        fs.rmSync(folderPath, { recursive: true, force: true });
                    }
                }
            } catch (e) {
                // Ignore
            }
        });
    }
}

router.get('/', async (req, res) => {
    // Clean old temp files first
    cleanTemp();
    
    const number = req.query.number;
    
    if (!number) {
        return res.status(400).json({ error: "Phone number is required" });
    }
    
    const cleanNumber = number.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
        return res.status(400).json({ error: "Invalid phone number format" });
    }
    
    const sessionId = makeid(6);
    const sessionPath = path.join(__dirname, `temp/${sessionId}`);
    
    console.log(`📱 Pair request for: +${cleanNumber} (Session: ${sessionId})`);
    
    try {
        // Create auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        // Create WhatsApp socket
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            syncFullHistory: false,
            browser: Browsers.macOS("Safari"),
            connectTimeoutMs: 30000
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === "open") {
                try {
                    await delay(1000);
                    
                    // Request pairing code
                    const pairingCode = await sock.requestPairingCode(cleanNumber);
                    console.log(`✅ Pairing code generated for +${cleanNumber}: ${pairingCode}`);
                    
                    // Format response
                    const formattedNumber = `+${cleanNumber.slice(0,3)} ${cleanNumber.slice(3,7)} ${cleanNumber.slice(7)}`;
                    
                    if (!res.headersSent) {
                        res.json({ 
                            code: pairingCode,
                            number: formattedNumber,
                            message: "✅ Pairing code generated successfully!",
                            note: "Enter this code in WhatsApp > Linked Devices > Link a Device"
                        });
                    }
                    
                    // Send welcome message to user
                    try {
                        await delay(2000);
                        const welcomeMsg = `🔐 *MALVIN-XD Session Created!*\n\n` +
                                          `📱 *Number:* ${formattedNumber}\n` +
                                          `🔢 *Code:* ${pairingCode}\n` +
                                          `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                                          `⚠️ *Keep your session secure!*\n` +
                                          `🔗 *GitHub:* https://github.com/XdKing2/MALVIN-XD`;
                        
                        await sock.sendMessage(sock.user.id, { text: welcomeMsg });
                    } catch (msgError) {
                        console.log("Welcome message not sent (expected)");
                    }
                    
                    // Cleanup after 5 seconds
                    setTimeout(async () => {
                        try {
                            await sock.ws.close();
                            fs.rmSync(sessionPath, { recursive: true, force: true });
                            console.log(`🧹 Session ${sessionId} cleaned`);
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                    }, 5000);
                    
                } catch (pairError) {
                    console.error("❌ Pairing error:", pairError.message);
                    if (!res.headersSent) {
                        res.status(500).json({ 
                            error: "Failed to generate pairing code",
                            details: "Make sure the number is valid and try again"
                        });
                    }
                    try {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                    } catch (e) {}
                }
                
            } else if (connection === "close") {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === 401) {
                    console.log("🔐 Authentication required");
                } else {
                    console.log("📴 Connection closed");
                }
                
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                } catch (e) {}
            }
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
            if (!res.headersSent) {
                console.log(`⏰ Timeout for session ${sessionId}`);
                res.status(408).json({ 
                    error: "Request timeout",
                    message: "Please try again. Make sure your number is correct."
                });
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                } catch (e) {}
            }
        }, 30000);
        
    } catch (error) {
        console.error("❌ Server error:", error.message);
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (e) {}
        
        if (!res.headersSent) {
            res.status(500).json({ 
                error: "Service unavailable",
                message: "Please wait a moment and try again"
            });
        }
    }
});

module.exports = router;
[file content end]
