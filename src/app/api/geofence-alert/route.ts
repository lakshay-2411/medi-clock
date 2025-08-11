import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const alert = await request.json();

    console.log(`Geofence alert for user ${alert.userId}:`, {
      alertType: alert.alertType,
      location: alert.location,
      timestamp: alert.timestamp
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling geofence alert:', error);
    return NextResponse.json(
      { error: 'Failed to process geofence alert' },
      { status: 500 }
    );
  }
}
