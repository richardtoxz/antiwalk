"use client";
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, Bus, Footprints, Loader2, MapPin, Route, TrainFront, X } from 'lucide-react';
import { getJourneys, getPlaces, getLocationServices, localTime, type Place, type JourneyOption } from '@/lib/transport/journeys';
import { getErrorMessage } from '@/lib/transport/hooks';
import { usePageVisible, useVisibleClock } from '@/lib/transport/visibility';

function PlacePicker({ label, value, onChange, onMap, addressesEnabled }: { label: string; value: Place | null; onChange: (place: Place | null) => void; onMap: () => void; addressesEnabled: boolean }) {
  const [text, setText] = useState(value?.name || '');
  const [search, setSearch] = useState(text);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const field = useRef<HTMLDivElement>(null);
  const visible = usePageVisible();
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!field.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const inputText = value?.name ?? text;
  useEffect(() => { const timer = window.setTimeout(() => setSearch(inputText.trim()), 500); return () => window.clearTimeout(timer); }, [inputText]);
  const query = useQuery({ queryKey: ['journey', 'places', search], queryFn: ({ signal }) => getPlaces(search, signal),
    enabled: open && !value && visible && search.length >= 2 && search.length <= 100 && search === inputText.trim(), staleTime: 300000, retry: false, refetchOnWindowFocus: false });
  const matching = search === inputText.trim();
  const places = matching ? query.data?.places || [] : [];
  const addressStatus = matching ? query.data?.addressSearch?.status : undefined;
  const choose = (place: Place) => { onChange(place); setText(place.name); setOpen(false); setHighlight(0); };
  const id = label === 'Origem' ? 'journey-origin' : 'journey-destination';
  return <div ref={field} className="relative">
    <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
    <input id={id} autoComplete="off" maxLength={100} value={inputText} placeholder={addressesEnabled ? 'Busque endereço, parada ou estação' : 'Busque uma parada ou estação'} role="combobox" aria-autocomplete="list" aria-expanded={open && !value}
      aria-controls={`${id}-results`} aria-activedescendant={open && places[highlight] ? `${id}-${highlight}` : undefined}
      onFocus={() => setOpen(true)} onChange={e => { setText(e.target.value); onChange(null); setOpen(true); setHighlight(0); }}
      onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.max(0, Math.min(i + 1, places.length - 1))); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(0, i - 1)); } if (e.key === 'Enter' && open && places[highlight]) { e.preventDefault(); choose(places[highlight]); } }}
      className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary" />
    {open && !value && inputText.length >= 2 && <ul id={`${id}-results`} role="listbox" className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
      {places.map((p, i) => <li key={p.id} id={`${id}-${i}`} role="option" aria-selected={i === highlight}>
        <button type="button" onClick={() => choose(p)} className={`min-h-11 w-full break-words px-3 py-3 text-left text-sm ${i === highlight ? 'bg-muted' : ''}`}>{p.name}<span className="ml-2 text-xs text-muted-foreground">{p.kind === 'metro' ? 'Metrô' : p.kind === 'address' ? 'Endereço' : 'Parada'}</span></button>
      </li>)}
      {(query.isFetching || !matching) && <li className="p-3 text-sm" role="status">Buscando…</li>}
      {matching && !query.isFetching && !places.length && <li className="p-3 text-sm text-muted-foreground">{query.error ? 'Busca indisponível. Escolha no mapa.' : 'Nenhum resultado. Escolha no mapa.'}</li>}
    </ul>}
    {open && (addressStatus === 'limited' || addressStatus === 'unavailable') && <p role="status" className="mt-2 text-xs text-muted-foreground">Endereços indisponíveis nesta consulta. Busque uma parada ou escolha no mapa.</p>}
    {addressesEnabled && <p className="mt-1 text-xs text-muted-foreground">Endereços: <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">Geoapify</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a></p>}
    <button type="button" onClick={onMap} className="mt-1 flex min-h-11 items-center gap-1 text-xs font-medium text-primary"><MapPin className="h-4 w-4" />Escolher {label.toLowerCase()} no mapa</button>
  </div>;
}

