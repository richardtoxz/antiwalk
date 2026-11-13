export interface MetroStation {
  id: number;
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  services: string[];
  platforms: Record<string, string>;
  linha: 'Ceilândia' | 'Samambaia' | 'Comum';
}

export const METRO_STATIONS: MetroStation[] = [
  {
    id: 1,
    code: 'CTL',
    name: 'Estação Central',
    address: 'Entre o Shopping Conjunto Nacional e Centro Comercial CONIC - Referência: Junto à Praça do Cidadão na plataforma oeste da Rodoviária do Plano Piloto.',
    latitude: -15.7934,
    longitude: -47.8843,
    services: ['WI-FI Gratuito', 'Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Painel de Horários', 'Bike Compartilhada', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Terminais' },
    linha: 'Comum'
  },
  {
    id: 2,
    code: 'GAL',
    name: 'Estação Galeria dos Estados',
    address: 'Referência: Frente para o eixo W - ao lado da Galeria dos Estados / SCS',
    latitude: -15.7995,
    longitude: -47.8859,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Achados e Perdidos', 'Telefone Público', 'Painel de Horários', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 3,
    code: '102',
    name: 'Estação 102 Sul',
    address: 'Entrequadras 102/103 Sul',
    latitude: -15.8057,
    longitude: -47.8894,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Painel de Horários', 'Bike Compartilhada', 'Mapa em Braile', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 4,
    code: '104',
    name: 'Estação 104 Sul',
    address: 'Em construção',
    latitude: -15.8105,
    longitude: -47.8938,
    services: [],
    platforms: {},
    linha: 'Comum'
  },
  {
    id: 5,
    code: '106',
    name: 'Estação 106 Sul',
    address: 'Quadra 106 Sul - Referencia : Cine Brasília',
    latitude: -15.815,
    longitude: -47.8986,
    services: ['Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Painel de Horários', 'Mapa em Braile'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 6,
    code: '108',
    name: 'Estação 108 Sul',
    address: 'Entrequadras 108/109 Sul - Referência: fundos do Clube Unidade e Vizinhança.',
    latitude: -15.819,
    longitude: -47.9041,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Telefone Público', 'Painel de Horários', 'Bike Compartilhada', 'Mapa em Braile', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 7,
    code: '110',
    name: 'Estação 110 Sul',
    address: 'Entrequadras 110/111 Sul',
    latitude: -15.8229,
    longitude: -47.9094,
    services: ['Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Painel de Horários', 'Bike Compartilhada', 'Mapa em Braile', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 8,
    code: '112',
    name: 'Estação 112 Sul',
    address: 'Entrequadras 112/113 Sul',
    latitude: -15.8268,
    longitude: -47.9148,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Painel de Horários', 'Mapa em Braile', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 9,
    code: '114',
    name: 'Estação 114 Sul',
    address: 'Entrequadras 114/115 Sul - Referência: frente ao estacionamento da lanchonete McDonald`s',
    latitude: -15.8307,
    longitude: -47.9203,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Painel de Horários', 'Mapa em Braile', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 10,
    code: 'ASA',
    name: 'Estação Asa Sul',
    address: 'Junto ao Terminal de Integração Asa Sul, acesso pela pista entre a ENAP e o Corpo de Bombeiros, Setor Policial Sul',
    latitude: -15.8371,
    longitude: -47.9327,
    services: ['Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Painel de Horários'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 11,
    code: 'SHP',
    name: 'Estação Shopping',
    address: 'Setor de Áreas Isoladas Sul - ao lado do Hipermercado Extra e Leroy Merlin',
    latitude: -15.8324,
    longitude: -47.9508,
    services: ['WI-FI Gratuito', 'Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Painel de Horários', 'Mapa em Braile', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 13,
    code: 'FEI',
    name: 'Estação Feira',
    address: 'Entre Guará I e II - Feira permanente do Guará e Administração Regional',
    latitude: -15.8231,
    longitude: -47.975,
    services: ['WI-FI Gratuito', 'Caixa Eletrônico', 'Estacionamento', 'Elevador', 'Escada Rolante', 'Painel de Horários'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 14,
    code: 'GUA',
    name: 'Estação Guará',
    address: 'Entre as quadras do Guará I e II',
    latitude: -15.8263,
    longitude: -47.9829,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Telefone Público', 'Painel de Horários', 'Mapa em Braile'],
    platforms: { '1': 'Sentido Terminais', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 16,
    code: 'ARN',
    name: 'Estação Arniqueiras',
    address: 'Entre a Av. das Auracárias e Av. das Castanheiras, entre as ruas 10 (Pitangueiras) e 11 (Alecrim)',
    latitude: -15.8367,
    longitude: -48.0171,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Elevador', 'Escada Rolante', 'Painel de Horários', 'Mapa em Braile', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Central', '2': 'Sentido Central' },
    linha: 'Comum'
  },
  {
    id: 17,
    code: 'CLA',
    name: 'Estação Águas Claras',
    address: 'Av. Pau Brasil, entre as Avenidas das Araucárias e Avenida das Castanheiras em Águas Claras',
    latitude: -15.8401,
    longitude: -48.0283,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Painel de Horários', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Central', '2': 'Sentido Terminais', '3': 'Sentido Terminais' },
    linha: 'Comum'
  },
  {
    id: 18,
    code: 'CON',
    name: 'Estação Concessionárias',
    address: 'Entre avenida da Castanheira e Araucária, rua 36, após a entrada da EPTG para Águas Claras, 1.5 km do centro de Taguatinga.',
    latitude: -15.8352,
    longitude: -48.0386,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Elevador', 'Painel de Horários'],
    platforms: { '1': 'Sentido Terminal Ceilândia', '2': 'Sentido Central' },
    linha: 'Ceilândia'
  },
  {
    id: 19,
    code: 'EPQ',
    name: 'Estação Estrada Parque',
    address: 'EPTG no sentido Taguatinga Centro/Plano Piloto - 400 metros após o viaduto de saída de Taguatinga Centro',
    latitude: -15.8324,
    longitude: -48.0452,
    services: ['Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Bicicletário', 'Painel de Horários', 'Mapa em Braile'],
    platforms: { '1': 'Sentido Terminal Ceilândia', '2': 'Sentido Central' },
    linha: 'Ceilândia'
  },
  {
    id: 20,
    code: 'REL',
    name: 'Estação Praça do Relógio',
    address: 'Av. das Palmeiras, ao lado da Administração de Taguatinga, na Praça do Relógio - Taguatinga',
    latitude: -15.833,
    longitude: -48.0561,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Telefone Público', 'Painel de Horários', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminal Ceilândia', '2': 'Sentido Central' },
    linha: 'Ceilândia'
  },
  {
    id: 21,
    code: 'ONO',
    name: 'Estação Onoyama',
    address: 'Em construção',
    latitude: -15.8346,
    longitude: -48.0775,
    services: [],
    platforms: {},
    linha: 'Ceilândia'
  },
  {
    id: 22,
    code: 'MET',
    name: 'Estação Centro Metropolitano',
    address: 'Entre a Rodoviária de Taguatinga e a Quadra QNL 14. Próxima ao DETRAN-Taguatinga',
    latitude: -15.8355,
    longitude: -48.0865,
    services: ['Caixa Eletrônico', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Telefone Público', 'Painel de Horários', 'Mapa em Braile', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminal Ceilândia', '2': 'Sentido Central' },
    linha: 'Ceilândia'
  },
  {
    id: 23,
    code: 'CES',
    name: 'Estação Ceilândia Sul',
    address: 'Entre a Via Ceilândia Sul e Via Oeste. Entre as quadras QNN 24/26 e QNN 08/10',
    latitude: -15.8379,
    longitude: -48.1033,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Painel de Horários', 'Mapa em Braile'],
    platforms: { '1': 'Sentido Terminal Ceilândia', '2': 'Sentido Central' },
    linha: 'Ceilândia'
  },
  {
    id: 24,
    code: 'GBA',
    name: 'Estação Guariroba',
    address: 'Cidade de Ceilândia, Via N1 em frente ao conjunto O da QNN 06.',
    latitude: -15.8305,
    longitude: -48.1074,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Painel de Horários', 'Mapa em Braile'],
    platforms: { '1': 'Sentido Terminal Ceilândia', '2': 'Sentido Central' },
    linha: 'Ceilândia'
  },
  {
    id: 25,
    code: 'CEC',
    name: 'Estação Ceilândia Centro',
    address: 'Cidade de Ceilandia, Av. Helio Prates, entre as quadras CNN 02 e QNN 02, próxima à agência da Secretaria de Fazenda do DF e ao Supermercado Tatico.',
    latitude: -15.8224,
    longitude: -48.112,
    services: ['WI-FI Gratuito', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Painel de Horários', 'Mapa em Braile', 'Lojas Comerciais'],
    platforms: { '1': 'Sentido Terminal Ceilândia', '2': 'Sentido Central' },
    linha: 'Ceilândia'
  },
  {
    id: 26,
    code: 'CEN',
    name: 'Estação Ceilândia Norte',
    address: 'Cidade de Ceilândia, Via N1 em frente ao conjunto P da QNN 03.',
    latitude: -15.8149,
    longitude: -48.1161,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Biblioteca', 'Escada Rolante', 'Bicicletário', 'Painel de Horários', 'Mapa em Braile'],
    platforms: { '1': 'Sentido Terminal Ceilândia', '2': 'Sentido Central' },
    linha: 'Ceilândia'
  },
  {
    id: 27,
    code: 'CEI',
    name: 'Estação Terminal Ceilândia',
    address: 'Cidade de Ceilândia, entre as Quadras QNN 23 e QNN 07, próxima às Igrejas Pentecostal e Assembléia de Deus e à Maranata Materiais de Construção.',
    latitude: -15.8056,
    longitude: -48.1213,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Painel de Horários', 'Mapa em Braile'],
    platforms: { '1': 'Sentido Central', '2': 'Sentido Central' },
    linha: 'Ceilândia'
  },
  {
    id: 30,
    code: 'TAS',
    name: 'Estação Taguatinga Sul',
    address: 'Entre as quadras QSD e QSE na EPCT (Pistão Sul) em Taguatinga Sul - em frente à caixa d\'água de Taguatinga',
    latitude: -15.8519,
    longitude: -48.042,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Painel de Horários'],
    platforms: { '3': 'Sentido Terminal Samambaia', '4': 'Sentido Central' },
    linha: 'Samambaia'
  },
  {
    id: 31,
    code: 'FUR',
    name: 'Estação Furnas',
    address: 'Cidade de Samambaia, entre a Quadra QR 122 e o Complexo Elétrico de Furnas, acesso pela Avenida Leste',
    latitude: -15.8649,
    longitude: -48.0598,
    services: ['WI-FI Gratuito', 'Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Telefone Público', 'Painel de Horários'],
    platforms: { '3': 'Sentido Terminal Samambaia', '4': 'Sentido Central' },
    linha: 'Samambaia'
  },
  {
    id: 32,
    code: 'SAS',
    name: 'Estação Samambaia Sul',
    address: 'Cidade de Samambaia, Quadra QR 110/112 rua dos Correios, após a agência dos Correios virar à direita.',
    latitude: -15.869,
    longitude: -48.0716,
    services: ['Estacionamento', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Painel de Horários'],
    platforms: { '3': 'Sentido Terminal Samambaia', '4': 'Sentido Central' },
    linha: 'Samambaia'
  },
  {
    id: 33,
    code: 'SAM',
    name: 'Estação Terminal Samambaia',
    address: 'Cidade de Samambaia, Quadra 104 na 2ª Avenida Sul - próxima a Feira Permanente de Samambaia',
    latitude: -15.8737,
    longitude: -48.0849,
    services: ['Caixa Eletrônico', 'Estacionamento', 'Ponto de Ônibus', 'Elevador', 'Escada Rolante', 'Bicicletário', 'Telefone Público', 'Painel de Horários'],
    platforms: { '3': 'Sentido Central', '4': 'Sentido Central' },
    linha: 'Samambaia'
  }
];

export const METRO_STATIONS_MAP = METRO_STATIONS.reduce<Record<string, MetroStation>>((acc, station) => {
  acc[station.code] = station;
  return acc;
}, {});

// Complete paths including under-construction stations to render smooth track lines
export const METRO_GEOMETRIES = {
  ceilandiaLine: [
    'CTL', 'GAL', '102', '104', '106', '108', '110', '112', '114', 'ASA', 
    'SHP', 'FEI', 'GUA', 'ARN', 'CLA', 'CON', 'EPQ', 'REL', 'ONO', 'MET', 
    'CES', 'GBA', 'CEC', 'CEN', 'CEI'
  ],
  samambaiaLine: [
    'CTL', 'GAL', '102', '104', '106', '108', '110', '112', '114', 'ASA', 
    'SHP', 'FEI', 'GUA', 'ARN', 'CLA', 'TAS', 'FUR', 'SAS', 'SAM'
  ]
};

/**
 * Gets the ordered sequence of ACTIVE stations (with platforms/service)
 * to logically determine the train's route flow for position interpolation.
 */
export function getLogicalActiveRoute(linha: string): string[] {
  const normalized = linha.toLowerCase();
  const isCeilandia = normalized.includes('ceil') || normalized === 'c';
  const isSamambaia = normalized.includes('samam') || normalized === 's';

  if (isCeilandia) {
    return [
      'CTL', 'GAL', '102', '106', '108', '110', '112', '114', 'ASA', 
      'SHP', 'FEI', 'GUA', 'ARN', 'CLA', 'CON', 'EPQ', 'REL', 'MET', 
      'CES', 'GBA', 'CEC', 'CEN', 'CEI'
    ];
  } else if (isSamambaia) {
    return [
      'CTL', 'GAL', '102', '106', '108', '110', '112', '114', 'ASA', 
      'SHP', 'FEI', 'GUA', 'ARN', 'CLA', 'TAS', 'FUR', 'SAS', 'SAM'
    ];
  }
  return [];
}

/**
 * Calculates the previous station code for a train currently arriving at target station,
 * depending on its line and destination/direction.
 */
export function getPreviousStationCode(
  targetStationCode: string,
  linha: string,
  sentido: string
): string | null {
  const route = getLogicalActiveRoute(linha);
  if (route.length === 0) return null;

  const index = route.indexOf(targetStationCode);
  if (index === -1) return null;

  // In Brasília Metro, "Sentido Central" means travelling towards Estação Central (index 0).
  // "Sentido Terminais" (or Ceilândia/Samambaia) means travelling away from Central (towards end of array).
  const isToCentral = sentido.toLowerCase().includes('central');

  if (isToCentral) {
    // Travelling towards Central (index 0). Previous station is at a HIGHER index (coming from terminals).
    if (index + 1 < route.length) {
      return route[index + 1];
    }
  } else {
    // Travelling towards Terminals (end of array). Previous station is at a LOWER index (coming from Central).
    if (index - 1 >= 0) {
      return route[index - 1];
    }
  }

  return null;
}

/**
 * Generates GeoJSON FeatureCollection for the Metrô-DF lines.
 */
export function getMetroLinesGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const getCoordinates = (codes: string[]) => {
    return codes
      .map(code => METRO_STATIONS_MAP[code])
      .filter(Boolean)
      .map(station => [station.longitude, station.latitude]);
  };

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          lineName: 'Linha Laranja',
          lineColor: '#ff6b09',
          linha: 'Ceilândia'
        },
        geometry: {
          type: 'LineString',
          coordinates: getCoordinates(METRO_GEOMETRIES.ceilandiaLine)
        }
      },
      {
        type: 'Feature',
        properties: {
          lineName: 'Linha Verde',
          lineColor: '#00b074',
          linha: 'Samambaia'
        },
        geometry: {
          type: 'LineString',
          coordinates: getCoordinates(METRO_GEOMETRIES.samambaiaLine)
        }
      }
    ]
  };
}

/**
 * Generates GeoJSON FeatureCollection for the Metrô-DF Stations.
 */
export function getMetroStationsGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: METRO_STATIONS.map(station => ({
      type: 'Feature',
      id: station.id,
      geometry: {
        type: 'Point',
        coordinates: [station.longitude, station.latitude]
      },
      properties: {
        code: station.code,
        name: station.name,
        address: station.address,
        linha: station.linha,
        services: station.services
      }
    }))
  };
}

