import { NextRequest, NextResponse } from 'next/server';

interface Quote {
  id: number;
  trackingNumber: string;
  bookingNumber: string;
  shipmentType: string;
  origin: string;
  destination: string;
  weight: string;
  dimensions: string;
  description: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  files: {
    name: string;
    size: number;
    type: string;
  }[];
  status: string;
  createdAt: string;
  estimatedDelivery: string;
  estimatedCost: number;
}
// Mock database - in a real app, this would connect to your database
const quotes: Quote[] = [];
let quoteIdCounter = 1;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract form data
    const shipmentType = formData.get('shipmentType') as string;
    const origin = formData.get('origin') as string;
    const destination = formData.get('destination') as string;
    const weight = formData.get('weight') as string;
    const dimensions = formData.get('dimensions') as string;
    const description = formData.get('description') as string;
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    
    // Handle file uploads
    const files: {
      name: string;
      size: number;
      type: string;
    }[] = [];
    const fileEntries = formData.getAll('files') as {
      name: string;
      size: number;
      type: string;
    }[];
    fileEntries.forEach(file => {
      if (file.size > 0) {
        files.push({
          name: file.name,
          size: file.size,
          type: file.type
        });
      }
    });

    // Validate required fields
    if (!shipmentType || !destination || !weight || !name || !email || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate tracking and booking numbers
    const trackingNumber = `ML${Date.now().toString().slice(-9)}`;
    const bookingNumber = `BK${Date.now().toString().slice(-9)}`;

    // Create quote record
    const quote = {
      id: quoteIdCounter++,
      trackingNumber,
      bookingNumber,
      shipmentType,
      origin: origin || "Ireland",
      destination,
      weight,
      dimensions,
      description,
      customer: {
        name,
        email,
        phone
      },
      files: files.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      })),
      status: "Pending",
      createdAt: new Date().toISOString(),
      estimatedDelivery: calculateEstimatedDelivery(shipmentType, destination),
      estimatedCost: calculateEstimatedCost(shipmentType, destination, parseFloat(weight))
    };

    // Store quote (in real app, save to database)
    quotes.push(quote as Quote);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({
      success: true,
      message: 'Quote request submitted successfully',
      data: {
        quoteId: quote.id,
        trackingNumber: quote.trackingNumber,
        bookingNumber: quote.bookingNumber,
        estimatedCost: quote.estimatedCost,
        estimatedDelivery: quote.estimatedDelivery
      }
    });

  } catch (error) {
    console.error('Quote submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const status = searchParams.get('status');

  let filteredQuotes = quotes;

  if (email) {
    filteredQuotes = filteredQuotes.filter(quote => 
      quote.customer.email.toLowerCase() === email.toLowerCase()
    );
  }

  if (status) {
    filteredQuotes = filteredQuotes.filter(quote => 
      quote.status.toLowerCase() === status.toLowerCase()
    );
  }

  return NextResponse.json({
    success: true,
    data: filteredQuotes,
    count: filteredQuotes.length
  });
}

// Helper functions
function calculateEstimatedDelivery(shipmentType: string, destination: string): string {
  const baseDays: Record<string, number> = {
    'car': 7,
    'parcel': 3,
    'container': 14,
    'air-express': 2,
    'freight': 5
  };

  const destinationMultipliers: Record<string, number> = {
    'united kingdom': 1.0,
    'france': 1.2,
    'germany': 1.2,
    'united states': 2.0,
    'canada': 2.0,
    'australia': 3.0,
    'china': 2.5,
    'japan': 2.5
  };

  const baseDaysForType = baseDays[shipmentType] || 5;
  const multiplier = destinationMultipliers[destination.toLowerCase()] || 1.5;
  const totalDays = Math.ceil(baseDaysForType * multiplier);

  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + totalDays);

  return deliveryDate.toISOString().split('T')[0];
}

function calculateEstimatedCost(shipmentType: string, destination: string, weight: number): number {
  const basePrices: Record<string, number> = {
    'car': 800,
    'parcel': 25,
    'container': 1200,
    'air-express': 45,
    'freight': 150
  };

  const weightMultipliers: Record<string, number> = {
    'car': 0,
    'parcel': 2.5,
    'container': 0.5,
    'air-express': 8,
    'freight': 1.5
  };

  const destinationMultipliers: Record<string, number> = {
    'united kingdom': 1.2,
    'france': 1.1,
    'germany': 1.1,
    'united states': 2.5,
    'canada': 2.3,
    'australia': 3.2,
    'china': 3.0,
    'japan': 2.8
  };

  const basePrice = basePrices[shipmentType] || 100;
  const weightCost = weight * (weightMultipliers[shipmentType] || 1);
  const destinationMultiplier = destinationMultipliers[destination.toLowerCase()] || 2.0;

  const totalCost = (basePrice + weightCost) * destinationMultiplier;

  // Apply minimum charges
  const minimums: Record<string, number> = {
    'car': 500,
    'parcel': 15,
    'container': 800,
    'air-express': 30,
    'freight': 100
  };

  return Math.max(totalCost, minimums[shipmentType] || 50);
}
