import rss from '@astrojs/rss';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import Renderer from './_rss/ContentRenderer.astro';
import sanitize from 'sanitize-html';

const container = await AstroContainer.create({
  renderers: [
    { name: '@astrojs/mdx', serverEntrypoint: 'astro/jsx/server.js' },
  ],
});

export async function GET(context) {
  const posts = await getCollection('blog');
  return rss({
    // stylesheet: '/styles.xsl',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: await Promise.all(
      posts.map(async ({ data, slug }) => {
        let content = await container.renderToString(Renderer, {
          params: { slug },
        });
        // Sanitize HTML but allow for <img> tags.
        // TODO: make img `src` attributes absolute.
        content = sanitize(content, {
          allowedTags: sanitize.defaults.allowedTags.concat(['img']),
        });
        return { ...data, link: `/blog/${slug}/`, content };
      })
    ),
  });
}
