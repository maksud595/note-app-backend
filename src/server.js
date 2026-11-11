const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');
const User = require('./models/User');
const Note = require('./models/Note');
const Post = require('./models/Post');

async function main() {
  await mongoose.connect(config.mongoUri);
  // Make sure the schema.index() definitions are built before serving traffic
  await Promise.all([User.init(), Note.init(), Post.init()]);
  app.listen(config.port, () => console.log(`Server listening on http://localhost:${config.port}`));
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
