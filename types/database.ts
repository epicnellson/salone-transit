// ============================================================
// Salone Transit — Database Types
// Auto-generated mirror of the SQL schema
// ============================================================

export type UserRole = "passenger" | "agent" | "admin";

export type BookingStatus = "pending" | "paid" | "verified" | "expired";

export type PaymentStatus = "pending" | "confirmed" | "failed";

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Route {
  id: string;
  origin: string;
  destination: string;
  active: boolean;
}

export interface Wave {
  id: string;
  route_id: string;
  departure_label: string;
  capacity_estimate: number;
}

export interface Booking {
  id: string;
  user_id: string;
  route_id: string;
  wave_id: string;
  seat_count: number;
  ticket_code: string;
  status: BookingStatus;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  monime_ref: string | null;
  amount: number;
  status: PaymentStatus;
  confirmed_at: string | null;
}

export interface Agent {
  id: string;
  user_id: string;
  station_location: string;
  commission_rate: number;
}

export interface Verification {
  id: string;
  booking_id: string;
  agent_id: string;
  verified_at: string;
}

export type SmsStatus = "sent" | "failed";

export interface SmsLog {
  id: string;
  phone: string;
  message: string;
  purpose: string;
  status: SmsStatus;
  provider_message_id: string | null;
  provider_status: string | null;
  provider_response: string | null;
  cost: string | null;
  created_at: string;
}

export interface OtpCode {
  id: string;
  phone: string;
  code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export interface AgentSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// ============================================================
// Supabase generated types shape
// ============================================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<User, "id">>;
      };
      routes: {
        Row: Route;
        Insert: Omit<Route, "id"> & { id?: string };
        Update: Partial<Omit<Route, "id">>;
      };
      waves: {
        Row: Wave;
        Insert: Omit<Wave, "id"> & { id?: string };
        Update: Partial<Omit<Wave, "id">>;
      };
      bookings: {
        Row: Booking;
        Insert: Omit<Booking, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Booking, "id">>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, "id"> & { id?: string };
        Update: Partial<Omit<Payment, "id">>;
      };
      agents: {
        Row: Agent;
        Insert: Omit<Agent, "id"> & { id?: string };
        Update: Partial<Omit<Agent, "id">>;
      };
      verifications: {
        Row: Verification;
        Insert: Omit<Verification, "id" | "verified_at"> & {
          id?: string;
          verified_at?: string;
        };
        Update: Partial<Omit<Verification, "id">>;
      };
      sms_logs: {
        Row: SmsLog;
        Insert: Omit<SmsLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<SmsLog, "id">>;
      };
      otp_codes: {
        Row: OtpCode;
        Insert: Omit<OtpCode, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<OtpCode, "id">>;
      };
      agent_sessions: {
        Row: AgentSession;
        Insert: Omit<AgentSession, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<AgentSession, "id">>;
      };
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      payment_status: PaymentStatus;
    };
  };
}
