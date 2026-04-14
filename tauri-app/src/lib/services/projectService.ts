import type { Project, ProjectInfo, Session, SessionLog, ProjectStats } from '$types/project';
import { createDefaultProject, createSession } from '$types/project';

const PROJECTS_STORAGE_KEY = 'clawcode_projects';
const SESSIONS_STORAGE_KEY = 'clawcode_sessions';

class ProjectService {
  private projects: Map<string, Project> = new Map();
  private sessions: Map<string, Session> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    this.loadFromStorage();
    this.initialized = true;
  }

  private loadFromStorage(): void {
    try {
      const projectsJson = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (projectsJson) {
        const projectsArray: Project[] = JSON.parse(projectsJson);
        this.projects = new Map(projectsArray.map(p => [p.id, p]));
      }

      const sessionsJson = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (sessionsJson) {
        const sessionsArray: Session[] = JSON.parse(sessionsJson);
        this.sessions = new Map(sessionsArray.map(s => [s.id, s]));
      }
    } catch (e) {
      console.error('Failed to load projects/sessions from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      const projectsArray = Array.from(this.projects.values());
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectsArray));

      const sessionsArray = Array.from(this.sessions.values());
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessionsArray));
    } catch (e) {
      console.error('Failed to save projects/sessions to storage:', e);
    }
  }

  async createProject(path: string, name?: string): Promise<Project> {
    const project = createDefaultProject(path, name);
    this.projects.set(project.id, project);
    this.saveToStorage();

    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
    } catch (e) {
      console.error('Failed to sync project to backend:', e);
    }

    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    return this.projects.get(id) || null;
  }

  async listProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort(
      (a, b) => b.lastAccessedAt - a.lastAccessedAt
    );
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    const project = this.projects.get(id);
    if (project) {
      const updated = { ...project, ...updates };
      this.projects.set(id, updated);
      this.saveToStorage();

      try {
        await fetch(`/api/projects/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch (e) {
        console.error('Failed to sync project update to backend:', e);
      }
    }
  }

  async deleteProject(id: string, keepConfig = false): Promise<void> {
    this.projects.delete(id);

    const sessionsToDelete = Array.from(this.sessions.values())
      .filter(s => s.projectId === id)
      .map(s => s.id);

    sessionsToDelete.forEach(sessionId => this.sessions.delete(sessionId));

    this.saveToStorage();

    try {
      await fetch(`/api/projects/${id}?keepConfig=${keepConfig}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.error('Failed to sync project deletion to backend:', e);
    }
  }

  async detectProjects(rootPath: string): Promise<ProjectInfo[]> {
    try {
      const response = await fetch(`/api/projects/detect?root=${encodeURIComponent(rootPath)}`);
      if (response.ok) {
        return response.json();
      }
    } catch (e) {
      console.error('Failed to detect projects from backend:', e);
    }

    return [];
  }

  async importExistingProject(path: string): Promise<Project> {
    const existingProject = Array.from(this.projects.values()).find(p => p.path === path);
    if (existingProject) {
      return existingProject;
    }

    return this.createProject(path);
  }

  async createSession(projectId: string, agentId: string, title?: string): Promise<Session> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const session = createSession(projectId, agentId, title);
    this.sessions.set(session.id, session);

    project.sessionCount++;
    project.lastAccessedAt = Date.now();
    this.projects.set(project.id, project);

    this.saveToStorage();

    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
    } catch (e) {
      console.error('Failed to sync session to backend:', e);
    }

    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async listSessions(projectId?: string): Promise<Session[]> {
    let sessions = Array.from(this.sessions.values());

    if (projectId) {
      sessions = sessions.filter(s => s.projectId === projectId);
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      const updated = { ...session, ...updates, updatedAt: Date.now() };
      this.sessions.set(id, updated);
      this.saveToStorage();
    }
  }

  async deleteSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      const project = this.projects.get(session.projectId);
      if (project) {
        project.sessionCount = Math.max(0, project.sessionCount - 1);
        this.projects.set(project.id, project);
      }

      this.sessions.delete(id);
      this.saveToStorage();
    }
  }

  async getSessionLogs(sessionId: string): Promise<SessionLog[]> {
    const session = this.sessions.get(sessionId);
    return session?.logs || [];
  }

  async addSessionLog(
    sessionId: string,
    level: SessionLog['level'],
    source: SessionLog['source'],
    message: string,
    details?: Record<string, any>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const log: SessionLog = {
        id: crypto.randomUUID(),
        sessionId,
        timestamp: Date.now(),
        level,
        source,
        message,
        details,
      };

      session.logs.push(log);
      session.updatedAt = Date.now();
      this.sessions.set(sessionId, session);
      this.saveToStorage();
    }
  }

  async getProjectStats(): Promise<ProjectStats> {
    const projects = Array.from(this.projects.values());
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => s.status === 'active');

    let lastActivityAt = 0;
    sessions.forEach(s => {
      if (s.updatedAt > lastActivityAt) {
        lastActivityAt = s.updatedAt;
      }
    });

    return {
      totalProjects: projects.length,
      activeSessions: activeSessions.length,
      totalConversations: sessions.length,
      lastActivityAt,
    };
  }

  async updateLastAccessed(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      project.lastAccessedAt = Date.now();
      this.projects.set(projectId, project);
      this.saveToStorage();
    }
  }
}

export const projectService = new ProjectService();
