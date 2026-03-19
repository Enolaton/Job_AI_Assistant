export type ViewType = 'workspace' | 'experience' | 'analysis' | 'interview';

export interface Experience {
    id: number;
    title: string;
    tags: string | string[];
    date?: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    insight: string;
    insightTags?: string[];
    type?: string;
}