export default function JourneyPanel({ origin, destination, onOrigin, onDestination, onPick, onClose, onSelect }: {
  origin: Place | null; destination: Place | null; onOrigin: (p: Place | null) => void; onDestination: (p: Place | null) => void;
  onPick: (field: 'origin' | 'destination') => void; onClose: () => void; onSelect: (option: JourneyOption) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const [maxWalk, setMaxWalk] = useState(800);
  const [request, setRequest] = useState<{ origin: Place; destination: Place; walk: number; sequence: number } | null>(null);
  const [sort, setSort] = useState('duration');
  const now = useVisibleClock();
  const visible = usePageVisible();
  const services = useQuery({ queryKey: ['journey', 'location-services'], queryFn: ({ signal }) => getLocationServices(signal),
    enabled: visible, staleTime: 30000, retry: false });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab') return;
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, a[href]') || [])];
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  const query = useQuery({ queryKey: ['journey', 'options', request], queryFn: ({ signal }) => getJourneys(request!.origin, request!.destination, request!.walk, signal),
    enabled: Boolean(request) && visible, retry: false, staleTime: 30000, refetchOnWindowFocus: false });
  const options = [...(query.data?.options || [])].sort((a, b) => sort === 'walking' ? a.walkMeters - b.walkMeters : sort === 'transfers' ? a.transfers - b.transfers : a.durationMinutes - b.durationMinutes);
  const current = request && origin && destination && request.origin.lat === origin.lat && request.origin.lng === origin.lng && request.destination.lat === destination.lat && request.destination.lng === destination.lng && request.walk === maxWalk;
  return <div className="fixed inset-0 z-50 bg-black/30 p-0 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-4" onClick={onClose}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="journey-title" onClick={e => e.stopPropagation()}
      className="flex h-dvh w-full flex-col bg-background text-foreground sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl sm:shadow-xl">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3"><h2 id="journey-title" className="flex items-center gap-2 text-lg font-bold"><Route className="h-5 w-5" />Planejar viagem</h2>
        <button type="button" onClick={onClose} aria-label="Fechar planejamento" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><X /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <p className="mb-4 text-sm text-muted-foreground">Compare ônibus e metrô para sair agora.</p>
        {services.data?.addresses === false && <p className="mb-3 text-xs text-muted-foreground">Busca de endereços indisponível por enquanto. Paradas, estações e seleção no mapa continuam disponíveis.</p>}
        <div className="space-y-2"><PlacePicker label="Origem" value={origin} onChange={onOrigin} onMap={() => onPick('origin')} addressesEnabled={Boolean(services.data?.addresses)} />
          <button type="button" aria-label="Inverter origem e destino" disabled={!origin || !destination} onClick={() => { onOrigin(destination); onDestination(origin); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-muted disabled:opacity-50"><ArrowDownUp className="h-4 w-4" /></button>
          <PlacePicker label="Destino" value={destination} onChange={onDestination} onMap={() => onPick('destination')} addressesEnabled={Boolean(services.data?.addresses)} /></div>
        <label htmlFor="journey-walk" className="mb-1 mt-4 block text-sm font-semibold">Caminhada máxima por trecho</label>
        <select id="journey-walk" value={maxWalk} onChange={e => setMaxWalk(Number(e.target.value))} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base">
          <option value={400}>Até 400 m</option><option value={800}>Até 800 m</option><option value={1500}>Até 1,5 km</option></select>
        <button type="button" disabled={!origin || !destination || query.isFetching} onClick={() => origin && destination && setRequest({ origin, destination, walk: maxWalk, sequence: Date.now() })}
          className="my-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
          {query.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}{query.isFetching ? 'Calculando opções…' : 'Comparar opções'}</button>
        {query.error && <p role="status" className="mb-3 text-sm text-amber-600">{getErrorMessage(query.error)}</p>}
        {current && query.data && <div aria-live="polite">
          {now - Date.parse(query.data.calculatedAt) > 60000 && <p className="mb-3 rounded-lg bg-muted p-3 text-sm">Estas opções foram calculadas às {localTime(query.data.calculatedAt)}. Compare novamente antes de sair.</p>}
          {query.data.coverage.state !== 'ready' && <p className="mb-3 rounded-lg bg-muted p-3 text-sm">Preparando a cobertura de ônibus ({query.data.coverage.indexed}/{query.data.coverage.total}). Podem existir outras opções; consulte novamente em instantes.</p>}
          {!options.length && <p className="mb-3 text-sm">Não encontramos uma opção com os dados e o limite de caminhada disponíveis. Tente outra parada ou amplie o limite.</p>}
          {options.length > 0 && <><label htmlFor="journey-sort" className="mr-2 text-sm">Ordenar por</label><select id="journey-sort" value={sort} onChange={e => setSort(e.target.value)} className="mb-3 min-h-11 rounded-lg border border-border bg-background px-2 text-sm">
            <option value="duration">Menor duração</option><option value="walking">Menos caminhada</option><option value="transfers">Menos baldeações</option></select></>}
          <ol className="space-y-3">{options.map(option => <li key={option.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-lg font-bold">{option.durationMinutes} min <span className="text-sm font-normal text-muted-foreground">· chegada {localTime(option.arrivalAt)}</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{option.transfers} baldeação(ões) · cerca de {option.walkMeters} m a pé{option.baseFare !== null ? ` · tarifas somadas R$ ${option.baseFare.toFixed(2)}` : ''}</p>
            <ol className="mt-3 space-y-3">{option.legs.map((leg, i) => <li key={i} className="flex gap-2 text-sm">
              {leg.mode === 'walk' ? <Footprints className="mt-1 h-4 w-4 shrink-0" /> : leg.mode === 'metro' ? <TrainFront className="mt-1 h-4 w-4 shrink-0" /> : <Bus className="mt-1 h-4 w-4 shrink-0" />}
              <div><p className="font-semibold">{leg.mode === 'walk' ? `Caminhar cerca de ${leg.distanceMeters} m` : `${leg.line} · ${localTime(leg.departureAt)}`}</p>
                <p className="text-xs text-muted-foreground">{leg.from.name} → {leg.to.name}</p>{leg.mode !== 'walk' && <p className="mt-1 text-xs">{leg.source === 'realtime' ? 'Previsão do metrô' : 'Horário programado'} · {leg.headsign}</p>}
                {leg.mode === 'walk' && <><p className="mt-1 text-xs text-muted-foreground">{leg.walkingRoute === 'geoapify' ? 'Caminho pelas ruas · tempo estimado' : 'Caminhada aproximada · confira os acessos'}</p>
                  {Boolean(leg.steps?.length) && <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-primary">Ver orientações a pé</summary><ol className="space-y-2 text-xs">{leg.steps?.map((step, index) => <li key={index}>{step.instruction}{step.distanceMeters > 0 ? ` · ${step.distanceMeters} m` : ''}</li>)}</ol></details>}</>}
                </div></li>)}</ol>
            {option.legs.some(l => l.walkingRoute === 'geoapify') && <p className="mt-3 text-xs text-muted-foreground">Caminhos: <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">Geoapify</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a></p>}
            {option.tightConnection && <p className="mt-3 text-xs text-amber-600">Conexão apertada: atrasos podem comprometer a troca.</p>}
            <button type="button" onClick={() => onSelect(option)} className="mt-3 min-h-11 w-full rounded-lg border border-primary px-3 text-sm font-semibold text-primary">Ver este percurso no mapa</button>
          </li>)}</ol>
          <div className="mt-4 space-y-2 text-xs text-muted-foreground">{query.data.notices.map(notice => <p key={notice}>{notice}</p>)}</div>
        </div>}
      </div>
    </div>
  </div>;
}
