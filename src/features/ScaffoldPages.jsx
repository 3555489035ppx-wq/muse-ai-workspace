import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, FileCheck2, Sparkles } from 'lucide-react';
import { AppShell } from '../components/shell';
import { Button, EmptyState, Surface } from '../components/ui';
import { useMuseStore } from '../stores/useMuseStore';
import { MissingProject } from './projects/ProjectPages';

const content = {
  workspace: ['项目概览', '把研究、素材与判断放在同一张画布上。', '从研究开始', 'research'],
  research: ['研究', '建立带来源的研究证据，再把判断带入情绪板与创意方向。', '添加研究条目', 'research'],
  moodboard: ['情绪板', '收集、整理并分析视觉素材，形成可解释的视觉证据。', '添加第一批素材', 'moodboard'],
  directions: ['创意方向', '生成多个可比较的方向，并保留人工选择与融合权。', '生成方向', 'directions'],
  exploration: ['视觉探索', '围绕锁定方向生成多版方案并持续细化。', '开始视觉探索', 'exploration'],
  critique: ['AI 评审', '按照项目目标、差异性与可落地性输出可解释评审。', '开始评审', 'critique'],
  versions: ['版本记录', '保存关键决策与迭代分支，让设计过程可回溯。', '保存当前版本', 'versions'],
};

export function ProjectScaffoldPage({ section }) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const project = useMuseStore((state) => state.projects.find((item) => item.id === projectId));
  if (!project) return <MissingProject/>;
  const [title, description, action] = content[section];
  return <AppShell project={project} context={<><div className="context-title"><Sparkles size={20}/><h2>AI 创意导师</h2></div><p className="context-subtitle">当前项目没有自动填充内容。Muse 会基于你主动添加的资料给出下一步建议。</p><Surface title="建议路径"><ul className="plain-list"><li>先补充与命题直接相关的证据</li><li>区分事实、观察与主观判断</li><li>再进入方向生成与比较</li></ul></Surface></>}><div className="feature-page"><header className="page-heading"><p>项目工作区</p><h1>{title}</h1><span>{description}</span></header><EmptyState title={`${title}还是空的`} description="这里不会自动创建示例数据。你可以返回简报核对目标与约束。" action={<Button icon={FileCheck2} onClick={() => navigate(`/projects/${projectId}/brief`)}>查看项目简报</Button>}/>{section !== 'research' ? <Link className="next-inline" to={`/projects/${projectId}/research`}>先去补充研究证据<ArrowRight size={15}/></Link> : null}</div></AppShell>;
}

const globalInfo = {
  templates: ['模板中心', '选择模板只会预填通用结构，不会生成示例项目。'],
  assets: ['素材库', '跨项目管理你主动上传或收藏的视觉素材。'],
  'direction-library': ['方向库', '统一查看收藏、归档与可复用的创意方向。'],
  settings: ['设置', '管理本地偏好、数据导入导出与服务配置。'],
  trash: ['回收站', '查看并恢复已移除的项目与资源。'],
};

export function GlobalScaffoldPage({ section }) {
  const [title, description] = globalInfo[section];
  return <AppShell><div className="feature-page"><header className="page-heading"><p>全局资源</p><h1>{title}</h1><span>{description}</span></header><EmptyState title={`${title}暂无内容`} description="此页面与项目内页面相互独立，不会自动跳转到任意项目。" action={section === 'templates' ? <Link className="button button--default" to="/projects/new">新建空白项目</Link> : null}/></div></AppShell>;
}
