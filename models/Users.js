import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import mongoose_delete from 'mongoose-delete';

const userSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    prenom: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "organizer", "participant"],
      default: "participant",
    },
    refreshToken: {
        type: String,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    verificationToken: String,
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deleted: { $eq: false } } });

//  Hash mot de passe 
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// comparer mot de passe
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

//  mongoose-delete plugin
userSchema.plugin(mongoose_delete, {
    overrideMethods: 'all',
    deletedAt: true,
    deletedBy: true
});

const User = mongoose.model("User", userSchema);
export default User;
