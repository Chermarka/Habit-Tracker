const BASE = "http://localhost:4000/api";

export type HabitType = "BINARY" | "NUMERIC";

export interface DashboardHabit {
  id: string;
  name: string;
  type: HabitType;
  targetValue: number | null;
  unit: string | null;
  completed?: boolean;
  value?: number;
  status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  streak: number;
}

export interface WeekDay {
  date: string;
  completed?: boolean;
  value?: number | null;
  editable: boolean;
}

export interface WeekHabit {
  id: string;
  name: string;
  type: HabitType;
  targetValue: number | null;
  unit: string | null;
  days: WeekDay[];
}

export interface WeekResponse {
  weekStart: string;
  weekEnd: string;
  habits: WeekHabit[];
}

export interface Habit {
  id: string;
  name: string;
  type: HabitType;
  targetValue: number | null;
  unit: string | null;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  requestId: string;
}

export interface CurrentUser {
  id: string;
  nickname: string;
}

const SESSION_KEY = "habit-tracker-session";

export function getSession(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    return null;
  }
}

function setSession(user: CurrentUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const session = getSession();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(session ? { "x-user-id": session.id } : {}),
    },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) {
    const err = body as ApiError;
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  return body as T;
}

export const api = {
  register: async (nickname: string) => {
    const user = await request<CurrentUser>(`/auth/register`, {
      method: "POST",
      body: JSON.stringify({ nickname }),
    });
    setSession(user);
    return user;
  },
  login: async (nickname: string) => {
    const user = await request<CurrentUser>(`/auth/login`, {
      method: "POST",
      body: JSON.stringify({ nickname }),
    });
    setSession(user);
    return user;
  },
  getDashboard: (date: string) => request<DashboardHabit[]>(`/habits?date=${date}`),
  createHabit: (input: { name: string; type: HabitType; targetValue?: number; unit?: string }) =>
    request<Habit>(`/habits`, { method: "POST", body: JSON.stringify(input) }),
  checkIn: (habitId: string, input: { date: string; completed?: boolean; value?: number }) =>
    request<{ log: unknown; streak: number }>(`/habits/${habitId}/checkin`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  getWeek: (start: string) => request<WeekResponse>(`/habits/week?start=${start}`),
  archiveHabit: (habitId: string) => request<Habit>(`/habits/${habitId}/archive`, { method: "POST" }),
  getArchived: () => request<Habit[]>(`/habits/archived`),
};
