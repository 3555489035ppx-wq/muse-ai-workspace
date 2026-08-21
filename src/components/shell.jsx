import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Archive, Boxes, ChevronDown, Compass, FlaskConical, FolderKanban, GalleryHorizontalEnd,
  Image, LayoutDashboard, Library, Menu, PanelRightClose, PanelRightOpen, Plus, Search, Settings,
  Sparkles, Trash2, X,
} from 'lucide-react';
import { stageLabel, workspaceSections } from '../data/catalog';
import { useMuseStore } from '../stores/useMuseStore';
import { Button, IconButton, StatusPill } from './ui';

const workspaceIcons = {
  overview: LayoutDashboard,
  brief: GalleryHorizontalEnd,
  research: Search,
  insight: Sparkles,
  direction: Compass,
  concept: Boxes,
  cmf: FlaskConical,
  review: GalleryHorizontalEnd,
  versions: Archive,
  'decision-map': Library,
};

const globalLinks = [
  ['/projects', '我的项目', FolderKanban],
  ['/templates', '模板中心', LayoutDashboard],
  ['/assets', '素材库', Image],
  ['/direction-library', '方向库', Library],
];

export function Brand() {
  return <NavLink className="brand" to="/projects" aria-label="返回 Muse 项目首页"><img className="brand__wordmark" src="/assets/brand/muse-handwritten-wordmark.jpg" alt="Muse"/></NavLink>;
}

export function SideNavigation({ project, open, onClose }) {
  const navigate = useNavigate();
  const pushToast = useMuseStore((state) => state.pushToast);
  const account = useMuseStore((state) => state.account);
  const [identityOpen, setIdentityOpen] = useState(false);
  const displayName = account?.displayName || '本地访客';
  return <aside className={`sidebar ${open ? 'sidebar--open' : ''}`} data-state={open ? 'open' : 'closed'}>
    <div className="sidebar__brand-row"><Brand/><IconButton label="关闭导航" className="sidebar__mobile-close" onClick={onClose}><X size={18}/></IconButton></div>
    <Button className="sidebar__new" icon={Plus} onClick={() => { navigate('/projects/new'); onClose?.(); }}>新建项目</Button>
    <nav className="sidebar__nav" aria-label="全局导航">
      {globalLinks.map(([path, label, Icon]) => <NavLink key={path} to={path} end={path === '/projects'} onClick={onClose}><Icon size={18}/>{label}</NavLink>)}
    </nav>
    <div className="sidebar__section"><p>项目工作区</p>
      {project ? <button className="project-switcher" onClick={() => navigate(`/projects/${project.id}/overview`)}><span className="project-switcher__thumb" style={project.coverImage ? { backgroundImage: `url("${project.coverImage}")` } : undefined}/><span><strong>{project.name}</strong><small>{stageLabel[project.stage] ?? '工业设计项目'}</small></span><ChevronDown size={15}/></button> : <div className="sidebar__project-empty"><strong>尚未打开项目</strong><span>从“我的项目”打开或新建一个项目</span></div>}
      <nav className="sidebar__nav" aria-label="项目工作区导航">
        {workspaceSections.map(([key, label]) => {
          const Icon = workspaceIcons[key];
          return project
            ? <NavLink key={key} to={`/projects/${project.id}/${key}`} onClick={onClose}><Icon size={18}/>{label}</NavLink>
            : <span data-tour={key === 'research' ? 'research' : key === 'moodboard' ? 'moodboard' : key === 'directions' ? 'direction' : key === 'critique' ? 'critique' : undefined} className="sidebar__disabled" key={key} aria-disabled="true"><Icon size={18}/>{label}</span>;
        })}
      </nav>
    </div>
    <div className="sidebar__footer">
      <NavLink to="/settings" data-tour="provider"><Settings size={18}/>设置</NavLink>
      <NavLink to="/trash"><Trash2 size={18}/>回收站</NavLink>
      <button onClick={() => setIdentityOpen((value) => !value)}><span className="avatar">{displayName.slice(0, 1)}</span><span>{displayName}</span><ChevronDown size={15}/></button>
      {identityOpen ? <div className="identity-card"><strong>{displayName}</strong><span>本地账号 · 数据保存在当前浏览器</span><NavLink to="/account" onClick={() => { setIdentityOpen(false); onClose?.(); }}>管理账号与素材库</NavLink><button onClick={() => { setIdentityOpen(false); pushToast('已保持本地工作模式', 'neutral'); }}>继续本地使用</button></div> : null}
    </div>
  </aside>;
}

