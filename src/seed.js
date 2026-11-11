// Creates the first admin account (public registration only ever creates role "user").
const mongoose = require('mongoose');
const config = require('./config');
const User = require('./models/User');

(async () => {
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const name = process.env.ADMIN_NAME || 'Admin';

  await mongoose.connect(config.mongoUri);
  await User.init();

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
  } else {
    await User.create({ name, email, password, role: 'admin' });
    console.log(`Admin created: ${email}`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
