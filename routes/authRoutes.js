import express from "express"

import { inscription, connexion, refreshToken, logout, verifyEmail } from "../controllers/authControllers.js" // Added verifyEmail
import { validateRegistration } from "../middlewares/validationMiddleware.js"

const RoutesAuth = express.Router()

RoutesAuth.post("/login", connexion)
RoutesAuth.post("/register", validateRegistration, inscription)
RoutesAuth.post("/refresh-token", refreshToken)
RoutesAuth.post("/logout", logout)
RoutesAuth.get("/verify-email", verifyEmail) // New route

export default  RoutesAuth