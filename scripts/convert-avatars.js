// Remove the type: "module" from package.json before running this script
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

// Database connection
const getDatabaseUrl = () => {
  const url = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_URL_NON_POOLING;
  
  if (!url) {
    console.error('Database connection string missing. Please check your environment variables.');
    process.exit(1);
  }
  
  return url;
};

const createSqlClient = () => {
  const url = getDatabaseUrl();
  return neon(url);
};

async function convertAvatarsToBase64() {
  try {
    console.log('Starting avatar conversion...');
    
    // Get database connection
    const sql = createSqlClient();
    
    // Get all users with avatars
    const users = await sql`
      SELECT id, username, avatar FROM users WHERE avatar IS NOT NULL
    `;
    
    console.log(`Found ${users.length} users with avatars`);
    
    // Process each user
    for (const user of users) {
      try {
        if (!user.avatar || user.avatar.startsWith('data:')) {
          console.log(`Skipping user ${user.username} - no avatar or already base64`);
          continue;
        }
        
        console.log(`Processing avatar for user ${user.username}`);
        
        // Get the file path
        const avatarPath = user.avatar.startsWith('/') 
          ? user.avatar.substring(1) // Remove leading slash
          : user.avatar;
        
        const fullPath = path.join(process.cwd(), 'public', avatarPath);
        
        // Read the file
        const fileBuffer = await fs.readFile(fullPath);
        
        // Compress the image
        const compressedImageBuffer = await sharp(fileBuffer)
          .resize(200, 200, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();
        
        // Convert to base64
        const base64Image = `data:image/jpeg;base64,${compressedImageBuffer.toString('base64')}`;
        
        // Update the user in the database
        await sql`
          UPDATE users SET avatar = ${base64Image} WHERE id = ${user.id}
        `;
        
        console.log(`Updated avatar for user ${user.username}`);
      } catch (error) {
        console.error(`Error processing avatar for user ${user.username}:`, error);
      }
    }
    
    console.log('Avatar conversion completed');
  } catch (error) {
    console.error('Error converting avatars:', error);
  }
}

// Run the conversion
convertAvatarsToBase64().catch(console.error); 