export enum UserRole {
  MANAGER = 'MANAGER',
  CARE_WORKER = 'CARE_WORKER',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  auth0Id?: string;
  picture?: string;
  organization?: Organization;
  shifts?: Shift[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  locationLat: number;
  locationLng: number;
  perimeterRadius: number;
  users?: User[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Shift {
  id: string;
  userId: string;
  user?: User;
  clockInTime: Date;
  clockOutTime?: Date;
  clockInLat: number;
  clockInLng: number;
  clockOutLat?: number;
  clockOutLng?: number;
  clockInNote?: string;
  clockOutNote?: string;
  totalHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface ClockInInput {
  lat: number;
  lng: number;
  note?: string;
}

export interface ClockOutInput {
  lat: number;
  lng: number;
  note?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  auth0Id?: string;
  picture?: string;
}

export interface CreateUserInput {
  auth0Id: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  organizationId: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  organizationId: string;
}

export interface ShiftAnalytics {
  totalHours: number;
  averageHours: number;
  totalShifts: number;
  currentlyClocked: number;
}

export interface DashboardStats {
  totalStaff: number;
  currentlyClocked: number;
  todayShifts: number;
  averageHours: number;
}
