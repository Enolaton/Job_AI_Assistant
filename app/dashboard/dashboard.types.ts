export type ViewType = 'dashboard' | 'workspace' | 'experience' | 'analysis' | 'interview';

export interface Experience {
    id: string;
    title: string;
    tags: string[];
    date: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    insight: string;
    insightTags: string[];
    type: 'leadership' | 'tech' | 'conflict' | 'project';
}

export interface AnalysisReport {
    company: string;
    revenue: string;
    profit: string;
    growth: string;
    marketCap: string;
    jdKeywords: string[];
    missingKeywords: { name: string; level: 'required' | 'important' }[];
    suggestions: { title: string; content: string }[];
}
