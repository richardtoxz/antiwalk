# Antiwalk

Rastreador e informador de horários de ônibus e metrô de Brasília (DF). Mostra no mapa onde os veículos estão, quando chegam a cada parada e como ir de um ponto a outro usando o transporte público.

## O que faz

- **Mapa ao vivo**: ônibus e trens do metrô posicionados no mapa, com a idade de cada posição de GPS.
- **Próximas chegadas**: previsões por parada ou estação, separando horários programados de previsões com GPS recente.
- **Planejamento de viagem**: compara opções por duração, caminhada e baldeações, com até duas trocas, combinando ônibus, metrô e trechos a pé.
- **Busca**: linhas, paradas, estações e endereços.
- **PWA**: pode ser instalado no celular e mantém a interface e os itinerários recentes disponíveis sem conexão.
- **Tema claro e escuro**, navegação por teclado e controles de toque de pelo menos 44 px.

## Como funciona

O Antiwalk é a interface. Os dados vêm de uma API própria, o projeto `websocket-serverDF`, que reúne as fontes do Metrô-DF e dos ônibus do Distrito Federal e as entrega em um formato único.

- **Dados ao vivo**: as posições chegam por WebSocket e SSE. Se a conexão falha, a interface passa a consultar a API em intervalos e avisa que os dados podem estar atrasados.
- **Qualidade das posições**: cada posição é classificada pela idade do GPS. Posições antigas não geram previsão ao vivo, e as com mais de dois minutos saem do mapa.
- **Metrô**: as posições dos trens são estimadas a partir das previsões de chegada em cada estação.
- **Planejamento**: o cálculo acontece no servidor, que prepara a rede de linhas e paradas. Ônibus usam a programação por dia de serviço; o metrô entra quando há previsões recentes do mesmo trem em pelo menos duas estações.
- **Endereços e caminhadas**: a busca de endereços e os trechos a pé pelas ruas usam o Geoapify, sempre por meio do servidor.
- **Economia de dados e bateria**: consultas periódicas e assinaturas pausam quando a página está oculta, e a busca de endereços aguarda a digitação terminar.
- **Offline**: o service worker guarda os arquivos da interface e os itinerários com validade. Os fluxos ao vivo nunca passam pelo cache.

## Tecnologias

- Next.js (App Router) sobre Vinext (Vite)
- React 19 e TypeScript
- Tailwind CSS
- TanStack Query
- MapLibre GL JS com mapa do OpenFreeMap
- WebSocket e SSE para dados em tempo real
- Geoapify para endereços e rotas a pé

## Limitações dos dados

- Os traçados do transporte entre paradas são aproximados, e caminhadas sem confirmação pelas ruas aparecem identificadas como aproximadas.
- As tarifas não aplicam descontos de integração.
- Feriados e atrasos podem alterar os horários programados.
- A interface informa quando os dados estão antigos, incompletos ou indisponíveis.

Dados de mapa © OpenStreetMap, com OpenFreeMap e Geoapify.
