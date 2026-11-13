# Antiwalk

Rastreador e informador de horário de ônibus e metrô de Brasília (DF).

## Tecnologias
- Next.js (App Router) sobre Vinext (Vite)
- React 19 e TypeScript
- Tailwind CSS
- TanStack Query
- MapLibre GL JS com mapa do OpenFreeMap
- API própria (`websocket-serverDF`) com REST, WebSocket e SSE

## Chegadas e planejamento

- Posições de ônibus indicam a idade do GPS. Dados antigos ou sem horário não geram chegadas ao vivo; posições com mais de dois minutos saem do mapa.
- Selecione uma linha e uma parada no mapa, na lista ou no itinerário para consultar próximas chegadas. Horários programados aparecem separados das previsões com GPS recente. Outras linhas da mesma parada também aparecem quando possuem programação disponível.
- **Planejar viagem** pesquisa endereços, paradas/estações ou permite escolher pontos no mapa. Compara duração, caminhada e baldeações, com até duas trocas. Com Geoapify habilitado na API, trechos a pé mostram caminhos pelas ruas e orientações em português; caminhadas não verificadas são identificadas como aproximadas. Os traçados do transporte são aproximados e tarifas não aplicam integração.
- Ônibus usam programação por dia de serviço e tempos previstos entre paradas; feriados e atrasos podem mudar o resultado. Metrô só entra no planejamento quando há previsões recentes do mesmo trem em pelo menos duas estações. As posições de trens no mapa são estimadas.
- O servidor prepara a cobertura gradualmente e mantém a base salva. A interface informa quando a cobertura ainda está incompleta.

O planejador é carregado ao abrir. Consultas periódicas e assinaturas pausam com a página oculta; a preparação da rede fica no servidor. O app permite zoom do navegador, possui controles de toque de pelo menos 44 px nos novos painéis e navegação por teclado no planejador. O cache offline guarda arquivos da interface e itinerários com validade; não intercepta os fluxos ao vivo da API.

Validação: `npm test`, `npx tsc --noEmit` e `npm run build:vinext`.

## Geoapify + OpenFreeMap

O OpenFreeMap continua fornecendo o mapa. A chave `GEOAPIFY_API_KEY` deve ser configurada apenas no `.env` do projeto irmão `websocket-serverDF`; reinicie essa API após alterar a chave. O navegador consulta endereços e caminhos pelo servidor, sem receber a chave.

A busca de endereços espera 500 ms após a digitação, usa pelo menos três caracteres e mantém resultados recentes em cache. Consultas de planejamento acontecem ao tocar em **Comparar opções**. Trechos pelas ruas podem ser expandidos em **Ver orientações a pé**. O planejador considera seu tempo para recalcular os embarques. Geoapify e OpenStreetMap aparecem nos créditos dos resultados e do percurso; falhas não desabilitam a pesquisa de paradas/estações nem a seleção no mapa.
