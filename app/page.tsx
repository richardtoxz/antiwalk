import Map from "./components/Map";
import SearchBar from "./components/SearchBar";
import BottomSheet from "./components/BottomSheet";

export const metadata = {
  title: "Transporte DF - Encontre linhas e estações",
  description:
    "Aplicativo de transporte público do Distrito Federal. Encontre linhas de ônibus, estações de metrô e planeje suas rotas.",
};

export default function Home() {
  return (
    <main className="relative w-full h-dvh overflow-hidden bg-background">
      {/* Skip to content link for accessibility */}
      <a
        href="#bottom-sheet"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
      >
        Pular para o conteúdo principal
      </a>

      {/* Main Map Background */}
      <div className="absolute inset-0 z-0">
        <Map />
      </div>

      {/* Search Header Overlay */}
      <SearchBar />

      {/* Bottom Sheet Overlay */}
      <div id="bottom-sheet">
        <BottomSheet />
      </div>
    </main>
  );
}
