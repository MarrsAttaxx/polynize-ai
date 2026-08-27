'use client';

import { useEffect, useState } from 'react';
import type { AutonomyLevel, Project, Task } from '@/lib/console-demo/types';
import { AGENTS, AGENT_BY_ID } from '@/lib/console-demo/seed';
import { AutonomyDial } from './AutonomyDial';
import { AgentAvatar } from './Avatar';
import { XIcon } from './Icons';
import s from '../console.module.css';
import m from './modal.module.css';

const PROJECT_COLORS = ['#69fccb', '#a5c1ec', '#f0e1b6', '#e8b85c', '#ff7a6b', '#f0b86b'];

export type CreateProjectPayload = {
  project: Project;
  starterTasks: Task[];
};

type Props = {
  onClose: () => void;
  onCreate: (payload: CreateProjectPayload) => void;
};

export function NewProjectModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [leadAgent, setLeadAgent] = useState<string>(AGENTS[0]?.id ?? '');
  const [autonomy, setAutonomy] = useState<AutonomyLevel>(1);
  const [priority, setPriority] = useState(6);
  const [objective, setObjective] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = () => {
    if (!name.trim()) return setError('Name is required.');
    if (!purpose.trim()) return setError('Purpose is required.');
    if (!leadAgent) return setError('Pick a lead agent.');
    setError(null);

    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
    const project: Project = {
      id,
      name: name.trim(),
      purpose: purpose.trim(),
      leadAgent,
      autonomy,
      status: 'active',
      priority,
      color,
      createdDaysAgo: 0,
      plan: {
        objective: objective.trim() || `Define the success criteria for ${name.trim()}.`,
        strategy: 'To be defined by the lead agent in the first round of proposals.',
        constraints: 'Inherit workspace defaults until partner overrides them.',
        priorities: 'TBD after first review pass.',
      },
    };

    const lead = AGENT_BY_ID[leadAgent];
    const starterTitles = [
      'Break down objective into ordered workstreams',
      'Produce a first-pass research index for the project',
      'Identify data gaps and dependencies',
    ];
    const starterTasks: Task[] = starterTitles.map((title, i) => ({
      id: `${id}_t${i}`,
      project: id,
      agent: lead?.id ?? leadAgent,
      title,
      status: 'proposed',
      urgency: 6,
      proposed_by: 'agent',
      created: 'just now',
    }));

    onCreate({ project, starterTasks });
  };

  return (
    <div className={m.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={m.panel} role="dialog" aria-label="New project">
        <header className={m.head}>
          <h2 className={m.title}>New project</h2>
          <button type="button" className={m.close} onClick={onClose} aria-label="Close modal">
            <XIcon width={14} height={14} />
          </button>
        </header>

        <div className={m.field}>
          <label className={m.label} htmlFor="np-name">Name</label>
          <input
            id="np-name"
            className={m.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morrison v. Cascade Holdings"
            autoFocus
          />
        </div>

        <div className={m.field}>
          <label className={m.label} htmlFor="np-purpose">Purpose</label>
          <textarea
            id="np-purpose"
            className={m.textarea}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="A sentence or two on the outcome the agent team is shaped around."
          />
        </div>

        <div className={m.field}>
          <label className={m.label}>Lead agent</label>
          <div className={m.agentPicker}>
            {AGENTS.map((ag) => (
              <button
                key={ag.id}
                type="button"
                className={`${m.agentChip} ${leadAgent === ag.id ? m.agentChipOn : ''}`}
                onClick={() => setLeadAgent(ag.id)}
              >
                <AgentAvatar agent={ag} size="sm" />
                <div>
                  <div className={m.agentChipName}>{ag.name}</div>
                  <div className={m.agentChipRole}>{ag.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={m.field}>
          <label className={m.label}>Autonomy</label>
          <AutonomyDial value={autonomy} onChange={setAutonomy} />
        </div>

        <div className={m.field}>
          <label className={m.label} htmlFor="np-priority">Priority</label>
          <div className={m.priorityRow}>
            <input
              id="np-priority"
              type="range"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className={m.prioritySlider}
            />
            <span className={m.priorityValue}>{priority}</span>
          </div>
        </div>

        <div className={m.field}>
          <label className={m.label} htmlFor="np-objective">Objective (optional)</label>
          <textarea
            id="np-objective"
            className={m.textarea}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="The agent team will draft the rest of the APEX Plan; you can edit it after."
          />
        </div>

        {error && <div className={m.error}>{error}</div>}

        <div className={m.actions}>
          <button type="button" className={s.btn} onClick={onClose}>Cancel</button>
          <button type="button" className={s.btnPrimary} onClick={handleSubmit}>
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}
