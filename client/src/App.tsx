import { Toaster } from "@/components/ui/sonner";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Home, PreprocessPage, QaPage, ReproducibilityPage, ValidationPage } from "./pages/Home";
import { Route, Switch } from "wouter";

function Router() {
  return <DashboardLayout><Switch><Route path="/" component={Home} /><Route path="/preprocess" component={PreprocessPage} /><Route path="/validation" component={ValidationPage} /><Route path="/qa" component={QaPage} /><Route path="/reproducibility" component={ReproducibilityPage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></DashboardLayout>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><Router /><Toaster theme="dark" /></ThemeProvider></ErrorBoundary>;
}
