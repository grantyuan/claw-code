import { writable, derived } from 'svelte/store';
import type { TaskInfo, TaskUpdate } from '$types/task';
import { TaskStatus } from '$types/task';

interface TaskState {
  tasks: Map<string, TaskInfo>;
  activeTasks: string[];
  pendingTasks: string[];
  completedTasks: string[];
}

const defaultState: TaskState = {
  tasks: new Map(),
  activeTasks: [],
  pendingTasks: [],
  completedTasks: [],
};

function createTaskStore() {
  const { subscribe, set, update } = writable<TaskState>(defaultState);

  const categorizeTask = (task: TaskInfo): 'active' | 'pending' | 'completed' => {
    if (task.status === TaskStatus.Running) return 'active';
    if (task.status === TaskStatus.Pending) return 'pending';
    return 'completed';
  };

  const updateLists = (state: TaskState): TaskState => {
    const activeTasks: string[] = [];
    const pendingTasks: string[] = [];
    const completedTasks: string[] = [];

    state.tasks.forEach((task, id) => {
      const category = categorizeTask(task);
      if (category === 'active') activeTasks.push(id);
      else if (category === 'pending') pendingTasks.push(id);
      else completedTasks.push(id);
    });

    return { ...state, activeTasks, pendingTasks, completedTasks };
  };

  return {
    subscribe,

    addTask: (task: TaskInfo) => {
      update(state => {
        const tasks = new Map(state.tasks);
        tasks.set(task.id, task);
        return updateLists({ ...state, tasks });
      });
    },

    removeTask: (id: string) => {
      update(state => {
        const tasks = new Map(state.tasks);
        tasks.delete(id);
        return updateLists({ ...state, tasks });
      });
    },

    updateTask: (taskUpdate: TaskUpdate) => {
      update(state => {
        const tasks = new Map(state.tasks);
        const task = tasks.get(taskUpdate.taskId);
        if (task) {
          const updatedTask: TaskInfo = {
            ...task,
            status: taskUpdate.status ?? task.status,
            progress: taskUpdate.progress ?? task.progress,
            assignedAgent: taskUpdate.assignedAgent ?? task.assignedAgent,
            result: taskUpdate.result ?? task.result,
            completedAt: taskUpdate.status === TaskStatus.Completed || taskUpdate.status === TaskStatus.Failed
              ? new Date()
              : task.completedAt,
          };
          tasks.set(taskUpdate.taskId, updatedTask);
        }
        return updateLists({ ...state, tasks });
      });
    },

    cancelTask: (id: string) => {
      update(state => {
        const tasks = new Map(state.tasks);
        const task = tasks.get(id);
        if (task) {
          tasks.set(id, { ...task, status: TaskStatus.Cancelled, completedAt: new Date() });
        }
        return updateLists({ ...state, tasks });
      });
    },

    clearCompleted: () => {
      update(state => {
        const tasks = new Map(state.tasks);
        state.completedTasks.forEach(id => tasks.delete(id));
        return updateLists({ ...state, tasks });
      });
    },

    reset: () => set(defaultState),
  };
}

export const taskStore = createTaskStore();

export const activeTaskList = derived(taskStore, $task =>
  $task.activeTasks.map(id => $task.tasks.get(id)).filter(Boolean) as TaskInfo[]
);

export const pendingTaskList = derived(taskStore, $task =>
  $task.pendingTasks.map(id => $task.tasks.get(id)).filter(Boolean) as TaskInfo[]
);

export const completedTaskList = derived(taskStore, $task =>
  $task.completedTasks.map(id => $task.tasks.get(id)).filter(Boolean) as TaskInfo[]
);

export const overallProgress = derived(taskStore, $task => {
  const tasks = Array.from($task.tasks.values());
  if (tasks.length === 0) return 0;
  const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(totalProgress / tasks.length);
});
