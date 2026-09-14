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

let students = [];

let teamsData = {
    'SmartTeam': {
        score: 0,
        workUrl: '',
        aiCriteria: { functional: 0, design: 0, codeQuality: 0, prompt: 0, defense: 0 },
        aiTotal: 0,
        aiEvaluated: false
    },
    'EduTeam': {
        score: 0,
        workUrl: '',
        aiCriteria: { functional: 0, design: 0, codeQuality: 0, prompt: 0, defense: 0 },
        aiTotal: 0,
        aiEvaluated: false
    },
    'CreativeTeam': {
        score: 0,
        workUrl: '',
        aiCriteria: { functional: 0, design: 0, codeQuality: 0, prompt: 0, defense: 0 },
        aiTotal: 0,
        aiEvaluated: false
    }
};

let adminAiSettings = {
    'SmartTeam': { functional: 5, design: 4, codeQuality: 5, prompt: 4, defense: 5 },
    'EduTeam': { functional: 4, design: 5, codeQuality: 4, prompt: 5, defense: 4 },
    'CreativeTeam': { functional: 5, design: 5, codeQuality: 4, prompt: 4, defense: 4 }
};

app.get('/api/qrcode', async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const registerUrl = `${protocol}://${host}/register.html`;
        const qrImage = await QRCode.toDataURL(registerUrl);
        res.json({ qrImage, registerUrl });
    } catch (err) {
        res.status(500).send('QR қатесі');
    }
});

io.on('connection', (socket) => {
    socket.emit('update-students', students);
    socket.emit('update-teams', teamsData);
    socket.emit('update-admin-settings', adminAiSettings);

    socket.on('register-student', (data) => {
        const { firstName, lastName, team } = data;
        if (firstName && lastName && team && teamsData[team]) {
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

    // Тіркелгеннен кейін жұмыс сілтемесін жіберу
    socket.on('submit-work-url', (data) => {
        const { team, workUrl } = data;
        if (teamsData[team] && workUrl) {
            teamsData[team].workUrl = workUrl.trim();
            io.emit('update-teams', teamsData);
            socket.emit('work-url-saved');
        }
    });

    socket.on('add-score', (team) => {
        if (teamsData[team]) {
            teamsData[team].score += 1;
            io.emit('update-teams', teamsData);
        }
    });

    socket.on('minus-score', (team) => {
        if (teamsData[team] && teamsData[team].score > 0) {
            teamsData[team].score -= 1;
            io.emit('update-teams', teamsData);
        }
    });

    socket.on('start-ai-evaluation', async (team) => {
        if (!teamsData[team] || teamsData[team].aiEvaluated) return;

        const settings = adminAiSettings[team];
        const criteriaList = ['functional', 'design', 'codeQuality', 'prompt', 'defense'];
        let runningTotal = 0;

        for (let key of criteriaList) {
            await new Promise(resolve => setTimeout(resolve, 3500));
            const val = settings[key] || 0;
            teamsData[team].aiCriteria[key] = val;
            runningTotal += val;
            teamsData[team].aiTotal = runningTotal;
            io.emit('update-teams', teamsData);
        }

        teamsData[team].score += teamsData[team].aiTotal;
        teamsData[team].aiEvaluated = true;
        io.emit('update-teams', teamsData);
    });

    socket.on('save-admin-settings', (newSettings) => {
        adminAiSettings = newSettings;
        io.emit('update-admin-settings', adminAiSettings);
    });

    socket.on('reset-scores', () => {
        for (let t in teamsData) {
            teamsData[t].score = 0;
            teamsData[t].workUrl = '';
            teamsData[t].aiTotal = 0;
            teamsData[t].aiEvaluated = false;
            teamsData[t].aiCriteria = { functional: 0, design: 0, codeQuality: 0, prompt: 0, defense: 0 };
        }
        io.emit('update-teams', teamsData);
    });

    socket.on('delete-student', (id) => {
        students = students.filter(s => s.id !== id);
        io.emit('update-students', students);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер: http://localhost:${PORT}`));
