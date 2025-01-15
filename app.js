// require modules
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const { MONGO_URI } = process.env;

const packageJson = require('./package.json');
process.env.VERSION = packageJson.version;

const mongoose = require('mongoose');
mongoose.set('strictQuery', false);

// mongoose connection
mongoose
  .connect(
    MONGO_URI,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  )
  .then(() => {
    console.log('connected to database');
    require('./Domain');

    // worker setup
    require('./worker')();
  });

process.env.instance = 'app';

// server setup
require('./server');
