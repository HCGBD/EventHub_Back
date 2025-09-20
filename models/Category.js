import mongoose from 'mongoose';
import mongoose_delete from 'mongoose-delete'; // Import du plugin

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

categorySchema.index({ name: 1 }, { unique: true, partialFilterExpression: { deleted: { $eq: false } } });

// Application du plugin mongoose-delete pour le soft delete
categorySchema.plugin(mongoose_delete, {
  overrideMethods: 'all', // Permet d'utiliser .delete() au lieu de .remove()
  deletedAt: true,
  deletedBy: true,
});

const Category = mongoose.model('Category', categorySchema);

export default Category;
