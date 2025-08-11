# MediClock - Healthcare Worker Time Tracking System

A comprehensive web application for healthcare organizations to manage worker shift tracking through location-based clock-in/clock-out functionality with role-based access for managers and care workers.

## Features

### 🏥 **Role-Based Access Control**
- **Manager Role**: Set location perimeters, view real-time staff status, access detailed analytics
- **Care Worker Role**: Clock in/out with location validation, view personal shift history

### 📍 **Location-Based Features**
- GPS location verification for clock-in/clock-out
- Configurable perimeter boundaries around facilities
- Real-time distance calculation using Haversine formula
- Location permission handling and error management

### 📊 **Dashboard & Analytics**
- Real-time staff status overview
- Comprehensive shift history tracking
- Daily, weekly, and monthly reporting
- Average hours worked calculations
- Interactive data visualizations

### 🔐 **Authentication System**
- Email/password authentication
- JWT token management
- Auth0 ready integration
- Secure session management

### 📱 **Mobile-First Design**
- Responsive design for all devices
- Progressive Web App (PWA) ready
- Tailwind CSS for modern UI
- Grommet components for healthcare-appropriate interface

## Tech Stack

- **Frontend**: Next.js 15 with App Router, React 18, TypeScript
- **Backend**: GraphQL with Apollo Server
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + Auth0 ready
- **Styling**: Tailwind CSS
- **Location**: Browser Geolocation API
- **State Management**: React Context API

## Quick Start

### 1. Installation

```bash
# Install dependencies
npm install
```

### 2. Environment Setup

The `.env` file is already configured with a Prisma development database.

### 3. Database Setup

```bash
# Start Prisma development database
npx prisma dev

# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### 4. Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Demo Usage

1. **Register as a Manager or Care Worker**
   - Use Organization ID: `demo-org-123` (when available)
   - Register at `/auth/register`

2. **Manager Features**
   - View dashboard at `/dashboard`
   - Monitor real-time staff status
   - View analytics and reports

3. **Care Worker Features**
   - Clock in/out at `/clock`
   - Location validation required
   - Add optional shift notes

## Key Components

- **Authentication**: JWT-based with role routing
- **Location Services**: GPS validation with perimeter checking
- **Dashboard**: Real-time staff monitoring for managers
- **Clock Interface**: Simple clock-in/out for care workers
- **GraphQL API**: Complete CRUD operations with type safety

## Security Features

- 🔒 JWT token authentication
- 🔒 Password hashing with bcrypt
- 🔒 Role-based access control
- 🔒 Input validation and sanitization
- 🔒 Location-based restrictions

## Development Scripts

```bash
npm run dev              # Start development server
npm run build           # Build for production
npm run db:push         # Push schema changes
npx prisma studio       # Open Prisma Studio
```
