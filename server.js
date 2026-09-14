const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Список участников
let students = [];

// Баллы команд (с новыми названиями)
let scores = {
    'SmartTeam': 0,
    'EduTeam': 0,
    'CreativeTeam': 0
};

// API: Генерация QR-кода
app.get('/api/qrcode', async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const registerUrl = `${protocol}://${host}/register.html`;
        
        const qrImage = await QRCode.toDataURL(registerUrl);
        res.json({ qrImage, registerUrl });
    } catch (err) {
        res.status(500).send('Ошибка генерации QR-кода');
    }
});

// Socket.io соединение
io.on('connection', (socket) => {
    // Отправка первичных данных
    socket.emit('update-students', students);
    socket.emit('update-scores', scores);

    // Регистрация нового студента через Socket
    socket.on('register-student', (data) => {
        const { firstName, lastName, team } = data;
        if (firstName && lastName && team && scores[team] !== undefined) {
            const newStudent = {
                id: Date.now().toString(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                team: team
            };
            students.push(newStudent);
            io.emit('update-students', students);
            socket.emit('registration-success', newStudent);
        }
    });

    // Добавление балла
    socket.on('add-score', (team) => {
        if (scores[team] !== undefined) {
            scores[team] += 1;
            io.emit('update-scores', scores);
        }
    });

    // Снятие балла (убрать балл)
    socket.on('minus-score', (team) => {
        if (scores[team] !== undefined && scores[team] > 0) {
            scores[team] -= 1;
            io.emit('update-scores', scores);
        }
    });

    // Сброс всех баллов
    socket.on('reset-scores', () => {
        scores = { 'SmartTeam': 0, 'EduTeam': 0, 'CreativeTeam': 0 };
        io.emit('update-scores', scores);
    });

    // Удаление студента
    socket.on('delete-student', (id) => {
        students = students.filter(student => student.id !== id);
        io.emit('update-students', students);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});
