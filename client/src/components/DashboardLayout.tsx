import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BookOpen, ChartNoAxesCombined, CircleDotDashed, LayoutDashboard, LogIn, LogOut, PanelLeft, ScanSearch, ShieldCheck, Waves } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Operations", path: "/" },
  { icon: ScanSearch, label: "OpenCV workspace", path: "/preprocess" },
  { icon: ChartNoAxesCombined, label: "Argo validation", path: "/validation" },
  { icon: ShieldCheck, label: "Agentic QA", path: "/qa" },
  { icon: BookOpen, label: "Reproducibility", path: "/reproducibility" },
];

const SIDEBAR_WIDTH_KEY = "oceanembed-sidebar-width";
const DEFAULT_WIDTH = 264;
const MIN_WIDTH = 224;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children, requireAuth = false }: { children: React.ReactNode; requireAuth?: boolean }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();

  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()), [sidebarWidth]);

  if (requireAuth && loading) return <div className="min-h-screen grid place-items-center text-slate-300">Loading operations workspace…</div>;
  if (requireAuth && !user) {
    return <div className="min-h-screen grid place-items-center bg-[#071823] p-6"><div className="glass-panel max-w-md p-8 text-center"><Waves className="mx-auto mb-5 text-cyan-300" /><h1 className="text-2xl font-semibold">Access protected operations</h1><p className="mt-3 text-sm text-slate-400">Sign in to access private datasets, thresholds, and delivery history.</p><Button onClick={() => startLogin()} className="mt-6 w-full">Sign in</Button></div></div>;
  }

  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - left;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const stop = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", stop);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const activeLabel = menuItems.find(item => item.path === location)?.label ?? "OceanEmbed";

  return <>
    <div className="relative" ref={sidebarRef}>
      <Sidebar collapsible="icon" className="ocean-sidebar border-r-0" disableTransition={isResizing}>
        <SidebarHeader className="h-[82px] justify-center px-3">
          <div className="flex w-full items-center gap-3">
            <button onClick={toggleSidebar} aria-label="Toggle navigation" className="icon-button"><PanelLeft size={17} /></button>
            {!isCollapsed && <div className="min-w-0"><div className="flex items-center gap-2"><div className="brand-mark"><Waves size={17} /></div><span className="font-semibold tracking-tight text-white">OceanEmbed</span></div><p className="mt-1 pl-9 text-[10px] uppercase tracking-[0.16em] text-cyan-200/55">Decision support</p></div>}
          </div>
        </SidebarHeader>
        <SidebarContent className="pt-5">
          {!isCollapsed && <p className="px-5 pb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Workspace</p>}
          <SidebarMenu className="px-3">
            {menuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="ocean-nav-item h-11"><item.icon size={17} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}
          </SidebarMenu>
          <div className="mx-4 mt-8 rounded-xl border border-cyan-200/10 bg-cyan-300/[0.045] p-3 group-data-[collapsible=icon]:hidden"><div className="flex items-center gap-2 text-xs font-medium text-cyan-100"><CircleDotDashed size={14} className="text-cyan-300" /> Curated historical scene</div><p className="mt-1.5 text-[11px] leading-5 text-slate-400">Real OISST, Argo, HYCOM and OpenCV 5 evidence; visibly separated from live operations.</p></div>
        </SidebarContent>
        <SidebarFooter className="p-3">
          {user ? <DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.05]"><Avatar className="h-8 w-8 border border-white/10"><AvatarFallback className="bg-cyan-300/10 text-xs text-cyan-100">{user.name?.charAt(0).toUpperCase() ?? "O"}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs text-slate-200">{user.name || "Project owner"}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">Owner controls</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout}><LogOut size={14} className="mr-2" /> Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : <Button onClick={() => startLogin()} variant="outline" className="w-full border-white/10 bg-white/[0.03] text-xs text-slate-300 hover:bg-white/[0.08] group-data-[collapsible=icon]:px-2"><LogIn size={14} /><span className="group-data-[collapsible=icon]:hidden">Owner sign in</span></Button>}
        </SidebarFooter>
      </Sidebar>
      <div className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-cyan-300/35 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} />
    </div>
    <SidebarInset className="ocean-shell min-w-0">{isMobile && <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-white/10 bg-[#071823]/95 px-3 backdrop-blur"><SidebarTrigger className="text-slate-200" /><span className="text-sm text-slate-100">{activeLabel}</span></div>}<main className="min-h-screen">{children}</main></SidebarInset>
  </>;
}
