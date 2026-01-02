const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pino = require("pino");
const {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers
} = require("@whiskeysockets/baileys");

router.get('/', async (req, res) => {
    // Clean old temp files
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
    
    const sessionId = makeid(6);
    const sessionPath = path.join(__dirname, `temp/${sessionId}`);
    
    console.log(`📷 QR session started: ${sessionId}`);
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Safari"),
            syncFullHistory: false,
            connectTimeoutMs: 30000
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on("connection.update", async (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            // Send QR code
            if (qr && !res.headersSent) {
                try {
                    console.log(`✅ QR generated for session ${sessionId}`);
                    const qrBuffer = await QRCode.toBuffer(qr, {
                        errorCorrectionLevel: 'H',
                        margin: 2,
                        width: 400
                    });
                    
                    res.setHeader('Content-Type', 'image/png');
                    res.setHeader('X-Session-ID', sessionId);
                    res.end(qrBuffer);
                    
                } catch (qrError) {
                    console.error("❌ QR generation error:", qrError);
                    if (!res.headersSent) {
                        res.status(500).json({ error: "Failed to generate QR code" });
                    }
                }
            }
            
            if (connection === "open") {
                console.log(`✅ WhatsApp connected for session ${sessionId}`);
                
                try {
                    await delay(2000);
                    
                    // Send success message
                    const successMsg = `✅ *MALVIN-XD QR Session Connected!*\n\n` +
                                      `🆔 *Session ID:* ${sessionId}\n` +
                                      `📱 *User:* ${sock.user?.id || 'Unknown'}\n` +
                                      `⏰ *Time:* ${new Date().toLocaleTimeString()}\n\n` +
                                      `🔐 *Session created successfully!*\n` +
                                      `⚠️ *Do not share your session with anyone*\n\n` +
                                      `🔗 *GitHub:* https://github.com/XdKing2/MALVIN-XD`;
                    
                    await sock.sendMessage(sock.user.id, { text: successMsg });
                    
                } catch (msgError) {
                    console.log("Welcome message not sent");
                }
                
                // Cleanup after 3 seconds
                setTimeout(async () => {
                    try {
                        await sock.ws.close();
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                        console.log(`🧹 QR session ${sessionId} cleaned`);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }, 3000);
                
            } else if (connection === "close") {
                console.log(`📴 QR session ${sessionId} closed`);
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                } catch (e) {}
                
                if (lastDisconnect?.error?.output?.statusCode === 401) {
                    console.log("🔐 Authentication failed for QR session");
                }
            }
        });
        
        // Timeout after 30 seconds if no QR
        setTimeout(() => {
            if (!res.headersSent) {
                console.log(`⏰ QR timeout for session ${sessionId}`);
                res.status(408).json({ 
                    error: "QR generation timeout",
                    message: "Please reload the page and try again"
                });
                try {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                } catch (e) {}
            }
        }, 30000);
        
    } catch (error) {
        console.error("❌ QR server error:", error.message);
        try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        } catch (e) {}
        
        if (!res.headersSent) {
            res.status(500).json({ 
                error: "QR service unavailable",
                message: "Please try again in a moment"
            });
        }
    }
});

module.exports = router;

