"use client";
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { getArrivals, localTime } from '@/lib/transport/journeys';
import { getErrorMessage } from '@/lib/transport/hooks';
import { usePageVisible, useVisibleClock } from '@/lib/transport/visibility';
import type { BusStop } from '@/lib/transport/types';

/** Next arrivals at one stop, shown inline under that stop in the line's stop list. */
export default function ArrivalPanel({ routeId, stop }: { routeId: number; stop: BusStop }) {
  const visible = usePageVisible();
  const now = useVisibleClock();
  const query = useQuery({ queryKey: ['bus', 'arrivals', routeId, stop.stopId],
    queryFn: ({ signal }) => getArrivals(stop.stopId, routeId, signal), enabled: visible,
    staleTime: 10000, refetchInterval: visible ? 20000 : false, retry: 1 });
  const arrivals = (query.data?.arrivals || []).filter(a => Date.parse(a.arrivalAt) >= now - 30000
    && (a.source === 'scheduled' || (a.observedAt && now - Date.parse(a.observedAt) <= 45000)));

  return (
    <div className="border-b border-border pb-3 pt-1" role="region" aria-label={`Próximas chegadas em ${stop.name}`}>
      {query.isLoading && <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Consultando chegadas…</p>}
      {query.error && <p role="status" className="py-2 text-sm text-amber-700 dark:text-amber-400">{getErrorMessage(query.error)}</p>}
      {query.data && <>
        {query.data.realtimeStatus !== 'available' && <p className="pb-1 text-xs text-amber-700 dark:text-amber-400">Sem confirmação ao vivo. Os horários abaixo são os programados.</p>}
        {now - Date.parse(query.data.calculatedAt) > 60000 && <p className="pb-1 text-xs text-amber-700 dark:text-amber-400">A consulta está antiga. Conecte-se para atualizar.</p>}
        {arrivals.length > 0 ? (
          <ul>
            {arrivals.map((arrival, i) => {
              const live = arrival.source === 'realtime';
              const minutes = Math.ceil((Date.parse(arrival.arrivalAt) - now) / 60000);
              return (
                <li key={`${arrival.routeId}:${arrival.tripId}:${arrival.arrivalAt}:${i}`} className="flex min-h-11 items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${live ? 'bg-cta' : 'border border-muted-foreground'}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">Linha {arrival.line}</span>
                    <span className="block truncate text-xs text-muted-foreground">{live ? 'Ao vivo' : 'Programado'}, {arrival.headsign}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-sm font-semibold tabular-nums ${live ? 'text-amber-700 dark:text-cta' : ''}`}>{minutes <= 0 ? 'Agora' : `${minutes} min`}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">{localTime(arrival.arrivalAt)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">Nenhuma chegada prevista nas próximas duas horas.</p>
        )}
        {query.data.notice && <p className="pt-1 text-xs text-muted-foreground">{query.data.notice}</p>}
      </>}
    </div>
  );
}
