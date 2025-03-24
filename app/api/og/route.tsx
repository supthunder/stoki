import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Get the search params from the request
    const { searchParams } = new URL(request.url);
    
    // Get title from search params or use default
    const title = searchParams.get('title') || 'Stoki - Social Stock Trading App';
    
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
            backgroundColor: '#000',
            backgroundSize: '150px 150px',
            backgroundPosition: '0 0, 75px 75px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              borderRadius: '16px',
              padding: '32px 64px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
              border: '1px solid #333',
              maxWidth: '90%',
            }}
          >
            <img
              src={`${request.nextUrl.origin}/logo512.png`}
              alt="Stoki Logo"
              width="120"
              height="120"
              style={{
                borderRadius: '12px',
                marginBottom: '24px',
              }}
            />
            <div
              style={{
                fontSize: 64,
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 28,
                color: '#f0f0f0',
                textAlign: 'center',
              }}
            >
              Track and share your stock portfolio with friends.
            </div>
            <div
              style={{
                display: 'flex',
                marginTop: '40px',
                padding: '12px 24px',
                backgroundColor: '#4A56E2',
                color: 'white',
                fontSize: 24,
                fontWeight: 'bold',
                borderRadius: '8px',
              }}
            >
              Start trading now
            </div>
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
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
} 