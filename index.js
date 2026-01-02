const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(__dirname));

// Import routes
const pairRouter = require('./pair');
const qrRouter = require('./qr');

// Routes
app.use('/code', pairRouter);   // Pair code API: /code?number=263...
app.use('/qr-api', qrRouter);   // QR API: /qr-api

// HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'MALVIN-XD Pair Service',
        uptime: process.uptime()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🚀 MALVIN-XD PAIR SERVER STARTED SUCCESSFULLY  ║
║                                                   ║
╠═══════════════════════════════════════════════════╣
║                                                   ║
║   🔗 Main URL:    http://localhost:${PORT}        ║
║   📱 Pair Code:   http://localhost:${PORT}/       ║
║   📷 QR Scanner:  http://localhost:${PORT}/qr     ║
║   ❤️  Health:      http://localhost:${PORT}/health ║
║                                                   ║
║   ⏰ Server Time: ${new Date().toLocaleString()}  ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔴 Shutting down server...');
    // Clean temp directory
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('🧹 Temp directory cleaned');
    }
    console.log('👋 Server stopped gracefully');
    process.exit(0);
});
