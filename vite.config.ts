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

function contentPlugin(): Plugin {
  let root = process.cwd();
  let timer: ReturnType<typeof setTimeout> | undefined;

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
      await generateContent(root);
    },
  };
}

export default defineConfig({
  plugins: [contentPlugin(), mdx({ remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMath], rehypePlugins: [rehypeKatex, rehypeSlug] }), react()],
  server: { port: 5173 },
  build: { target: 'es2022' },
});
