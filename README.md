# 🏥 MediClock - Healthcare Worker Time Tracking System

A comprehensive, location-based time tracking application specifically designed for healthcare organizations. Built with modern web technologies to provide secure, real-time monitoring of healthcare worker shifts with GPS verification and role-based access control.

Use ``` MANAGER2025 ``` as Manager's Code

## 🌟 Features

### 👥 **Role-Based Access Control**
- **🔵 Manager Dashboard**: 
  - Real-time staff monitoring and location tracking
  - Comprehensive analytics and reporting
  - Shift management and oversight
  - Organization perimeter configuration
- **🟢 Care Worker Interface**: 
  - Simple clock-in/out functionality
  - Location validation for security
  - Personal shift history
  - Optional shift notes

### 📍 **Advanced Location Services**
- **GPS Verification**: Real-time location tracking with browser Geolocation API
- **Perimeter Validation**: Configurable radius-based boundaries around healthcare facilities
- **Distance Calculation**: Precise distance measurement using Haversine formula
- **Location Security**: Prevents unauthorized remote clock-ins
- **Permission Handling**: Graceful handling of location permission states

### 📊 **Analytics & Reporting**
- **Real-time Dashboard**: Live staff status updates
- **Comprehensive Reports**: Daily, weekly, and monthly analytics
- **Hour Calculations**: Automatic total hours and overtime tracking
- **Interactive Charts**: Visual data representation with Chart.js and Recharts
- **Export Capabilities**: Data export for payroll integration

### 🔐 **Security**
- **Dual Authentication**: JWT tokens + Auth0 integration ready
- **Password Security**: bcrypt hashing with salt rounds
- **Role-based Routing**: Automatic redirection based on user roles
- **Session Management**: Secure token handling and refresh
- **Input Validation**: Comprehensive data sanitization

### 📱 **Modern User Experience**
- **Mobile-First Design**: Optimized for healthcare workers on mobile devices
- **Responsive UI**: Tailwind CSS with healthcare-appropriate color schemes
- **Accessibility**: WCAG compliant interface design
- **Real-time Updates**: GraphQL subscriptions for live data

## 🛠 Technology Stack

### **Frontend**
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: Grommet UI for healthcare interfaces
- **Charts**: Chart.js + React Charts 2, Recharts

### **Backend**
- **API**: GraphQL with Apollo Server
- **Authentication**: JWT + Auth0 ready
- **Subscriptions**: GraphQL Subscriptions with WebSocket support

### **Database & ORM**
- **Database**: PostgreSQL
- **ORM**: Prisma 6.13.0
- **Migrations**: Automated schema versioning
- **Client**: Type-safe database access

## 🚀 Quick Start Guide

### **Prerequisites**
- Node.js 18+ installed
- PostgreSQL database (or use Prisma's development database)
- Modern web browser with geolocation support

### **1. Installation**

```bash
git clone https://github.com/lakshay-2411/medi-clock.git
cd medi-clock

npm install
```

### **2. Environment Configuration**

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="your_postgresql_connection_string"

# Auth0 (Optional)
AUTH0_SECRET="your_auth0_secret"
AUTH0_BASE_URL="http://localhost:3000"
AUTH0_ISSUER_BASE_URL="your_auth0_domain"
AUTH0_CLIENT_ID="your_auth0_client_id"
AUTH0_CLIENT_SECRET="your_auth0_client_secret"

# JWT
JWT_SECRET="your_jwt_secret_key"
```

### **3. Database Setup**

```bash
# Push schema to database
npm run db:push

# Generate Prisma client
npx prisma generate

# (Optional) Seed database with sample data
npm run db:seed
```

### **4. Development Server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Guide

### **Getting Started**

1. **Access the Application**: Navigate to the landing page
2. **Role Selection**: Choose between Manager or Care Worker
3. **Authentication**: Sign in with Auth0 or create an account
4. **Location Permission**: Grant location access when prompted

### **For Managers**

1. **Dashboard Access**: Navigate to `/dashboard`
2. **Staff Monitoring**: View real-time staff status and locations
3. **Analytics**: Access comprehensive reporting and analytics
4. **Organization Settings**: Configure facility perimeter and settings

### **For Care Workers**

1. **Clock Interface**: Navigate to `/clock`
2. **Clock In**: Tap "Clock In" when arriving at the facility
3. **Location Validation**: Ensure you're within the facility perimeter
4. **Add Notes**: Optionally add shift notes
5. **Clock Out**: Tap "Clock Out" when leaving

### **Authentication Flow**

```
Landing Page → Role Selection → Auth0/Login → Dashboard/Clock Interface
```

## 🏗 Architecture & Project Structure

```
medi-clock/
├── src/
│   ├── app/                    
│   │   ├── api/               
│   │   ├── auth/              
│   │   ├── clock/             
│   │   └── dashboard/        
│   ├── components/            
│   │   ├── ui/               
│   │   └── dashboard/        
│   ├── context/              
│   ├── hooks/                
│   ├── lib/                  
│   │   └── graphql/          
│   ├── types/                
│   └── utils/                
├── prisma/                   
├── public/                   
└── Configuration files
```

### **Key Components**

- **`EnhancedClockInterface`**: Main clock-in/out interface for care workers
- **`EnhancedManagerDashboard`**: Comprehensive dashboard for managers
- **`LocationTrackingPanel`**: Real-time location monitoring
- **`RealTimeDashboard`**: Live updates and analytics
- **`AuthContext`**: Authentication state management
- **`LocationContext`**: Location services and geofencing

## 🔧 API Reference

### **GraphQL Schema**

The application uses a comprehensive GraphQL API with the following main types:

```graphql
type User {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
  organizationId: String!
  shifts: [Shift!]!
}

type Organization {
  id: ID!
  name: String!
  locationLat: Float!
  locationLng: Float!
  perimeterRadius: Float!
  users: [User!]!
}

type Shift {
  id: ID!
  userId: String!
  clockInTime: DateTime!
  clockOutTime: DateTime
  clockInLat: Float!
  clockInLng: Float!
  totalHours: Float
}

enum UserRole {
  MANAGER
  CARE_WORKER
}
```

### **Main Mutations**
- `clockIn(input: ClockInInput!)`: Clock in with location validation
- `clockOut(input: ClockOutInput!)`: Clock out and calculate hours
- `createUser(input: CreateUserInput!)`: Register new user
- `updateOrganization(input: UpdateOrganizationInput!)`: Update facility settings

### **Main Queries**
- `me`: Get current user information
- `getShifts(filters: ShiftFilters)`: Get shift history with filtering
- `getAnalytics(period: TimePeriod)`: Get analytics data
- `getActiveShifts`: Get currently active shifts

### **Subscriptions**
- `shiftUpdates`: Real-time shift status updates
- `locationUpdates`: Live location tracking

## 📊 Database Schema

The application uses a PostgreSQL database with the following main entities:

### **Users Table**
- Personal information and authentication data
- Role assignment (Manager/Care Worker)
- Organization association
- Auth0 integration fields

### **Organizations Table**
- Facility information and settings
- GPS coordinates for perimeter validation
- Configurable radius settings

### **Shifts Table**
- Complete shift lifecycle tracking
- Clock-in/out timestamps and locations
- Automatic hour calculations
- Optional shift notes
