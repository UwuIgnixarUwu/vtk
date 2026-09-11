const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Статическая папка для фронтенда
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Список студентов (в памяти сервера)
let students = [];

// API: Генерация QR-кода (автоматически определяет протокол http/https и хост)
app.get('/api/qrcode', async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const registerUrl = `${protocol}://${host}/register.html`;
        
        // Генерируем QR-код в формате Data URL (картинка base64)
        const qrImage = await QRCode.toDataURL(registerUrl);
        res.json({ qrImage, registerUrl });
    } catch (err) {
        res.status(500).send('Ошибка генерации QR-кода');
    }
});

// API: Регистрация студента
app.post('/api/register', (req, res) => {
    const { firstName, lastName } = req.body;
    
    if (firstName && lastName) {
        const newStudent = {
            id: Date.now().toString(),
            firstName: firstName.trim(),
            lastName: lastName.trim()
        };
        
        students.push(newStudent);

        // Рассылаем обновленный список ВСЕМ подключенным клиентам (в реальном времени)
        io.emit('update-students', students);

        // Перенаправляем пользователя на страницу успеха или обратно на главную
        res.send(`<h2>Регистрация прошла успешно, ${firstName}! Можете закрыть эту вкладку.</h2><a href="/">На главную</a>`);
    } else {
        res.status(400).send('Заполните все поля!');
    }
});

// WebSocket подключение
io.on('connection', (socket) => {
    // При подключении отправляем текущий список студентов
    socket.emit('update-students', students);

    // Удаление студента (доступно через админку)
    socket.on('delete-student', (id) => {
        students = students.filter(student => student.id !== id);
        // Рассылаем обновленный список всем
        io.emit('update-students', students);
    });
});

// Используем порт хостинга или 3000 для локального теста
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});