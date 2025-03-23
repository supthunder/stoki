import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Cryptocurrency ID is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
      {
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from CoinGecko API');
    }

    const data = await response.json();
    
    if (!data[id] || !data[id].usd) {
      return NextResponse.json({ error: 'Price data not available' }, { status: 404 });
    }

    return NextResponse.json({ price: data[id].usd });
  } catch (error) {
    console.error('Error fetching cryptocurrency price:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cryptocurrency price' },
      { status: 500 }
    );
  }
} 