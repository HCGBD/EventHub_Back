import express from 'express'
import connectDB from './configs/database.js'
import 'dotenv/config'
import cors from 'cors';
import passport from "passport";
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes AFTER database connection is established
let RoutesAuth;
let adminRoutes;
let userRoutes;
let categoryRoutes;
let locationRoutes;
let eventRoutes;
let contactRoutes;
let ticketRoutes;
let settingRoutes; // Import settingRoutes

const PORT = process.env.PORT || 5000

const app = express()

// Configuration CORS
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:3001').split(',');

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// app.use(helmet())
app.use(cookieParser())
app.use(morgan('dev'))

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the 'uploads' directory
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

app.use(passport.initialize())

// Connect to DB and then start server
const startServer = async () => {
  try {
    await connectDB();
    console.log('Database connected successfully. Starting server...');

    // Import routes only after DB connection
    RoutesAuth = (await import("./routes/authRoutes.js")).default;
    adminRoutes = (await import("./routes/adminRoutes.js")).default;
    userRoutes = (await import("./routes/userRoutes.js")).default;
    categoryRoutes = (await import("./routes/categoryRoutes.js")).default;
    locationRoutes = (await import("./routes/locationRoutes.js")).default;
    eventRoutes = (await import("./routes/eventRoutes.js")).default;
    contactRoutes = (await import("./routes/contactRoutes.js")).default;
    ticketRoutes = (await import("./routes/ticketRoutes.js")).default;
    settingRoutes = (await import("./routes/settingRoutes.js")).default; // Import settingRoutes
    
    // --- MIDDLEWARE ORDERING ---
    // 1. Routes with specific body parsers (like multer for multipart/form-data)
    app.use("/api/locations", locationRoutes);
    app.use("/api/events", eventRoutes);

    // 2. Generic JSON and URL-encoded body parsers
    app.use(express.json({ limit: '50mb' }))
    app.use(express.urlencoded({ limit: '50mb', extended: true }))

    // 3. Other routes that expect JSON or URL-encoded bodies
    app.use("/api/auth/", RoutesAuth);
    app.use("/api/admin", adminRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/categories", categoryRoutes);
    app.use("/api/contact", contactRoutes);
    app.use("/api/tickets", ticketRoutes);
    app.use("/api/settings", settingRoutes); // Register settingRoutes

    app.get("/",(req,res)=>{
      res.send("Bienvenue dans EventHub API ")
    })

    app.listen(PORT, () => {
      console.log(`Server start in http://127.0.0.1:${PORT}`)
    });

  } catch (error) {
    console.error('Failed to connect to database or start server:', error);
    process.exit(1);
  }
};

startServer();
