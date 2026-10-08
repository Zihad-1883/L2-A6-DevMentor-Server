export interface IUpdateUserProfileInput {
  name?: string;
  image?: string | null;
  bio?: string;
  techStackTags?: string[];
  githubUrl?: string | null;
  resumeUrl?: string | null;
}
