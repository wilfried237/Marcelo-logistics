import { NextRequest, NextResponse } from 'next/server';

interface TrackingData {
  trackingNumber: string;
  bookingNumber: string;
  status: string;
  origin: string;
  destination: string;
  estimatedDelivery: string;
  currentLocation: string;
  events: TrackingEvent[];
  details: {
    weight: string;
    dimensions: string;
    service: string;
    carrier: string;
  };
}

interface TrackingEvent {
  id: string;
  status: string;
  location: string;
  timestamp: string;
  description: string;
  icon: string;
}

// Mock tracking data - in a real app, this would connect to your logistics API
const trackingData: Record<string, TrackingData> = {
  "ML123456789": {
    trackingNumber: "ML123456789",
    bookingNumber: "BK987654321",
    status: "In Transit",
    origin: "Dublin, Ireland",
    destination: "New York, USA",
    estimatedDelivery: "2024-01-15",
    currentLocation: "Atlantic Ocean",
    events: [
      {
        id: "1",
        status: "Delivered",
        location: "Dublin, Ireland",
        timestamp: "2024-01-08T10:00:00Z",
        description: "Package picked up from sender",
        icon: "Package"
      },
      {
        id: "2",
        status: "In Transit",
        location: "Dublin Port, Ireland",
        timestamp: "2024-01-08T14:30:00Z",
        description: "Package arrived at origin facility",
        icon: "Truck"
      },
      {
        id: "3",
        status: "In Transit",
        location: "Dublin Port, Ireland",
        timestamp: "2024-01-09T08:00:00Z",
        description: "Package loaded onto vessel",
        icon: "Ship"
      },
      {
        id: "4",
        status: "In Transit",
        location: "Atlantic Ocean",
        timestamp: "2024-01-10T12:00:00Z",
        description: "Package in transit via sea freight",
        icon: "Ship"
      }
    ],
    details: {
      weight: "25.5 kg",
      dimensions: "60×40×30 cm",
      service: "Sea Freight",
      carrier: "Marchelo Logistics"
    }
  },
  "ML987654321": {
    trackingNumber: "ML987654321",
    bookingNumber: "BK123456789",
    status: "Delivered",
    origin: "Cork, Ireland",
    destination: "London, UK",
    estimatedDelivery: "2024-01-12",
    currentLocation: "London, UK",
    events: [
      {
        id: "1",
        status: "Delivered",
        location: "Cork, Ireland",
        timestamp: "2024-01-10T09:00:00Z",
        description: "Package picked up from sender",
        icon: "Package"
      },
      {
        id: "2",
        status: "Delivered",
        location: "Cork Port, Ireland",
        timestamp: "2024-01-10T11:30:00Z",
        description: "Package arrived at origin facility",
        icon: "Truck"
      },
      {
        id: "3",
        status: "Delivered",
        location: "Cork Port, Ireland",
        timestamp: "2024-01-10T16:00:00Z",
        description: "Package loaded onto vessel",
        icon: "Ship"
      },
      {
        id: "4",
        status: "Delivered",
        location: "Liverpool, UK",
        timestamp: "2024-01-11T08:00:00Z",
        description: "Package arrived at destination port",
        icon: "Ship"
      },
      {
        id: "5",
        status: "Delivered",
        location: "London, UK",
        timestamp: "2024-01-12T14:30:00Z",
        description: "Package delivered to recipient",
        icon: "CheckCircle"
      }
    ],
    details: {
      weight: "12.3 kg",
      dimensions: "45×30×20 cm",
      service: "Express Shipping",
      carrier: "Marchelo Logistics"
    }
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackingNumber = searchParams.get('trackingNumber');
  const bookingNumber = searchParams.get('bookingNumber');

  if (!trackingNumber && !bookingNumber) {
    return NextResponse.json(
      { error: 'Tracking number or booking number is required' },
      { status: 400 }
    );
  }

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Find shipment by tracking number or booking number
  let shipment = null;
  if (trackingNumber) {
    shipment = trackingData[trackingNumber.toUpperCase()];
  } else if (bookingNumber) {
    shipment = Object.values(trackingData).find(
      (s: TrackingData) => s.bookingNumber === bookingNumber.toUpperCase()
    );
  }

  if (!shipment) {
    return NextResponse.json(
      { error: 'Shipment not found' },
      { status: 404 }
    );
  }

  // Add real-time updates (simulate live tracking)
  const now = new Date();
  const lastEvent = shipment.events[shipment.events.length - 1];
  const lastEventTime = new Date(lastEvent.timestamp);
  
  // If the last event was more than 2 hours ago and shipment is in transit, add a new event
  if (shipment.status === "In Transit" && now.getTime() - lastEventTime.getTime() > 2 * 60 * 60 * 1000) {
    const newEvent = {
      id: (shipment.events.length + 1).toString(),
      status: "In Transit",
      location: "In Transit",
      timestamp: now.toISOString(),
      description: "Package continues in transit",
      icon: "Truck"
    };
    shipment.events.push(newEvent);
  }

  return NextResponse.json({
    success: true,
    data: shipment,
    lastUpdated: now.toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackingNumber, bookingNumber, status, location, description } = body;

    if (!trackingNumber && !bookingNumber) {
      return NextResponse.json(
        { error: 'Tracking number or booking number is required' },
        { status: 400 }
      );
    }

    // Find shipment
    let shipment = null;
    if (trackingNumber) {
      shipment = trackingData[trackingNumber.toUpperCase()];
    } else if (bookingNumber) {
      shipment = Object.values(trackingData).find(
        (s: TrackingData) => s.bookingNumber === bookingNumber.toUpperCase()
      );
    }

    if (!shipment) {
      return NextResponse.json(
        { error: 'Shipment not found' },
        { status: 404 }
      );
    }

    // Add new tracking event
    const newEvent = {
      id: (shipment.events.length + 1).toString(),
      status: status || "In Transit",
      location: location || "Unknown",
      timestamp: new Date().toISOString(),
      description: description || "Status update",
      icon: "Truck"
    };

    shipment.events.push(newEvent);
    shipment.status = status || shipment.status;
    shipment.currentLocation = location || shipment.currentLocation;

    return NextResponse.json({
      success: true,
      message: 'Tracking event added successfully',
      data: newEvent
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
