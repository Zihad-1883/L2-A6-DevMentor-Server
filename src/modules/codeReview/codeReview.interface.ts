export type CodeReviewTierType = "QUICK" | "DEEP";

export interface ICreateCodeReviewInput {
  tier: CodeReviewTierType;
  title: string;
  description: string;
  codeSnippet?: string;
  language?: string;
  githubRepoUrl?: string;
  branchName?: string;
  specificFiles?: string;
}

export interface IUpdateCodeSnippetInput {
  title?: string;
  description?: string;
  codeSnippet?: string;
  language?: string;
  githubRepoUrl?: string;
  branchName?: string;
  specificFiles?: string;
}

export interface ICodeReviewCommentInput {
  filePath: string;
  lineNumber: number;
  commentText: string;
  severity?: "BUG" | "SECURITY" | "SUGGESTION";
}

export interface ISubmitCodeReviewInput {
  summary: string;
  reviewedCodeSnippet?: string;
  videoUrl?: string;
  pullRequestUrl?: string;
  comments?: ICodeReviewCommentInput[];
}
