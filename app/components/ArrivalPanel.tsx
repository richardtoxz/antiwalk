"use client";
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bus, Clock3, Loader2 } from 'lucide-react';
import { getArrivals, localTime } from '@/lib/transport/journeys';
import { getErrorMessage } from '@/lib/transport/hooks';
import { usePageVisible, useVisibleClock } from '@/lib/transport/visibility';
import type { BusStop } from '@/lib/transport/types';

export default function ArrivalPanel({ routeId, stops, selectedStopId, onSelectStop }: {
  routeId: number; stops: BusStop[]; selectedStopId: number | null; onSelectStop: (id: number | null) => void;
}) {
  const visible = usePageVisible();
  const now = useVisibleClock();
  const [expanded, setExpanded] = useState(true);
  const stop = stops.find(s => s.stopId === selectedStopId);
  const query = useQuery({ queryKey: ['bus', 'arrivals', routeId, stop?.stopId],
    queryFn: ({ signal }) => getArrivals(stop!.stopId, routeId, signal), enabled: Boolean(stop) && visible && expanded,
    staleTime: 10000, refetchInterval: stop && visible && expanded ? 20000 : false, retry: 1 });
  const arrivals = (query.data?.arrivals || []).filter(a => Date.parse(a.arrivalAt) >= now - 30000
    && (a.source === 'scheduled' || (a.observedAt && now - Date.parse(a.observedAt) <= 45000)));
  return <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-label="Próximas chegadas">
    <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="flex min-h-11 w-full items-center justify-between text-left text-sm font-semibold">
      <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Próximas chegadas</span><span aria-hidden>{expanded ? '−' : '+'}</span>
    </button>
    {expanded && <>
      <label htmlFor="arrival-stop" className="mb-1 block text-xs text-muted-foreground">Escolha sua parada</label>
      <select id="arrival-stop" value={stop?.stopId ?? ''} onChange={e => onSelectStop(e.target.value ? Number(e.target.value) : null)}
        className="min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm">
        <option value="">Selecionar parada</option>{stops.map((s, i) => <option key={`${s.stopId}:${i}`} value={s.stopId}>{s.name}</option>)}
      </select>
      {!stop && <p className="mt-2 text-xs text-muted-foreground">Também pode tocar em uma parada no mapa ou no itinerário.</p>}
      {query.isLoading && stop && <p className="mt-3 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Consultando chegadas…</p>}
      {query.error && <p role="status" className="mt-3 text-sm text-amber-600">{getErrorMessage(query.error)}</p>}
      {query.data && <>
        {query.data.realtimeStatus !== 'available' && <p className="mt-3 text-xs text-amber-600">Sem confirmação ao vivo. Consulte os horários programados abaixo.</p>}
        {now - Date.parse(query.data.calculatedAt) > 60000 && <p className="mt-3 text-xs text-amber-600">A consulta está antiga. Conecte-se para atualizar.</p>}
        <ul className="mt-3 space-y-3">{arrivals.map((arrival, i) => <li key={`${arrival.routeId}:${arrival.tripId}:${arrival.arrivalAt}:${i}`} className="flex items-start gap-2 border-b border-border/50 pb-3 last:border-0">
          <Bus className="mt-1 h-4 w-4 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Linha {arrival.line} · {localTime(arrival.arrivalAt)}</p>
            <p className="text-xs text-muted-foreground">{arrival.headsign}</p><p className="mt-1 text-xs">{arrival.source === 'realtime' ? 'Previsão com posição recente' : 'Horário programado'}</p></div>
          <span className="shrink-0 text-sm font-semibold">{Date.parse(arrival.arrivalAt) <= now ? 'Agora' : `${Math.ceil((Date.parse(arrival.arrivalAt) - now) / 60000)} min`}</span>
        </li>)}</ul>
        {!arrivals.length && <p className="mt-3 text-sm text-muted-foreground">Não há chegadas confirmadas ou programadas nas próximas duas horas para as linhas disponíveis.</p>}
        <p className="mt-2 text-[11px] text-muted-foreground">{query.data.notice}</p>
      </>}
    </>}
  </section>;
}