export interface RawTrainArrival {
  fetchedAt?: string;
  chegada_em_minutos: number;
  id_trem: string;
  linha: string;
  sentido: string;
  destino_final: string;
  station: string;
  platform: string;
}

export function normalizeMetroRealtime(payload: unknown): RawTrainArrival[] {
  if (!Array.isArray(payload)) return [];
  const arrivals: RawTrainArrival[] = [];
  for (const item of payload) {
    if (!item || typeof item !== 'object') continue;
    const station = METRO_STATIONS_MAP[item.station];
    const direction = station?.platforms[String(item.platform)];
    if (!station || !direction || typeof item.lista !== 'string') continue;
    for (const raw of item.lista.split(';')) {
      const [minutes, service, id, , , destination] = raw.split(',');
      const number = Number(minutes);
      if (!id || !Number.isFinite(number) || number < 0) continue;
      const line = direction === 'Sentido Central' ? (service === 'S' ? 'Samambaia' : 'Ceilândia')
        : station.linha === 'Comum' ? (destination === 'C' ? 'Ceilândia' : 'Samambaia') : station.linha;
      arrivals.push({ id_trem: id, chegada_em_minutos: number, linha: line, sentido: direction,
        destino_final: direction === 'Sentido Central' ? 'Central' : `Terminal ${line}`,
        station: station.code, platform: String(item.platform), fetchedAt: item.fetchedAt });
    }
  }
  return arrivals;
}

