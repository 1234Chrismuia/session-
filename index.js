const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 5000;

// Ensure temp directory exists (Heroku has ephemeral filesystem)
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Import routes
const pairRouter = require('./pair');
const qrRouter = require('./qr');

// Routes
app.use('/code', pairRouter);
app.use('/server', qrRouter); // Changed to /server to match qr.html

// HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'MALVIN-XD WhatsApp Pair',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Clean old temp files every hour
setInterval(() => {
    if (fs.existsSync(tempDir)) {
        const now = Date.now();
        fs.readdirSync(tempDir).forEach(folder => {
            const folderPath = path.join(tempDir, folder);
            try {
                if (fs.statSync(folderPath).isDirectory()) {
                    const folderAge = now - fs.statSync(folderPath).mtimeMs;
                    if (folderAge > 3600000) { // 1 hour
                        fs.rmSync(folderPath, { recursive: true, force: true });
                        console.log(`Cleaned old session: ${folder}`);
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        });
    }
}, 3600000);

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     🚀 MALVIN-XD PAIR SERVER                          ║
║     ✅ Running on PORT: ${PORT}                        ║
║     🌐 URL: https://${process.env.HEROKU_APP_NAME || 'localhost'}.herokuapp.com ║
║                                                       ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║   📌 Endpoints:                                      ║
║   • Main:        /                                   ║
║   • Pair Code:   /code?number=263XXXXXXXXX           ║
║   • QR Code:     /server                             ║
║   • Health:      /health                             ║
║                                                       ║
║   ⏰ Started: ${new Date().toLocaleString()}          ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    console.log('✅ Cleanup complete');
    process.exit(0);
});

