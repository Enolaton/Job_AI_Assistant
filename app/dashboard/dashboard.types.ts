export type ViewType = 'dashboard' | 'workspace' | 'experience' | 'analysis' | 'interview';

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
