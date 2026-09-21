import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import { generateContent } from './scripts/content.mjs';
import { collectPageRoutes, writePageEntries } from './scripts/pages.mjs';

function contentPlugin(): Plugin {
  let root = process.cwd();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let outputDirectory = path.join(root, 'dist');
  let exportPages = false;
  let pageRoutes: string[] = [];

  const refresh = async (server?: { ws: { send: (message: { type: string }) => void } }) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      await generateContent(root);
      server?.ws.send({ type: 'full-reload' });
    }, 80);
  };

  return {
    name: 'leo-content-loader',
    async configResolved(config) {
      root = config.root;
      outputDirectory = path.resolve(root, config.build.outDir);
      exportPages = config.command === 'build' && config.build.write;
      await generateContent(root);
    },
    configureServer(server) {
      const watchedRoots = [path.join(root, 'spaces'), path.join(root, 'components')].map((directory) => path.resolve(directory));
      const isWatchedSource = (file: string) => {
        const absolute = path.resolve(file);
        return watchedRoots.some((directory) => absolute === directory || absolute.startsWith(`${directory}${path.sep}`));
      };
      server.watcher.add(watchedRoots);
      server.watcher.on('all', (event, file) => {
        if ((event === 'add' || event === 'change' || event === 'unlink') && isWatchedSource(file)) {
          void refresh(server);
        }
      });
    },
    async buildStart() {
      pageRoutes = collectPageRoutes(await generateContent(root));
    },
    async writeBundle() {
      if (exportPages) await writePageEntries(outputDirectory, pageRoutes);
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [contentPlugin(), mdx({ remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMath], rehypePlugins: [rehypeKatex, rehypeSlug] }), react()],
  server: { port: 5173 },
  build: { target: 'es2022' },
});
