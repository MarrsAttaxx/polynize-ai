'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApexPlan as ApexPlanT,
  AutonomyLevel,
  PersistedState,
  Tab,
  TaskStatus,
  Tweaks,
} from '@/lib/console-demo/types';
import { DEFAULT_TWEAKS } from '@/lib/console-demo/constants';
import {
  AGENTS,
  AGENT_BY_ID,
  HUMANS,
  PROJECTS,
  SEED_ACTIVITY,
  TASKS,
} from '@/lib/console-demo/seed';
import { loadPersisted, savePersisted, clearPersisted, SEED_STATE } from '@/lib/console-demo/persist';
import { simulationTick } from '@/lib/console-demo/simulation';
import { Shell } from './Shell';
import { TweaksPanel } from './TweaksPanel';
import { Dashboard } from './Dashboard';
import { ProjectsList } from './ProjectsList';
import { ProjectDetail } from './ProjectDetail';
import { AgentsList } from './AgentsList';
import { AgentDetail } from './AgentDetail';
import { HumansList } from './HumansList';
import { NewProjectModal, type CreateProjectPayload } from './NewProjectModal';
import s from '../console.module.css';

export function ConsoleApp() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [projects, setProjects] = useState(PROJECTS);
  const [tasks, setTasks] = useState(TASKS);
  const [activity, setActivity] = useState(SEED_ACTIVITY);
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULT_TWEAKS);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  // Only the setter is read from here; hydratedRef below carries the value.
  const [, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) {
      setTab(persisted.tab);
      setOpenProjectId(persisted.openProjectId);
      setOpenAgentId(persisted.openAgentId);
      setProjects(persisted.projects);
      setTasks(persisted.tasks);
      setActivity(persisted.activity);
      setTweaks(persisted.tweaks);
    }
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!hydratedRef.current) return;
    const state: PersistedState = {
      tab,
      openProjectId,
      openAgentId,
      projects,
      tasks,
      activity,
      tweaks,
    };
    savePersisted(state);
  }, [tab, openProjectId, openAgentId, projects, tasks, activity, tweaks]);

  // Clear isNew flags shortly after insertion so the entry animation runs once
  useEffect(() => {
    if (!activity.some((a) => a.isNew)) return;
    const timer = window.setTimeout(() => {
      setActivity((prev) => prev.map((a) => (a.isNew ? { ...a, isNew: false } : a)));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activity]);

  // 12s simulation tick — single interval, reads current state via refs
  const tasksRef = useRef(tasks);
  const activityRef = useRef(activity);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { activityRef.current = activity; }, [activity]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      const result = simulationTick(tasksRef.current, activityRef.current);
      setTasks(result.tasks);
      setActivity(result.activity);
    }, 12_000);
    return () => window.clearInterval(interval);
  }, []);

  const pendingApprovals = useMemo(
    () => tasks.filter((t) => t.status === 'proposed').length,
    [tasks]
  );

  const handleTabChange = useCallback((next: Tab) => {
    setTab(next);
    setOpenProjectId(null);
    setOpenAgentId(null);
  }, []);

  const handleTweaksChange = useCallback((patch: Partial<Tweaks>) => {
    setTweaks((prev) => {
      const next = { ...prev, ...patch };
      // global autonomy propagates to all projects
      if (patch.autonomy !== undefined && patch.autonomy !== prev.autonomy) {
        setProjects((prevProjects) =>
          prevProjects.map((p) => ({ ...p, autonomy: patch.autonomy! }))
        );
      }
      return next;
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTweaks((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const handleSimulate = useCallback(() => {
    const result = simulationTick(tasks, activity, 'propose');
    setTasks(result.tasks);
    setActivity(result.activity);
  }, [tasks, activity]);

  // Task action — approve/reject a proposed task, or move between columns
  const taskAction = useCallback(
    (taskId: string, action: 'approve' | 'reject' | 'move', arg?: TaskStatus) => {
      setTasks((prev) => {
        const target = prev.find((t) => t.id === taskId);
        if (!target) return prev;
        const agent = AGENT_BY_ID[target.agent];
        const actor = agent?.name ?? 'Agent';

        if (action === 'approve') {
          setActivity((a) => [
            { kind: 'approved' as const, actor: 'Evelyn Harrow', text: `approved ${target.title}`, project: target.project, ago: 'now', isNew: true },
            ...a,
          ].slice(0, 40));
          return prev.map((t) => (t.id === taskId ? { ...t, status: 'todo' as const } : t));
        }
        if (action === 'reject') {
          setActivity((a) => [
            { kind: 'proposed' as const, actor: 'Evelyn Harrow', text: `rejected ${target.title}`, project: target.project, ago: 'now', isNew: true },
            ...a,
          ].slice(0, 40));
          return prev.filter((t) => t.id !== taskId);
        }
        if (action === 'move' && arg) {
          if (target.status !== arg) {
            const kind: 'done' | 'doing' | 'plan' = arg === 'done' ? 'done' : arg === 'doing' ? 'doing' : 'plan';
            setActivity((a) => [
              { kind, actor, text: `moved ${target.title} to ${arg}`, project: target.project, ago: 'now', isNew: true },
              ...a,
            ].slice(0, 40));
          }
          return prev.map((t) => (t.id === taskId ? { ...t, status: arg } : t));
        }
        return prev;
      });
    },
    []
  );

  const handleApproveAll = useCallback(
    (projectId: string) => {
      setTasks((prev) => {
        const toApprove = prev.filter((t) => t.project === projectId && t.status === 'proposed');
        if (toApprove.length === 0) return prev;
        setActivity((a) => [
          {
            kind: 'approved' as const,
            actor: 'Evelyn Harrow',
            text: `approved ${toApprove.length} proposed ${toApprove.length === 1 ? 'task' : 'tasks'}`,
            project: projectId,
            ago: 'now',
            isNew: true,
          },
          ...a,
        ].slice(0, 40));
        return prev.map((t) =>
          t.project === projectId && t.status === 'proposed' ? { ...t, status: 'todo' as const } : t
        );
      });
    },
    []
  );

  const handleUpdatePlan = useCallback(
    (projectId: string, plan: ApexPlanT) => {
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, plan } : p)));
      setActivity((a) => {
        const proj = projects.find((pp) => pp.id === projectId);
        if (!proj) return a;
        return [
          { kind: 'plan' as const, actor: 'Evelyn Harrow', text: `updated APEX Plan for ${proj.name}`, project: projectId, ago: 'now', isNew: true },
          ...a,
        ].slice(0, 40);
      });
    },
    [projects]
  );

  const handleUpdateAutonomy = useCallback(
    (projectId: string, next: AutonomyLevel) => {
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, autonomy: next } : p)));
    },
    []
  );

  const handleCreateProject = useCallback(
    ({ project, starterTasks }: CreateProjectPayload) => {
      setProjects((prev) => [...prev, project]);
      setTasks((prev) => [...starterTasks, ...prev]);
      const lead = AGENT_BY_ID[project.leadAgent];
      const actor = lead?.name ?? 'Agent';
      setActivity((prev) => [
        {
          kind: 'plan' as const,
          actor: 'Evelyn Harrow',
          text: `created ${project.name}`,
          project: project.id,
          ago: 'now',
          isNew: true,
        },
        {
          kind: 'proposed' as const,
          actor,
          text: `proposed ${starterTasks.length} starter tasks for ${project.name}`,
          project: project.id,
          ago: 'now',
          isNew: true,
        },
        ...prev,
      ].slice(0, 40));
      setTab('projects');
      setOpenProjectId(project.id);
      setModalOpen(false);
    },
    []
  );

  const handleReset = useCallback(() => {
    clearPersisted();
    setTab(SEED_STATE.tab);
    setOpenProjectId(null);
    setOpenAgentId(null);
    setProjects(SEED_STATE.projects);
    setTasks(SEED_STATE.tasks);
    setActivity(SEED_STATE.activity);
    setTweaks(SEED_STATE.tweaks);
    setTweaksOpen(false);
  }, []);

  // Keyboard: Esc closes tweaks/modal (drawer manages its own Esc handler)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTweaksOpen(false);
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className={`${s.root} ${tweaks.theme === 'light' ? 'theme-light' : ''}`}
      data-console-depth={tweaks.depth}
      data-console-density={tweaks.density}
    >
      <Shell
        activeTab={tab}
        onTabChange={handleTabChange}
        pendingApprovals={pendingApprovals}
        theme={tweaks.theme}
        onToggleTheme={handleToggleTheme}
        projectCount={projects.length}
        agentCount={4}
        humanCount={5}
      />

      <main className={s.main}>
        {tab === 'dashboard' && (
          <Dashboard
            projects={projects}
            tasks={tasks}
            activity={activity}
            agents={AGENTS}
            onOpenProject={(id) => {
              setTab('projects');
              setOpenProjectId(id);
            }}
            onOpenAgent={(id) => {
              setTab('agents');
              setOpenAgentId(id);
            }}
            onNewProject={() => setModalOpen(true)}
          />
        )}
        {tab === 'projects' && !openProjectId && (
          <ProjectsList
            projects={projects}
            tasks={tasks}
            onOpenProject={(id) => setOpenProjectId(id)}
            onNewProject={() => setModalOpen(true)}
          />
        )}
        {tab === 'projects' && openProjectId && (() => {
          const project = projects.find((p) => p.id === openProjectId);
          if (!project) return null;
          return (
            <ProjectDetail
              project={project}
              tasks={tasks}
              onBack={() => setOpenProjectId(null)}
              onUpdatePlan={(plan) => handleUpdatePlan(openProjectId, plan)}
              onUpdateAutonomy={(next) => handleUpdateAutonomy(openProjectId, next)}
              onTaskAction={taskAction}
              onApproveAll={() => handleApproveAll(openProjectId)}
            />
          );
        })()}
        {tab === 'agents' && (
          <AgentsList agents={AGENTS} tasks={tasks} onOpen={(id) => setOpenAgentId(id)} />
        )}
        {tab === 'humans' && <HumansList humans={HUMANS} />}
      </main>

      {openAgentId && (() => {
        const agent = AGENTS.find((a) => a.id === openAgentId);
        if (!agent) return null;
        return (
          <AgentDetail
            agent={agent}
            tasks={tasks}
            onClose={() => setOpenAgentId(null)}
            onOpenTask={(_taskId, projectId) => {
              setOpenAgentId(null);
              setTab('projects');
              setOpenProjectId(projectId);
            }}
          />
        );
      })()}

      {modalOpen && (
        <NewProjectModal onClose={() => setModalOpen(false)} onCreate={handleCreateProject} />
      )}

      <TweaksPanel
        open={tweaksOpen}
        tweaks={tweaks}
        onToggle={() => setTweaksOpen((v) => !v)}
        onChange={handleTweaksChange}
        onSimulate={handleSimulate}
        onReset={handleReset}
      />
    </div>
  );
}
