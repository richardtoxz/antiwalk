"use client";
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, ArrowLeft, Bus, ChevronRight, Footprints, Loader2, MapPin, TrainFront } from 'lucide-react';
import { getJourneys, getPlaces, getLocationServices, localTime, placeKindLabel, type Place, type JourneyOption } from '@/lib/transport/journeys';
import { getErrorMessage } from '@/lib/transport/hooks';
import { usePageVisible, useVisibleClock } from '@/lib/transport/visibility';
import { useConnection } from './ConnectionBanner';
import TurnstileWidget, { TURNSTILE_ENABLED } from './TurnstileWidget';

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
    <label htmlFor={id} className="block text-xs text-muted-foreground">{label}</label>
    <div className="flex items-center gap-1">
      <input id={id} autoComplete="off" maxLength={100} value={inputText} placeholder={addressesEnabled ? 'Endereço, parada ou estação' : 'Parada ou estação'} role="combobox" aria-autocomplete="list" aria-expanded={open && !value}
        aria-controls={`${id}-results`} aria-activedescendant={open && places[highlight] ? `${id}-${highlight}` : undefined}
        onFocus={() => setOpen(true)} onChange={e => { setText(e.target.value); onChange(null); setOpen(true); setHighlight(0); }}
        onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.max(0, Math.min(i + 1, places.length - 1))); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(0, i - 1)); } if (e.key === 'Enter' && open && places[highlight]) { e.preventDefault(); choose(places[highlight]); } }}
        className="min-h-10 min-w-0 flex-1 truncate bg-transparent text-base font-medium placeholder:font-normal placeholder:text-muted-foreground focus:outline-none" />
      <button type="button" onClick={onMap} aria-label={`Escolher ${label.toLowerCase()} no mapa`} title="Escolher no mapa"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
        <MapPin className="h-4 w-4" aria-hidden />
      </button>
    </div>
    {open && !value && inputText.length >= 2 && <ul id={`${id}-results`} role="listbox" className="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-auto rounded-lg border border-border bg-card shadow-lg">
      {places.map((p, i) => <li key={p.id} id={`${id}-${i}`} role="option" aria-selected={i === highlight}>
        <button type="button" onClick={() => choose(p)} className={`min-h-11 w-full break-words px-3 py-2 text-left text-sm ${i === highlight ? 'bg-muted' : ''}`}>
          <span className="block font-medium">{p.name}</span>
          <span className="block text-xs text-muted-foreground">{placeKindLabel(p)}</span>
        </button>
      </li>)}
      {(query.isFetching || !matching) && <li className="p-3 text-sm text-muted-foreground" role="status">Buscando…</li>}
      {matching && !query.isFetching && !places.length && <li className="p-3 text-sm text-muted-foreground">{query.error ? 'Busca indisponível. Escolha o ponto no mapa.' : 'Nenhum resultado. Escolha o ponto no mapa.'}</li>}
    </ul>}
    {open && (addressStatus === 'limited' || addressStatus === 'unavailable') && <p role="status" className="pb-1 text-xs text-muted-foreground">Endereços indisponíveis nesta consulta. Busque uma parada ou escolha no mapa.</p>}
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
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [request, setRequest] = useState<{ origin: Place; destination: Place; walk: number; sequence: number; turnstileToken?: string } | null>(null);
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
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  const query = useQuery({
    queryKey: ['journey', 'options', request],
    queryFn: async ({ signal }) => {
      try {
        return await getJourneys(request!.origin, request!.destination, request!.walk, signal, request!.turnstileToken);
      } finally {
        if (TURNSTILE_ENABLED) {
          setTurnstileToken('');
          setTurnstileResetKey(k => k + 1);
        }
      }
    },
    enabled: Boolean(request) && visible, retry: false, staleTime: Infinity, refetchOnMount: false, refetchOnReconnect: false, refetchOnWindowFocus: false
  });
  const options = [...(query.data?.options || [])].sort((a, b) => sort === 'walking' ? a.walkMeters - b.walkMeters : sort === 'transfers' ? a.transfers - b.transfers : a.durationMinutes - b.durationMinutes);
  const current = request && origin && destination && request.origin.lat === origin.lat && request.origin.lng === origin.lng && request.destination.lat === destination.lat && request.destination.lng === destination.lng && request.walk === maxWalk;
  const addressesEnabled = Boolean(services.data?.addresses);
  const disconnected = useConnection().status !== "online";
  const transferLabel = (count: number) => count === 0 ? 'Sem troca' : count === 1 ? '1 troca' : `${count} trocas`;
  const usesGeoapify = addressesEnabled || options.some(option => option.legs.some(leg => leg.walkingRoute === 'geoapify'));
  return <div ref={dialog} role="dialog" aria-labelledby="journey-title"
    className="fixed inset-0 z-40 flex flex-col bg-card text-foreground md:inset-auto md:bottom-4 md:left-4 md:top-4 md:w-[380px] md:rounded-xl md:border md:border-border md:shadow-xl">
    <header className="flex shrink-0 items-center gap-1 px-2 pt-2 safe-top">
      <button type="button" onClick={onClose} aria-label="Voltar" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-accent"><ArrowLeft className="h-5 w-5" aria-hidden /></button>
      <h2 id="journey-title" className="text-base font-semibold">Traçar rota</h2>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <div className="flex items-stretch rounded-lg border border-border pl-3 focus-within:border-foreground">
        <div className="min-w-0 flex-1 divide-y divide-border">
          <div className="py-1.5"><PlacePicker label="Origem" value={origin} onChange={onOrigin} onMap={() => onPick('origin')} addressesEnabled={addressesEnabled} /></div>
          <div className="py-1.5"><PlacePicker label="Destino" value={destination} onChange={onDestination} onMap={() => onPick('destination')} addressesEnabled={addressesEnabled} /></div>
        </div>
        <button type="button" aria-label="Inverter origem e destino" disabled={!origin || !destination} onClick={() => { onOrigin(destination); onDestination(origin); }}
          className="flex w-11 shrink-0 items-center justify-center rounded-r-lg border-l border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40">
          <ArrowDownUp className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {disconnected && <p role="status" className="mt-3 rounded-lg bg-muted p-3 text-sm">O cálculo de rotas depende do servidor, que está sem conexão agora. Você pode escolher a origem e o destino no mapa; as opções aparecem quando a conexão voltar.</p>}
      {services.data?.addresses === false && <p className="mt-2 text-xs text-muted-foreground">A busca de endereços está indisponível. Paradas, estações e a escolha no mapa continuam funcionando.</p>}

      <fieldset className="mt-4">
        <legend className="text-xs text-muted-foreground">Caminhada máxima por trecho</legend>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {([[400, '400 m'], [800, '800 m'], [1500, '1,5 km']] as const).map(([value, label]) =>
            <button key={value} type="button" aria-pressed={maxWalk === value} onClick={() => setMaxWalk(value)}
              className={`min-h-11 rounded-lg border text-sm font-medium tabular-nums ${maxWalk === value ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-accent'}`}>{label}</button>)}
        </div>
      </fieldset>

      <TurnstileWidget action="journeys" onToken={setTurnstileToken} resetKey={turnstileResetKey} />
      {TURNSTILE_ENABLED && !turnstileToken && <p className="mt-2 text-xs text-muted-foreground">Verificando segurança…</p>}

      <button type="button" disabled={!origin || !destination || query.isFetching || (TURNSTILE_ENABLED && !turnstileToken)} onClick={() => origin && destination && setRequest({ origin, destination, walk: maxWalk, sequence: Date.now(), turnstileToken: turnstileToken || undefined })}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
        {query.isFetching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{query.isFetching ? 'Calculando opções…' : 'Ver opções'}</button>
      {(!origin || !destination) && <p className="mt-2 text-xs text-muted-foreground">Escolha a origem e o destino para comparar as opções.</p>}
      {query.error && <p role="status" className="mt-3 text-sm text-amber-700 dark:text-amber-400">{getErrorMessage(query.error)}</p>}

      {current && query.data && <div aria-live="polite" className="mt-4">
        {now - Date.parse(query.data.calculatedAt) > 60000 && <p className="mb-3 rounded-lg bg-muted p-3 text-sm">Estas opções foram calculadas às {localTime(query.data.calculatedAt)}. Veja as opções de novo antes de sair.</p>}
        {query.data.coverage.state !== 'ready' && <p className="mb-3 rounded-lg bg-muted p-3 text-sm">A cobertura de ônibus ainda está sendo preparada ({query.data.coverage.indexed} de {query.data.coverage.total} linhas). Podem existir outras opções; consulte de novo em instantes.</p>}
        {!options.length && <p className="text-sm">Nenhuma opção encontrada com esse limite de caminhada. Tente outra parada ou aumente o limite.</p>}
        {options.length > 0 && <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ordenar opções">
          {([['duration', 'Mais rápida'], ['walking', 'Menos caminhada'], ['transfers', 'Menos trocas']] as const).map(([value, label]) =>
            <button key={value} type="button" aria-pressed={sort === value} onClick={() => setSort(value)}
              className={`min-h-9 rounded-full border px-3 text-xs font-medium ${sort === value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-accent'}`}>{label}</button>)}
        </div>}
        <ol className="mt-1 divide-y divide-border">{options.map(option => <li key={option.id} className="py-4">
          <p className="flex items-baseline gap-2"><span className="text-xl font-bold tabular-nums">{option.durationMinutes} min</span><span className="text-sm text-muted-foreground">chega às {localTime(option.arrivalAt)}</span></p>
          <p className="mt-2 flex flex-wrap items-center gap-1 text-xs">
            {option.legs.map((leg, i) => <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />}
              {leg.mode === 'walk'
                ? <span className="flex items-center gap-1 text-muted-foreground"><Footprints className="h-3.5 w-3.5" aria-hidden />{leg.distanceMeters} m</span>
                : leg.mode === 'metro'
                  ? <span className="flex items-center gap-1 rounded-md bg-foreground px-1.5 py-0.5 font-semibold text-background"><TrainFront className="h-3.5 w-3.5" aria-hidden />Metrô</span>
                  : <span className="flex items-center gap-1 rounded-md border border-foreground px-1.5 py-0.5 font-semibold tabular-nums"><Bus className="h-3.5 w-3.5" aria-hidden />{leg.line}</span>}
            </span>)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{transferLabel(option.transfers)}, cerca de {option.walkMeters} m a pé{option.baseFare !== null ? `, tarifas somadas R$ ${option.baseFare.toFixed(2).replace('.', ',')}` : ''}</p>
          {option.tightConnection && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Conexão apertada: um atraso pode comprometer a troca.</p>}
          <details className="mt-1">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Passo a passo</summary>
            <ol className="space-y-3 pb-2">{option.legs.map((leg, i) => <li key={i} className="flex gap-2 text-sm">
              {leg.mode === 'walk' ? <Footprints className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : leg.mode === 'metro' ? <TrainFront className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Bus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              <div className="min-w-0">
                <p className="font-medium">{leg.mode === 'walk' ? `Caminhar cerca de ${leg.distanceMeters} m` : `${leg.mode === 'metro' ? 'Metrô' : `Linha ${leg.line}`} às ${localTime(leg.departureAt)}`}</p>
                <p className="text-xs text-muted-foreground">De {leg.from.name} até {leg.to.name}</p>
                {leg.mode !== 'walk' && <p className="text-xs text-muted-foreground">{leg.source === 'realtime' ? 'Previsão do metrô' : 'Horário programado'}{leg.headsign ? `, sentido ${leg.headsign}` : ''}</p>}
                {leg.mode === 'walk' && <p className="text-xs text-muted-foreground">{leg.walkingRoute === 'geoapify' ? 'Caminho pelas ruas, tempo estimado' : 'Caminhada aproximada, confira os acessos'}</p>}
                {leg.mode === 'walk' && Boolean(leg.steps?.length) && <details>
                  <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium">Orientações a pé</summary>
                  <ol className="space-y-1.5 text-xs">{leg.steps?.map((step, index) => <li key={index}>{step.instruction}{step.distanceMeters > 0 ? ` (${step.distanceMeters} m)` : ''}</li>)}</ol>
                </details>}
              </div>
            </li>)}</ol>
          </details>
          <button type="button" onClick={() => onSelect(option)} className="mt-1 min-h-11 w-full rounded-lg border border-foreground px-3 text-sm font-semibold hover:bg-accent">Ver no mapa</button>
        </li>)}</ol>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">{query.data.notices.map(notice => <p key={notice}>{notice}</p>)}</div>
      </div>}
      {usesGeoapify && <p className="mt-4 text-xs text-muted-foreground">Endereços e caminhos a pé: <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">Geoapify</a> e <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a></p>}
    </div>
  </div>;
}
