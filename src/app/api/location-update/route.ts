import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, location, isWithinPerimeter } = await request.json();
    console.log(`Location update for user ${userId}:`, {
      location,
      isWithinPerimeter,
      timestamp: new Date()
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling location update:', error);
    return NextResponse.json(
      { error: 'Failed to process location update' },
      { status: 500 }
    );
  }
}
