const bcrypt = require('bcryptjs');
require('dotenv').config();
const pool = require('./db');

async function createUser() {
  try {
    console.log('\n🔄 Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected!\n');

    console.log('🔐 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (username) DO NOTHING
       RETURNING *`,
      ['admin', 'admin@hcg.com', hashedPassword, 'Admin User', 'admin']
    );

    if (result.rows.length > 0) {
      console.log('\n✅ USER CREATED SUCCESSFULLY!');
      console.log('================================');
      console.log('Username:  admin');
      console.log('Password:  admin123');
      console.log('Email:     atanudhara.geo@gmail.com');
      console.log('Role:      admin');
      console.log('================================\n');
    } else {
      console.log('\n⚠️  User "admin" already exists!');
      console.log('================================');
      console.log('Username:  admin');
      console.log('Password:  admin123');
      console.log('================================\n');
    }

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createUser();