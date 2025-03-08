import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

// Add this to prevent static generation of this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      );
    }

    // Check if the file is an image
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "File must be an image" },
        { status: 400 }
      );
    }
    
    // Convert the file to a Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Compress the image using sharp
    const compressedImageBuffer = await sharp(buffer)
      .resize(200, 200, { fit: 'cover' }) // Resize to 200x200 pixels
      .jpeg({ quality: 80 }) // Compress with 80% quality
      .toBuffer();
    
    // Convert to base64
    const base64Image = `data:image/jpeg;base64,${compressedImageBuffer.toString('base64')}`;
    
    // Return the base64 data directly
    return NextResponse.json({ 
      success: true, 
      url: base64Image,
      base64: base64Image
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { success: false, message: "Failed to upload file", error: String(error) },
      { status: 500 }
    );
  }
} 