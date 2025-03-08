import { readFile } from 'fs/promises';
import { join } from 'path';
import { createSqlClient } from '../lib/db';
import sharp from 'sharp';

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
        
        const fullPath = join(process.cwd(), 'public', avatarPath);
        
        // Read the file
        const fileBuffer = await readFile(fullPath);
        
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