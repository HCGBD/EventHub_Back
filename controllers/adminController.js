import User from '../models/Users.js'
import Event from '../models/Event.js'
import Location from '../models/Location.js'
import Category from '../models/Category.js'

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -refreshToken')
    res.json(users)
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message })
  }
}

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Admin
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (user) {
      await user.delete(req.user.id)
      res.json({
        message:
          'Utilisateur supprimé (soft delete) avec informations de suppression'
      })
    } else {
      res.status(404).json({ message: 'Utilisateur non trouvé' })
    }
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message })
  }
}

// @desc    Update user role
// @route   PATCH /api/admin/users/:id/role
// @access  Admin
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body

    const allowedRoles = ['admin', 'organizer', 'participant']
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' })
    }

    const user = await User.findById(req.params.id)

    if (user) {
      user.role = role
      const updatedUser = await user.save()
      res.json({
        _id: updatedUser._id,
        nom: updatedUser.nom,
        prenom: updatedUser.prenom,
        email: updatedUser.email,
        role: updatedUser.role
      })
    } else {
      res.status(404).json({ message: 'Utilisateur non trouvé' })
    }
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message })
  }
}

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard-stats
// @access  Admin
export const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments()
   
    const totalEvents = await Event.countDocuments()
    const publishedEvents = await Event.countDocuments({ status: 'publie' })
    const pendingEvents = await Event.countDocuments({
      status: 'en_attente_approbation'
    })
    const draftEvents = await Event.countDocuments({ status: 'brouillon' })
    const rejectedEvents = await Event.countDocuments({ status: 'rejete' })
    const cancelledEvents = await Event.countDocuments({ status: 'annule' })
    const finishedEvents = await Event.countDocuments({ status: 'termine' })
    const pendingLocations = await Location.countDocuments({
      status: 'en_attente'
    }) // Corrected status
    const totalCategories = await Category.countDocuments()

    res.json({
      totalUsers,
      totalEvents,
      publishedEvents,
      pendingEvents,
      draftEvents,
      rejectedEvents,
      cancelledEvents,
      finishedEvents,
      pendingLocations,
      totalCategories
    })
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message })
  }
}

// @desc    Get event activity statistics for chart
// @route   GET /api/admin/event-activity-stats
// @access  Admin
export const getEventActivityStats = async (req, res) => {
  try {
    const { year, month } = req.query;
    const currentYear = parseInt(year) || new Date().getFullYear();

    let matchStage = {
      startDate: {
        $gte: new Date(currentYear, 0, 1),
        $lt: new Date(currentYear + 1, 0, 1),
      },
    };

    let groupStage = {
      _id: { $month: '$startDate' },
      evenements: { $sum: 1 },
    };
    let projectStage = {
      _id: 0,
      month: '$_id',
      evenements: 1,
    };
    let sortStage = { month: 1 };

    if (month) {
      const currentMonth = parseInt(month) - 1; // Months are 0-indexed in JS Date
      matchStage.startDate.$gte = new Date(currentYear, currentMonth, 1);
      matchStage.startDate.$lt = new Date(currentYear, currentMonth + 1, 1);
      
      groupStage = {
        _id: { $dayOfMonth: '$startDate' },
        evenements: { $sum: 1 },
      };
      projectStage = {
        _id: 0,
        day: '$_id',
        evenements: 1,
      };
      sortStage = { day: 1 };
    }

    const stats = await Event.aggregate([
      { $match: { status: { $ne: 'brouillon' } } }, // Exclude draft events
      { $match: matchStage },
      { $group: groupStage },
      { $project: projectStage },
      { $sort: sortStage },
    ]);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
