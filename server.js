const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Фронтендке арналған статикалық бума
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Студенттер тізімі
let students = [];

// Командалардың ұпайлары
let scores = {
    'Alfa': 0,
    'Beta': 0,
    'CreativeTeam': 0
};

// API: QR-код генерациясы
app.get('/api/qrcode', async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const registerUrl = `${protocol}://${host}/register.html`;
        
        const qrImage = await QRCode.toDataURL(registerUrl);
        res.json({ qrImage, registerUrl });
    } catch (err) {
        res.status(500).send('QR-код генерациялау қатесі');
    }
});

// API: Студентті тіркеу
app.post('/api/register', (req, res) => {
    const { firstName, lastName, team } = req.body;
    
    if (firstName && lastName && team) {
        const newStudent = {
            id: Date.now().toString(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            team: team
        };
        
        students.push(newStudent);

        io.emit('update-students', students);

        res.send(`
            <div style="font-family: Arial; text-align: center; padding: 50px;">
                <h2>Тіркелу сәтті өтті, ${firstName}!</h2>
                <p>Топ: <strong>${team}</strong></p>
                <a href="/scores.html">Ұпайлар бетіне өту</a>
            </div>
        `);
    } else {
        res.status(400).send('Барлық өрістерді толтырыңыз!');
    }
});

// WebSocket арқылы онлайн байланыс
io.on('connection', (socket) => {
    // Алғашқы деректерді жіберу
    socket.emit('update-students', students);
    socket.emit('update-scores', scores);

    // Студентті өшіру
    socket.on('delete-student', (id) => {
        students = students.filter(student => student.id !== id);
        io.emit('update-students', students);
    });

    // Ұпай қосу
    socket.on('add-score', (team) => {
        if (scores[team] !== undefined) {
            scores[team] += 1;
            io.emit('update-scores', scores);
        }
    });

    // Ұпай азайту (убрать балл)
    socket.on('minus-score', (team) => {
        if (scores[team] !== undefined && scores[team] > 0) {
            scores[team] -= 1;
            io.emit('update-scores', scores);
        }
    });

    // Барлық ұпайларды нөлдеу (сброс)
    socket.on('reset-scores', () => {
        scores = { 'Alfa': 0, 'Beta': 0, 'CreativeTeam': 0 };
        io.emit('update-scores', scores);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер іске қосылды: http://localhost:${PORT}`);
});
