import Category from '../models/Category.js';

// @desc    Create a category
// @route   POST /api/categories
// @access  Admin
export const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        const existingCategory = await Category.findOne({ name, deleted: false });
        if (existingCategory) {
            return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà.' });
        }

        const category = new Category({ name, description });
        const createdCategory = await category.save();
        res.status(201).json(createdCategory);
    } catch (err) {
        res.status(400).json({ message: 'Erreur lors de la création de la catégorie', error: err.message });
    }
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Get category by ID
// @route   GET /api/categories/:id
// @access  Public
export const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (category) {
            res.json(category);
        } else {
            res.status(404).json({ message: 'Catégorie non trouvée' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};

// @desc    Update a category
// @route   PUT /api/categories/:id
// @access  Admin
export const updateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const category = await Category.findById(req.params.id);

        if (category) {
            category.name = name || category.name;
            category.description = description || category.description;

            const updatedCategory = await category.save();
            res.json(updatedCategory);
        } else {
            res.status(404).json({ message: 'Catégorie non trouvée' });
        }
    } catch (err) {
        res.status(400).json({ message: 'Erreur lors de la mise à jour de la catégorie', error: err.message });
    }
};

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Admin
export const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (category) {
            // Utiliser la méthode de soft delete du plugin, en enregistrant l'utilisateur qui supprime
            await category.delete(req.user.id);
            res.json({ message: 'Catégorie supprimée (soft delete)' });
        } else {
            res.status(404).json({ message: 'Catégorie non trouvée' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', error: err.message });
    }
};