require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');

// Import Config
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Proxy for Vercel
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MongoStore = require('connect-mongo');

// Session Setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // True on Vercel
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
    }
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Static Files
app.use(express.static(path.join(__dirname, '/')));

// Routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// API Routes
const shopRoutes = require('./routes/shop');
const craftRoutes = require('./routes/craft');
const bankRoutes = require('./routes/bank');

app.use('/api/shop', shopRoutes);
app.use('/api/craft', craftRoutes);
app.use('/api/bank', bankRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
