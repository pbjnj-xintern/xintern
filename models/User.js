const mongoose = require('mongoose');

const User = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    createdAt: { type: mongoose.Schema.Types.Date, default: new Date(), required: true },
    isDeleted: { type: mongoose.Schema.Types.Boolean, default: false },
    username: { type: mongoose.Schema.Types.String, required: true },
    password: { type: mongoose.Schema.Types.String, required: true },
    email: { type: mongoose.Schema.Types.String, required: true },
    institution: { type: mongoose.Schema.Types.String, required: true },
    firstName: { type: mongoose.Schema.Types.String },
    lastName: { type: mongoose.Schema.Types.String },
    sex: { type: mongoose.Schema.Types.String },
    photo: { type: mongoose.Schema.Types.String },
    program: { type: mongoose.Schema.Types.String },
    age: { type: mongoose.Schema.Types.Number },
    isShowInfo: { type: mongoose.Schema.Types.Boolean, default: true },
    role: { type: mongoose.Schema.Types.String, required: true } //XINT or ADMIN
});

module.exports = mongoose.model('User', User);