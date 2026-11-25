# API usada pelo Antiwalk

O frontend consome a API do projeto `websocket-serverDF`, que reúne os dados do Metrô-DF, dos ônibus (Mobilibus) e da busca de endereços e caminhadas (Geoapify). O endereço da API vem de `NEXT_PUBLIC_API_URL`; o WebSocket usa o mesmo host (`wss` quando a API usa `https`).

Este documento lista só o que o frontend usa. A referência completa da API fica no repositório dela.

## Metrô

| Método | Caminho | Uso no app |
|---|---|---|
| GET | `/api/metro/estacoes` | Estações e plataformas, para a busca e o mapa |
| GET | `/api/metro/schedule` | Horário de funcionamento do dia |
| GET | `/api/metro/trens/:estacao/:plataforma` | Próximos trens de uma plataforma |

Tópicos do WebSocket: `metro:trains` (previsões de todas as plataformas, usadas para estimar a posição dos trens) e `metro:schedule`.

## Ônibus

| Método | Caminho | Uso no app |
|---|---|---|
| GET | `/lines` | Números de todas as linhas, para a busca |
| GET | `/lines/:linha/routes` | Converte o número da linha no `routeId` |
| GET | `/routes/:routeId` | Itinerário: sentidos, traçado e paradas |
| GET | `/routes/:routeId/vehicles` | Posições atuais da frota (usado quando o tempo real cai) |
| POST | `/monitor/:routeId` | Pede ao servidor para acompanhar a linha |
| GET | `/api/monitor/sse/:ids` | Posições ao vivo por SSE, para os IDs separados por vírgula |
| GET | `/stops/:stopId/arrivals?routeId=` | Próximas chegadas em uma parada, ao vivo ou programadas |

Cada veículo traz `vehicleId`, `lat`, `lng`, `heading` (graus, 0 = norte), `observedAt` (horário do GPS), `delayMinutes` e `tripId`. A interface classifica a posição pela idade do GPS e descarta as que passam de dois minutos.

## Planejamento de viagem

| Método | Caminho | Uso no app |
|---|---|---|
| GET | `/journeys/location-services` | Diz se a busca de endereços e as caminhadas pelas ruas estão ativas |
| GET | `/journeys/places?q=` | Lugares, paradas e estações para a busca e para origem e destino |
| GET | `/places/nearby?lat=&lng=&radius=&limit=&kinds=` | Paradas de ônibus e estações próximas |
| POST | `/journeys` | Opções de viagem entre dois pontos, com limite de caminhada |

O corpo de `POST /journeys` é `{ origin, destination, maxWalkMeters }`, onde origem e destino são lugares devolvidos por `/journeys/places` ou pontos escolhidos no mapa. Cada opção traz duração, horário de chegada, trocas, metros a pé, tarifa somada e os trechos (`walk`, `bus` ou `metro`) com seus traçados.

## Viagem compartilhada

| Método | Caminho | Uso no app |
|---|---|---|
| POST | `/rides` | Inicia uma viagem compartilhada vinculada a um ônibus e parada opcional de descida |
| GET | `/rides/:token` | Consulta o estado atual e o trajeto de uma viagem compartilhada |
| GET | `/rides/:token/stream` | Fluxo SSE com posições ao vivo da viagem compartilhada |
| DELETE | `/rides/:token` | Encerra a viagem compartilhada (via `Authorization: Bearer <ownerToken>`) |

## Erros

A API responde 400 para entradas inválidas, 404 para linhas ou paradas desconhecidas e 503 quando um fornecedor está indisponível. O frontend mostra a mensagem correspondente e, no caso dos ônibus, passa a consultar as posições periodicamente até o tempo real voltar.
