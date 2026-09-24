import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import {
  BookOpen,
  ChartColumn,
  CircleUserRound,
  GraduationCap,
  Home,
  LogOut,
  NotebookPen,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AppSidebar() {
  const { state, signOut } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = state.status === 'signed-in' ? state.user.role : null;
  const isTeacher = role === 'teacher' || role === 'admin';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/'}>
              <Link to="/">
                <Home />
                <span>
                  Ilham <span dir="rtl">إلهام</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Corpus</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={startsWithAny(pathname, ['/collections'])}>
                  <Link to="/collections">
                    <BookOpen />
                    <span>Collections</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/search'}>
                  <Link to="/search" search={{ q: '' }}>
                    <Search />
                    <span>Search</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={startsWithAny(pathname, ['/narrators'])}>
                  <Link to="/narrators" search={{ q: '' }}>
                    <Users />
                    <span>Narrators</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Study</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={startsWithAny(pathname, ['/circles'])}>
                  <Link to="/circles">
                    <GraduationCap />
                    <span>Circles</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={startsWithAny(pathname, ['/sets'])}>
                  <Link to="/sets">
                    <BookOpen />
                    <span>Study sets</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={startsWithAny(pathname, ['/notes'])}>
                  <Link to="/notes">
                    <NotebookPen />
                    <span>Notes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isTeacher ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={startsWithAny(pathname, ['/students'])}>
                    <Link to="/students">
                      <Users />
                      <span>Students</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={startsWithAny(pathname, ['/analytics'])}>
                  <Link to="/analytics">
                    <ChartColumn />
                    <span>Analytics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/me'}>
                  <Link to="/me">
                    <CircleUserRound />
                    <span>Account</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/settings'}>
                  <Link to="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {role === 'admin' ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === '/admin/verify'}>
                    <Link to="/admin/verify">
                      <ShieldCheck />
                      <span>Verify teachers</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {state.status === 'signed-in' ? (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/me">
                  <CircleUserRound />
                  <span>
                    {state.user.full_name} · {state.user.role}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                // The guards only re-run on navigation, so a bare signOut
                // would strand the visitor on a stale authed page.
                void signOut().finally(() => {
                  void router.navigate({ to: '/login' });
                });
              }}
            >
              <LogOut />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
