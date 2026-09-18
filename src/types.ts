export interface ContentHeading {
  depth: number;
  text: string;
  id: string;
}

export interface ContentBreadcrumb {
  title: string;
  route: string;
}

export interface ContentEntry {
  spaceSlug: string;
  relativePath: string;
  sourcePath: string;
  route: string;
  kind: 'index' | 'doc';
  title: string;
  description: string;
  type: string;
  tags: readonly string[];
  date: string;
  order: number;
  draft: boolean;
  dirParts: readonly string[];
  headings: readonly ContentHeading[];
  body: string;
  updatedAt?: string;
  directoryRoute?: string;
  parentRoute?: string;
  directoryTitles?: readonly string[];
  breadcrumbs?: readonly ContentBreadcrumb[];
}

export interface Space {
  slug: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  hidden: boolean;
  entries: readonly ContentEntry[];
}
