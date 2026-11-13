export interface MetroStation {
  nome: string;
  linha: string;
  plataformas: Record<string, string>;
}

export type MetroStationsResponse = Record<string, MetroStation>;

export interface MetroScheduleEntry {
  id_horario: number;
  id_dia_semana: number;
  sg_dia_semana: string;
  ds_hora_inicio: string;
  ds_hora_fim: string;
  dt_alteracao: string;
  id_usuario_responsavel: string;
  st_paralisado: "n" | "s";
  st_alterado: string;
  dt_afetada_alteracao: string | null;
  ds_observacao: string | null;
}

export interface MetroTrain {
  chegada_em_minutos: number;
  id_trem: string;
  linha: string;
  sentido: string;
  destino_final: string;
  raw: {
    servico: string;
    direcao: string;
  };
}

export interface MetroTrainsResponse {
  fetchedAt?: string;
  info: {
    nome: string;
    codigo: string;
    plataforma_consultada: string;
    sentido: string;
  };
  trens: MetroTrain[];
  status_operacional: "Operando" | "Perto de fechar" | "Fechado";
  status_api: "operacional" | "indisponivel" | "problemas" | "sem_dados";
  mensagem_api?: string;
}

export interface BusRouteSummary {
  routeId: number;
  shortName: string;
  longName: string;
  color: string;
  textColor: string;
  price: number;
}

export interface BusLinesResponse {
  total: number;
  lines: string[];
}

export interface BusRoutesResponse {
  total: number;
  routes: BusRouteSummary[];
}

export interface BusLineRoutesResponse {
  line: string;
  total: number;
  routes: BusRouteSummary[];
}

export interface BusStop {
  stopId: number;
  lat: number;
  lng: number;
  name: string;
  sequence?: number;
  offsetSeconds?: number | null;
}

export interface BusTripDetails {
  tripId: string | number;
  tripName: string;
  routeName: string;
  coordinates: [number, number][];
  stops: BusStop[];
  tzOffset: number;
  price: string;
}

export interface BusDirection {
  directionId: number;
  tripId: string | number;
  tripDetails: BusTripDetails;
}

export interface BusTrip {
  tripId: string | number;
  directionId: number;
  seq: number;
  tripDetails: BusTripDetails;
}

export interface BusRouteDetailsResponse {
  route: BusRouteSummary & { description: string | null };
  trips: BusTrip[];
  directions: BusDirection[];
}

export interface MonitorRouteResponse {
  success: boolean;
  message: string;
  data?: {
    routeId: number;
    routeInfo?: BusRouteSummary;
  };
}

export interface BusVehicle {
  vehicleId: string | number;
  lat: number;
  observedAt?: string | null;
  fetchedAt?: string;
  positionTime?: string | null;
  startTime?: string | null;
  delaySeconds?: number | null;
  lng: number;
  percTravelled?: number;
  heading?: number;
  delayMinutes?: number;
  seq?: number;
  tripId?: string | number;
  stopId?: string | null;
  tripHeadsign?: string | null;
}

export interface BusRealtimePayload {
  routeInfo?: {
    shortName: string;
  };
  tripId?: string | number | null;
  trips?: { tripId: string | number; vehicles: BusVehicle[] }[];
  vehicles: BusVehicle[];
  timestamp?: string;
}

export interface BusRealtimeMessage {
  topic: string;
  data: BusRealtimePayload;
  isUpdate?: boolean;
}

export type SearchSelection =
  | {
      id: string;
      type: "line";
      title: string;
      subtitle: string;
      shortName: string;
    }
  | {
      id: string;
      type: "station";
      title: string;
      subtitle: string;
      stationCode: string;
    };

export type SocketConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  | "error";

export type MetroRealtimeMode = "probing" | "ws" | "polling";