export interface ActiveTrainPosition {
  id: string;
  linha: string;
  sentido: string;
  destino_final: string;
  nextStationCode: string;
  minutesToArrival: number;
  lat: number;
  lng: number;
}

/**
 * Groups and processes raw train arrivals, selecting the closest upcoming station arrival 
 * for each unique train, and calculates its interpolated coordinate.
 */
export function parseActiveTrains(arrivals: RawTrainArrival[]): ActiveTrainPosition[] {
  const trainArrivalsMap = new Map<string, RawTrainArrival>();

  for (const arrival of arrivals) {
    if (!arrival.id_trem) continue;
    const existing = trainArrivalsMap.get(arrival.id_trem);
    // We want the most imminent arrival prediction for each unique train ID
    if (!existing || arrival.chegada_em_minutos < existing.chegada_em_minutos) {
      trainArrivalsMap.set(arrival.id_trem, arrival);
    }
  }

  const activeTrains: ActiveTrainPosition[] = [];

  for (const [id, arrival] of trainArrivalsMap.entries()) {
    const targetCode = arrival.station;
    const targetStation = METRO_STATIONS_MAP[targetCode];
    if (!targetStation) continue;

    const previousCode = getPreviousStationCode(targetCode, arrival.linha, arrival.sentido);
    const previousStation = previousCode ? METRO_STATIONS_MAP[previousCode] : null;

    let lat = targetStation.latitude;
    let lng = targetStation.longitude;

    if (previousStation && arrival.chegada_em_minutos > 0) {
      // Interpolate along track segment between stations. 
      // We assume an average transit time of 2.5 minutes between stations.
      const ratio = Math.max(0.15, Math.min(0.85, 1 - (arrival.chegada_em_minutos / 2.5)));
      lat = previousStation.latitude + (targetStation.latitude - previousStation.latitude) * ratio;
      lng = previousStation.longitude + (targetStation.longitude - previousStation.longitude) * ratio;
    }

    activeTrains.push({
      id,
      linha: arrival.linha,
      sentido: arrival.sentido,
      destino_final: arrival.destino_final,
      nextStationCode: targetCode,
      minutesToArrival: arrival.chegada_em_minutos,
      lat,
      lng
    });
  }

  return activeTrains;
}

/**
 * Converts active trains to GeoJSON features for map rendering.
 */
export function getMetroTrainsGeoJSON(trains: ActiveTrainPosition[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: trains.map(train => ({
      type: 'Feature',
      id: Number(train.id) || undefined,
      geometry: {
        type: 'Point',
        coordinates: [train.lng, train.lat]
      },
      properties: {
        id: train.id,
        linha: train.linha,
        sentido: train.sentido,
        destino_final: train.destino_final,
        nextStationCode: train.nextStationCode,
        minutesToArrival: train.minutesToArrival
      }
    }))
  };
}

