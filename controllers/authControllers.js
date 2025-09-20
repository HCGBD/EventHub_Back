import jwt from 'jsonwebtoken'
import User from '../models/Users.js'
import 'dotenv/config'
import { sendEmail } from '../services/emailService.js'
import crypto from 'crypto' // For token generation

const generateAccessToken = user => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '15m' // 15 minutes
  })
}

const generateRefreshToken = user => {
  return jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d'
  })
}

export const inscription = async (req, res) => {
  try {
    const { nom, prenom, email, password, role } = req.body

    const exist = await User.findOne({ email, deleted: false })
    if (exist) {
      return res.status(400).json({ message: 'Email déjà utilisé' })
    }

    const user = new User({ nom, prenom, email, password, role })

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    user.verificationToken = verificationToken
    user.isVerified = false // Ensure it's false on creation

    await user.save()

    // Send verification email
    const verificationLink = `${process.env.BASE_URL}/api/auth/verify-email?token=${verificationToken}` // BASE_URL needs to be in .env
    const subject = 'Vérifiez votre adresse e-mail pour EventHub'
    const htmlContent = `
        <h1>Vérification de votre adresse e-mail</h1>
        <p>Bonjour ${user.prenom},</p>
        <p>Merci de vous être inscrit sur EventHub. Veuillez cliquer sur le lien ci-dessous pour vérifier votre adresse e-mail et activer votre compte :</p>
        <p><a href="${verificationLink}">Vérifier mon e-mail</a></p>
        <p>Si vous n'avez pas créé de compte, veuillez ignorer cet e-mail.</p>
        <p>L'équipe EventHub</p>
    `

    try {
      await sendEmail(user.email, subject, htmlContent)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Do not block registration response if email fails
    }

    res.status(201).json({
      message:
        'Utilisateur créé avec succès. Veuillez vérifier votre e-mail pour activer votre compte.',
      user: {
        id: user._id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified // Include isVerified in response
      }
    })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message })
  }
}

export const connexion = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(400).json({ message: 'Utilisateur non trouvé' })
    }
    // Check if user is verified

    // console.log('test')

    if (!user.isVerified) {
      return res
        .status(401)
        .json({
          message: 'Veuillez vérifier votre adresse e-mail pour vous connecter.'
        })
    }
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Mot de passe incorrect' })
    }

    const accessToken = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)

    user.refreshToken = refreshToken
    await user.save()

    // Set cookie with SameSite attribute for cross-origin requests
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
    res.cookie('refreshToken', refreshToken, cookieOptions)

    res.json({
      message: 'Connexion réussie',
      accessToken,
      user: {
        id: user._id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role
      }
    })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message })
  }
}

export const refreshToken = async (req, res) => {
  // console.log('--- Refresh Token Endpoint Hit ---') // DEBUG
  try {
    const cookies = req.cookies
    if (!cookies?.refreshToken) {
      // console.log('ERROR: No refresh token in cookies') // DEBUG
      return res.sendStatus(401)
    }
    const refreshToken = cookies.refreshToken
    console.log('Found refresh token in cookie:', refreshToken) // DEBUG

    const user = await User.findOne({ refreshToken }).exec()
    if (!user) {
      // console.log('ERROR: No user found with this refresh token') // DEBUG
      return res.sendStatus(403) // Forbidden
    }
    // console.log('Found user associated with token:', user.email) // DEBUG

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err) {
          console.log('ERROR: JWT verification failed', err) // DEBUG
          return res.sendStatus(403)
        }
        if (user.id !== decoded.id) {
          // console.log('ERROR: Token user ID does not match found user ID') // DEBUG
          return res.sendStatus(403)
        }

        // console.log(
        //   'JWT verified successfully. Generating new access token for user:',
        //   user.email,
        //   'with role:',
        //   user.role
        // ) // DEBUG
        const accessToken = generateAccessToken(user)
        // console.log('Generated new accessToken:', accessToken) // NEW DEBUG LOG
        res.json({ accessToken })
      }
    )
  } catch (error) {
    // console.log('FATAL ERROR in refreshToken controller:', error) // DEBUG
    res.status(500).json({ message: 'Internal Server Error' })
  }
}

export const logout = async (req, res) => {
  const cookies = req.cookies
  if (!cookies?.refreshToken) {
    return res.sendStatus(204)
  }

  const refreshToken = cookies.refreshToken
  // console.log('test')

  const user = await User.findOne({ refreshToken }).exec()
  if (user) {
    user.refreshToken = ''
    await user.save()
  }

  res.clearCookie('refreshToken', {
    httpOnly: true,
    sameSite: 'None',
    secure: true
  })
  res.sendStatus(204)
}

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query

    if (!token) {
      return res
        .status(400)
        .json({ message: 'Token de vérification manquant.' })
    }

    const user = await User.findOne({ verificationToken: token })

    if (!user) {
      return res
        .status(400)
        .json({ message: 'Token de vérification invalide ou expiré.' })
    }

    user.isVerified = true
    user.verificationToken = undefined // Clear the token after verification
    await user.save()

    // Optionally, redirect to a success page or send a success message
    res.redirect(`${process.env.FRONTEND_URL}/login`);
  } catch (err) {
    console.error("Erreur lors de la vérification de l'e-mail:", err)
    res
      .status(500)
      .json({
        message: "Erreur serveur lors de la vérification de l'e-mail.",
        error: err.message
      })
  }
}
