import { writable, derived } from 'svelte/store';
import type { AgentInfo, AgentStatusUpdate } from '$types/agent';
import { AgentRole, AgentStatus } from '$types/agent';

interface AgentState {
  agents: Map<string, AgentInfo>;
  leaderAgent: string | null;
  selectedAgent: string | null;
}

const defaultState: AgentState = {
  agents: new Map(),
  leaderAgent: null,
  selectedAgent: null,
};

function createAgentStore() {
  const { subscribe, set, update } = writable<AgentState>(defaultState);

  return {
    subscribe,

    addAgent: (agent: AgentInfo) => {
      update(state => {
        const agents = new Map(state.agents);
        agents.set(agent.id, agent);
        const leaderAgent = agent.role === AgentRole.Leader ? agent.id : state.leaderAgent;
        return { ...state, agents, leaderAgent };
      });
    },

    removeAgent: (id: string) => {
      update(state => {
        const agents = new Map(state.agents);
        agents.delete(id);
        return {
          ...state,
          agents,
          leaderAgent: state.leaderAgent === id ? null : state.leaderAgent,
          selectedAgent: state.selectedAgent === id ? null : state.selectedAgent,
        };
      });
    },

    updateAgentStatus: (statusUpdate: AgentStatusUpdate) => {
      update(state => {
        const agents = new Map(state.agents);
        const agent = agents.get(statusUpdate.agentId);
        if (agent) {
          agents.set(statusUpdate.agentId, {
            ...agent,
            status: statusUpdate.status,
            currentTask: statusUpdate.currentTask ?? agent.currentTask,
            progress: statusUpdate.progress ?? agent.progress,
            metrics: statusUpdate.metrics ? { ...agent.metrics, ...statusUpdate.metrics } : agent.metrics,
            updatedAt: new Date(),
          });
        }
        return { ...state, agents };
      });
    },

    setSelectedAgent: (id: string | null) => {
      update(state => ({ ...state, selectedAgent: id }));
    },

    setLeaderAgent: (id: string) => {
      update(state => {
        const agents = new Map(state.agents);
        const agent = agents.get(id);
        if (agent) {
          agents.set(id, { ...agent, role: AgentRole.Leader });
          if (state.leaderAgent && state.leaderAgent !== id) {
            const oldLeader = agents.get(state.leaderAgent);
            if (oldLeader) {
              agents.set(state.leaderAgent, { ...oldLeader, role: AgentRole.Coder });
            }
          }
        }
        return { ...state, agents, leaderAgent: id };
      });
    },

    initDefaultLeader: () => {
      update(state => {
        if (state.leaderAgent) return state;
        const leaderId = 'leader-default';
        const leader: AgentInfo = {
          id: leaderId,
          name: 'Leader Agent',
          role: AgentRole.Leader,
          status: AgentStatus.Idle,
          model: 'claude-3-opus',
          progress: 0,
          metrics: {
            tasksCompleted: 0,
            tasksFailed: 0,
            averageResponseTime: 0,
            totalTokensUsed: 0,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const agents = new Map(state.agents);
        agents.set(leaderId, leader);
        return { ...state, agents, leaderAgent: leaderId };
      });
    },

    reset: () => set(defaultState),
  };
}

export const agentStore = createAgentStore();

export const agentList = derived(agentStore, $agent =>
  Array.from($agent.agents.values())
);

export const leaderAgent = derived(agentStore, $agent => {
  if (!$agent.leaderAgent) return null;
  return $agent.agents.get($agent.leaderAgent) || null;
});

export const selectedAgent = derived(agentStore, $agent => {
  if (!$agent.selectedAgent) return null;
  return $agent.agents.get($agent.selectedAgent) || null;
});

export const activeAgents = derived(agentStore, $agent =>
  Array.from($agent.agents.values()).filter(a => a.status === AgentStatus.Active || a.status === AgentStatus.Thinking)
);
