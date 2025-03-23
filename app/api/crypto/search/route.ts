import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (response.status === 429) {
      return NextResponse.json(
        { error: 'CoinGecko API rate limit reached. Please try again later.' },
        { status: 429 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CoinGecko API error:', errorText);
      throw new Error(`Failed to fetch from CoinGecko API: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error searching cryptocurrencies:', error);
    return NextResponse.json(
      { error: 'Failed to search cryptocurrencies. Please try again later.' },
      { status: 500 }
    );
  }
} 