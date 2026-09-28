import { useEffect, useState } from 'react';
import { todayISO, type ISODate } from '../utils/date';

/** Aktuelles Datum, das sich auch nach Mitternacht bzw. beim Zurückkehren in die App aktualisiert. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const refresh = () => setToday(todayISO());
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}
