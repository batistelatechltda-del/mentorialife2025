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

    return data?.data == null
      ? []
      : (data.data as CalendarEvent[]).map((event) => ({
          ...event,
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
