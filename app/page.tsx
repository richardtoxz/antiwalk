import TransitShell from "./components/TransitShell";

export const metadata = {
  title: "Transporte DF - Encontre linhas e estações",
  description:
    "Aplicativo de transporte público do Distrito Federal. Encontre linhas de ônibus, estações de metrô e planeje suas rotas.",
};

export default function Home() {
  return <TransitShell />;
}
