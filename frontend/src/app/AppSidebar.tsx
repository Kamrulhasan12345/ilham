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
import {
  Link,
  type LinkOptions,
  linkOptions,
  useRouter,
  useRouterState,
} from '@tanstack/react-router';
import {
  BookOpen,
  ChartColumn,
  CircleUserRound,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Library,
  LogOut,
  type LucideIcon,
  NotebookPen,
  Search,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { UserAvatar } from './UserAvatar';

type Role = 'student' | 'teacher' | 'admin';

interface NavItem {
  label: string;
  icon: LucideIcon;
  link: LinkOptions;
  /** Path prefixes that mark this item active; exact match when omitted. */
  prefixes?: string[];
  roles?: Role[];
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, link: linkOptions({ to: '/' }) },
      { label: 'My progress', icon: CircleUserRound, link: linkOptions({ to: '/me' }) },
    ],
  },
  {
    label: 'Corpus',
    items: [
      {
        label: 'Collections',
        icon: Library,
        link: linkOptions({ to: '/collections' }),
        prefixes: ['/collections', '/hadiths'],
      },
      { label: 'Search', icon: Search, link: linkOptions({ to: '/search', search: { q: '' } }) },
      {
        label: 'Narrators',
        icon: Users,
        link: linkOptions({ to: '/narrators', search: { q: '' } }),
        prefixes: ['/narrators'],
      },
    ],
  },
  {
    label: 'Study',
    items: [
      {
        label: 'Circles',
        icon: GraduationCap,
        link: linkOptions({ to: '/circles' }),
        prefixes: ['/circles', '/assignments'],
      },
      {
        label: 'Study sets',
        icon: Layers,
        link: linkOptions({ to: '/sets' }),
        prefixes: ['/sets'],
      },
      { label: 'Notes', icon: NotebookPen, link: linkOptions({ to: '/notes' }) },
      {
        label: 'Students',
        icon: UsersRound,
        link: linkOptions({ to: '/students' }),
        prefixes: ['/students'],
        roles: ['teacher', 'admin'],
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        label: 'Analytics',
        icon: ChartColumn,
        link: linkOptions({ to: '/analytics' }),
        prefixes: ['/analytics'],
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        label: 'Verify teachers',
        icon: ShieldCheck,
        link: linkOptions({ to: '/admin/verify' }),
        roles: ['admin'],
      },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (!item.prefixes) return pathname === item.link.to;
  return item.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AppSidebar() {
  const { state, signOut } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = state.status === 'signed-in' ? state.user : null;
  const role = user?.role as Role | undefined;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <BookOpen className="size-4" />
                </span>
                <span className="grid flex-1 text-start leading-tight">
                  <span className="truncate font-semibold">
                    Ilham{' '}
                    <span dir="rtl" lang="ar" className="font-arabic font-normal">
                      إلهام
                    </span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">Hadith study</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((group) => {
          const items = group.items.filter(
            (item) => !item.roles || (role && item.roles.includes(role)),
          );
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(pathname, item)}
                        tooltip={item.label}
                      >
                        <Link {...item.link}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip="Settings">
              <Link to="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
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
          {user ? (
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/me" aria-label={`${user.full_name} · ${user.role}`}>
                  <UserAvatar name={user.full_name} className="size-8" />
                  <span className="grid flex-1 text-start leading-tight">
                    <span className="truncate font-medium">{user.full_name}</span>
                    <span className="truncate text-xs text-muted-foreground capitalize">
                      {user.role}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
