# 🚇🚌 Backend API - Transporte DF (Brasília)

Documentação completa da API backend para agentes de IA implementarem a conectividade no frontend Antiwalk.

**Base URL:** `http://localhost:3000`
**Protocolo REST:** HTTP/JSON
**Protocolo Real-Time:** WebSocket (`ws://localhost:3000`)

> **IMPORTANTE:** O servidor backend é separado do frontend Next.js. Este backend proxy unifica os sistemas do Metrô-DF e Mobilibus (ônibus) do Distrito Federal, contornando restrições de CORS e oferecendo cache inteligente + WebSockets.

---

## 📋 Índice

1. [Endpoints REST — Metrô](#-metrô-df-apimetro)
2. [Endpoints REST — Ônibus (Mobilibus)](#-mobilibus--ônibus)
3. [WebSockets (Tempo Real)](#-websockets-tempo-real)
4. [Schemas de Resposta](#-schemas-de-resposta-detalhados)
5. [Fluxos de Implementação](#-fluxos-de-implementação-para-o-frontend)
6. [Notas Técnicas](#-notas-técnicas)

---

## 🚇 Metrô-DF (`/api/metro`)

### `GET /api/metro/estacoes`

Lista **todas as estações** do metrô-DF, seus códigos e plataformas com sentidos.

**Resposta:** Objeto onde cada chave é o **código da estação** (3 letras ou 3 números).

```json
{
  "CEI": {
    "nome": "Terminal Ceilândia",
    "linha": "Ceilândia",
    "plataformas": {
      "1": "Sentido Central",
      "2": "Sentido Central"
    }
  },
  "CTL": {
    "nome": "Central",
    "linha": "Comum",
    "plataformas": {
      "1": "Sentido Terminais",
      "2": "Sentido Terminais"
    }
  },
  "CLA": {
    "nome": "Águas Claras",
    "linha": "Comum",
    "plataformas": {
      "1": "Sentido Central",
      "2": "Sentido Terminais",
      "3": "Sentido Terminais"
    }
  }
}
```

**Estações verificadas (27 total):**

| Código | Nome | Linha |
|--------|------|-------|
| `102` | 102 Sul | Comum |
| `106` | 106 Sul | Comum |
| `108` | 108 Sul | Comum |
| `110` | 110 Sul | Comum |
| `112` | 112 Sul | Comum |
| `114` | 114 Sul | Comum |
| `CEI` | Terminal Ceilândia | Ceilândia |
| `CEN` | Ceilândia Norte | Ceilândia |
| `CEC` | Ceilândia Centro | Ceilândia |
| `GBA` | Guariroba | Ceilândia |
| `CES` | Ceilândia Sul | Ceilândia |
| `MET` | Centro Metropolitano | Ceilândia |
| `REL` | Praça do Relógio | Ceilândia |
| `EPQ` | Estrada Parque | Ceilândia |
| `CON` | Concessionárias | Ceilândia |
| `SAM` | Terminal Samambaia | Samambaia |
| `SAS` | Samambaia Sul | Samambaia |
| `FUR` | Furnas | Samambaia |
| `TAS` | Taguatinga Sul | Samambaia |
| `CLA` | Águas Claras | Comum |
| `ARN` | Arniqueiras | Comum |
| `GUA` | Guará | Comum |
| `FEI` | Feira | Comum |
| `SHP` | Shopping | Comum |
| `ASA` | Asa Sul | Comum |
| `GAL` | Galeria | Comum |
| `CTL` | Central | Comum |

**Linhas do Metrô:**
- `Ceilândia` — plataformas `1` e `2`
- `Samambaia` — plataformas `3` e `4`
- `Comum` — plataformas `1` e `2` (exceto Águas Claras que tem `1`, `2` e `3`)

---

### `GET /api/metro/schedule`

Retorna o horário de funcionamento do metrô para o dia atual.

```json
[
  {
    "id_horario": 3,
    "id_dia_semana": 2,
    "sg_dia_semana": "TER",
    "ds_hora_inicio": "05:30:00",
    "ds_hora_fim": "23:30:00",
    "dt_alteracao": "2020-06-18T12:46:55.000Z",
    "id_usuario_responsavel": "2",
    "st_paralisado": "n",
    "st_alterado": "0",
    "dt_afetada_alteracao": null,
    "ds_observacao": null
  }
]
```

**Campos importantes:**
- `st_paralisado`: `"n"` = operando, `"s"` = paralisado
- `ds_hora_inicio` / `ds_hora_fim`: horário de funcionamento
- `sg_dia_semana`: abreviação do dia (SEG, TER, QUA, QUI, SEX, SAB, DOM)

---

### `GET /api/metro/trens/:stationCode/:platform`

Retorna os trens chegando numa **plataforma específica** de uma estação.

**Parâmetros:**
- `:stationCode` — código da estação (ex: `CEI`, `CTL`, `112`)
- `:platform` — número da plataforma (ex: `1`, `2`, `3`, `4`)

**Exemplo:** `GET /api/metro/trens/CEI/1`

```json
{
  "info": {
    "nome": "Terminal Ceilândia",
    "codigo": "CEI",
    "plataforma_consultada": "1",
    "sentido": "Sentido Central"
  },
  "trens": [
    {
      "chegada_em_minutos": 3,
      "id_trem": "17",
      "linha": "Ceilândia",
      "sentido": "Sentido Central",
      "destino_final": "Central",
      "raw": {
        "servico": "C",
        "direcao": "x"
      }
    },
    {
      "chegada_em_minutos": 29,
      "id_trem": "28",
      "linha": "Ceilândia",
      "sentido": "Sentido Central",
      "destino_final": "Central",
      "raw": {
        "servico": "C",
        "direcao": "x"
      }
    }
  ],
  "status_operacional": "Perto de fechar",
  "status_api": "operacional",
  "mensagem_api": "Ponto não instalado."
}
```

**Campos do trem:**
- `chegada_em_minutos`: `0` = trem na estação agora
- `id_trem`: identificador numérico do trem
- `linha`: "Ceilândia" ou "Samambaia"
- `sentido`: "Sentido Central" ou "Sentido Terminais" ou "Sentido Terminal Ceilândia/Samambaia"
- `destino_final`: nome da estação destino
- `raw.servico`: `"C"` = Ceilândia, `"S"` = Samambaia, `"R"` = Redistributivo/Comum
- `raw.direcao`: `"C"` = Ceilândia, `"S"` = Samambaia, `"x"` = indefinido

**Status operacional possíveis:** `"Operando"`, `"Perto de fechar"`, `"Fechado"`

---

### `GET /api/metro/trens/all`

Retorna **TODOS os trens em todas as plataformas de todas as estações** de uma vez.

**Resposta:** Objeto grande (~38KB) mapeando código da estação → plataforma → dados dos trens.

```json
{
  "CEI": {
    "platform_1": {
      "info": { ... },
      "trens": [ ... ],
      "status_operacional": "...",
      "status_api": "..."
    },
    "platform_2": { ... }
  },
  "CTL": {
    "platform_1": { ... },
    "platform_2": { ... }
  }
}
```

> ⚠️ **NOTA:** Esta rota é **pesada** (~38KB de JSON). Use-a para construir um mapa visual de todos os trens ou para cache local. Para consultas individuais, prefira `/api/metro/trens/:stationCode/:platform`.

---

## 🚌 Mobilibus — Ônibus

### `GET /routes`

Lista **todas as rotas de ônibus** disponíveis no DF.

**Resposta:** Array com 920+ rotas.

```json
{
  "total": 920,
  "routes": [
    {
      "routeId": 685743,
      "shortName": "366.1",
      "longName": "Samambaia Sul(2ª Avenida)/Samambaia Norte(1ª Avenida)/Estação Furnas",
      "color": "#007eff",
      "textColor": "#FFFFFF",
      "price": 2.7
    },
    {
      "routeId": 685681,
      "shortName": "0.394",
      "longName": "Samambaia Sul(1 Avenida)/Rodoviária Do Plano Piloto(EPTG)",
      "color": "#007eff",
      "textColor": "#FFFFFF",
      "price": 5.5
    }
  ]
}
```

---

### `GET /routes/:routeId`

Retorna **detalhes completos** de uma rota: informações gerais, viagens (trips), coordenadas GPS do trajeto, e todas as paradas.

**Parâmetro:** `:routeId` — ID numérico da rota (ex: `685681`).

> ⚠️ **IMPORTANTE:** Aceita **somente o ID numérico** (`685681`), NÃO aceita o shortName (`366.1`). Buscar por shortName retorna `{"error":"Rota não encontrada."}`.
> Para converter shortName → routeId, use primeiro `GET /lines/:line/routes`.

**Exemplo:** `GET /routes/685681`

```json
{
  "route": {
    "routeId": 685681,
    "shortName": "0.394",
    "longName": "Samambaia Sul(1 Avenida)/Rodoviária Do Plano Piloto(EPTG)",
    "description": null,
    "color": "#007eff",
    "textColor": "#FFFFFF",
    "price": 5.5
  },
  "trips": [
    {
      "tripId": 3696357,
      "directionId": 1,
      "seq": 1,
      "tripDetails": {
        "tripId": 3696357,
        "tripName": "Samambaia Sul 100-300 (via SIG-EPTG)",
        "routeName": "0.394 - Samambaia Sul(1 Avenida)/Rodoviária Do Plano Piloto(EPTG)",
        "coordinates": [[-15.79313, -47.88245], ...],
        "stops": [
          {
            "stopId": 21804122,
            "lat": -15.79309293,
            "lng": -47.88243079,
            "name": "Terminal Rodoviário do Plano Piloto - Plataforma E8"
          }
        ],
        "tzOffset": -3,
        "price": "5.50"
      }
    }
  ],
  "directions": [
    {
      "directionId": 0,
      "tripId": 3696358,
      "tripDetails": { ... }
    },
    {
      "directionId": 1,
      "tripId": 3696357,
      "tripDetails": { ... }
    }
  ]
}
```

**Campos importantes:**
- `coordinates`: array de `[lat, lng]` que forma a polyline do trajeto no mapa
- `stops`: array de paradas com coordenadas GPS e nomes
- `directions`: os possíveis sentidos da viagem (ida/volta)
- `directionId`: `0` = ida, `1` = volta (tipicamente)
- `tripId`: identificador único da viagem

> ⚠️ **NOTA:** A resposta é **muito grande** (~90KB). Contém centenas de coordenadas GPS. Use com cautela em mobile.

---

### `GET /lines`

Lista apenas os **nomes/números simplificados** das linhas de ônibus.

```json
{
  "total": 920,
  "lines": ["0.005", "0.006", "0.008", ..., "366.1", ..., "965.2"]
}
```

---

### `GET /lines/:line/routes`

Dado um **nome de linha** (shortName), retorna as rotas e sentidos vinculados.

**Parâmetro:** `:line` — nome da linha (ex: `366.1`, `0.394`)

**Exemplo:** `GET /lines/366.1/routes`

```json
{
  "line": "366.1",
  "total": 1,
  "routes": [
    {
      "routeId": 685743,
      "shortName": "366.1",
      "longName": "Samambaia Sul(2 Avenida)/Samambaia Norte(1 Avenida)/Estação Furnas",
      "color": "#007eff",
      "textColor": "#FFFFFF",
      "price": 2.7
    }
  ]
}
```

> **DICA:** Use esta rota para converter `shortName` → `routeId`. Depois use `GET /routes/:routeId` para obter os detalhes completos.

---

### `GET /monitor`

Mostra quais linhas de ônibus estão sendo **ativamente rastreadas** via GPS pelo servidor neste momento.

```json
{
  "total": 0,
  "routes": []
}
```

Quando há rotas monitoradas:
```json
{
  "total": 1,
  "routes": [
    {
      "routeId": 685681,
      "shortName": "0.394",
      "subscribers": 2,
      "lastUpdate": "2026-04-08T02:01:30.000Z"
    }
  ]
}
```

---

### `POST /monitor/:routeId`

Força o **início imediato** do poller contínuo de GPS para uma rota específica.

**Parâmetro:** `:routeId` — ID numérico da rota (ex: `685681`)

**Exemplo:** `POST /monitor/685681`

```json
{
  "success": true,
  "message": "Rota 685681 adicionada ao monitoramento",
  "data": {
    "routeId": 685681,
    "routeInfo": {
      "routeId": 685681,
      "shortName": "0.394",
      "longName": "Samambaia Sul(1 Avenida)/Rodoviária Do Plano Piloto(EPTG)",
      "color": "#007eff",
      "textColor": "#FFFFFF"
    },
    "trips": [3696357, 3696358],
    "tripsByDirection": {
      "0": 3696358,
      "1": 3696357
    },
    "directions": [
      {
        "directionId": 0,
        "tripId": 3696358,
        "tripDetails": {
          "tripName": "Rodoviária do Plano Piloto (via 100-300 / EPTG-SIG)",
          "coordinates": [...],
          "stops": [...]
        }
      },
      {
        "directionId": 1,
        "tripId": 3696357,
        "tripDetails": { ... }
      }
    ]
  }
}
```

---

## 🔄 WebSockets (Tempo Real)

**URL:** `ws://localhost:3000`

### Conectar

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  console.log('Conectado ao WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Atualização:', data);
};
```

### Assinar um Tópico (Subscribe)

```javascript
ws.send(JSON.stringify({
  action: "subscribe",
  topic: "metro:trains"
}));
```

### Tópicos Disponíveis

| Tópico | Descrição | Dados recebidos |
|--------|-----------|-----------------|
| `metro:trains` | Mapa de todos os trens em tempo real | Posições e tempos de todos os trens |
| `metro:schedule` | Status de operação (aberto/fechado) | Horário e status de paralisação |
| `mobilibus:route:[ID]` | GPS de ônibus por routeId numérico | Posições dos veículos |
| `linha:mobilibus:[NOME]` | GPS de ônibus pelo shortName | Posições dos veículos (ex: `linha:mobilibus:366.1`) |

### Ativar Rastreio de Ônibus (MonitorRoute)

Para rastrear um ônibus em tempo real, é preciso **"acordar" a rota** primeiro:

```javascript
// Pode usar shortName (ex: "366.1") OU routeId numérico
ws.send(JSON.stringify({
  action: "monitorRoute",
  routeId: "366.1"
}));
```

**Resposta automática a cada ~10s:**

```json
{
  "topic": "linha:mobilibus:366.1",
  "data": {
    "routeInfo": { "shortName": "366.1" },
    "tripId": 123456,
    "vehicles": [
      {
        "vehicleId": 76543,
        "lat": -15.8643,
        "lng": -48.0654,
        "percTravelled": 25.4,
        "heading": 120,
        "delayMinutes": 2
      }
    ],
    "timestamp": "2026-04-08T02:05:00.000Z"
  },
  "isUpdate": true
}
```

**Campos do veículo:**
- `vehicleId`: identificador do ônibus
- `lat`, `lng`: coordenadas GPS
- `percTravelled`: percentual do trajeto percorrido (0–100)
- `heading`: direção em graus (0–360)
- `delayMinutes`: atraso em minutos (negativo = adiantado)

### Cancelar Inscrição (Unsubscribe)

```javascript
ws.send(JSON.stringify({
  action: "unsubscribe",
  topic: "linha:mobilibus:366.1"
}));
```

> Se nenhum cliente estiver assistindo uma rota por 5 minutos, o servidor para de rastrear automaticamente para economizar memória.

---

## 📐 Schemas de Resposta Detalhados

### Schema: Estação de Metrô

```typescript
interface EstacaoMetro {
  nome: string;          // "Terminal Ceilândia"
  linha: string;         // "Ceilândia" | "Samambaia" | "Comum"
  plataformas: Record<string, string>; // {"1": "Sentido Central"}
}

// Resposta completa: Record<string, EstacaoMetro>
```

### Schema: Trem

```typescript
interface TremChegando {
  chegada_em_minutos: number;   // 0 = na estação
  id_trem: string;              // "17"
  linha: string;                // "Ceilândia" | "Samambaia"
  sentido: string;              // "Sentido Central" | "Sentido Terminais" etc.
  destino_final: string;        // "Central" | "Terminal Ceilândia" etc.
  raw: {
    servico: string;            // "C" | "S" | "R"
    direcao: string;            // "C" | "S" | "x"
  };
}

interface RespostaTrens {
  info: {
    nome: string;
    codigo: string;
    plataforma_consultada: string;
    sentido: string;
  };
  trens: TremChegando[];
  status_operacional: "Operando" | "Perto de fechar" | "Fechado";
  status_api: "operacional" | "indisponivel";
  mensagem_api?: string;
}
```

### Schema: Rota de Ônibus

```typescript
interface RotaOnibus {
  routeId: number;        // 685743
  shortName: string;      // "366.1"
  longName: string;       // "Samambaia Sul(2ª Avenida)/.."
  color: string;          // "#007eff"
  textColor: string;      // "#FFFFFF"
  price: number;          // 2.7
}

interface Parada {
  stopId: number;
  lat: number;
  lng: number;
  name: string;
}

interface DetalhesViagem {
  tripId: number;
  tripName: string;
  routeName: string;
  coordinates: [number, number][];  // [lat, lng]
  stops: Parada[];
  tzOffset: number;       // -3 (Brasília)
  price: string;
}

interface RespostaRotaCompleta {
  route: RotaOnibus & { description: string | null };
  trips: Array<{
    tripId: number;
    directionId: number;    // 0 = ida, 1 = volta
    seq: number;
    tripDetails: DetalhesViagem;
  }>;
  directions: Array<{
    directionId: number;
    tripId: number;
    tripDetails: DetalhesViagem;
  }>;
}
```

### Schema: Veículo GPS (WebSocket)

```typescript
interface VeiculoGPS {
  vehicleId: number;
  lat: number;
  lng: number;
  percTravelled: number;    // 0-100
  heading: number;          // 0-360 graus
  delayMinutes: number;     // negativo = adiantado
}

interface AtualizacaoOnibus {
  topic: string;            // "linha:mobilibus:366.1"
  data: {
    routeInfo: { shortName: string };
    tripId: number;
    vehicles: VeiculoGPS[];
    timestamp: string;      // ISO 8601
  };
  isUpdate: boolean;
}
```

---

## 🔧 Fluxos de Implementação para o Frontend

### Fluxo 1: Exibir trens no mapa em tempo real

```
1. GET /api/metro/estacoes → armazenar mapa de estações
2. Conectar WebSocket ws://localhost:3000
3. Subscribe "metro:trains" → receber atualizações
4. OU GET /api/metro/trens/all → snapshot único (38KB)
5. Para estação individual: GET /api/metro/trens/:code/:platform
```

### Fluxo 2: Rastrear ônibus em tempo real

```
1. Usuário busca linha pelo shortName (ex: "366.1")
2. GET /lines/366.1/routes → obter routeId (685743)
3. GET /routes/685743 → obter trajectória, paradas, polyline
4. Conectar WebSocket ws://localhost:3000
5. Enviar { action: "monitorRoute", routeId: "366.1" }
6. Receber posições GPS a cada ~10s
7. Ao sair: enviar { action: "unsubscribe", topic: "linha:mobilibus:366.1" }
```

### Fluxo 3: Listar e buscar linhas de ônibus

```
1. GET /lines → lista de 920 shortNames para autocomplete
2. GET /routes → lista completa com nomes longos e preços
3. GET /lines/:line/routes → lookup de routeId por shortName
```

### Fluxo 4: Verificar status do metrô

```
1. GET /api/metro/schedule → horário de hoje
2. Verificar st_paralisado ("n" = operando)
3. OU: Subscribe WebSocket "metro:schedule"
```

---

## 📝 Notas Técnicas

### Encoding
- A API retorna JSON em UTF-8
- Caracteres acentuados (ã, é, ô, etc.) são nativos no JSON

### Cache
- A API backend implementa cache inteligente internamente
- Dados do metrô: atualizam a cada poucos segundos (horários de trem mudam em tempo real)
- Dados de rotas/linhas: relativamente estáticos (mudam raramente)

### Erros conhecidos
- `GET /routes/:shortName` → retorna `{"error":"Rota não encontrada."}` — use ID numérico
- Quando o metrô está fora de horário, `trens` pode ser array vazio
- `mensagem_api` pode conter texto longo de status do órgão governamental

### Limites e Performance
- `/api/metro/trens/all` — ~38KB, leva ~5s para compilar (faz requests paralelas a todas as estações)
- `/routes` — lista completa leva ~2-3s
- `/routes/:id` — detalhes de uma rota ~90KB (muitas coordenadas GPS)
- WebSocket polling de ônibus: atualiza a cada ~10s

### Comportamento de Idle do WebSocket
- Se **nenhum cliente** estiver inscrito numa rota de ônibus por 5 minutos, o servidor **para de rastrear** aquela rota
- Ao reconectar WebSocket, é necessário re-enviar `monitorRoute` para todas as rotas desejadas
- O metrô (`metro:trains`) é sempre rastreado enquanto houver pelo menos 1 subscriber

### CORS
- O backend proxy já resolve CORS internamente
- O frontend pode chamar diretamente `http://localhost:3000` sem headers especiais
