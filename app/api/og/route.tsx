import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Optional parameters for customization
    const title = searchParams.get('title') || 'Stoki - Social Stock Trading App';
    const description = searchParams.get('description') || 'Track and share your stock portfolio with friends';
    
    // Determine if we should use custom mode or blob image mode
    const mode = searchParams.get('mode') || 'blob';
    
    if (mode === 'blob') {
      // Send a redirect to the blob image
      return new Response(null, {
        status: 302,
        headers: {
          'Location': 'https://dp8ya6ppz4ztmtyp.public.blob.vercel-storage.com/stoki-preview-dyKTvFXkchXeDEbZPuFysBiNb046Si.png'
        }
      });
    }
    
    // Custom dynamic mode
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: 'linear-gradient(to bottom right, #0f172a, #1e293b)',
            color: 'white',
            fontFamily: 'sans-serif',
            padding: '40px 60px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '40px',
            }}
          >
            <svg width="80" height="80" viewBox="0 0 512 512" fill="none">
              <rect width="512" height="512" rx="256" fill="#4F46E5" />
              <path d="M320 128L192 256L320 384" stroke="white" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div
              style={{
                fontSize: '60px',
                fontWeight: 'bold',
                marginLeft: '20px',
              }}
            >
              Stoki
            </div>
          </div>
          <div
            style={{
              fontSize: '60px',
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: '20px',
              maxWidth: '900px',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: '30px',
              textAlign: 'center',
              maxWidth: '800px',
              opacity: 0.9,
            }}
          >
            {description}
          </div>
          
          <div
            style={{
              marginTop: '60px',
              padding: '16px 60px',
              backgroundColor: '#4F46E5',
              color: 'white',
              fontSize: '28px',
              fontWeight: 'bold',
              borderRadius: '12px',
            }}
          >
            Start Trading Now
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image: ${e.message}`, {
      status: 500,
    });
  }
} 