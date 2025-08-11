import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime

  enum UserRole {
    MANAGER
    CARE_WORKER
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: UserRole!
    organizationId: String!
    auth0Id: String
    picture: String
    organization: Organization!
    shifts: [Shift!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Organization {
    id: ID!
    name: String!
    locationLat: Float!
    locationLng: Float!
    perimeterRadius: Float!
    users: [User!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Shift {
    id: ID!
    userId: String!
    user: User!
    clockInTime: DateTime!
    clockOutTime: DateTime
    clockInLat: Float!
    clockInLng: Float!
    clockOutLat: Float
    clockOutLng: Float
    clockInNote: String
    clockOutNote: String
    totalHours: Float
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type ShiftAnalytics {
    totalHours: Float!
    averageHours: Float!
    totalShifts: Int!
    currentlyClocked: Int!
  }

  type DashboardStats {
    totalStaff: Int!
    currentlyClocked: Int!
    todayShifts: Int!
    averageHours: Float!
  }

  type StaffAnalytics {
    userId: String!
    user: User!
    totalHours: Float!
    averageDailyHours: Float!
    totalShifts: Int!
    weeklyHours: Float!
  }

  type DailyStats {
    date: String!
    clockInCount: Int!
    totalHours: Float!
    averageHours: Float!
  }

  type WeeklyReport {
    staffAnalytics: [StaffAnalytics!]!
    dailyStats: [DailyStats!]!
    overallStats: DashboardStats!
  }

  input ShiftHistoryFilter {
    userId: String
    startDate: DateTime
    endDate: DateTime
    limit: Int
    offset: Int
  }

  input CreateUserInput {
    auth0Id: String!
    email: String!
    name: String!
    picture: String
    role: UserRole!
    organizationId: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input RegisterInput {
    email: String!
    password: String!
    name: String!
    role: UserRole!
    organizationId: String!
  }

  input ClockInInput {
    lat: Float!
    lng: Float!
    note: String
  }

  input ClockOutInput {
    lat: Float!
    lng: Float!
    note: String
  }

  input UpdatePerimeterInput {
    locationLat: Float!
    locationLng: Float!
    perimeterRadius: Float!
  }

  type Query {
    me: User
    getUserByAuth0Id(auth0Id: String!): User
    checkManagerExists(organizationId: String!): Boolean!
    currentShift: Shift
    currentShiftByAuth0Id(auth0Id: String!): Shift
    myShifts(limit: Int, offset: Int): [Shift!]!
    myShiftsByAuth0Id(auth0Id: String!, limit: Int, offset: Int): [Shift!]!
    allStaff: [User!]!
    allStaffByAuth0Id(auth0Id: String!): [User!]!
    dashboardStatsByAuth0Id(auth0Id: String!): DashboardStats!
    currentlyClocked: [Shift!]!
    currentlyClockedByAuth0Id(auth0Id: String!): [Shift!]!
    shiftHistory(filter: ShiftHistoryFilter): [Shift!]!
    shiftHistoryByAuth0Id(auth0Id: String!, filter: ShiftHistoryFilter): [Shift!]!
    dashboardStats: DashboardStats!
    shiftAnalytics(userId: String): ShiftAnalytics!
    weeklyReport: WeeklyReport!
    staffAnalytics: [StaffAnalytics!]!
    staffAnalyticsByAuth0Id(auth0Id: String!): [StaffAnalytics!]!
    dailyStats(days: Int): [DailyStats!]!
    dailyStatsByAuth0Id(auth0Id: String!, days: Int): [DailyStats!]!
    organization: Organization
    organizationByAuth0Id(auth0Id: String!): Organization
  }

  type Mutation {
    createOrUpdateUser(input: CreateUserInput!): User!
    login(input: LoginInput!): AuthPayload!
    register(input: RegisterInput!): AuthPayload!
    clockIn(input: ClockInInput!): Shift!
    clockInByAuth0Id(auth0Id: String!, input: ClockInInput!): Shift!
    clockOut(input: ClockOutInput!): Shift!
    clockOutByAuth0Id(auth0Id: String!, input: ClockOutInput!): Shift!
    updatePerimeter(input: UpdatePerimeterInput!): Organization!
    updatePerimeterByAuth0Id(auth0Id: String!, input: UpdatePerimeterInput!): Organization!
  }

  type Subscription {
    shiftUpdated: Shift!
    staffStatusChanged: User!
    locationUpdate(userId: String, isManager: Boolean): LocationUpdate!
    geofenceAlert(isManager: Boolean): GeofenceAlert!
    realTimeStats(organizationId: String, isManager: Boolean): RealTimeStats!
  }

  type LocationUpdate {
    userId: String!
    lat: Float!
    lng: Float!
    timestamp: DateTime!
    isWithinPerimeter: Boolean!
  }

  type GeofenceAlert {
    userId: String!
    user: User!
    alertType: String! # "ENTERED", "EXITED", "AUTO_CLOCK_OUT"
    location: Location!
    timestamp: DateTime!
  }

  type RealTimeStats {
    organizationId: String!
    currentlyClocked: Int!
    totalStaff: Int!
    timestamp: DateTime!
  }

  type Location {
    lat: Float!
    lng: Float!
  }
`;
