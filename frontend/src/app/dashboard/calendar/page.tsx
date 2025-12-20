import Calendar from "@/components/dashboard/calender";
import { cookies } from "next/headers";

interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time?: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  type?: "EVENT" | "ROUTINE";
}

async function getCalender(): Promise<CalendarEvent[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL_SERVER}/api/client/calendar-event/get-all`,
      {
        headers: {
          authorization: `${token}`,
        },
      }
    );

    const data = await res.json();

    if (!data?.data) return [];

    return data.data.map((event: any) => ({
      id: event.id,
      title: event.title,
      description: event.description ?? null,

      // 🔥 NORMALIZAÇÃO CRÍTICA
      start_time: event.start,
      end_time: event.end,

      is_completed: event.isCompleted ?? false,
      created_at: event.created_at ?? new Date().toISOString(),
      updated_at: event.updated_at ?? new Date().toISOString(),

      type: event.type ?? "EVENT",
    }));
  } catch (err) {
    console.log(err);
    return [];
  }
}

async function page() {
  const events = await getCalender();
  return <Calendar initEvents={events} />;
}

export default page;
