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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
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
  getHabitHeatmap: (habitId: string, year: number, month?: number) =>
    request<{ date: string; percentage: number }[]>(
      `/habits/${habitId}/heatmap?year=${year}${month ? `&month=${month}` : ""}`
    ),
  getAggregateHeatmap: (year: number, month?: number) =>
    request<{ date: string; done: number; total: number; percentage: number }[]>(
      `/habits/heatmap?year=${year}${month ? `&month=${month}` : ""}`
    ),
};