function pageTitle(pathname, project) {
  if (pathname === '/projects') return '我的项目';
  if (pathname === '/templates') return '模板中心';
  if (pathname === '/assets') return '素材库';
  if (pathname === '/direction-library') return '方向库';
  if (pathname === '/settings') return '设置';
  if (pathname === '/account') return '账号与素材库';
  if (pathname === '/trash') return '回收站';
  if (pathname.endsWith('/brief')) return '确认项目简报';
  const section = workspaceSections.find(([key]) => pathname.includes(`/${key}`));
  return section ? section[1] : project?.name ?? 'Muse';
}

export function Topbar({ project, onOpenNavigation, contextOpen, onToggleContext }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return <header className="topbar liquid-glass-surface">
    <div className="topbar__leading"><IconButton label="打开导航" className="topbar__menu" onClick={onOpenNavigation}><Menu size={19}/></IconButton><div><span className="topbar__eyebrow">{project ? project.name : 'Muse 创意方向工作台'}</span><strong>{pageTitle(pathname, project)}</strong></div>{project ? <StatusPill status="ai">{stageLabel[project.stage] ?? '进行中'}</StatusPill> : null}</div>
    <div className="topbar__actions">{onToggleContext ? <IconButton label={contextOpen ? '收起辅助面板' : '展开辅助面板'} selected={contextOpen} onClick={onToggleContext}>{contextOpen ? <PanelRightClose size={18}/> : <PanelRightOpen size={18}/>}</IconButton> : null}<Button data-tour="create" icon={Plus} onClick={() => navigate('/projects/new')}>新建项目</Button></div>
  </header>;
}

/**
 * @param {{ project?: object | null, children?: import('react').ReactNode, context?: import('react').ReactNode | null, mode?: string | null }} props
 */
export function AppShell({ project: projectProp = null, children, context = null, mode = null }) {
  const { projectId } = useParams();
  const { pathname, search } = useLocation();
  const routeProject = useMuseStore((state) => projectId ? state.projects.find((item) => item.id === projectId) : null);
  const project = projectProp ?? routeProject ?? null;
  const [navOpen, setNavOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(() => !context || typeof window === 'undefined' || window.matchMedia('(min-width: 1281px)').matches);
  const previousViewportWidth = useRef(typeof window === 'undefined' ? 0 : window.innerWidth);
  useEffect(() => {
    // Industrial pages need the complete decision navigation. A compact class can
    // persist from the global shell and otherwise collapses the active project flow.
    if (mode === 'industrial') document.body.classList.remove('nav-compact');
  }, [mode]);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);
  useEffect(() => {
    if (!context) return undefined;
    const syncContextToViewport = () => {
      const currentWidth = window.innerWidth;
      const previousWidth = previousViewportWidth.current;
      if (previousWidth <= 1280 && currentWidth > 1280) setContextOpen(true);
      if (previousWidth > 1280 && currentWidth <= 1280) setContextOpen(false);
      previousViewportWidth.current = currentWidth;
    };
    window.addEventListener('resize', syncContextToViewport);
    return () => window.removeEventListener('resize', syncContextToViewport);
  }, [context]);
  useEffect(() => {
    if (!contextOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && window.matchMedia('(max-width: 1280px)').matches) setContextOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [contextOpen]);
  return <div className={`app-shell ${mode ? `app-shell--${mode}` : ''} ${context ? 'app-shell--with-context' : ''} ${context && !contextOpen ? 'app-shell--context-collapsed' : ''}`}>
    <SideNavigation project={project} open={navOpen} onClose={() => setNavOpen(false)}/>
    {navOpen ? <button className="sidebar-scrim" aria-label="关闭导航" onClick={() => setNavOpen(false)}/> : null}
    <div className="app-shell__main"><Topbar project={project} onOpenNavigation={() => setNavOpen(true)} contextOpen={contextOpen} onToggleContext={context ? () => setContextOpen((value) => !value) : null}/><main className="app-shell__content">{children}</main></div>
    {context ? <aside className="context-panel liquid-glass-surface" aria-label="项目辅助面板" data-state={contextOpen ? 'open' : 'closed'} aria-hidden={!contextOpen}><button className="context-panel__collapse" aria-label="收起辅助面板" onClick={() => setContextOpen(false)}><PanelRightClose size={16}/></button>{context}</aside> : null}
  </div>;
}

export function GlobalTopNav() {
  return <header className="global-top"><Brand/><nav>{globalLinks.map(([path, label]) => <NavLink key={path} to={path} end={path === '/projects'}>{label}</NavLink>)}</nav><Button icon={Plus} onClick={() => location.assign('/projects/new')}>新建项目</Button></header>;
}
