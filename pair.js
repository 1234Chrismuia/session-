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

// Clean up temp files
function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    try {
        fs.rmSync(FilePath, { recursive: true, force: true });
        return true;
    } catch (err) {
        console.error("Error removing file:", err);
        return false;
    }
}

router.get('/', async (req, res) => {
    const number = req.query.number;
    
    // Validate number
    if (!number) {
        return res.status(400).json({ error: "Phone number is required" });
    }
    
    // Clean number
    const cleanNumber = number.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10) {
        return res.status(400).json({ error: "Invalid phone number" });
    }
    
    const sessionId = makeid(8);
    const sessionPath = path.join(__dirname, `temp/${sessionId}`);
    
    console.log(`🔑 Starting pairing for: ${cleanNumber}`);
    
    try {
        // Create auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        // Create WhatsApp socket
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            syncFullHistory: false,
            browser: Browsers.macOS("Safari")
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        // Handle connection events
        sock.ev.on("connection.update", async (update) => {
            const { connection } = update;
            
            if (connection === "open") {
                try {
                    await delay(1000);
                    
                    // Get pairing code
                    const pairingCode = await sock.requestPairingCode(cleanNumber);
                    console.log(`✅ Pairing code generated for ${cleanNumber}: ${pairingCode}`);
                    
                    if (!res.headersSent) {
                        res.json({ 
                            code: pairingCode,
                            number: `+${cleanNumber}`,
                            message: "Pairing code generated successfully"
                        });
                    }
                    
                    // Cleanup after sending response
                    setTimeout(async () => {
                        try {
                            await sock.logout();
                            await delay(500);
                            removeFile(sessionPath);
                            console.log(`🧹 Session ${sessionId} cleaned up`);
                        } catch (e) {
                            console.error("Cleanup error:", e);
                        }
                    }, 2000);
                    
                } catch (pairError) {
                    console.error("Pairing error:", pairError);
                    if (!res.headersSent) {
                        res.status(500).json({ error: "Failed to generate pairing code" });
                    }
                    removeFile(sessionPath);
                }
                
            } else if (connection === "close") {
                console.log("Connection closed for", cleanNumber);
                removeFile(sessionPath);
            }
        });
        
        // Timeout after 30 seconds
        setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({ error: "Request timeout. Please try again." });
                removeFile(sessionPath);
            }
        }, 30000);
        
    } catch (error) {
        console.error("Server error:", error);
        removeFile(sessionPath);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                error: "Service temporarily unavailable",
                message: "Please try again in a few moments"
            });
        }
    }
});

module.exports = router;
[file content end]
